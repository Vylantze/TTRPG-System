import { adjustResource, type Character, type Engine, type EvaluationResult } from '@/src/index';
import { ResourceSummary } from '@/ui/src/ResourceSummary';

export function HitPoints({ engine, character, result, update, report }: { engine: Engine; character: Character; result: EvaluationResult; update: (character: Character) => void; report: (message: string) => void }) {
  return (
    <div className="sheet-hit-points">
      {Object.values(result.resources).filter((pool) => pool.key === 'hit-points').map((pool) => (
        <ResourceSummary
          key={pool.id}
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
    </div>
  );
}
