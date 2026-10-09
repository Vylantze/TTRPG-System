import { featureName, tagName } from '@/ui/src/display';
import { useMemo, useState } from 'react';
import { type Engine, type Character, type Edit, type SelectionResult, type Value } from '@/src/index';
import { labelFromId } from '@/ui/src/workspace';
import { FeatureRules, RulesText } from '@/ui/src/RulesText';
import { descriptionPreview, featureDescription } from '@/ui/src/feature-description';

import { FeatureRequirements } from '@/ui/src/FeatureRequirements';

const PAGE = 12;
export function SelectionCard({ slot, engine, character, edit, openFeature, ownerName }: { slot: SelectionResult; engine: Engine; character: Character; edit: (edits: Edit[]) => void; openFeature: (id: string) => void; ownerName?: string }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [page, setPage] = useState(0), [event, setEvent] = useState('');
  const definitions = engine.catalogue.features;
  const [listMode, setListMode] = useState(false);
  const [option, setOption] = useState('');
  const pool = useMemo(() => engine.getSelectionFeatures(slot.definition), [engine, slot.definition]);
  const title = ownerName ? `${ownerName} · ${labelFromId(slot.definition.id)}` : labelFromId(slot.definition.id);
  const matches = useMemo(() => pool.filter((f) => `${featureName(f)} ${f.name} ${f.tags?.map((tag) => tagName(engine.catalogue.system, tag)).join(' ') ?? ''}`.toLowerCase().includes(query.toLowerCase())), [pool, query, engine.catalogue.system]);
  const visible = useMemo(() => listMode ? matches.slice(page * PAGE, (page + 1) * PAGE) : matches.filter((f) => f.id === option), [matches, page, listMode, option]);
  const candidates = useMemo(() => open ? engine.getCandidates(character, slot.id, {}, { features: visible.map((f) => f.id) }) : [], [engine, character, slot.id, open, visible]);
  const picks = character.selections[slot.id] ?? [];
  const update = (next: typeof picks) => edit([{ kind: 'select', selection: slot.id, picks: next, ...(event ? { event } : {}) }]);
  const missing = Math.max(0, slot.minimum - picks.length);
  return (
    <details className={`selection-card ${missing ? 'needs-choice' : ''}`} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <span>{title}</span>
        <span className={`badge ${missing ? 'incomplete' : 'valid'}`}>
          {picks.length}
          {' '}
          {'/ '}
          {' '}
          {slot.minimum === slot.maximum ? slot.maximum : `${slot.minimum}–${slot.maximum}`}
        </span>
      </summary>
      <p className="muted small">{slot.id}</p>
      <button className="quiet" aria-pressed={listMode} onClick={() => setListMode(!listMode)}>{listMode ? 'Use dropdown' : 'Use list'}</button>
      {slot.definition.ignorePrerequisites && <p className="notice">Ordinary prerequisites are waived here. Resource requirements still apply.</p>}
      {slot.definition.retraining?.events?.length
        ? (
            <label>
              Replacement event
              <select value={event} onChange={(e) => setEvent(e.target.value)}>
                <option value="">Initial selection</option>
                {slot.definition.retraining.events.map((e) => <option key={e} value={e}>{labelFromId(e)}</option>)}
              </select>
            </label>
          )
        : null}
      {picks.map((p) => {
        const feature = definitions.find((f) => f.id === p.feature);
        return (
          <div className="picked" key={p.id}>
            <div className="row">
              <button className="link" onClick={() => openFeature(p.feature)}>{featureName(feature)}</button>
              <button className="quiet" aria-label={`Remove ${featureName(feature)}`} onClick={() => update(picks.filter((x) => x.id !== p.id))}>Remove</button>
            </div>
            {feature
              ? (
                  <details>
                    <summary>Read Feature rules</summary>
                    <FeatureRequirements feature={feature} engine={engine} />
                    <FeatureRules feature={feature} engine={engine} openFeature={openFeature} />
                  </details>
                )
              : null}
            {feature?.parameters && (
              <div className="input-grid">
                {Object.entries(feature.parameters).map(([key, parameter]) => {
                  const value = p.parameters?.[key] ?? parameter.default;
                  const change = (value: Value) => update(picks.map((x) => x.id === p.id ? { ...x, parameters: { ...x.parameters, [key]: value } } : x));
                  return (
                    <label key={key}>
                      {labelFromId(key)}
                      {parameter.options
                        ? (
                            <select value={String(value ?? '')} onChange={(e) => change(parameter.options!.find((v) => String(v) === e.target.value)!)}>
                              <option value="" disabled>Choose…</option>
                              {parameter.options.map((v) => <option key={String(v)} value={String(v)}>{String(v)}</option>)}
                            </select>
                          )
                        : parameter.kind === 'boolean'
                          ? (
                              <select value={String(value ?? '')} onChange={(e) => change(e.target.value === 'true')}>
                                <option value="" disabled>Choose…</option>
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                              </select>
                            )
                          : (
                              <input
                                key={`${p.id}:${key}:${String(value)}`}
                                type={parameter.kind === 'number' ? 'number' : 'text'}
                                defaultValue={value === undefined ? '' : String(value)}
                                min={parameter.minimum}
                                max={parameter.maximum}
                                step={parameter.integer ? 1 : 'any'}
                                onBlur={(e) => {
                                  if (e.target.value === '')e.target.value = value === undefined ? '' : String(value);
                                  if (e.target.value !== '' && e.target.value !== String(value)) change(parameter.kind === 'number' ? Number(e.target.value) : e.target.value);
                                }}
                              />
                            )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <>
        <label className="search">
          Find a Feature
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search this selection…"
          />
        </label>
        {!listMode && (
          <label>
            Feature
            <select aria-label={`Feature for ${title}`} value={option} onChange={(e) => setOption(e.target.value)}>
              <option value="">Choose a Feature…</option>
              {matches.map((f) => <option key={f.id} value={f.id} disabled={picks.some((p) => p.feature === f.id) && !slot.definition.allowDuplicates}>{featureName(f)}</option>)}
            </select>
          </label>
        )}
        <div className="candidate-list">
          {visible.map((f) => {
            const candidate = candidates.find((c) => c.feature === f.id), selected = picks.some((p) => p.feature === f.id);
            return (
              <div className="candidate" key={f.id}>
                <div>
                  <button className="link" onClick={() => openFeature(f.id)}>{featureName(f)}</button>
                  <span className={`badge ${candidate?.status ?? 'incomplete'}`}>{candidate?.status === 'valid' ? 'Eligible' : candidate?.status === 'invalid' ? 'Requirements unmet' : 'Pending'}</span>
                  <RulesText text={descriptionPreview(featureDescription(f, engine))} engine={engine} openFeature={openFeature} exclude={[f.id]} />
                  <FeatureRequirements feature={f} engine={engine} compact />
                  {candidate?.diagnostics.length ? <p className="muted small">{candidate.diagnostics.slice(0, 2).map((d) => d.message).join(' ')}</p> : null}
                </div>
                <button className="quiet" disabled={picks.length >= slot.maximum || (selected && !slot.definition.allowDuplicates)} onClick={() => update([...picks, { id: crypto.randomUUID(), feature: f.id }])}>{selected && !slot.definition.allowDuplicates ? 'Selected' : 'Choose'}</button>
              </div>
            );
          })}
        </div>
        {!matches.length && <p className="muted">No matching Features.</p>}
        {listMode && (
          <div className="row pagination">
            <button className="quiet" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
            <span>
              {matches.length}
              {' '}
              {'options · page '}
              {' '}
              {page + 1}
              {' '}
              {'of '}
              {' '}
              {Math.max(1, Math.ceil(matches.length / PAGE))}
            </span>
            <button className="quiet" disabled={(page + 1) * PAGE >= matches.length} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        )}
      </>
    </details>
  );
}
