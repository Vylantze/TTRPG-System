import { FeatureRolls } from '@/ui/src/FeatureRolls';
import { useState } from 'react';
import { adjustResource, changeHealth, type Character, type Engine, type EvaluationResult } from '@/src/index';
import { ResourceSummary } from '@/ui/src/ResourceSummary';

export function HitPoints({ engine, character, result, update, report }: { engine: Engine; character: Character; result: EvaluationResult; update: (character: Character) => void; report: (message: string) => void }) {
  const [amount, setAmount] = useState('1');
  const policy = engine.catalogue.system.healthRules;
  const display = engine.catalogue.system.sheetDisplay?.health;
  const pools = Object.values(result.resources);
  const health = pools.find((pool) => pool.key === (policy?.resourceKey ?? 'hit-points'));
  const ready = character.buildState !== 'draft' && result.status === 'valid';
  const attempt = (action: () => Character) => {
    try {
      update(action());
    } catch (error) { report(error instanceof Error ? error.message : String(error)); }
  };
  const current = health ? health.current ?? health.capacity - health.spent : undefined;
  return (
    <div className="sheet-hit-points">
      {health && <h2>{display?.name ?? health.name ?? 'Health'}</h2>}
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
            <input aria-label="Damage or healing amount" type="number" min="0" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          {(['damage', 'heal'] as const).map((kind) => <button key={kind} className={kind === 'damage' ? 'quiet danger' : 'quiet'} disabled={!ready || amount.trim() === '' || !Number.isSafeInteger(Number(amount)) || Number(amount) < 0} onClick={() => attempt(() => changeHealth(engine, character, kind, Number(amount), crypto.randomUUID()))}>{kind === 'damage' ? 'Damage' : 'Heal'}</button>)}
        </div>
      )}
      {policy?.temporaryResourceKey && pools.filter((pool) => pool.key === policy.temporaryResourceKey).map((pool) => (
        <label className="temporary-health" key={pool.id}>
          {pool.name ?? 'Temporary health'}
          <input
            aria-label={pool.name ?? 'Temporary health'}
            type="number"
            min="0"
            step="1"
            disabled={!ready}
            key={`${pool.id}:${pool.current}`}
            defaultValue={pool.current ?? pool.capacity - pool.spent}
            onBlur={(event) => {
              const next = Number(event.target.value);
              if (event.target.value.trim() && Number.isSafeInteger(next) && next >= 0) attempt(() => adjustResource(engine, character, pool.id, next - (pool.current ?? pool.capacity - pool.spent), crypto.randomUUID()));
              else event.target.value = String(pool.current ?? pool.capacity - pool.spent);
            }}
          />
        </label>
      ))}
      {display?.counters && (!display.showDeathSavesAtZero || current === 0) && <div className="health-counters">{pools.filter((pool) => display.counters?.includes(pool.key)).map((pool) => <ResourceSummary key={pool.id} pool={pool} engine={engine} result={result} ready={ready} adjust={(delta) => attempt(() => adjustResource(engine, character, pool.id, delta, crypto.randomUUID()))} />)}</div>}
      {display?.showHealingFeatures !== false && engine.catalogue.system.healingFeaturesTag && [...new Set(result.instances.filter((instance) => instance.active && instance.eligible && engine.getFeature(instance.feature)?.tags?.includes(engine.catalogue.system.healingFeaturesTag!)).map((instance) => instance.feature))].map((id) => (
        <details className="panel rest-healing" key={id}>
          <summary>{engine.getFeature(id)!.displayName ?? engine.getFeature(id)!.name}</summary>
          {Object.values(result.resources).filter((pool) => pool.providers.some((provider) => result.instances.some((instance) => instance.feature === id && provider.startsWith(`${instance.id}/`)))).map((pool) => <ResourceSummary key={pool.id} pool={pool} engine={engine} result={result} />)}
          <FeatureRolls feature={engine.getFeature(id)!} engine={engine} />
        </details>
      ))}
    </div>
  );
}
