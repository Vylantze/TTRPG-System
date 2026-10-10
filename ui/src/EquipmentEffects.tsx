import { useState } from 'react';
import { assignEquipment, requiresEquipmentAttunement, itemProperties, type Character, type Engine, type EvaluationResult } from '@/src/index';
import { FeatureRules } from '@/ui/src/RulesText';

export function EquipmentEffects({ engine, character, result, update, report }: { engine: Engine; character: Character; result: EvaluationResult; update: (character: Character) => void; report: (message: string) => void }) {
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [recipients, setRecipients] = useState<Record<string, string>>({});
  const instances = result.instances.filter((instance) => instance.active && instance.eligible && engine.getFeature(instance.feature)?.equipmentEffect);
  const orphaned = (character.equipmentAssignments ?? []).filter((assignment) => !instances.some((instance) => instance.id === assignment.instance));
  if (!instances.length && !orphaned.length) return null;
  const attempt = (action: () => Character) => {
    try {
      update(action());
    } catch (error) {
      report(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <section className="panel">
      <h2>Infused items</h2>
      <p>Assign after a long rest. External recipients keep their own equipment bonuses; this sheet tracks the creator’s infusion and charges.</p>
      {orphaned.map((assignment) => (
        <article className="notice" key={assignment.instance}>
          <p>This assignment’s infusion is no longer active. End it to repair the build.</p>
          <button className="quiet" onClick={() => attempt(() => assignEquipment(engine, character, assignment.instance))}>End inactive infusion</button>
        </article>
      ))}
      {instances.map((instance) => {
        const feature = engine.getFeature(instance.feature)!;
        const effect = feature.equipmentEffect!;
        const attunement = requiresEquipmentAttunement(effect, instance);
        const assignment = character.equipmentAssignments?.find((entry) => entry.instance === instance.id);
        const compatible = (item: NonNullable<Engine['catalogue']['items']>[number]) => effect.categories.includes(item.category) && !itemProperties(engine.catalogue, item.id).magical && (effect.requiredProperties ?? []).every((key) => itemProperties(engine.catalogue, item.id)[key]);
        const target = targets[instance.id] ?? '';
        return (
          <article className="panel" key={instance.id}>
            <h3>{feature.displayName ?? feature.name}</h3>
            <small>{`${result.stats[effect.capacityStat]?.value ?? 0} active item limit · ${attunement ? 'Requires attunement' : 'No attunement required'}`}</small>
            {effect.bonusCapacity && <small>{`Up to ${result.stats[effect.bonusCapacity.stat]?.value ?? 0} additional assignments to eligible items`}</small>}
            {assignment
              ? (
                  <div className="toolbar">
                    <span>{assignment.recipient ?? engine.catalogue.items?.find((item) => item.id === character.inventory?.find((entry) => entry.id === assignment.inventory)?.item)?.name}</span>
                    {attunement && (
                      <label>
                        <input type="checkbox" checked={assignment.attuned} onChange={(event) => attempt(() => assignEquipment(engine, character, instance.id, { ...assignment, attuned: event.target.checked }))} />
                        Attuned
                      </label>
                    )}
                    <button className="quiet" onClick={() => attempt(() => assignEquipment(engine, character, instance.id))}>End infusion</button>
                  </div>
                )
              : (
                  <div className="toolbar">
                    <label>
                      Item
                      <select value={target} onChange={(event) => setTargets({ ...targets, [instance.id]: event.target.value })}>
                        <option value="">Choose item…</option>
                        {(character.inventory ?? []).filter((entry) => entry.quantity === 1 && engine.catalogue.items?.some((item) => item.id === entry.item && compatible(item))).map((entry) => <option key={entry.id} value={`inventory:${entry.id}`}>{engine.catalogue.items?.find((item) => item.id === entry.item)?.name}</option>)}
                        {engine.catalogue.items?.filter(compatible).map((item) => <option key={item.id} value={`external:${item.id}`}>{`External: ${item.name}`}</option>)}
                      </select>
                    </label>
                    {target.startsWith('external:') && (
                      <label>
                        Recipient and item identity
                        <input value={recipients[instance.id] ?? ''} onChange={(event) => setRecipients({ ...recipients, [instance.id]: event.target.value })} />
                      </label>
                    )}
                    <button disabled={!target || (target.startsWith('external:') && !recipients[instance.id]?.trim())} onClick={() => attempt(() => assignEquipment(engine, character, instance.id, target.startsWith('inventory:') ? { inventory: target.slice(10), attuned: false } : { item: target.slice(9), recipient: recipients[instance.id], attuned: false }))}>Infuse item</button>
                  </div>
                )}
            <details>
              <summary>Rules and source</summary>
              {(effect.itemFeatures ?? []).flatMap((id) => Object.entries(engine.catalogue.itemFeatures?.find((item) => item.id === id)?.properties ?? {})).map(([key, value]) => <p key={key}>{`${key}: ${value}`}</p>)}
              <FeatureRules feature={feature} engine={engine} instanceId={instance.id} showRolls={false} />
            </details>
          </article>
        );
      })}
    </section>
  );
}
