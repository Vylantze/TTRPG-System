import { starterInventory } from '@/tools/starter-inventory.mjs';
import { writeFileSync } from 'node:fs';
import { classEntryPath, selectionPath, pickPath, serializeCharacter } from '@/dist/index.js';
import { createDnd2014Engine } from '@/dist/systems/dnd5e-2014/index.js';

const engine = createDnd2014Engine();
const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
const templates = [
  { key: 'human-fighter-noble', name: 'Human Fighter — Noble', cls: 'fighter', race: 'human', background: 'noble', base: [15, 8, 14, 10, 12, 13], skills: ['athletics', 'perception'], style: 'defense', page: 1, alignment: 'Lawful neutral', attacks: 'Greataxe +5, 1d12+3 slashing; javelin +5, 1d6+3 piercing, range 30/120 ft.' },
  { key: 'hill-dwarf-cleric-soldier', name: 'Hill Dwarf Cleric — Soldier', cls: 'cleric', race: 'hill-dwarf', background: 'soldier', base: [14, 8, 13, 10, 15, 12], skills: ['medicine', 'religion'], page: 3, alignment: 'Neutral good', attacks: 'Warhammer +4, 1d8+2 bludgeoning; handaxe +4, 1d6+2 slashing, range 20/60 ft.' },
  { key: 'lightfoot-halfling-rogue-criminal', name: 'Lightfoot Halfling Rogue — Criminal', cls: 'rogue', race: 'lightfoot-halfling', background: 'criminal', base: [8, 14, 12, 13, 10, 15], skills: ['acrobatics', 'investigation', 'performance', 'sleight-of-hand'], page: 5, alignment: 'Neutral', attacks: 'Shortsword +5, 1d6+3 piercing; shortbow +5, 1d6+3 piercing, range 80/320 ft. Sneak Attack: +1d6 when eligible.' },
  { key: 'high-elf-wizard-acolyte', name: 'High Elf Wizard — Acolyte', cls: 'wizard', race: 'high-elf', background: 'acolyte', base: [10, 13, 14, 15, 12, 8], skills: ['arcana', 'history'], page: 7, alignment: 'Chaotic good', attacks: 'Shortsword +4, 1d6+2 piercing.' },
  { key: 'human-fighter-folk-hero', name: 'Human Fighter — Folk Hero', cls: 'fighter', race: 'human', background: 'folk-hero', base: [13, 15, 14, 10, 12, 8], skills: ['history', 'perception'], style: 'archery', page: 9, alignment: 'Lawful good', attacks: 'Greatsword +4, 2d6+2 slashing; longbow +7, 1d8+3 piercing, range 150/600 ft.' },
];
const characters = templates.map((t) => {
  const c = engine.createCharacter(`starter-2014-${t.key}`, t.name, [{ id: 'class-0', class: `dnd5e:2014:${t.cls}`, level: 1 }]);
  const select = (path, names) => {
    c.selections[path] = names.map((name, i) => ({ id: `pick-${i}`, feature: `dnd5e:2014:${name}` }));
    return names.map((_, i) => pickPath(path, `pick-${i}`));
  };
  abilities.forEach((a, i) => c.inputs[`base.${a}`] = t.base[i]);
  c.inputs.armorIndex = 0;
  c.inputs.shield = 0;
  c.money = { gp: starterInventory[t.key].find(([item]) => item === 'gold-piece')?.[1] ?? 0 };
  c.inventory = starterInventory[t.key].filter(([item]) => item !== 'gold-piece').map(([item, quantity], index) => ({ id: `starting-${index}`, item: `dnd5e:2014:item.${item}`, quantity, equipped: ['chain-mail', 'leather-armor', 'shield'].includes(item) }));
  const [race] = select('advancement/0/race', [`race.${t.race}`]);
  const [background] = select('advancement/0/background', [`background.${t.background}`]);
  select(selectionPath(classEntryPath('class-0', 1, 'entry'), 'skills'), t.skills.map((s) => `skill.${s}`));
  if (t.race === 'human') select(selectionPath(race, 'language'), [`language.${t.background === 'noble' ? 'draconic' : 'elvish'}`]);
  if (t.background === 'noble') select(selectionPath(background, 'language'), ['language.dwarvish']);
  if (t.style) select(classEntryPath('class-0', 1, 'fighting-style'), [`style.${t.style}`]);
  if (t.cls === 'rogue') select(classEntryPath('class-0', 1, 'expertise'), ['expertise.stealth', 'expertise.thieves-tools']);
  if (t.cls === 'cleric') {
    select(selectionPath(race, 'artisan-tool'), ['tool.mason']);
    select(classEntryPath('class-0', 1, 'cantrips'), ['light', 'sacred-flame', 'thaumaturgy'].map((s) => `cleric.cantrip.${s}`));
    select(selectionPath(classEntryPath('class-0', 1, 'spellcasting'), 'prepared'), ['command', 'detect-magic', 'guiding-bolt', 'shield-of-faith'].map((s) => `cleric.prepared.${s}`));
  }
  if (t.cls === 'wizard') {
    select(selectionPath(race, 'language'), ['language.draconic']);
    select(selectionPath(race, 'cantrip'), ['racial-cantrip.shocking-grasp']);
    select(selectionPath(background, 'insight'), ['skill.insight']);
    select(selectionPath(background, 'religion'), ['skill.religion']);
    select(selectionPath(background, 'languages'), ['language.dwarvish', 'language.goblin']);
    select(classEntryPath('class-0', 1, 'cantrips'), ['mage-hand', 'prestidigitation', 'ray-of-frost'].map((s) => `cantrip.${s}`));
    select(classEntryPath('class-0', 1, 'spellbook'), ['burning-hands', 'detect-magic', 'mage-armor', 'magic-missile', 'shield', 'sleep'].map((s) => `spellbook.${s}`));
    select(selectionPath(classEntryPath('class-0', 1, 'spellcasting'), 'prepared'), ['burning-hands', 'mage-armor', 'magic-missile', 'shield'].map((s) => `prepared.${s}`));
  }
  c.notes = { 'Source': `https://media.wizards.com/downloads/dnd/StarterSet_Charactersv2.pdf#page=${t.page}`, 'Alignment': t.alignment, 'Starting attacks (reference only)': `${t.attacks} These printed starting values do not recalculate when you edit the build.`, 'Template scope': 'Level 1. The source leaves the character name blank; this descriptive name is editable. See the linked original for personality, history, and background Feature text.' };
  if (t.cls === 'cleric' || t.cls === 'wizard') c.notes['Prepared spells'] = 'The source leaves daily preparation to the player. The selected prepared spells are editable application defaults, not printed selections.';
  const result = engine.evaluate(c);
  if (result.status !== 'valid') throw new Error(`${t.key}: ${JSON.stringify(result.diagnostics)}`);
  c.buildState = 'finalized';
  for (const pool of Object.values(result.resources)) c.resources[pool.id] = { spent: 0, ...(pool.tracking ? { current: pool.key === 'hit-points' ? pool.capacity : pool.current } : {}) };
  serializeCharacter(c);
  return c;
});
writeFileSync(new URL('../src/systems/dnd5e-2014/starter-characters.json', import.meta.url), JSON.stringify(characters, null, 2) + '\n');
console.log(`Generated ${characters.length} valid Starter Set characters.`);
