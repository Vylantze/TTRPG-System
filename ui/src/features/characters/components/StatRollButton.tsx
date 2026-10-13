import { rollStat, type Character, type Engine, type EvaluationResult } from '@/src/index';
import { Tooltip } from '@/ui/src/components/Tooltip';

export function StatRollButton({ stat, label, value, engine, character, result, update, report }: { stat: string; label: string; value: string | number; engine: Engine; character: Character; result: EvaluationResult; update?: (character: Character) => void; report?: (message: string) => void }) {
  const latest = character.statRolls?.filter((roll) => roll.stat === stat).at(-1);
  return (
    <span className="stat-roll-control">
      <Tooltip text={`Roll ${label}`}>
        <button
          className="link rollable-value"
          disabled={!update || result.status !== 'valid'}
          aria-label={`Roll ${label}`}
          onClick={() => {
            try {
              update?.(rollStat(engine, character, stat, crypto.randomUUID()));
            } catch (error) { report?.(error instanceof Error ? error.message : String(error)); }
          }}
        >
          {value}
        </button>
      </Tooltip>
      {latest && <Tooltip text={`${latest.expression} (${latest.name}) = ${latest.breakdown}${latest.modifierReasons ? ` · ${latest.modifierReasons}` : ''}`}><output aria-live="polite">{latest.total}</output></Tooltip>}
    </span>
  );
}
