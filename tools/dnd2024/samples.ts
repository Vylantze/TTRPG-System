/**
 * Builds the twelve level 1 sample characters for DnD5e 2024, one per class, from
 * SRD 5.2.1 options only. Names and short descriptions are original to this project.
 *
 * Run after the System build and `npm run build`: npm run build:dnd2024
 * Every choice is made through the engine's own candidate lists, so a sample is
 * written only if the engine finds it valid.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolveSystemFile } from '@/dist/system-package.js';
import { SystemRegistry } from '@/dist/system-loader.js';
import { serializeCharacter } from '@/dist/index.js';
import type { Character } from '@/src/model.js';
import { ABILITIES } from './core.ts';
import { slug } from './srd.ts';

interface Sample {
  name: string;
  cls: string;
  species: string;
  background: string;
  /** Standard Array in ability order: Str, Dex, Con, Int, Wis, Cha. */
  scores: number[];
  /** Background increase: the ability that gets +2, then +1. */
  increase: [string, string];
  /** Preferred picks, as Feature ID endings, in priority order. */
  prefer: string[];
  armor?: string;
  shield?: boolean;
  alignment: string;
  about: string;
}

const SAMPLES: Sample[] = [
  { name: 'Grusha Ironhide', cls: 'barbarian', species: 'orc', background: 'soldier', scores: [15, 13, 14, 8, 12, 10], increase: ['strength', 'constitution'], prefer: ['skill.athletics', 'skill.perception', 'mastery.greataxe', 'mastery.handaxe', 'language.giant', 'language.dwarvish', 'tool.gaming-set'], alignment: 'Chaotic good', about: 'A former caravan guard who fights to keep the road open for others.' },
  { name: 'Tamsin Quickreel', cls: 'bard', species: 'gnome', background: 'criminal', scores: [8, 14, 13, 12, 10, 15], increase: ['dexterity', 'constitution'], prefer: ['lineage.rock-gnome', 'rock-gnome.charisma', 'skill.performance', 'skill.persuasion', 'skill.deception', 'tool.musical-instrument', 'language.halfling', 'language.elvish', 'bard.spell.vicious-mockery', 'bard.spell.minor-illusion', 'bard.spell.healing-word', 'bard.spell.charm-person', 'bard.spell.dissonant-whispers', 'bard.spell.faerie-fire'], armor: 'Leather Armor', alignment: 'Neutral good', about: 'A travelling performer whose songs open more doors than lockpicks.' },
  { name: 'Maren Vale', cls: 'cleric', species: 'human', background: 'acolyte', scores: [13, 8, 14, 10, 15, 12], increase: ['wisdom', 'charisma'], prefer: ['size.medium', 'skill.medicine', 'skill.insight', 'skill.persuasion', 'feat.skilled', 'skill.history', 'skill.perception', 'tool.herbalism-kit', 'divine-order.protector', 'language.halfling', 'language.dwarvish', 'cleric.spell.guidance', 'cleric.spell.sacred-flame', 'cleric.spell.thaumaturgy', 'cleric.spell.bless', 'cleric.spell.cure-wounds', 'cleric.spell.guiding-bolt', 'cleric.spell.shield-of-faith', 'magic-initiate.cleric.wisdom', 'spare-the-dying', 'light', 'sanctuary'], armor: 'Chain Shirt', shield: true, alignment: 'Lawful good', about: 'A temple healer who left the cloister to tend the wounded on the frontier.' },
  { name: 'Fennick Mossbottle', cls: 'druid', species: 'gnome', background: 'sage', scores: [8, 13, 14, 12, 15, 10], increase: ['wisdom', 'constitution'], prefer: ['lineage.forest-gnome', 'forest-gnome.wisdom', 'skill.nature', 'skill.animal-handling', 'tool.herbalism-kit', 'primal-order.magician', 'language.elvish', 'language.halfling', 'druid.spell.produce-flame', 'druid.spell.guidance', 'druid.spell.shillelagh', 'druid.spell.entangle', 'druid.spell.healing-word', 'druid.spell.faerie-fire', 'druid.spell.thunderwave', 'magic-initiate.wizard.wisdom', 'mage-hand', 'prestidigitation', 'magic-missile'], armor: 'Leather Armor', shield: true, alignment: 'Neutral', about: 'A herbalist who keeps meticulous notes on every mushroom in the Old Wood.' },
  { name: 'Brakka Stonewatch', cls: 'fighter', species: 'goliath', background: 'soldier', scores: [15, 13, 14, 8, 12, 10], increase: ['strength', 'constitution'], prefer: ['giant-ancestry.stone-giant', 'skill.perception', 'skill.survival', 'feat.defense', 'mastery.greatsword', 'mastery.flail', 'mastery.javelin', 'language.giant', 'language.dwarvish', 'tool.gaming-set'], armor: 'Chain Mail', alignment: 'Lawful neutral', about: 'A mountain sentinel who swore to hold the pass until relieved.' },
  { name: 'Jory Stillwater', cls: 'monk', species: 'human', background: 'criminal', scores: [12, 15, 13, 10, 14, 8], increase: ['dexterity', 'constitution'], prefer: ['size.medium', 'skill.acrobatics', 'skill.stealth', 'skill.athletics', 'feat.alert', 'tool.brewers-supplies', 'language.elvish', 'language.halfling', 'magic-initiate.cleric.wisdom', 'guidance', 'spare-the-dying', 'cure-wounds'], alignment: 'Lawful neutral', about: 'A brewer from a hillside monastery, calm until someone threatens the vineyard.' },
  { name: 'Torbin Oathhammer', cls: 'paladin', species: 'dwarf', background: 'acolyte', scores: [15, 10, 13, 8, 12, 14], increase: ['charisma', 'wisdom'], prefer: ['skill.athletics', 'skill.persuasion', 'mastery.longsword', 'mastery.javelin', 'language.dwarvish', 'language.giant', 'paladin.spell.bless', 'paladin.spell.cure-wounds', 'magic-initiate.cleric.charisma', 'guidance', 'sacred-flame', 'shield-of-faith'], armor: 'Chain Mail', shield: true, alignment: 'Lawful good', about: 'A shrine guardian who carries his clan’s oath carved into his shield.' },
  { name: 'Taeral Brightleaf', cls: 'ranger', species: 'elf', background: 'soldier', scores: [12, 15, 13, 8, 14, 10], increase: ['dexterity', 'constitution'], prefer: ['lineage.wood-elf', 'wood-elf.wisdom', 'skill.survival', 'skill.stealth', 'skill.nature', 'skill.perception', 'mastery.longbow', 'mastery.scimitar', 'language.elvish', 'language.common-sign-language', 'tool.gaming-set', 'ranger.spell.hunters-mark', 'ranger.spell.cure-wounds'], armor: 'Studded Leather Armor', alignment: 'Neutral good', about: 'A border scout who tracks raiders through the marshes.' },
  { name: 'Pip Underbough', cls: 'rogue', species: 'halfling', background: 'criminal', scores: [8, 15, 13, 12, 14, 10], increase: ['dexterity', 'constitution'], prefer: ['skill.perception', 'skill.acrobatics', 'skill.insight', 'skill.investigation', 'expertise.stealth', 'expertise.sleight-of-hand', 'mastery.shortsword', 'mastery.shortbow', 'language.halfling', 'language.goblin', 'language.elvish'], armor: 'Leather Armor', alignment: 'Chaotic neutral', about: 'A charming pickpocket repaying a debt one favour at a time.' },
  { name: 'Vexira Embersong', cls: 'sorcerer', species: 'dragonborn', background: 'sage', scores: [10, 13, 14, 12, 8, 15], increase: ['constitution', 'intelligence'], prefer: ['ancestry.red', 'skill.arcana', 'skill.persuasion', 'language.draconic', 'language.elvish', 'sorcerer.spell.fire-bolt', 'sorcerer.spell.light', 'sorcerer.spell.mage-hand', 'sorcerer.spell.prestidigitation', 'sorcerer.spell.burning-hands', 'sorcerer.spell.shield', 'magic-initiate.wizard.charisma', 'ray-of-frost', 'minor-illusion', 'magic-missile'], alignment: 'Chaotic good', about: 'A scholar of draconic lore whose ancestry stirs whenever she casts.' },
  { name: 'Morrow Ashfall', cls: 'warlock', species: 'tiefling', background: 'criminal', scores: [8, 14, 13, 12, 10, 15], increase: ['dexterity', 'constitution'], prefer: ['size.medium', 'legacy.infernal', 'infernal.charisma', 'skill.deception', 'skill.intimidation', 'eldritch-invocations.pact-of-the-tome', 'eldritch-invocations.armor-of-shadows', 'language.common-sign-language', 'language.goblin', 'warlock.spell.eldritch-blast', 'warlock.spell.minor-illusion', 'warlock.spell.hex', 'warlock.spell.protection-from-evil-and-good'], armor: 'Leather Armor', alignment: 'Neutral', about: 'A fixer in the city’s shadow markets who made a bargain to stay ahead.' },
  { name: 'Ilyra Moonquill', cls: 'wizard', species: 'elf', background: 'sage', scores: [8, 14, 13, 15, 12, 10], increase: ['intelligence', 'constitution'], prefer: ['lineage.high-elf', 'high-elf.intelligence', 'skill.arcana', 'skill.history', 'skill.investigation', 'skill.perception', 'language.draconic', 'language.dwarvish', 'wizard.spell.fire-bolt', 'wizard.spell.mage-hand', 'wizard.spell.light', 'wizard.spell.magic-missile', 'wizard.spell.shield', 'wizard.spell.mage-armor', 'wizard.spell.detect-magic', 'magic-initiate.wizard.intelligence', 'ray-of-frost', 'minor-illusion', 'sleep'], alignment: 'Chaotic good', about: 'A library archivist chasing a misfiled spell across the continent.' },
];

