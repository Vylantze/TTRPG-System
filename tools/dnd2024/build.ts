/**
 * Builds the DnD5e 2024 System package in src/systems/dnd5e-2024 from SRD 5.2.1.
 *
 * Run: npm run build:dnd2024
 * Needs .reference-cache/srd-5.2.1-sections.json from tools/extract-dnd2024-srd.py.
 * Every rule is authored once here; repeated data (class spell entries, level
 * entries, ability variants) is generated, and the six option configurations
 * share one System definition by JSON pointer.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { BlockDefinition, ClassDefinition, FeatureDefinition } from '@/src/model.js';
import { coreFeatures, sharedDefinition, validation, type AbilityMethod } from './core.ts';
import { backgrounds, feats, initiateSpells, species } from './origins.ts';
import { castingBlocks, SPELLS, spellFeatures } from './spells.ts';
import { items } from './items.ts';
import { buildClass, type ClassSpec } from './classes/common.ts';
import { fighter } from './classes/fighter.ts';
import { barbarian, monk, rogue } from './classes/martial.ts';
import { bard, cleric, druid, paladin, ranger } from './classes/divine.ts';
import { sorcerer, warlock, wizard } from './classes/arcane.ts';
import { id } from './srd.ts';

const OUT = new URL('../../src/systems/dnd5e-2024/', import.meta.url);
const SYSTEM_ID = 'dnd5e:2024-srd5.2.1';
const CLASSES: ClassSpec[] = [barbarian, bard, cleric, druid, fighter, monk, paladin, ranger, rogue, sorcerer, warlock, wizard];

const blocks: BlockDefinition[] = [
  {
    id: 'core:training',
    parameters: { stat: { kind: 'string' }, rank: { kind: 'number', minimum: 0, integer: true } },
    components: [{ id: 'training', kind: 'modifyStat', stat: { argument: 'stat' }, operation: 'floor', value: { argument: 'rank' } }],
  },
  ...castingBlocks(),
];

const classes: ClassDefinition[] = [];
const classFeatures: FeatureDefinition[] = [];
for (const spec of CLASSES) {
  const built = buildClass(spec);
  classes.push(built.definition);
  classFeatures.push(...built.features);
}

const origin = [...species(), ...backgrounds(), ...feats()];
const lists = (name: string) => SPELLS.filter((entry) => entry.classes.includes(name) && entry.level <= 1).map((entry) => entry.name);
const spells = [...spellFeatures(), ...initiateSpells({ cleric: lists('cleric'), druid: lists('druid'), wizard: lists('wizard') })];
const features = [...coreFeatures(), ...origin];

const all = [...features, ...classFeatures, ...spells];
const ids = new Set<string>();
for (const feature of all) {
  if (ids.has(feature.id)) throw new Error(`Duplicate Feature ID ${feature.id}.`);
  ids.add(feature.id);
}

const tagDisplayNames: Record<string, string> = {
  'class-feature': 'Class Feature',
  'subclass-feature': 'Subclass Feature',
  'subclass': 'Subclasses',
  'species': 'Species',
  'species-trait': 'Species Trait',
  'species-option': 'Species Option',
  'background': 'Background',
  'ability-adjustment': 'Ability Adjustment',
  'feat': 'Feat',
  'origin-feat': 'Origin Feat',
  'general-feat': 'General Feat',
  'fighting-style-feat': 'Fighting Style Feat',
  'epic-boon-feat': 'Epic Boon Feat',
  'skill-proficiency': 'Skill Proficiency',
  'expertise': 'Expertise',
  'tool-proficiency': 'Tool Proficiency',
  'artisan-tools': 'Artisan’s Tools',
  'other-tools': 'Other Tools',
  'language': 'Language',
  'standard-language': 'Standard Language',
  'rare-language': 'Rare Language',
  'weapon-mastery': 'Weapon Mastery',
  'simple-weapon': 'Simple Weapon',
  'martial-weapon': 'Martial Weapon',
  'melee-weapon': 'Melee Weapon',
  'ranged-weapon': 'Ranged Weapon',
  'spell': 'Spell',
  'cantrip': 'Cantrip',
  'leveled-spell': 'Leveled Spell',
  'ritual': 'Ritual',
  'concentration': 'Concentration',
  'resistance': 'Resistance',
  'resource-tracker': 'Resource Tracker',
  'roll-feature': 'Roll Feature',
  'rest-healing': 'Rest Healing',
  'spellcasting-ability-choice': 'Spellcasting Ability',
  ...Object.fromEntries(['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard'].map((name) => [`${name}-list`, `${name[0].toUpperCase()}${name.slice(1)} Spell List`])),
  ...Object.fromEntries(CLASSES.map((spec) => [`${spec.name.toLowerCase()}-subclass`, `${spec.name} Subclasses`])),
};

// Every tag in use gets a display name; generated tags ("wizard-cantrip") are titled from their ID.
for (const tag of new Set(all.flatMap((feature) => feature.tags ?? []))) {
  tagDisplayNames[tag] ??= tag
    .split('-')
    .map((word) => (/^\d+$/.test(word) ? `(level ${word})` : word[0].toUpperCase() + word.slice(1)))
    .join(' ');
}

const shared = sharedDefinition({
  classes: classes.map((entry) => entry.id),
  species: origin.filter((feature) => feature.tags?.includes('species')).map((feature) => feature.id),
  backgrounds: origin.filter((feature) => feature.tags?.includes('background')).map((feature) => feature.id),
  tagDisplayNames,
});

const equipment = items();
const VERSION = '1.0.0';
const asset = (data: unknown) => ({ assetVersion: VERSION, data });
const files: Record<string, unknown> = {
  'definitions.json': asset(shared),
  'classes.json': asset(classes),
  'features.json': asset(features),
  'class-features.json': asset(classFeatures),
  'spells.json': asset(spells),
  'blocks.json': asset(blocks),
  'items.json': asset(equipment.items),
  'item-features.json': asset(equipment.itemFeatures),
};

const methods: AbilityMethod[] = ['standard-array', 'point-buy', 'manual'];
const configurations = methods.flatMap((method) =>
  [false, true].map((multiclass) => ({
    options: { abilityMethod: method, multiclass },
    id: id(`catalogue:${method}:multiclass-${multiclass}`),
    revision: 1,
    system: {
      id: SYSTEM_ID,
      revision: 1,
      name: 'DnD5e 2024',
      allowMultipleClasses: multiclass,
      validation: validation(method),
      ...Object.fromEntries(Object.keys(shared).map((key) => [key, { $ref: `definitions.json#/${key}` }])),
    },
    classes: { $ref: 'classes.json' },
  })),
);

const previous = (() => {
  try {
    return JSON.parse(readFileSync(new URL('system.json', OUT), 'utf8'));
  } catch {
    return undefined;
  }
})();
const manifest = {
  format: 'ttrpg-system',
  // The pre-commit hook raises these versions; keep what is already published.
  contentVersion: previous?.contentVersion ?? VERSION,
  version: 1,
  id: SYSTEM_ID,
  revision: 1,
  options: {
    abilityMethod: { default: 'standard-array', values: methods },
    multiclass: { default: false, values: [false, true] },
  },
  features: [{ $ref: 'features.json' }, { $ref: 'class-features.json' }, { $ref: 'spells.json' }],
  configurations,
  blocks: { $ref: 'blocks.json' },
  items: { $ref: 'items.json' },
  itemFeatures: { $ref: 'item-features.json' },
  // The sample files come from samples.ts; listing them lets the browser version them.
  assetVersions: Object.fromEntries([...Object.keys(files), 'multiclass-sample.json', 'starter-characters.json'].sort().map((path) => [path, previous?.assetVersions?.[path] ?? VERSION])),
};
for (const [path] of Object.entries(files)) (files[path] as { assetVersion: string }).assetVersion = manifest.assetVersions[path];

mkdirSync(OUT, { recursive: true });
for (const [path, value] of Object.entries({ ...files, 'system.json': manifest })) {
  writeFileSync(new URL(path, OUT), `${JSON.stringify(value, null, 2)}\n`);
}
console.log(`DnD5e 2024: ${classes.length} classes, ${all.length} Features (${spells.length} spell entries), ${equipment.items.length} items.`);
