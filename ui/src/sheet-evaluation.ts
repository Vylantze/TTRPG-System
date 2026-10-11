import { checkCharacter, type Character, type Engine, type EvaluationResult } from '@/src/index';

const evaluations = new WeakMap<Engine, Map<string, { key: string; result: EvaluationResult }>>();
function freeze(value: unknown): void {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return;
  Object.values(value).forEach(freeze);
  Object.freeze(value);
}

/** Bounded UI-only cache. Commands continue evaluating their inputs independently. */
export function evaluateForSheet(engine: Engine, character: Character): EvaluationResult {
  try {
    checkCharacter(character);
  } catch {
    return engine.evaluate(character);
  }
  // Evaluation does not inspect replay history; commands still check it independently.
  // All other present and future fields remain part of the rules key.
  const { name, notes, tabOrder, displayPreferences, statRolls, events, ...rules } = character;
  const key = JSON.stringify(rules);
  let cache = evaluations.get(engine);
  const previous = cache?.get(character.id);
  if (previous?.key === key) return previous.result;
  const result = engine.evaluate(character);
  freeze(result);
  if (!cache) evaluations.set(engine, cache = new Map());
  if (cache.size >= 8 && !cache.has(character.id)) cache.delete(cache.keys().next().value!);
  cache.set(character.id, { key, result });
  return result;
}