const dir = new URL('../../src/systems/dnd5e-2024/', import.meta.url);
const read = (name: string) => JSON.parse(readFileSync(new URL(name, dir), 'utf8'));
const documents = Object.fromEntries(readdirSync(dir).filter((name) => name.endsWith('.json') && name !== 'system.json' && name !== 'starter-characters.json' && name !== 'multiclass-sample.json').map((name) => [name, read(name)]));
const manifest = read('system.json');
const registry = new SystemRegistry();
const system = registry.load(resolveSystemFile(manifest, documents));
const engine = registry.createEngine(system.id, system.revision, { abilityMethod: 'standard-array', multiclass: false });
const itemsByName = new Map<string, string>((documents['items.json'] as { data: { id: string; name: string }[] }).data.map((item) => [item.name.toLowerCase(), item.id]));

/** Parse "(A) Chain Mail, Greatsword, 8 Javelins, ... and 4 GP" into items and gold. */
function equipment(text: string) {
  const option = /\(A\) (.+?)(?:; or \(B\)|; \(B\))/.exec(text)?.[1] ?? '';
  const result: { item: string; quantity: number }[] = [];
  let gold = 0;
  const missing: string[] = [];
  for (const raw of option.replace(/,? and /g, ', ').split(/, /)) {
    const match = /^(\d+) (.+)$/.exec(raw.trim());
    const quantity = match ? Number(match[1]) : 1;
    const name = (match ? match[2] : raw.trim()).replace(/ \(.*\)$/, '').replace(/ of your choice$/, '').replace('Short sword', 'Shortsword');
    if (name === 'GP') {
      gold += quantity;
      continue;
    }
    const item = itemsByName.get(name.toLowerCase()) ?? itemsByName.get(name.toLowerCase().replace(/s$/, '')) ?? itemsByName.get(name.toLowerCase().replace(/es$/, ''));
    if (item) result.push({ item, quantity });
    else missing.push(match ? raw.trim() : name);
  }
  return { items: result, gold, missing };
}

