import { itemFeatures, itemProperties, type Engine, type Value } from '@/src/index';
import { expressionText } from '@/ui/src/features/catalogue/model/feature-requirements';

export function ItemDetail({
  engine,
  id,
  properties,
}: {
  engine: Engine;
  id: string;
  properties?: Record<string, Value>;
}) {
  const item = engine.catalogue.items?.find((entry) => entry.id === id);
  if (!item) return <p>This item is unavailable in the loaded System.</p>;
  const modifiers = itemFeatures(engine.catalogue, id).flatMap(
    (feature) => feature.modifiers ?? [],
  );
  const operations = {
    add: 'Add',
    multiply: 'Multiply by',
    override: 'Set to',
    floor: 'Minimum',
    ceiling: 'Maximum',
  };
  return (
    <section className="item-details">
      <h3>{item.name}</h3>
      <p>{item.category}</p>
      <dl className="item-details-properties">
        {Object.entries(properties ?? itemProperties(engine.catalogue, id)).map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{String(value)}</dd>
          </div>
        ))}
      </dl>
      {modifiers.length > 0 && (
        <ul>
          {modifiers.map((modifier, index) => (
            <li key={index}>
              {`${engine.getStatDefinition(modifier.stat)?.name ?? modifier.stat}: ${operations[modifier.operation]} ${expressionText(modifier.value, engine)}${modifier.condition !== undefined ? ` (when ${expressionText(modifier.condition, engine)})` : ''}`}
            </li>
          ))}
        </ul>
      )}
      <h4>Item components</h4>
      <ul>
        {item.features.map((feature) => (
          <li key={feature}>
            {engine.catalogue.itemFeatures?.find((entry) => entry.id === feature)?.name ?? feature}
          </li>
        ))}
      </ul>
      {item.source && <p className="source">{item.source}</p>}
    </section>
  );
}
