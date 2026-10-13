import type { Character, Engine, EvaluationResult } from '@/src/index';

export function StatCalculation({ id, engine, result }: { id: string; engine: Engine; character: Character; result: EvaluationResult }) {
  const stat = result.stats[id];
  if (!stat) return <div className="calculation-box">Unavailable</div>;
  const sources = (stat.contributions ?? [{ amount: stat.value, label: engine.getStatDefinition(id)?.name ?? id }]);
  const terms = sources.filter((term) => term.amount !== 0);
  if (!terms.length && stat.value === 0 && sources.length) terms.push(sources[0]);
  const readable = (label: string) => label.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\bmodifier\./g, '').replace(/^./, (letter) => letter.toUpperCase());
  return (
    <div className="calculation-box">
      {stat.value === 0 && !terms.length && (
        <p>
          {stat.base}
          {' (Base, '}
          {readable(engine.getStatDefinition(id)?.name ?? id)}
          )
        </p>
      )}
      {(terms.length > 0 || stat.value !== 0) && (
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
      )}
    </div>
  );
}