function fill(character: Character, prefer: string[], rules = engine) {
  const rank = (feature: string) => {
    const index = prefer.findIndex((ending) => feature.endsWith(`.${ending}`) || feature.endsWith(`:${ending}`));
    return index < 0 ? prefer.length : index;
  };
  for (let round = 0; round < 40; round += 1) {
    const result = rules.evaluate(character);
    let changed = false;
    for (const selection of result.selections) {
      const optional = selection.minimum === 0;
      const want = optional ? selection.maximum : selection.minimum;
      if (selection.picks.length >= want) continue;
      const taken = new Set(selection.picks.map((pick) => pick.feature));
      const candidates = rules
        .getCandidates(character, selection.id)
        .filter((candidate) => candidate.status !== 'invalid' && !taken.has(candidate.feature) && (!optional || rank(candidate.feature) < prefer.length))
        .sort((a, b) => rank(a.feature) - rank(b.feature) || a.feature.localeCompare(b.feature));
      if (!candidates.length) continue;
      const picks = [...(character.selections[selection.id] ?? [])];
      for (const candidate of candidates.slice(0, want - selection.picks.length)) picks.push({ id: `pick-${picks.length}`, feature: candidate.feature });
      character.selections[selection.id] = picks;
      changed = true;
    }
    if (!changed) return result;
  }
  return rules.evaluate(character);
}

