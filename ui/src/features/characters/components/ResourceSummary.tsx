import { resetConditionName } from '@/ui/src/features/systems/model/reset-condition-name';
import { type ReactNode } from 'react';
import type { Engine, EvaluationResult, PoolResult } from '@/src/index';
import { expressionText } from '@/ui/src/features/catalogue/model/feature-requirements';
import { featureName } from '@/ui/src/features/catalogue/model/display';
import { labelFromId } from '@/ui/src/lib/workspace';

export function ResourceSummary({ pool, engine, result, ready = false, adjust, children, showName = true, valueControl }: { pool: PoolResult; engine: Engine; result: EvaluationResult; ready?: boolean; adjust?: (delta: number) => void; children?: ReactNode; showName?: boolean; valueControl?: ReactNode }) {
  const amount = 1;
  const validAmount = Number.isFinite(amount) && amount > 0 && (!pool.integer || Number.isInteger(amount));
  const providers = [...new Set(pool.providers.map((id) => featureName(engine.getFeature(result.instances.find((i) => i.id === id)!.feature))))];
  return (
    <article className={`stat-tile resource-card ${engine.catalogue.system.sheetDisplay?.resources?.compact ? 'resource-compact' : ''}`}>
      {showName && <span>{pool.name ?? labelFromId(pool.key)}</span>}
      {valueControl ?? <strong aria-label="Current / maximum">{`${pool.current ?? pool.capacity - pool.spent} / ${Number.isFinite(pool.capacity) ? pool.capacity : 'No maximum'}`}</strong>}
      {adjust && (
        <div className="toolbar resource-adjust">
          <button className="quiet resource-adjust-button" aria-label={`Decrease ${pool.name ?? pool.key}`} disabled={!ready || !validAmount || pool.available < amount} onClick={() => adjust(-amount)}>−</button>
          <button className="quiet resource-adjust-button" aria-label={`Increase ${pool.name ?? pool.key}`} disabled={!ready || !validAmount || (pool.current ?? pool.capacity - pool.spent) + amount > pool.capacity} onClick={() => adjust(amount)}>+</button>
        </div>
      )}
      <p className="muted small">{pool.recovery.map((r) => `${resetConditionName(engine.catalogue.system, r.event)}: ${r.amount === 'full' ? 'restore to maximum' : `recover ${r.dice ? `${r.dice} + ` : ''}${expressionText(r.amount, engine)}`}`).join(' · ') || Object.entries(engine.catalogue.system.recoveryAllocations ?? {}).filter(([, policy]) => policy.keys.includes(pool.key)).map(([event, policy]) => `${resetConditionName(engine.catalogue.system, event)}: shared recovery allowance of ${result.stats[policy.budgetStat]?.value ?? 0}`).join(' · ') || 'No automatic recovery'}</p>
      {children}
      <details open={engine.catalogue.system.sheetDisplay?.resources?.showDetailsByDefault ?? false}>
        <summary>Pool details</summary>
        <p className="muted small">{`${pool.available} available · ${pool.reserved} reserved · ${pool.units}`}</p>
        <p className="muted small">{`Provided by: ${providers.join(', ')}`}</p>
      </details>
    </article>
  );
}
