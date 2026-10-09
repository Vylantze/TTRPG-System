import type { Character, EvaluationResult } from '@/src/model.js';
import type { FeatureRoll } from '@/src/model/FeatureRoll.js';
import type { Engine } from '@/src/engine.js';
import { RuleError } from '@/src/expression.js';
import { rollDice } from '@/src/dice.js';
import { useAbility, adjustResource } from '@/src/commands.js';

export function featureRollExpression(roll: FeatureRoll, character: Character, result: EvaluationResult): string {
  const bonus = typeof roll.bonus === 'number' ? roll.bonus : roll.bonus && 'stat' in roll.bonus ? result.stats[roll.bonus.stat]?.value : roll.bonus && 'class' in roll.bonus ? character.progressions.filter((p) => p.class === (roll.bonus as { class: string }).class).reduce((n, p) => n + p.level, 0) : 0;
  if (!Number.isFinite(bonus)) throw new RuleError('ROLL', 'The roll requires an unavailable stat.');
  return `${roll.dice}${bonus ? ` ${bonus! < 0 ? '-' : '+'} ${Math.abs(bonus!)}` : ''}`;
}

/** Spend the originating ability and apply a declared self-recovery atomically. */
export function rollFeature(engine: Engine, character: Character, instanceId: string, rollId: string, eventId: string, random?: () => number) {
  if (character.events.some((event) => event.id === eventId || event.id === `${eventId}/effect`)) throw new RuleError('ROLL', 'This roll was already applied.');
  const result = engine.evaluate(character);
  if (character.buildState === 'draft' || result.status !== 'valid') throw new RuleError('ROLL', 'Finalize a valid character before applying effects.');
  const instance = result.instances.find((item) => item.id === instanceId && item.active);
  const roll = instance && engine.getFeature(instance.feature)?.rolls?.find((item) => item.id === rollId);
  if (!roll) throw new RuleError('ROLL', 'Roll is not granted by an active Feature.');
  const capability = result.capabilities.find((item) => item.source === instanceId && item.definition.name === roll.capability);
  if (roll.capability && !capability) throw new RuleError('ROLL', 'Required ability is unavailable.');
  const pool = roll.restoreResource ? Object.values(result.resources).find((item) => item.key === roll.restoreResource && item.scope === 'character') : undefined;
  if (roll.restoreResource && !pool) throw new RuleError('ROLL', 'Recovery resource is unavailable.');
  let next = capability ? useAbility(engine, character, capability.id, eventId, { actionTracking: 'manual' }).character : structuredClone(character);
  const outcome = rollDice(featureRollExpression(roll, character, result), random);
  const applied = pool ? Math.max(0, Math.min(outcome.total, pool.capacity - (pool.current ?? pool.capacity - pool.spent))) : 0;
  if (pool) next = adjustResource(engine, next, pool.id, applied, `${eventId}/effect`);
  return { character: next, ...outcome, applied };
}
