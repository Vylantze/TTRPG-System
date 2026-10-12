import type { Character, Engine, EvaluationResult } from '@/src/index';

export function StatCalculation({ id, engine, result }: { id: string; engine: Engine; character: Character; result: EvaluationResult }) {
  const stat = result.stats[id];
  if (!stat) return <div className="calculation-box">Unavailable</div>;
  const terms = (stat.contributions ?? [{ amount: stat.value, label: engine.getStatDefinition(id)?.name ?? id }]).filter((term) => term.amount !== 0);
  const readable = (label: string) => label.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\bmodifier\./g, '').replace(/^./, (letter) => letter.toUpperCase());
  return (
    <div className="calculation-box">
      <p>
        {terms.length
          ? terms.map((term, index) => (
              <span key={index}>
                {index ? term.amount < 0 ? ' − ' : ' + ' : term.amount < 0 ? '−' : ''}
                {Math.abs(term.amount)}
                {' ('}
                {readable(term.label)}
                )
              </span>
            ))
          : '0'}
      </p>
    </div>
  );
}
