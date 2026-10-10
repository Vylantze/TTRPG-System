import { MoneySection } from '@/ui/src/MoneySection';
import { Inventory } from '@/ui/src/Inventory';
import { EquipmentEffects } from '@/ui/src/EquipmentEffects';
import { CompanionPanels } from '@/ui/src/CompanionPanels';
import { orderedSheetTabs, moveSheetTab } from '@/ui/src/sheet-tabs';
import { LoadingOverlay } from '@/ui/src/LoadingOverlay';
import { HitPoints } from '@/ui/src/HitPoints';
import { CharacterDetails } from '@/ui/src/CharacterDetails';
import { SheetSectionView } from '@/ui/src/SheetSectionView';
import type { SheetTab } from '@/src/model/SheetTab';
import { CharacterRuleContext } from '@/ui/src/character-rule-context';
import { FeatureRolls } from '@/ui/src/FeatureRolls';
import { SpellBook } from '@/ui/src/SpellBook';
import { CharacterSheet } from '@/ui/src/CharacterSheet';
import { FeatureLink } from '@/ui/src/FeatureLink';
import { CharacterFeatures } from '@/ui/src/CharacterFeatures';
import { featureName } from '@/ui/src/display';
import { useMemo, useState, useTransition } from 'react';
import { clearFeatureRolls, featureRollInstances, reopenCharacter, spellGroups, spellSlotPools, adjustResource, applyEdit, previewEdit, finalizeCharacter, recoverSelectedResources, settleAbility, useAbility as activateAbility, type Engine, type Character, type Edit, type EditPreview } from '@/src/index';
import { labelFromId } from '@/ui/src/workspace';
import { SelectionCard } from '@/ui/src/SelectionCard';
import { Modal } from '@/ui/src/Modal';
import { FeatureRules, RulesText } from '@/ui/src/RulesText';
import { ResourceSummary } from '@/ui/src/ResourceSummary';