const characters = SAMPLES.map((sample) => {
  const key = `${slug(sample.species)}-${sample.cls}-${sample.background}`;
  const character = engine.createCharacter(`sample-2024-${key}`, sample.name, [{ id: 'class-0', class: `dnd5e:2024:${sample.cls}`, level: 1 }]);
  ABILITIES.forEach((ability, index) => (character.inputs[`base.${ability}`] = sample.scores[index]));
  character.inputs.armorIndex = 0;
  character.inputs.shield = 0;
  character.selections['advancement/0/species'] = [{ id: 'pick-0', feature: `dnd5e:2024:species.${sample.species}` }];
  character.selections['advancement/0/background'] = [{ id: 'pick-0', feature: `dnd5e:2024:background.${sample.background}` }];
  fill(character, sample.prefer);
  // The background's +2/+1 split is a parameter of its ability-score pick.
  const abilityPath = 'advancement/0/background/pick/pick-0/choice/ability-scores';
  const [plusTwo, plusOne] = sample.increase;
  character.selections[abilityPath] = [{ id: 'pick-0', feature: `dnd5e:2024:background.${sample.background}.ability-scores`, parameters: Object.fromEntries(Object.keys(engine.getFeature(`dnd5e:2024:background.${sample.background}.ability-scores`)!.parameters!).map((ability) => [ability, ability === plusTwo ? 2 : ability === plusOne ? 1 : 0])) }];
  const classEquipment = equipment((engine.getFeature(`dnd5e:2024:${sample.cls}.core-traits`)!.components.find((component) => component.id === 'equipment') as { text: string }).text);
  const backgroundEquipment = equipment((engine.getFeature(`dnd5e:2024:background.${sample.background}`)!.components.find((component) => component.id === 'equipment') as { text: string }).text);
  // Class and background can both give the same item (two pairs of Daggers): one entry.
  const owned: { item: string; quantity: number }[] = [];
  for (const entry of [...classEquipment.items, ...backgroundEquipment.items]) {
    const existing = owned.find((candidate) => candidate.item === entry.item);
    if (existing) existing.quantity += entry.quantity;
    else owned.push({ ...entry });
  }
  character.money = { gp: classEquipment.gold + backgroundEquipment.gold };
  character.inventory = owned.map((entry, index) => ({ id: `starting-${index}`, item: entry.item, quantity: entry.quantity, equipped: entry.item.endsWith(`.${slug(sample.armor ?? '-')}`) || (!!sample.shield && entry.item.endsWith('.shield')) }));
  const result = engine.evaluate(character);
  if (result.status !== 'valid') throw new Error(`${key}: ${result.diagnostics.map((entry) => `${entry.code} ${entry.path ?? ''} ${entry.message}`).join('; ')}`);
  character.notes = {
    'Alignment': sample.alignment,
    'About': sample.about,
    'Sample scope': 'Level 1 sample built from SRD 5.2.1 options with the Standard Array and starting equipment option A. Every choice can be changed.',
    ...(classEquipment.missing.length || backgroundEquipment.missing.length ? { 'Equipment not in the item list': [...classEquipment.missing, ...backgroundEquipment.missing].join(', ') } : {}),
  };
  character.buildState = 'finalized';
  for (const pool of Object.values(result.resources)) character.resources[pool.id] = { spent: 0, ...(pool.tracking ? { current: pool.key === 'hit-points' ? pool.capacity : pool.current } : {}) };
  serializeCharacter(character);
  return character;
});

