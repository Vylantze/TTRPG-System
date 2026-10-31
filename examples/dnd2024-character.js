import { createDnd2024Engine } from '@/dist/systems/dnd5e-2024/index.js';

const engines = new Map();
const engineFor = (settings) => {
  const key = JSON.stringify(settings);
  if (!engines.has(key)) engines.set(key, createDnd2024Engine(settings));
  return engines.get(key);
};

/** Picks preferred by Feature ID ending; anything else is chosen in ID order. */
const PREFER = [
  'species.human', 'size.medium', 'background.soldier', 'feat.skilled', 'skill.athletics', 'skill.perception', 'skill.insight', 'skill.stealth',
  'skill.acrobatics', 'skill.arcana', 'skill.history', 'skill.investigation', 'skill.survival', 'tool.gaming-set', 'language.elvish', 'language.dwarvish',
  'feat.defense', 'mastery.longsword', 'mastery.longbow', 'mastery.javelin', 'mastery.shortsword', 'mastery.dagger', 'mastery.handaxe', 'mastery.greatsword',
  'expertise.stealth', 'expertise.perception', 'expertise.athletics', 'expertise.arcana', 'expertise.history',
  'fighter.subclass.champion', 'rogue.subclass.thief', 'wizard.subclass.evoker', 'feat.ability-score-improvement',
  'wizard.spell.fire-bolt', 'wizard.spell.mage-hand', 'wizard.spell.light', 'wizard.spell.ray-of-frost',
  'wizard.spell.magic-missile', 'wizard.spell.shield', 'wizard.spell.mage-armor', 'wizard.spell.detect-magic', 'wizard.spell.misty-step', 'wizard.spell.scorching-ray', 'wizard.spell.fireball', 'wizard.spell.counterspell',
];

/**
 * A complete example builder with valid choices, not a rules recommendation. Every pick
 * comes from the engine's own candidate list, so the character is valid by construction.
 */
export function exampleCharacter({ classes = [{ class: 'fighter', level: 3 }], settings = {}, history, prefer = [] } = {}) {
  const engine = engineFor(settings);
  const character = engine.createCharacter('example-hero', 'Example Hero', classes.map((entry, index) => ({ id: `class-${index}`, class: `dnd5e:2024:${entry.class}`, level: entry.level })));
  if (history) character.history = history;
  const scores = settings.abilityMethod === 'manual' ? [15, 14, 14, 14, 12, 10] : [15, 13, 14, 12, 10, 8];
  ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].forEach((ability, index) => (character.inputs[`base.${ability}`] = scores[index]));
  const order = [...prefer, ...PREFER];
  const rank = (feature) => {
    const index = order.findIndex((ending) => feature.endsWith(`.${ending}`) || feature.endsWith(`:${ending}`));
    return index < 0 ? order.length : index;
  };
  for (let round = 0; round < 40; round += 1) {
    let changed = false;
    // Origins first, as a player chooses them: a class skill that repeats a background
    // skill is rightly invalid, so background skills must be known before class picks.
    const selections = engine.evaluate(character).selections;
    const origin = (selection) => (selection.id.startsWith('advancement/0/') ? 0 : 1);
    for (const selection of [...selections].sort((a, b) => origin(a) - origin(b))) {
      const optional = selection.minimum === 0;
      const want = optional ? Math.min(selection.maximum, 2) : selection.minimum;
      if (selection.picks.length >= want) continue;
      const taken = new Set(selection.picks.map((pick) => pick.feature));
      // Evaluating a candidate is expensive, so check them in preference order, a few at a time.
      const ordered = engine.getSelectionFeatures(selection.definition).map((feature) => feature.id)
        .filter((feature) => !taken.has(feature) && (!optional || rank(feature) < order.length))
        .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
      const candidates = [];
      for (let start = 0; start < ordered.length && candidates.length < want - selection.picks.length; start += 6) {
        candidates.push(...engine.getCandidates(character, selection.id, {}, { features: ordered.slice(start, start + 6) }).filter((candidate) => candidate.status !== 'invalid'));
      }
      candidates.sort((a, b) => rank(a.feature) - rank(b.feature) || a.feature.localeCompare(b.feature));
      if (!candidates.length) continue;
      const picks = [...(character.selections[selection.id] ?? [])];
      for (const candidate of candidates.slice(0, want - selection.picks.length)) picks.push({ id: `pick-${picks.length}`, feature: candidate.feature });
      character.selections[selection.id] = picks;
      changed = true;
    }
    if (!changed) break;
  }
  const evaluation = engine.evaluate(character);
  for (const pool of Object.values(evaluation.resources)) character.resources[pool.id] ??= { spent: 0 };
  return { engine, character, evaluation: engine.evaluate(character) };
}
