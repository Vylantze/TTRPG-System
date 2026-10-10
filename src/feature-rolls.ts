import type { Character, EvaluationResult } from '@/src/model.js';
import type { FeatureRoll } from '@/src/model/FeatureRoll.js';
import type { Engine } from '@/src/engine.js';
import { RuleError } from '@/src/expression.js';
import { spellGroups } from '@/src/spell-display.js';
import { rollDice } from '@/src/dice.js';
import { useAbility, adjustResource } from '@/src/commands.js';

export function featureRollExpression(roll: FeatureRoll, character: Character, result: EvaluationResult): string {
  const resolveDie = (value: number | { stat: string }) => {
    const number = typeof value === 'number' ? value : result.stats[value.stat]?.value;
    if (!Number.isSafeInteger(number) || number! < 1) throw new RuleError('ROLL', 'The roll requires a positive integer dice stat.');
    return number!;
  };
  const dice = typeof roll.dice === 'string' ? roll.dice : `${resolveDie(roll.dice.count)}d${resolveDie(roll.dice.sides)}`;
  const bonus = typeof roll.bonus === 'number' ? roll.bonus : roll.bonus && 'stat' in roll.bonus ? result.stats[roll.bonus.stat]?.value : roll.bonus && 'class' in roll.bonus ? character.progressions.filter((p) => p.class === (roll.bonus as { class: string }).class).reduce((n, p) => n + p.level, 0) : 0;
  if (!Number.isFinite(bonus)) throw new RuleError('ROLL', 'The roll requires an unavailable stat.');
  return `${dice}${bonus ? ` ${bonus! < 0 ? '-' : '+'} ${Math.abs(bonus!)}` : ''}`;
}

/** Resolve a roll's owning ability through its parent chain, never an unrelated Feature. */
export function rollCapability(engine: Engine, result: EvaluationResult, instanceId: string) {
  const origin = result.instances.find((item) => item.id === instanceId && item.active);
  const name = origin && engine.getFeature(origin.feature)?.roll?.capability;
  let instance = origin;
  while (instance && name) {
    const capability = result.capabilities.find((item) => item.source === instance!.id && item.definition.name === name);
    if (capability) return capability;
    instance = result.instances.find((item) => item.id === instance!.parent && item.active);
  }
  return undefined;
}

/** Find granted Roll Features for a displayed Feature, including shared source definitions. */
export function featureRollInstances(engine: Engine, result: EvaluationResult, featureId: string, ownerId?: string) {
  const feature = engine.getFeature(featureId);
  const ids = new Set([...(feature?.roll ? [feature.id] : []), ...feature?.components.flatMap((component) => component.kind === 'grantFeature' && engine.getFeature(component.feature)?.roll ? [component.feature] : []) ?? []]);
  const seen = new Set<string>();
  return result.instances.filter((instance) => {
    if (!instance.active || !ids.has(instance.feature) || (ownerId && (feature?.roll ? instance.id !== ownerId : instance.parent !== ownerId)) || (!ownerId && seen.has(instance.feature))) return false;
    seen.add(instance.feature);
    return true;
  });
}

/** Rolling spends the use now and stores the immutable result; it never applies healing. */
export function rollFeature(engine: Engine, character: Character, instanceId: string, eventId: string, random?: () => number, castingCapability?: string) {
  if (!eventId || character.events.some((event) => event.id === eventId) || character.rollResults?.some((roll) => roll.id === eventId)) throw new RuleError('ROLL', 'This roll was already recorded or has an invalid ID.');
  const result = engine.evaluate(character);
  if (character.buildState === 'draft' || result.status !== 'valid') throw new RuleError('ROLL', 'Finalize a valid character before rolling.');
  const instance = result.instances.find((item) => item.id === instanceId && item.active);
  const roll = instance && engine.getFeature(instance.feature)?.roll;
  if (!roll) throw new RuleError('ROLL', 'Roll is not granted by an active Roll Feature.');
  const spell = spellGroups(engine, result).filter((group) => group.feature === roll.spell);
  const mode = spell.flatMap((group) => group.modes).find((option) => option.capability.id === castingCapability);
  if (roll.spell && !mode) throw new RuleError('ROLL', 'Select an available casting mode for this spell.');
  if (castingCapability && !roll.spell) throw new RuleError('ROLL', 'This Roll Feature does not belong to a spell.');
  const capability = mode?.capability ?? rollCapability(engine, result, instanceId);
  if (roll.capability && !capability) throw new RuleError('ROLL', 'Required ability is unavailable.');
  const use = capability ? useAbility(engine, character, capability.id, eventId, { actionTracking: 'manual' }) : undefined;
  if (use?.pending) throw new RuleError('ROLL', 'A Roll Feature requires an immediately spent ability use.');
  const next = use?.character ?? structuredClone(character);
  const expression = featureRollExpression(roll, character, result);
  const outcome = { id: eventId, instance: instanceId, feature: instance!.feature, definition: JSON.stringify(roll), expression, ...(mode ? { casting: { capability: mode.capability.id, spell: roll.spell!, slotLevel: mode.slotLevel, ritual: mode.ritual } } : {}), ...rollDice(expression, random) };
  next.rollResults = [...next.rollResults ?? [], outcome];
  if (!use) next.events.push({ id: eventId, fingerprint: JSON.stringify({ kind: 'roll', instanceId, outcome }) });
  return { character: next, outcome };
}

/** Apply exactly one stored result without rolling or spending the ability a second time. */
export function applyFeatureRoll(engine: Engine, character: Character, rollId: string, eventId: string) {
  const result = engine.evaluate(character);
  if (character.buildState === 'draft' || result.status !== 'valid') throw new RuleError('ROLL', 'Finalize a valid character before applying a roll.');
  const outcome = character.rollResults?.find((item) => item.id === rollId);
  if (!outcome || outcome.applied !== undefined) throw new RuleError('ROLL', 'Roll is missing or already applied.');
  if (!eventId || character.events.some((event) => event.id === eventId)) throw new RuleError('ROLL', 'Application event ID has already been used.');
  const instance = result.instances.find((item) => item.id === outcome.instance && item.feature === outcome.feature && item.active);
  const roll = instance && engine.getFeature(instance.feature)?.roll;
  if (!roll || (!roll.restoreResource && !outcome.casting) || JSON.stringify(roll) !== outcome.definition) throw new RuleError('ROLL', 'The Roll Feature or its effect is no longer available.');
  if (!roll.restoreResource) {
    const next = structuredClone(character);
    next.rollResults = next.rollResults!.map((item) => item.id === rollId ? { ...item, applied: outcome.total } : item);
    next.events.push({ id: eventId, fingerprint: JSON.stringify({ kind: 'applySpellRoll', rollId }) });
    return { character: next, applied: outcome.total };
  }
  const pool = Object.values(result.resources).find((item) => item.key === roll.restoreResource && item.scope === 'character');
  if (!pool) throw new RuleError('ROLL', 'Recovery resource is unavailable.');
  const applied = Math.max(0, Math.min(outcome.total, pool.capacity - (pool.current ?? pool.capacity - pool.spent)));
  const next = adjustResource(engine, character, pool.id, applied, eventId);
  next.rollResults = next.rollResults!.map((item) => item.id === rollId ? { ...item, applied } : item);
  return { character: next, applied };
}

/** Clear displayed results only. Spent resources and event IDs remain unchanged. */
export function clearFeatureRolls(character: Character, instanceIds?: string[]): Character {
  return { ...character, rollResults: instanceIds ? character.rollResults?.filter((roll) => !instanceIds.includes(roll.instance)) ?? [] : [] };
}
