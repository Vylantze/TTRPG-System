import { FeatureRolls } from '@/ui/src/FeatureRolls';
import { useState } from 'react';
import { adjustResource, changeHealth, type Character, type Engine, type EvaluationResult } from '@/src/index';
import { ResourceSummary } from '@/ui/src/ResourceSummary';
import { HitDiceIcons } from '@/ui/src/HitDiceIcons';
import { Tooltip } from '@/ui/src/Tooltip';

export function HitPoints({ engine, character, result, update, report }: { engine: Engine; character: Character; result: EvaluationResult; update: (character: Character) => void; report: (message: string) => void }) {
  const [amount, setAmount] = useState('1');
  const policy = engine.catalogue.system.healthRules;
  const display = engine.catalogue.system.sheetDisplay?.health;
  const pools = Object.values(result.resources);
  const health = policy && pools.find((pool) => pool.key === policy.resourceKey);
  const ready = character.buildState !== 'draft' && result.status === 'valid';
  const attempt = (action: () => Character) => {
    try {
      update(action());
    } catch (error) { report(error instanceof Error ? error.message : String(error)); }
  };
  const current = health ? health.current ?? health.capacity - health.spent : undefined;
  if (!health) return null;
  const expanded = character.displayPreferences?.healthExpanded ?? !(display?.compactDefault ?? true);
  const name = display?.name ?? health.name ?? 'Health';
  const toggle = <Tooltip text={`${expanded ? 'Collapse' : 'Expand'} ${name}`}><button className="quiet icon-button health-toggle" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${name}`} aria-expanded={expanded} onClick={() => update({ ...character, displayPreferences: { ...character.displayPreferences, healthExpanded: !expanded } })}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={expanded ? 'M4 9h5V4 M20 15h-5v5 M9 9 3 3 M15 15l6 6' : 'M9 3H3v6 M15 21h6v-6 M3 3l7 7 M21 21l-7-7'} /></svg></button></Tooltip>;
  if (!expanded) return (
    <div className="sheet-hit-points health-compact-card">
      <div className="health-heading">
        <span>{name}</span>
        {toggle}
      </div>
      <strong aria-label="Current / maximum">
        {current}
        {' / '}
        {Number.isFinite(health.capacity) ? health.capacity : 'No maximum'}
      </strong>
    </div>
  );
  return (
    <div className="sheet-hit-points">
      <div className="health-heading">
        <h2>{name}</h2>
        {toggle}
      </div>
      {pools.filter((pool) => pool.id === health?.id).map((pool) => (
        <ResourceSummary
          key={pool.id}
          showName={false}
          pool={pool}
          engine={engine}
          result={result}
          ready={character.buildState !== 'draft' && result.status === 'valid'}
          adjust={(amount) => {
            try {
              update(adjustResource(engine, character, pool.id, amount, crypto.randomUUID()));
            } catch (error) {
              report(error instanceof Error ? error.message : String(error));
            }
          }}
        />
      ))}
      {policy && health && (
        <div className="toolbar health-adjust">
          <label>
            Amount
            <input aria-label="Damage or healing amount" type="number" min="0" step={health.integer ? '1' : 'any'} value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          {(['damage', 'heal'] as const).map((kind) => <button key={kind} className={kind === 'damage' ? 'quiet danger' : 'quiet'} disabled={!ready || amount.trim() === '' || !Number.isFinite(Number(amount)) || (health.integer && !Number.isSafeInteger(Number(amount))) || Number(amount) < 0} onClick={() => attempt(() => changeHealth(engine, character, kind, Number(amount), crypto.randomUUID()))}>{kind === 'damage' ? 'Damage' : 'Heal'}</button>)}
        </div>
      )}
      {policy?.temporaryResourceKey && pools.filter((pool) => pool.key === policy.temporaryResourceKey).map((pool) => (
        <label className="temporary-health" key={pool.id}>
          {pool.name ?? 'Temporary health'}
          <input
            aria-label={pool.name ?? 'Temporary health'}
            type="number"
            min={(pool.minimum ?? 0) + pool.reserved}
            max={Number.isFinite(pool.capacity) ? pool.capacity : undefined}
            step={pool.integer ? '1' : 'any'}
            disabled={!ready}
            key={`${pool.id}:${pool.current}`}
            defaultValue={pool.current ?? pool.capacity - pool.spent}
            onBlur={(event) => {
              const next = Number(event.target.value);
              if (event.target.value.trim() && Number.isFinite(next) && (!pool.integer || Number.isSafeInteger(next)) && next >= (pool.minimum ?? 0) + pool.reserved && next <= pool.capacity) attempt(() => adjustResource(engine, character, pool.id, next - (pool.current ?? pool.capacity - pool.spent), crypto.randomUUID()));
              else event.target.value = String(pool.current ?? pool.capacity - pool.spent);
            }}
          />
        </label>
      ))}
      {display?.counters && (display.countersVisibleAtOrBelow === undefined || (current !== undefined && current <= display.countersVisibleAtOrBelow)) && <div className="health-counters">{pools.filter((pool) => display.counters?.includes(pool.key)).map((pool) => <ResourceSummary key={pool.id} pool={pool} engine={engine} result={result} ready={ready} adjust={(delta) => attempt(() => adjustResource(engine, character, pool.id, delta, crypto.randomUUID()))} />)}</div>}
      {display?.showHealingFeatures !== false && engine.catalogue.system.healingFeaturesTag && [...new Set(result.instances.filter((instance) => instance.active && instance.eligible && engine.getFeature(instance.feature)?.tags?.includes(engine.catalogue.system.healingFeaturesTag!)).map((instance) => instance.feature))].map((id) => (
        <details className="panel rest-healing" key={id}>
          <summary>
            {engine.getFeature(id)!.displayName ?? engine.getFeature(id)!.name}
            {display?.healingResourceIcons && pools.filter((pool) => pool.providers.some((provider) => result.instances.some((instance) => instance.feature === id && provider.startsWith(`${instance.id}/`)))).map((pool) => <HitDiceIcons key={pool.id} pool={pool} />)}
          </summary>
          {Object.values(result.resources).filter((pool) => pool.providers.some((provider) => result.instances.some((instance) => instance.feature === id && provider.startsWith(`${instance.id}/`)))).map((pool) => <ResourceSummary key={pool.id} pool={pool} engine={engine} result={result} />)}
          <FeatureRolls feature={engine.getFeature(id)!} engine={engine} />
        </details>
      ))}
    </div>
  );
}
