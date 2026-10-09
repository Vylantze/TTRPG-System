import type { Engine, EvaluationResult, PoolResult } from '../../src/index';
import { expressionText } from './feature-requirements';
import { featureName } from './display';
import { labelFromId } from './workspace';

export function ResourceSummary({ pool, engine, result }: { pool: PoolResult; engine: Engine; result: EvaluationResult }) {
  const providers = [...new Set(pool.providers.map((id) => featureName(engine.getFeature(result.instances.find((i) => i.id === id)!.feature))))];
  return (
    <article className="stat-tile">
      <span>{pool.name ?? labelFromId(pool.key)}</span>
      <strong aria-label="Current / maximum">{`${pool.current ?? pool.available} / ${Number.isFinite(pool.capacity) ? pool.capacity : 'No maximum'}`}</strong>
      <p className="muted small">{`${pool.available} available · ${pool.reserved} reserved · ${pool.units}`}</p>
      <p className="muted small">{pool.recovery.map((r) => `${labelFromId(r.event)}: ${r.amount === 'full' ? 'restore to maximum' : `recover ${expressionText(r.amount, engine)}`}`).join(' · ') || 'No automatic recovery'}</p>
      <p className="muted small">{`Provided by: ${providers.join(', ')}`}</p>
    </article>
  );
}
