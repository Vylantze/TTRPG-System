import type { Character, Engine } from '@/src/index';
import { clearFeatureRolls } from '@/src/index';
import { Tooltip } from '@/ui/src/components/Tooltip';

export function RollHistory({ engine, character, update }: { engine: Engine; character: Character; update: (character: Character) => void }) {
  const rolls = [...(character.statRolls ?? []).map((roll) => ({ ...roll, kind: 'Check' })), ...(character.rollResults ?? []).map((roll) => ({ ...roll, name: engine.getFeature(roll.feature)?.displayName ?? engine.getFeature(roll.feature)?.name ?? 'Feature roll', kind: roll.applied !== undefined ? 'Applied' : 'Rolled' }))];
  const order = new Map(character.events.map((event, index) => [event.id, index]));
  rolls.sort((a, b) => (order.get(a.id) ?? -1) - (order.get(b.id) ?? -1));
  return (
    <section className="panel roll-history">
      <h2>{`Roll history · ${rolls.length}`}</h2>
      <button className="quiet" disabled={!rolls.length} onClick={() => update({ ...clearFeatureRolls(character), statRolls: [] })}>Clear all rolls</button>
      {!rolls.length && <p className="muted small">Roll checks or abilities to see their results here.</p>}
      <ol>
        {rolls.slice(-100).reverse().map((roll) => (
          <li key={roll.id}>
            <span>{`${roll.expression} (${roll.name}) = ${roll.breakdown}`}</span>
            <Tooltip text={`${roll.expression} (${roll.name}) = ${roll.breakdown}${'modifierReasons' in roll && roll.modifierReasons ? ` · ${roll.modifierReasons}` : ''}`}><strong>{roll.total}</strong></Tooltip>
            <small>{roll.kind}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}
