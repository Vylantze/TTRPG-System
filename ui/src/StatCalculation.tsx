import type { Character, Engine, EvaluationResult } from '@/src/index';
import { expressionText } from '@/ui/src/feature-requirements';
export function StatCalculation({ id, engine, character, result }: { id: string; engine: Engine; character: Character; result: EvaluationResult }) {
  const definition = engine.getStatDefinition(id);
  const inputs = new Set<string>();
  const collect = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if ('stat' in value && typeof value.stat === 'string') inputs.add(value.stat);
    Object.values(value).forEach(collect);
  };
  if (definition?.kind === 'derived') collect(definition.expression);
  return (
    <div className="calculation-box">
      {definition?.kind === 'derived' && <p>{expressionText(definition.expression, engine)}</p>}
      {[...inputs].map((stat) => <p key={stat}>{`${engine.getStatDefinition(stat)?.name ?? stat}: ${result.stats[stat]?.value ?? 'Unavailable'}`}</p>)}
      <p>
        {'Base: '}
        {result.stats[id]?.base}
      </p>
      {result.stats[id]?.modifiers.map((modifier, index) => (
        <p key={index}>
          {modifier.operation}
          {' '}
          {modifier.amount}
          {' '}
          ·
          {' '}
          {modifier.applied ? 'Applied' : modifier.reason}
          <small>{modifier.source.startsWith('item/') ? engine.catalogue.items?.find((item) => item.id === character.inventory?.find((entry) => entry.id === decodeURIComponent(modifier.source.split('/')[1]))?.item)?.name : engine.getFeature(result.instances.find((instance) => instance.id === modifier.source)?.feature ?? '')?.displayName ?? 'Feature'}</small>
        </p>
      ))}
    </div>
  );
}
