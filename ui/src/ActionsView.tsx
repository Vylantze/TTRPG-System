import { useMemo, useState } from 'react';
import { spellGroups, featureRollInstances, useAbility as activateAbility, type Character, type Engine, type EvaluationResult } from '@/src/index';
import { FeatureLink } from '@/ui/src/FeatureLink';
import { FeatureRolls } from '@/ui/src/FeatureRolls';
import { Tooltip } from '@/ui/src/Tooltip';
import { EquippedAttacks } from '@/ui/src/EquippedAttacks';

export function ActionsView({ engine, character, result, update, report }: { engine: Engine; character: Character; result: EvaluationResult; update: (character: Character) => void; report: (message: string) => void }) {
  const [category, setCategory] = useState('');
  const [modes, setModes] = useState<Record<string, string>>({});
  const settings = engine.catalogue.system.sheetDisplay?.actions;
  const spells = useMemo(() => spellGroups(engine, result), [engine, result]);
  const spellIds = new Set(spells.flatMap((spell) => spell.modes.map((mode) => mode.capability.id)));
  const companions = result.instances.filter((instance) => engine.getFeature(instance.feature)?.companion).map((instance) => instance.id);
  const kinds = settings?.categories?.find((entry) => entry.id === category)?.kinds;
  const capabilities = result.capabilities.filter((capability) => capability.definition.name !== engine.catalogue.system.commandRules?.selectedRecovery?.capabilityName && !spellIds.has(capability.id) && !companions.some((id) => capability.source === id || capability.source.startsWith(`${id}/`)) && (!kinds || kinds.includes(capability.definition.action?.kind ?? '')));
  const ready = character.buildState !== 'draft' && result.status === 'valid';
  const activate = (id: string) => {
    try {
      update(activateAbility(engine, character, id, crypto.randomUUID(), { actionTracking: 'manual' }).character);
    } catch (error) { report(error instanceof Error ? error.message : String(error)); }
  };
  return (
    <section className="actions-view">
      <div className="row">
        <h2>Actions</h2>
        <label>
          Action category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All actions</option>
            {settings?.categories?.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
        </label>
      </div>
      <div className="sheet-table-wrap">
        <table className="sheet-table action-table">
          <thead>
            <tr>
              <th>Ability or spell</th>
              <th>Timing</th>
              {settings?.columns?.map((column) => <th key={column.metadataKey}>{column.name}</th>)}
              <th>Cost / remaining</th>
              <th>Use</th>
            </tr>
          </thead>
          <tbody>
            {capabilities.map((capability) => {
              const feature = engine.getFeature(result.instances.find((instance) => instance.id === capability.source)!.feature)!;
              const rolls = featureRollInstances(engine, result, feature.id).some((instance) => engine.getFeature(instance.feature)?.roll?.capability === capability.definition.name);
              return (
                <tr key={capability.id}>
                  <th><FeatureLink id={feature.id} engine={engine}>{capability.definition.name}</FeatureLink></th>
                  <td>{capability.definition.action?.kind ?? 'Special'}</td>
                  {settings?.columns?.map((column) => <td key={column.metadataKey}>{String(capability.definition.metadata?.[column.metadataKey] ?? '—')}</td>)}
                  <td>{Object.entries(capability.costs).map(([id, amount]) => `${amount} ${result.resources[id]?.name ?? 'resource'} · ${result.resources[id]?.available ?? 0} remaining`).join(' / ') || 'At will'}</td>
                  <td>{rolls ? <FeatureRolls feature={feature} instanceId={capability.source} engine={engine} /> : <button disabled={!ready || Object.entries(capability.costs).some(([id, amount]) => (result.resources[id]?.available ?? 0) < amount)} onClick={() => activate(capability.id)}>Use Ability</button>}</td>
                </tr>
              );
            })}
            {spells.filter((spell) => !kinds || spell.modes.some((mode) => kinds.includes(mode.capability.definition.action?.kind ?? ''))).map((spell) => {
              const options = spell.modes.filter((mode) => !kinds || kinds.includes(mode.capability.definition.action?.kind ?? ''));
              const selected = options.find((mode) => mode.capability.id === modes[spell.id]) ?? options.find((mode) => mode.available) ?? options[0];
              const feature = engine.getFeature(spell.feature)!;
              const rolls = featureRollInstances(engine, result, spell.feature).length > 0;
              const costs = Object.entries(selected.capability.costs);
              return (
                <tr key={spell.id}>
                  <th>
                    <FeatureLink id={spell.feature} engine={engine}>{spell.name}</FeatureLink>
                    <small>{`Level ${spell.level} · ${spell.castingAbility}`}</small>
                  </th>
                  <td>{selected.capability.definition.action?.kind ?? 'Special'}</td>
                  {settings?.columns?.map((column) => <td key={column.metadataKey}>{String(selected.capability.definition.metadata?.[column.metadataKey] ?? '—')}</td>)}
                  <td>
                    <select aria-label={`Casting option for ${spell.name}`} value={selected.capability.id} onChange={(event) => setModes({ ...modes, [spell.id]: event.target.value })}>
                      {options.map((mode) => (
                        <option value={mode.capability.id} key={mode.capability.id}>
                          {mode.ritual ? 'Ritual' : mode.slotLevel ? `Level ${mode.slotLevel} slot` : (engine.catalogue.system.sheetDisplay?.spells?.zeroLevelName ?? 'Level 0 spell')}
                          {mode.available ? '' : ' · none remaining'}
                        </option>
                      ))}
                    </select>
                    {costs.map(([id, amount]) => <small key={id}>{`${amount} ${result.resources[id]?.name ?? 'resource'} · ${result.resources[id]?.available ?? 0} remaining`}</small>)}
                  </td>
                  <td>{rolls ? <FeatureRolls feature={feature} engine={engine} castingCapability={selected.capability.id} /> : costs.some(([, amount]) => amount > 0) ? <button disabled={!ready || !selected.available} onClick={() => activate(selected.capability.id)}>Use Spell</button> : <Tooltip text="This spell has no supported roll or resource cost"><span className="muted small">At will</span></Tooltip>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!capabilities.length && !spells.some((spell) => !kinds || spell.modes.some((mode) => kinds.includes(mode.capability.definition.action?.kind ?? ''))) && <p className="muted">No abilities or spells in this category.</p>}
      {!category && <EquippedAttacks engine={engine} character={character} result={result} />}
    </section>
  );
}
