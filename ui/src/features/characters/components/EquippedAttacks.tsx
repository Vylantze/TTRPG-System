import {
  itemProperties,
  infusedItemProperties,
  type Character,
  type Engine,
  type EvaluationResult,
} from '@/src/index';

export function EquippedAttacks({
  engine,
  character,
  result,
}: {
  engine: Engine;
  character: Character;
  result: EvaluationResult;
}) {
  const categories = engine.catalogue.system.sheetDisplay?.actions?.itemCategories ?? [];
  const entries = (character.inventory ?? []).filter(
    (entry) =>
      entry.equipped
      && categories.includes(
        engine.catalogue.items?.find((item) => item.id === entry.item)?.category ?? '',
      ),
  );
  if (!categories.length) return null;
  return (
    <section className="panel equipped-attacks">
      <h3>Equipped weapons</h3>
      {!entries.length && (
        <p className="muted">Equip a weapon in Items to view its attack properties.</p>
      )}
      {entries.map((entry) => {
        const item = engine.catalogue.items!.find((item) => item.id === entry.item)!;
        const properties = {
          ...itemProperties(engine.catalogue, item.id),
          ...infusedItemProperties(character, engine.catalogue, entry.id, result.instances),
        };
        return (
          <div key={entry.id}>
            <strong>{item.name}</strong>
            <dl className="spell-quick-info">
              {Object.entries(properties).map(([name, value]) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </section>
  );
}