const version = manifest.assetVersions?.['starter-characters.json'] ?? '1.0.0';
writeFileSync(new URL('starter-characters.json', dir), `${JSON.stringify({ assetVersion: version, data: characters }, null, 2)}\n`);

// A multiclass sample: Fighter 3, then Wizard 2 (multiclass needs Int 13 and Str or Dex 13).
const multiclassRules = registry.createEngine(system.id, system.revision, { abilityMethod: 'standard-array', multiclass: true });
const rook = multiclassRules.createCharacter('sample-2024-human-fighter-wizard', 'Rook Ashveil — Fighter / Wizard', [
  { id: 'class-0', class: 'dnd5e:2024:fighter', level: 3 },
  { id: 'class-1', class: 'dnd5e:2024:wizard', level: 2 },
]);
rook.history = [1, 2, 3].map((level) => ({ progression: 'class-0', level })).concat([1, 2].map((level) => ({ progression: 'class-1', level })));
ABILITIES.forEach((ability, index) => (rook.inputs[`base.${ability}`] = [15, 13, 14, 12, 10, 8][index]));
rook.inputs.armorIndex = 0;
rook.inputs.shield = 0;
rook.selections['advancement/0/species'] = [{ id: 'pick-0', feature: 'dnd5e:2024:species.human' }];
rook.selections['advancement/0/background'] = [{ id: 'pick-0', feature: 'dnd5e:2024:background.sage' }];
fill(rook, ['size.medium', 'feat.skilled', 'skill.athletics', 'skill.perception', 'skill.investigation', 'feat.defense', 'mastery.longsword', 'mastery.longbow', 'mastery.javelin', 'fighter.subclass.champion', 'language.elvish', 'language.dwarvish', 'magic-initiate.wizard.intelligence', 'wizard.spell.fire-bolt', 'wizard.spell.mage-hand', 'wizard.spell.light', 'wizard.spell.shield', 'wizard.spell.magic-missile', 'wizard.spell.find-familiar', 'ray-of-frost', 'minor-illusion', 'sleep', 'expertise.arcana', 'tool.smiths-tools'], multiclassRules);
rook.selections['advancement/0/background/pick/pick-0/choice/ability-scores'] = [{ id: 'pick-0', feature: 'dnd5e:2024:background.sage.ability-scores', parameters: { constitution: 1, intelligence: 2, wisdom: 0 } }];
const rookResult = multiclassRules.evaluate(rook);
if (rookResult.status !== 'valid') throw new Error(`multiclass sample: ${rookResult.diagnostics.map((entry) => `${entry.code} ${entry.path ?? ''} ${entry.message}`).join('; ')}`);
rook.notes = { 'Alignment': 'Neutral good', 'About': 'A soldier who found a spellbook in a fallen officer’s pack and never looked back.', 'Sample scope': 'Multiclass sample from SRD 5.2.1 options. Fighter levels were taken first.' };
rook.buildState = 'finalized';
for (const pool of Object.values(rookResult.resources)) rook.resources[pool.id] = { spent: 0, ...(pool.tracking ? { current: pool.key === 'hit-points' ? pool.capacity : pool.current } : {}) };
serializeCharacter(rook);
writeFileSync(new URL('multiclass-sample.json', dir), `${JSON.stringify({ assetVersion: manifest.assetVersions?.['multiclass-sample.json'] ?? '1.0.0', data: rook }, null, 2)}\n`);
console.log(`Generated ${characters.length} valid DnD5e 2024 sample characters and a multiclass sample.`);
