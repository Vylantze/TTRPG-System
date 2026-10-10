import { classEntryPath, selectionPath, pickPath, childPath } from '@/dist/index.js';
import { createDnd2014Engine, classInfo, wizardSpells } from '@/dist/systems/dnd5e-2014/index.js';

/** A complete example builder with explicit choices, not a rules recommendation. */
export function exampleCharacter({ classes = [{ class: 'fighter', level: 3 }], race = 'human', settings = {}, history } = {}) {
  const engine = createDnd2014Engine(settings);
  const character = engine.createCharacter('example-hero', 'Example Hero', classes.map((p, i) => ({ id: `class-${i}`, class: `dnd5e:2014:${p.class}`, level: p.level })));
  if (history) character.history = history;
  const select = (path, features, parameters) => {
    character.selections[path] = features.map((name, i) => ({ id: `pick-${i}`, feature: `dnd5e:2014:${name}`, ...(parameters?.[i] ? { parameters: parameters[i] } : {}) }));
    return features.map((_, i) => pickPath(path, `pick-${i}`));
  };
  const [racePath] = select('advancement/0/race', [`race.${race}`]);
  const [background] = select('advancement/0/background', ['background.acolyte']);
  select(selectionPath(background, 'insight'), ['skill.insight']);
  select(selectionPath(background, 'religion'), ['skill.religion']);
  const language = race === 'tiefling' ? 'draconic' : 'infernal';
  select(selectionPath(background, 'languages'), [`language.${language}`, 'language.celestial']);
  if (['human', 'high-elf', 'half-elf'].includes(race)) select(selectionPath(racePath, 'language'), ['language.giant']);
  if (race === 'hill-dwarf') select(selectionPath(racePath, 'artisan-tool'), ['tool.mason']);
  if (race === 'high-elf') select(selectionPath(racePath, 'cantrip'), ['racial-cantrip.fire-bolt']);
  if (race === 'dragonborn') select(selectionPath(racePath, 'ancestry'), ['dragon-ancestry.red']);
  if (race === 'half-elf') select(selectionPath(racePath, 'skills'), ['skill.perception', 'skill.survival']);
  const trained = new Set(['insight', 'religion', ...(race === 'high-elf' ? ['perception'] : race === 'half-elf' ? ['perception', 'survival'] : race === 'half-orc' ? ['intimidation'] : [])]);
  const expert = new Set();
  const learned = new Set();
  let improvements = 0;
  for (const entry of character.history) {
    const p = character.progressions.find((p) => p.id === entry.progression);
    const cls = p.class.split(':').at(-1);
    const info = classInfo[cls], lvl = entry.level;
    if (lvl === 1) {
      const count = character.history[0].progression === p.id ? info.startingSkills : info.multiclassSkills;
      const chosen = info.skills.filter((s) => !trained.has(s)).slice(0, count);
      select(selectionPath(classEntryPath(p.id, 1, 'entry'), 'skills'), chosen.map((s) => `skill.${s}`));
      chosen.forEach((s) => trained.add(s));
    }
    if (info.asi.includes(lvl)) {
      const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
      const boost = abilities[improvements++ % abilities.length];
      select(classEntryPath(p.id, lvl, 'improvement'), ['ability-score-improvement'], [Object.fromEntries(abilities.map((a) => [a, a === boost ? 2 : 0]))]);
    }
    if (lvl === info.subclassAt) select(classEntryPath(p.id, lvl, 'subclass'), [`${cls}.${info.subclass}`]);
    if (cls === 'fighter' && lvl === 1) select(classEntryPath(p.id, 1, 'fighting-style'), ['style.defense']);
    if (cls === 'fighter' && lvl === 10) select(selectionPath(childPath(pickPath(classEntryPath(p.id, 3, 'subclass'), 'pick-0'), 'progression-additional-style'), 'additional-style'), ['style.archery']);
    if (cls === 'rogue' && [1, 6].includes(lvl)) {
      const choices = [...trained, 'thieves-tools'].filter((s) => !expert.has(s)).slice(0, 2);
      select(classEntryPath(p.id, lvl, 'expertise'), choices.map((s) => `expertise.${s}`));
      choices.forEach((s) => expert.add(s));
    }
    if (cls === 'wizard') {
      const maximumLevel = Math.min(9, Math.ceil(lvl / 2));
      const preference = lvl === 1 ? ['magic-missile', 'shield', 'alarm', 'burning-hands', 'find-familiar', 'mage-armor'] : lvl === 3 ? ['misty-step', 'scorching-ray'] : lvl === 5 ? ['fireball', 'counterspell'] : [];
      const available = wizardSpells.filter((s) => s.level > 0 && s.level <= maximumLevel && !learned.has(s.slug));
      available.sort((a, b) => {
        const ai = preference.indexOf(a.slug), bi = preference.indexOf(b.slug);
        if (ai >= 0 || bi >= 0) return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
        return b.level - a.level || a.slug.localeCompare(b.slug);
      });
      const chosen = available.slice(0, lvl === 1 ? 6 : 2);
      select(classEntryPath(p.id, lvl, 'spellbook'), chosen.map((s) => `spellbook.${s.slug}`));
      chosen.forEach((s) => learned.add(s.slug));
      if (lvl === 1) {
        select(classEntryPath(p.id, 1, 'cantrips'), ['cantrip.fire-bolt', 'cantrip.ray-of-frost', 'cantrip.mage-hand']);
        select(selectionPath(classEntryPath(p.id, 1, 'spellcasting'), 'prepared'), ['prepared.magic-missile']);
      }
      if ([4, 10].includes(lvl)) select(classEntryPath(p.id, lvl, 'cantrip'), [lvl === 4 ? 'cantrip.light' : 'cantrip.chill-touch']);
      if (lvl === 18) {
        const path = classEntryPath(p.id, 18, 'spell-mastery');
        select(selectionPath(path, 'level-1'), ['mastery.magic-missile']);
        select(selectionPath(path, 'level-2'), ['mastery.misty-step']);
      }
      if (lvl === 20) select(selectionPath(classEntryPath(p.id, 20, 'signature-spells'), 'spells'), ['signature.fireball', 'signature.counterspell']);
    }
  }
  const evaluation = engine.evaluate(character);
  for (const pool of Object.values(evaluation.resources)) character.resources[pool.id] ??= { spent: 0 };
  return { engine, character, evaluation: engine.evaluate(character) };
}