export function CharacterBuilder({ engine, character, update, openFeature, report }: { engine: Engine; character: Character; update: (c: Character) => void; openFeature: (id: string) => void; report: (message: string) => void }) {
  const systemTabs: SheetTab[] = engine.catalogue.system.sheetTabs ?? [
    { id: 'choices', name: 'Build & choices', content: 'choices' },
    { id: 'stats', name: 'Character sheet', content: 'sheet' },
    { id: 'items', name: 'Items', content: 'items' },
    { id: 'features', name: 'Features & traits', content: 'features' },
    { id: 'resources', name: 'Abilities & resources', content: 'resources' },
    { id: 'notes', name: 'Notes', content: 'notes' },
  ];
  const tabs = orderedSheetTabs(systemTabs, character.tabOrder);
  const [orderingTabs, setOrderingTabs] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [changingTab, startTabChange] = useTransition();
  const result = useMemo(() => engine.evaluate(character), [engine, character]);
  const [tab, setTab] = useState(() => {
      const requested = typeof window !== 'undefined' ? new URLSearchParams(window.location.hash.split('?')[1]).get('view') : null;
      return requested && tabs.some((entry) => entry.id === requested) ? requested : (tabs.find((entry) => entry.content === (character.buildState === 'finalized' ? 'sheet' : 'choices')) ?? tabs[0])?.id;
    }), [level, setLevel] = useState('all'), [classId, setClassId] = useState(engine.catalogue.classes[0]?.id ?? '');
  const currentTab = tabs.find((entry) => entry.id === tab) ?? tabs[0];
  const [preview, setPreview] = useState<{ edits: Edit[]; result: EditPreview } | null>(null);
  const attempt = (action: () => void) => {
    try {
      action();
    } catch (e) {
      report(e instanceof Error ? e.message : String(e));
    }
  };
  const edit = (edits: Edit[]) => attempt(() => {
    if (character.buildState === 'draft') update(applyEdit(engine, character, edits, crypto.randomUUID()));
    else setPreview({ edits, result: previewEdit(engine, character, edits) });
  });
  const slots = result.selections.filter((s) => level === 'all' || (s.id.startsWith('advancement/') ? 'origins' : s.id.match(/^class\/[^/]+\/(\d+)/)?.[1] ?? 'extra') === level);
  const levels = [...new Set(result.selections.map((s) => s.id.startsWith('advancement/') ? 'origins' : s.id.match(/^class\/[^/]+\/(\d+)/)?.[1] ?? 'extra'))].sort((a, b) => Number(a) - Number(b));
  const inputs = engine.catalogue.system.stats.filter((s) => s.kind === 'input');
  const incomplete = result.diagnostics.filter((d) => d.severity === 'incomplete').length;
  const ready = character.buildState !== 'draft' && result.status === 'valid';
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const spells = spellGroups(engine, result);
  const spellIds = new Set(spells.flatMap((spell) => spell.modes.map((mode) => mode.capability.id)));
  const slotIds = new Set(spellSlotPools(engine, result).map(({ pool }) => pool.id));
  const companionOwners = result.instances.filter((instance) => engine.getFeature(instance.feature)?.companion).map((instance) => instance.id);
  const abilities = result.capabilities.filter((capability) => !companionOwners.some((id) => capability.source === id || capability.source.startsWith(`${id}/`)) && !spellIds.has(capability.id) && !engine.getFeature(result.instances.find((instance) => instance.id === capability.source)!.feature)?.tags?.includes(engine.catalogue.system.healingFeaturesTag ?? ''));
  const resource = (id: string) => result.resources[id] && <ResourceSummary key={id} pool={result.resources[id]} engine={engine} result={result} ready={ready} adjust={(delta) => attempt(() => update(adjustResource(engine, character, id, delta, crypto.randomUUID())))} />;
  const ability = (c: (typeof result.capabilities)[number]) => {
    const sourceFeature = engine.getFeature(result.instances.find((instance) => instance.id === c.source)!.feature)!;
    const recovery = c.definition.name === engine.catalogue.system.commandRules?.selectedRecovery?.capabilityName;
    return (
      <article className="panel ability-row" key={c.id}>
        <div className="ability-main">
          <div className="ability-description">
            <h3>{c.definition.name}</h3>
            <p className="muted small">{c.definition.action ? `${c.definition.action.amount} ${labelFromId(c.definition.action.kind)}` : 'No action cost'}</p>
            <details>
              <summary>Read source rules</summary>
              <FeatureRules showRolls={false} feature={engine.getFeature(result.instances.find((instance) => instance.id === c.source)!.feature)!} engine={engine} openFeature={openFeature} />
            </details>
            <FeatureLink id={result.instances.find((instance) => instance.id === c.source)!.feature} engine={engine}>View source Feature →</FeatureLink>
          </div>
          <div className="ability-controls">
            {Object.keys(c.costs).map(resource)}
            {featureRollInstances(engine, result, sourceFeature.id).some((instance) => engine.getFeature(instance.feature)?.roll?.capability === c.definition.name) ? <FeatureRolls instanceId={c.source} feature={sourceFeature} engine={engine} /> : <button disabled={!ready || Object.entries(c.costs).some(([id, amount]) => (result.resources[id]?.available ?? 0) < amount)} onClick={() => recovery ? setRecoveryOpen(!recoveryOpen) : attempt(() => update(activateAbility(engine, character, c.id, crypto.randomUUID(), { actionTracking: 'manual' }).character))}>Use Ability</button>}
          </div>
        </div>
        {recovery && recoveryOpen && <SelectedRecovery engine={engine} character={character} ready={ready} update={update} report={report} />}
      </article>
    );
  };
  return (
    <CharacterRuleContext.Provider value={{ character, result, update, report }}>
      <div className="character-title">
        <div>
          <p className="eyebrow">Character workspace</p>
          <input
            className="name-input"
            aria-label="Character name"
            key={character.id}
            defaultValue={character.name}
            onBlur={(e) => {
              const name = e.target.value.trim() || 'Unnamed character';
              e.target.value = name;
              if (name !== character.name) update({ ...character, name });
            }}
          />
          <p className="muted">
            {engine.catalogue.system.name}
            {' '}
            {'· level '}
            {' '}
            {result.characterLevel}
          </p>
        </div>
        <button aria-expanded={showSummary || result.status === 'invalid'} aria-controls="build-summary" onClick={() => setShowSummary(!showSummary)} className={`badge ${result.status}`}>{result.status === 'valid' && character.buildState === 'draft' ? 'Ready to finalize' : result.status}</button>
      </div>
      {(showSummary || result.status === 'invalid') && (
        <div id="build-summary" className="summary-strip">
          <div>
            <span>Selections</span>
            <strong>{result.selections.reduce((n, s) => n + s.picks.length, 0)}</strong>
          </div>
          <div>
            <span>Open requirements</span>
            <strong>{result.diagnostics.length}</strong>
          </div>
          <div>
            <span>Acquired Features</span>
            <strong>{result.instances.filter((i) => i.active && i.eligible).length}</strong>
          </div>
          <div>
            <span>Resource pools</span>
            <strong>{Object.keys(result.resources).length}</strong>
          </div>
        </div>
      )}
      {changingTab && <LoadingOverlay />}
      <button className="link reorder-tabs" aria-expanded={orderingTabs} onClick={() => setOrderingTabs(!orderingTabs)}>{orderingTabs ? 'Done arranging tabs' : 'Rearrange tabs'}</button>
      {orderingTabs && (
        <div className="panel tab-order-editor">
          {tabs.map((entry, index) => (
            <div className="row" key={entry.id}>
              <span>{entry.name}</span>
              <div className="toolbar">
                <button className="quiet" aria-label={`Move ${entry.name} left`} disabled={index === 0} onClick={() => update({ ...character, tabOrder: moveSheetTab(tabs.map((tab) => tab.id), entry.id, -1) })}>←</button>
                <button className="quiet" aria-label={`Move ${entry.name} right`} disabled={index === tabs.length - 1} onClick={() => update({ ...character, tabOrder: moveSheetTab(tabs.map((tab) => tab.id), entry.id, 1) })}>→</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <nav className="subnav" aria-label="Character sections">
        {tabs.map(({ id, name }) => (
          <button
            key={id}
            className={tab === id ? 'active' : ''}
            onClick={() => {
              startTabChange(() => setTab(id));
              const [path, search] = window.location.hash.split('?');
              const params = new URLSearchParams(search);
              params.set('view', id);
              window.history.replaceState(null, '', `${path}?${params}`);
            }}
          >
            {name}
          </button>
        ))}
      </nav>
      {result.diagnostics.length > 0 && (
        <details className="diagnostics" open={result.status === 'invalid'}>
          <summary>{result.status === 'invalid' ? 'Build needs repair' : `${incomplete} requirements to finish`}</summary>
          <ul>
            {result.diagnostics.map((d, i) => (
              <li key={i}>
                <strong>{d.message}</strong>
                <small>{d.path}</small>
              </li>
            ))}
          </ul>
          <p>Totals are provisional until every requirement is satisfied.</p>
        </details>
      )}
      {currentTab?.content === 'choices' && (
        <div className="builder-grid">
          <aside className="builder-setup">
            <section className="panel">
              <h3>{`${engine.catalogue.system.terminology?.classSingular ?? 'Class'} progression`}</h3>
              {character.progressions.map((p) => {
                const cls = engine.catalogue.classes.find((c) => c.id === p.class);
                return cls?.description
                  ? (
                      <details key={`rules:${p.id}`}>
                        <summary>
                          {'Read '}
                          {cls.name}
                          {' '}
                          {`${engine.catalogue.system.terminology?.classSingular ?? 'Class'} rules`}
                        </summary>
                        <RulesText text={cls.description} source={cls.source} engine={engine} openFeature={openFeature} />
                      </details>
                    )
                  : null;
              })}
              {character.progressions.map((p) => (
                <label key={p.id}>
                  {engine.catalogue.classes.find((c) => c.id === p.class)?.name ?? p.class}
                  <input
                    type="number"
                    key={`${p.id}:${p.level}`}
                    min="0"
                    max={engine.catalogue.classes.find((c) => c.id === p.class)?.maximumLevel}
                    defaultValue={p.level}
                    onBlur={(e) => {
                      if (e.target.value === '')e.target.value = String(p.level);
                      if (Number(e.target.value) !== p.level)edit([{ kind: 'level', progression: p.id, level: Number(e.target.value) }]);
                    }}
                  />
                  {character.buildState === 'draft' && <button className="link" onClick={() => edit([{ kind: 'removeProgression', progression: p.id }])}>Remove progression</button>}
                </label>
              ))}
              {engine.catalogue.classes.length > 0 && (
                <>
                  <label>
                    Add a class
                    <select value={classId} onChange={(e) => setClassId(e.target.value)}>{engine.catalogue.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  </label>
                  <button className="quiet full" disabled={(!engine.catalogue.system.allowMultipleClasses && character.progressions.length > 0) || (engine.catalogue.system.allowDuplicateClasses === false && character.progressions.some((p) => p.class === classId))} onClick={() => edit([{ kind: 'addProgression', progression: { id: crypto.randomUUID(), class: classId, level: 1 } }])}>Add progression</button>
                </>
              )}
              {!engine.catalogue.system.allowMultipleClasses && <p className="muted small">{`This configuration permits one ${(engine.catalogue.system.terminology?.classSingular ?? 'Class').toLowerCase()} progression.`}</p>}
              <details>
                <summary>Advancement history</summary>
                <ol>
                  {character.history.map((h, i) => (
                    <li key={i}>
                      {engine.catalogue.classes.find((c) => c.id === character.progressions.find((p) => p.id === h.progression)?.class)?.name}
                      {' '}
                      {h.level}
                    </li>
                  ))}
                </ol>
              </details>
            </section>
            <section className="panel">
              <h3>Basic stats</h3>
              {inputs.map((s) => (
                <label key={s.id}>
                  {s.name}
                  <input
                    key={`${character.id}:${s.id}:${character.inputs[s.id]}`}
                    type="number"
                    defaultValue={character.inputs[s.id] ?? ''}
                    min={s.minimum}
                    max={s.maximum}
                    step={s.integer ? 1 : 'any'}
                    onBlur={(e) => {
                      if (e.target.value === '')e.target.value = String(character.inputs[s.id] ?? '');
                      if (e.target.value !== '' && Number(e.target.value) !== character.inputs[s.id])edit([{ kind: 'input', stat: s.id, value: Number(e.target.value) }]);
                    }}
                  />
                </label>
              ))}
            </section>
          </aside>
          <section>
            <div className="row">
              <h2>Feature selections</h2>
              <label className="compact">
                Show
                <select aria-label="Filter selections by level" value={level} onChange={(e) => setLevel(e.target.value)}>
                  <option value="all">All levels</option>
                  {levels.map((l) => <option value={l} key={l}>{l === 'origins' ? 'Origins' : l === 'extra' ? 'Additional Features' : `${engine.catalogue.system.terminology?.classSingular ?? 'Class'} level ${l}`}</option>)}
                </select>
              </label>
            </div>
            <p className="muted">Each slot is independent. Choose a Feature to reveal its parameters and nested choices.</p>
            {slots.map((slot) => {
              const owner = result.instances.find((i) => i.id === slot.owner), name = owner ? featureName(engine.catalogue.features.find((f) => f.id === owner.feature)) : undefined;
              return <SelectionCard key={slot.id} slot={slot} engine={engine} character={character} edit={edit} openFeature={openFeature} ownerName={name} />;
            })}
            {!slots.length && <p>No selections at this level.</p>}
            <details className="panel">
              <summary>Additional root Features</summary>
              <p className="muted">Add supported extra acquisitions from this System. Engine prerequisites and resource rules still apply.</p>
              <RootPicker engine={engine} character={character} edit={edit} level={result.characterLevel} />
              {character.roots.map((root) => (
                <div className="row" key={root.id}>
                  <FeatureLink className="link" id={root.feature} engine={engine}>{featureName(engine.catalogue.features.find((f) => f.id === root.feature))}</FeatureLink>
                  <button className="quiet" onClick={() => edit([{ kind: 'removeRoot', id: root.id }])}>Remove</button>
                </div>
              ))}
            </details>
            {character.buildState === 'draft' && (
              <div className="finalize">
                <p>{result.status === 'valid' ? 'All requirements are met. Finalize to use abilities and resources.' : 'Drafts are saved as you work. Finish the requirements to finalize.'}</p>
                <button disabled={result.status !== 'valid'} onClick={() => attempt(() => update(finalizeCharacter(engine, character, crypto.randomUUID())))}>Finalize character</button>
              </div>
            )}
          </section>
        </div>
      )}
      {currentTab?.content === 'items' && (
        <>
          <MoneySection engine={engine} character={character} update={update} report={report} />
          <Inventory engine={engine} character={character} update={update} report={report} />
          <EquipmentEffects engine={engine} character={character} result={result} update={update} report={report} />
        </>
      )}
      {currentTab?.content === 'notes' && <CharacterDetails notes engine={engine} character={character} result={result} update={update} />}
      {currentTab?.content === 'sections' && (engine.catalogue.system.sheetSections ?? []).filter((section) => currentTab.sections?.includes(section.id)).map((section) => <SheetSectionView key={section.id} section={section} engine={engine} character={character} result={result} update={update} />)}
      {currentTab?.content === 'sheet' && <CharacterSheet sectionIds={currentTab.sections} engine={engine} character={character} result={result} update={update} report={report} />}
      {currentTab?.content === 'features' && <CharacterFeatures engine={engine} character={character} result={result} openFeature={openFeature} />}
      {currentTab?.content === 'resources' && (
        <>
          <HitPoints engine={engine} character={character} result={result} update={update} report={report} />
          <CompanionPanels engine={engine} character={character} result={result} update={update} report={report} />
          <div className="toolbar">

            {Boolean(character.rollResults?.length) && <button className="quiet" onClick={() => update(clearFeatureRolls(character))}>Clear all rolls</button>}
          </div>
          <h2>Abilities</h2>
          <div className="ability-list">{abilities.map(ability)}</div>
          {Object.values(result.resources).filter((pool) => pool.key !== 'hit-points' && !result.instances.some((instance) => engine.getFeature(instance.feature)?.companion?.resources.includes(pool.key)) && !Object.values(engine.catalogue.system.recoveryAllocations ?? {}).some((policy) => policy.keys.includes(pool.key)) && !slotIds.has(pool.id) && !abilities.some((capability) => Object.hasOwn(capability.costs, pool.id))).map((pool) => <div className="standalone-resource" key={pool.id}>{resource(pool.id)}</div>)}
          <SpellBook engine={engine} character={character} result={result} ready={ready} update={update} report={report} />
          {Object.entries(character.pending).map(([id, pending]) => (
            <section className="panel" key={id}>
              <h3>Resolve reserved ability use</h3>
              <p className="muted small">{id}</p>
              <div className="toolbar">
                {pending.spendOnOutcomes.map((outcome) => (
                  <button className="quiet" key={outcome} disabled={!ready} onClick={() => attempt(() => update(settleAbility(character, id, outcome, crypto.randomUUID())))}>
                    {labelFromId(outcome)}
                    {' '}
                    · consume
                  </button>
                ))}
                <button
                  className="quiet"
                  disabled={!ready}
                  onClick={() => attempt(() => {
                    const release = `release:${crypto.randomUUID()}`;
                    update(settleAbility(character, id, release, crypto.randomUUID()));
                  })}
                >
                  Release reservation
                </button>
              </div>
            </section>
          ))}
        </>
      )}
      {character.buildState !== 'draft' && (
        <button
          className="quiet"
          onClick={() => attempt(() => {
            update(reopenCharacter(engine, character, crypto.randomUUID()));
            setTab(tabs.find((entry) => entry.content === 'choices')?.id ?? tabs[0]?.id);
          })}
        >
          Edit build
        </button>
      )}
      {preview && (
        <Modal title="Review build change" onClose={() => setPreview(null)}>
          <p>
            {preview.result.added.length}
            {' '}
            {'Features added · '}
            {' '}
            {preview.result.removed.length}
            {' '}
            removed
          </p>
          <p>
            {'Stats affected: '}
            {preview.result.changedStats.map(labelFromId).join(', ') || 'None'}
          </p>
          <p>
            {'Resource pools affected: '}
            {preview.result.changedResources.length}
          </p>
          <p>
            {'Result: '}
            {preview.result.after.status}
            . Dependent choices may need repair.
          </p>
          <div className="toolbar">
            <button onClick={() => attempt(() => {
              update(applyEdit(engine, character, preview.edits, crypto.randomUUID()));
              setPreview(null);
            })}
            >
              Apply change
            </button>
            <button className="quiet" onClick={() => setPreview(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </CharacterRuleContext.Provider>
  );
}
function SelectedRecovery({ engine, character, ready, update, report }: { engine: Engine; character: Character; ready: boolean; update: (c: Character) => void; report: (message: string) => void }) {
  const policy = engine.catalogue.system.commandRules!.selectedRecovery!;
  const [counts, setCounts] = useState<Record<string, number>>({}), [rest, setRest] = useState('');
  const result = engine.evaluate(character);
  const events = character.events.filter((e) => {
    try {
      const data = JSON.parse(e.fingerprint);
      return data.kind === 'recover' && data.recoveryEvent === policy.requiredEvent;
    } catch {
      return false;
    }
  });
  return (
    <section className="panel">
      <h3>{policy.capabilityName}</h3>
      <p className="muted small">
        {'Recovery budget: '}
        {result.stats[policy.budgetStat].value}
        . Targets use the weights declared by this System.
      </p>
      <label>
        {'Completed '}
        {labelFromId(policy.requiredEvent)}
        <select value={rest} onChange={(e) => setRest(e.target.value)}>
          <option value="">Choose a recorded event…</option>
          {events.map((e, i) => (
            <option key={e.id} value={e.id}>
              {'Event '}
              {i + 1}
              {' '}
              {'· '}
              {e.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>
      <div className="input-grid">
        {Object.entries(policy.targets).map(([id, target]) => {
          const pool = Object.values(result.resources).find((p) => p.key === target.key && p.scope === target.scope);
          return (
            <label key={id}>
              {labelFromId(target.key)}
              {' '}
              {'· weight '}
              {' '}
              {target.weight}
              <input type="number" min="0" max={pool?.spent ?? 0} step="1" value={counts[id] ?? 0} onChange={(e) => setCounts({ ...counts, [id]: Number(e.target.value) })} />
            </label>
          );
        })}
      </div>
      <button
        className="quiet"
        disabled={!ready || !rest}
        onClick={() => {
          try {
            update(recoverSelectedResources(engine, character, Object.fromEntries(Object.entries(counts).filter(([,n]) => n !== 0)), rest, crypto.randomUUID()));
            setCounts({});
          } catch (e) {
            report(e instanceof Error ? e.message : String(e));
          }
        }}
      >
        Recover allocation
      </button>
    </section>
  );
}
function RootPicker({ engine, character, edit, level }: { engine: Engine; character: Character; edit: (e: Edit[]) => void; level: number }) {
  const [query, setQuery] = useState(''), [selected, setSelected] = useState('');
  const policy = engine.catalogue.system.rootCandidates;
  const choices = engine.catalogue.features.filter((f) => (!policy?.ids || policy.ids.includes(f.id)) && (!policy?.tags || policy.tags.every((t) => f.tags?.includes(t))) && featureName(f).toLowerCase().includes(query.toLowerCase())).slice(0, 50);
  return (
    <>
      <label>
        Find additional Feature
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected('');
          }}
        />
      </label>
      <label>
        Feature
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Choose…</option>
          {choices.map((f) => <option value={f.id} key={f.id}>{featureName(f)}</option>)}
        </select>
      </label>
      <button className="quiet" disabled={!selected} onClick={() => edit([{ kind: 'root', acquisition: { id: crypto.randomUUID(), feature: selected, acquiredCharacterLevel: level, ...(character.history.length ? { acquiredEvent: character.history.length - 1 } : {}) } }])}>Add Feature</button>
    </>
  );
}
