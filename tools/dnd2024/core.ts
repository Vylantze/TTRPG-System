import type { Expression, FeatureDefinition, ScalingTable, StatDefinition, SystemDefinition } from '@/src/model.js';
import type { SheetSection } from '@/src/model/SheetSection.js';
import type { AbilityMethod } from './types/AbilityMethod.ts';

export type { AbilityMethod };
import { id, quote, section, sectionStarting, slug, source } from './srd.ts';

export const ABILITIES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const;
export type Ability = (typeof ABILITIES)[number];
export const title = (word: string) => word[0].toUpperCase() + word.slice(1);

export const SKILLS: [string, Ability][] = [
  ['Acrobatics', 'dexterity'],
  ['Animal Handling', 'wisdom'],
  ['Arcana', 'intelligence'],
  ['Athletics', 'strength'],
  ['Deception', 'charisma'],
  ['History', 'intelligence'],
  ['Insight', 'wisdom'],
  ['Intimidation', 'charisma'],
  ['Investigation', 'intelligence'],
  ['Medicine', 'wisdom'],
  ['Nature', 'intelligence'],
  ['Perception', 'wisdom'],
  ['Performance', 'charisma'],
  ['Persuasion', 'charisma'],
  ['Religion', 'intelligence'],
  ['Sleight of Hand', 'dexterity'],
  ['Stealth', 'dexterity'],
  ['Survival', 'wisdom'],
];
export const skill = (name: string) => id(`skill.${slug(name)}`);

/** Artisan's Tools and Other Tools (SRD 5.2.1 pp. 93–94), with the ability each tool uses. */
export const TOOLS: [string, Ability, 'artisan' | 'other'][] = [
  ['Alchemist’s Supplies', 'intelligence', 'artisan'],
  ['Brewer’s Supplies', 'intelligence', 'artisan'],
  ['Calligrapher’s Supplies', 'dexterity', 'artisan'],
  ['Carpenter’s Tools', 'strength', 'artisan'],
  ['Cartographer’s Tools', 'wisdom', 'artisan'],
  ['Cobbler’s Tools', 'dexterity', 'artisan'],
  ['Cook’s Utensils', 'wisdom', 'artisan'],
  ['Glassblower’s Tools', 'intelligence', 'artisan'],
  ['Jeweler’s Tools', 'intelligence', 'artisan'],
  ['Leatherworker’s Tools', 'dexterity', 'artisan'],
  ['Mason’s Tools', 'strength', 'artisan'],
  ['Painter’s Supplies', 'wisdom', 'artisan'],
  ['Potter’s Tools', 'intelligence', 'artisan'],
  ['Smith’s Tools', 'strength', 'artisan'],
  ['Tinker’s Tools', 'dexterity', 'artisan'],
  ['Weaver’s Tools', 'dexterity', 'artisan'],
  ['Woodcarver’s Tools', 'dexterity', 'artisan'],
  ['Disguise Kit', 'charisma', 'other'],
  ['Forgery Kit', 'dexterity', 'other'],
  ['Gaming Set', 'wisdom', 'other'],
  ['Herbalism Kit', 'intelligence', 'other'],
  ['Musical Instrument', 'charisma', 'other'],
  ['Navigator’s Tools', 'wisdom', 'other'],
  ['Poisoner’s Kit', 'intelligence', 'other'],
  ['Thieves’ Tools', 'dexterity', 'other'],
];
export const tool = (name: string) => id(`tool.${slug(name)}`);

export const STANDARD_LANGUAGES = ['Common Sign Language', 'Draconic', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc'];
export const RARE_LANGUAGES = ['Abyssal', 'Celestial', 'Deep Speech', 'Druidic', 'Infernal', 'Primordial', 'Sylvan', 'Thieves’ Cant', 'Undercommon'];
export const language = (name: string) => id(`language.${slug(name)}`);

/**
 * Weapons table (SRD 5.2.1 pp. 90–91). Masteries follow the table's Mastery column;
 * the extracted text keeps that column in row order, which the builder test checks.
 */
export const WEAPONS: [string, 'simple' | 'martial', 'melee' | 'ranged', string][] = [
  ['Club', 'simple', 'melee', 'Slow'],
  ['Dagger', 'simple', 'melee', 'Nick'],
  ['Greatclub', 'simple', 'melee', 'Push'],
  ['Handaxe', 'simple', 'melee', 'Vex'],
  ['Javelin', 'simple', 'melee', 'Slow'],
  ['Light Hammer', 'simple', 'melee', 'Nick'],
  ['Mace', 'simple', 'melee', 'Sap'],
  ['Quarterstaff', 'simple', 'melee', 'Topple'],
  ['Sickle', 'simple', 'melee', 'Nick'],
  ['Spear', 'simple', 'melee', 'Sap'],
  ['Dart', 'simple', 'ranged', 'Vex'],
  ['Light Crossbow', 'simple', 'ranged', 'Slow'],
  ['Shortbow', 'simple', 'ranged', 'Vex'],
  ['Sling', 'simple', 'ranged', 'Slow'],
  ['Battleaxe', 'martial', 'melee', 'Topple'],
  ['Flail', 'martial', 'melee', 'Sap'],
  ['Glaive', 'martial', 'melee', 'Graze'],
  ['Greataxe', 'martial', 'melee', 'Cleave'],
  ['Greatsword', 'martial', 'melee', 'Graze'],
  ['Halberd', 'martial', 'melee', 'Cleave'],
  ['Lance', 'martial', 'melee', 'Topple'],
  ['Longsword', 'martial', 'melee', 'Sap'],
  ['Maul', 'martial', 'melee', 'Topple'],
  ['Morningstar', 'martial', 'melee', 'Sap'],
  ['Pike', 'martial', 'melee', 'Push'],
  ['Rapier', 'martial', 'melee', 'Vex'],
  ['Scimitar', 'martial', 'melee', 'Nick'],
  ['Shortsword', 'martial', 'melee', 'Vex'],
  ['Trident', 'martial', 'melee', 'Topple'],
  ['Warhammer', 'martial', 'melee', 'Push'],
  ['War Pick', 'martial', 'melee', 'Sap'],
  ['Whip', 'martial', 'melee', 'Slow'],
  ['Blowgun', 'martial', 'ranged', 'Vex'],
  ['Hand Crossbow', 'martial', 'ranged', 'Vex'],
  ['Heavy Crossbow', 'martial', 'ranged', 'Push'],
  ['Longbow', 'martial', 'ranged', 'Slow'],
  ['Musket', 'martial', 'ranged', 'Slow'],
  ['Pistol', 'martial', 'ranged', 'Vex'],
];
export const mastery = (weapon: string) => id(`mastery.${slug(weapon)}`);

/** Finesse and Light properties from the Weapons table, for class weapon lists. */
export const FINESSE = ['Dagger', 'Dart', 'Rapier', 'Scimitar', 'Shortsword', 'Whip'];
export const LIGHT = ['Club', 'Dagger', 'Handaxe', 'Light Hammer', 'Sickle', 'Scimitar', 'Shortsword', 'Hand Crossbow'];

/** The standard Hit Point Dice; each class adds one die per level to its capacity stat. */
export const HIT_DICE = [6, 8, 10, 12] as const;

const TABLES = id('tables');
const table = (name: string, input: Expression): Expression => ({ table: name, owner: TABLES, input });
const exact = (rows: [number, number][]): ScalingTable => ({
  mode: 'exact',
  rows: rows.map(([key, value]) => ({ key, value })),
  below: 'error',
  above: 'error',
  missing: 'error',
});
const add = (...args: Expression[]): Expression => ({ op: 'add', args });
const derived = (statId: string, expression: Expression, name = statId, extra: Partial<StatDefinition> = {}): StatDefinition =>
  ({ id: statId, name, kind: 'derived', expression, ...extra }) as StatDefinition;
const trained = (stat: string, modifier: string): Expression => add({ stat: modifier }, { op: 'multiply', args: [{ stat }, { stat: 'proficiencyBonus' }] });

/** Full-caster Spell Slots by caster level (SRD 5.2.1, Multiclass Spellcaster table). */
const SLOTS = [
  [],
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/**
 * Armor table rows (SRD 5.2.1 p. 92). Index 0 is unarmored; the order matches the
 * sheet's armor input: Padded, Leather, Studded Leather, Hide, Chain Shirt, Scale Mail,
 * Breastplate, Half Plate, Ring Mail, Chain Mail, Splint, Plate.
 */
export const ARMOR = ['None', 'Padded Armor', 'Leather Armor', 'Studded Leather Armor', 'Hide Armor', 'Chain Shirt', 'Scale Mail', 'Breastplate', 'Half Plate Armor', 'Ring Mail', 'Chain Mail', 'Splint Armor', 'Plate Armor'];
const ARMOR_BASE = [10, 11, 11, 12, 12, 13, 14, 14, 15, 14, 16, 17, 18];
const ARMOR_CATEGORY = [0, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3];
const ARMOR_STRENGTH = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 13, 15, 15];

export function tablesFeature(): FeatureDefinition {
  const indexed = (values: number[]) => exact(values.map((value, index) => [index, value]));
  return {
    id: TABLES,
    revision: 1,
    name: 'DnD5e 2024 rules tables',
    source: source(21),
    components: [],
    tables: {
      pointBuy: exact([
        [8, 0],
        [9, 1],
        [10, 2],
        [11, 3],
        [12, 4],
        [13, 5],
        [14, 7],
        [15, 9],
      ]),
      armorBase: indexed(ARMOR_BASE),
      armorCategory: indexed(ARMOR_CATEGORY),
      armorDexterityCap: indexed(ARMOR_CATEGORY.map((category) => (category === 2 ? 2 : category === 3 ? 0 : 99))),
      armorStrength: indexed(ARMOR_STRENGTH),
      ...Object.fromEntries(
        Array.from({ length: 9 }, (_, slot) => [`slots${slot + 1}`, indexed(SLOTS.map((row) => row[slot] ?? 0))]),
      ),
    },
  };
}

function stats(): StatDefinition[] {
  const list: StatDefinition[] = [];
  const defaults: Record<Ability, number> = { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 };
  for (const ability of ABILITIES) {
    list.push({ id: `base.${ability}`, name: `Base ${ability}`, kind: 'input', default: defaults[ability], integer: true, minimum: 3, maximum: 18 });
  }
  for (const ability of ABILITIES) {
    list.push(derived(ability, { stat: `base.${ability}` }, title(ability), { minimum: 1, maximum: 30, clamp: true, integer: true }));
    list.push(derived(`modifier.${ability}`, { op: 'floor', args: [{ op: 'divide', args: [{ op: 'subtract', args: [{ stat: ability }, 10] }, 2] }] }, `${title(ability)} modifier`));
  }
  list.push(
    derived('proficiencyBonus', {
      if: { op: 'gt', args: [{ context: 'characterLevel' }, 0] },
      then: add(2, { op: 'floor', args: [{ op: 'divide', args: [{ op: 'subtract', args: [{ context: 'characterLevel' }, 1] }, 4] }] }),
      else: 0,
    }, 'Proficiency Bonus'),
  );
  for (const ability of ABILITIES) {
    list.push(derived(`training.save.${ability}`, 0, `${title(ability)} save training`));
    list.push(derived(`save.${ability}`, trained(`training.save.${ability}`, `modifier.${ability}`), `${title(ability)} saving throw`));
  }
  for (const [name, ability] of SKILLS) {
    const key = slug(name);
    list.push(derived(`training.skill.${key}`, 0, `${name} training`));
    list.push(derived(`skill.${key}`, trained(`training.skill.${key}`, `modifier.${ability}`), name));
  }
  for (const [name] of TOOLS) list.push(derived(`training.tool.${slug(name)}`, 0, `${name} training`));
  for (const kind of ['light', 'medium', 'heavy', 'shield']) list.push(derived(`training.armor.${kind}`, 0, `${title(kind)} armor training`));
  for (const kind of ['simple', 'martial']) list.push(derived(`training.weapons.${kind}`, 0, `${title(kind)} weapon proficiency`));
  const category = table('armorCategory', { stat: 'armorIndex' });
  const wearing = (value: number, training: string): Expression => ({
    op: 'and',
    args: [{ op: 'eq', args: [category, value] }, { op: 'gte', args: [{ stat: training }, 1] }],
  });
  list.push(
    derived('hitPoints', 0, 'Hit Point maximum'),
    derived('attacksPerAction', 1, 'Attacks per Attack action'),
    derived('criticalThreshold', 20, 'Critical Hit threshold'),
    derived('rangedWeaponAttackBonus', 0, 'Ranged weapon attack bonus'),
    derived('initiative', { stat: 'modifier.dexterity' }, 'Initiative'),
    derived('passivePerception', add(10, { stat: 'skill.perception' }), 'Passive Perception'),
    { id: 'armorIndex', name: 'Worn armor', kind: 'input', default: 0, integer: true, minimum: 0, maximum: ARMOR.length - 1 },
    { id: 'shield', name: 'Wielding a shield', kind: 'input', default: 0, integer: true, minimum: 0, maximum: 1 },
    derived('armorStrengthExemption', 0, 'Heavy armor Strength exemption'),
    // Unarmored Defense features raise this to an ability modifier; it applies with no armor.
    derived('unarmoredDefense', 0, 'Unarmored Defense bonus'),
    derived('walkingSpeed', 0, 'Walking speed'),
    derived('speed', {
      op: 'subtract',
      args: [
        { stat: 'walkingSpeed' },
        {
          if: { op: 'and', args: [{ op: 'lt', args: [{ stat: 'strength' }, table('armorStrength', { stat: 'armorIndex' })] }, { op: 'eq', args: [{ stat: 'armorStrengthExemption' }, 0] }] },
          then: 10,
          else: 0,
        },
      ],
    }, 'Speed'),
    // Unarmored, Light and Medium armor add Dexterity (Medium caps it at +2); Heavy adds none.
    derived('armorClass', add(
      table('armorBase', { stat: 'armorIndex' }),
      { if: { op: 'eq', args: [category, 3] }, then: 0, else: { op: 'min', args: [{ stat: 'modifier.dexterity' }, table('armorDexterityCap', { stat: 'armorIndex' })] } },
      { op: 'multiply', args: [2, { stat: 'shield' }] },
      { if: { op: 'eq', args: [{ stat: 'armorIndex' }, 0] }, then: { stat: 'unarmoredDefense' }, else: 0 },
    ), 'Armor Class'),
    derived('armorProficient', {
      if: {
        op: 'and',
        args: [
          { op: 'or', args: [{ op: 'eq', args: [{ stat: 'armorIndex' }, 0] }, wearing(1, 'training.armor.light'), wearing(2, 'training.armor.medium'), wearing(3, 'training.armor.heavy')] },
          { op: 'or', args: [{ op: 'eq', args: [{ stat: 'shield' }, 0] }, { op: 'gte', args: [{ stat: 'training.armor.shield' }, 1] }] },
        ],
      },
      then: 1,
      else: 0,
    }, 'Trained with worn armor'),
    derived('darkvision', 0, 'Darkvision range'),
    derived('sizeCategory', 1, 'Size (0 Small, 1 Medium)'),
    // Spellcasting features add their class's contribution (SRD 5.2.1 p. 25, rounded up).
    derived('casterLevel', 0, 'Spellcasting level'),
    ...Array.from({ length: 9 }, (_, slot) => derived(`spellSlots.${slot + 1}`, table(`slots${slot + 1}`, { op: 'min', args: [20, { stat: 'casterLevel' }] }), `Level ${slot + 1} spell slots`)),
    derived('pactSlotLevel', 0, 'Pact Magic slot level'),
    derived('pactSlotCount', 0, 'Pact Magic slots'),
    derived('attunementLimit', 3, 'Attunement limit'),
    ...HIT_DICE.map((die) => derived(`resource.capacity.hit-dice.d${die}`, 0, `Hit Point Dice (d${die}) maximum`, { minimum: 0, integer: true })),
  );
  for (const ability of ['intelligence', 'wisdom', 'charisma'] as const) {
    list.push(derived(`casting.${ability}.attack`, add({ stat: 'proficiencyBonus' }, { stat: `modifier.${ability}` }), `${title(ability)} spell attack`));
    list.push(derived(`casting.${ability}.dc`, add(8, { stat: `casting.${ability}.attack` }), `${title(ability)} spell save DC`));
  }
  return list;
}

function sheetSections(): SheetSection[] {
  const roll = { dice: '1d20' };
  const levels = [
    { minimum: 0, name: 'Not proficient', symbol: '○', trained: false },
    { minimum: 1, name: 'Proficient', symbol: '●', trained: true },
    { minimum: 2, name: 'Expertise', symbol: '◉', trained: true },
  ];
  const skillTable = { defaultSort: 'Name', trainingLevels: levels, primarySigned: true, columnLabels: { Training: 'Proficiency' } };
  // Saving throws show three columns with calculations under the values; skills keep a Calculation column.
  const saveTable = { ...skillTable, columns: ['Training', 'Name', 'Bonus'], calculationPlacement: 'belowValue', valueAlignment: 'left' };
  return [
    {
      id: 'abilities',
      name: 'Abilities',
      layout: 'abilities',
      rows: ABILITIES.map((ability) => ({ stat: ability, secondaryStat: `modifier.${ability}`, name: title(ability), roll: { dice: '1d20', bonusStat: `modifier.${ability}` } })),
      modifierFirst: true,
      primaryValueLabel: 'score',
      secondaryValueLabel: 'modifier',
      secondarySigned: true,
    },
    { id: 'combat', name: 'Combat & exploration', layout: 'stats', rows: [] },
    {
      id: 'saves',
      name: 'Saving throws',
      layout: 'skills',
      rows: ABILITIES.map((ability) => ({ stat: `save.${ability}`, name: title(ability), proficiencyStat: `training.save.${ability}`, roll })),
      ...saveTable,
    },
    {
      id: 'skills',
      name: 'Skills',
      layout: 'skills',
      rows: SKILLS.map(([name, ability]) => ({ stat: `skill.${slug(name)}`, name, ability: ability.slice(0, 3).toUpperCase(), proficiencyStat: `training.skill.${slug(name)}`, feature: skill(name), roll })),
      ...skillTable,
    },
  ] as SheetSection[];
}

const VALIDATION = {
  standardArray: {
    id: 'standard-array',
    message: 'Assign the Standard Array 15, 14, 13, 12, 10, 8 exactly once before background adjustments.',
    requirement: {
      expression: {
        op: 'and',
        args: [15, 14, 13, 12, 10, 8].map((score) => ({
          op: 'eq',
          args: [add(...ABILITIES.map((ability): Expression => ({ if: { op: 'eq', args: [{ stat: `base.${ability}` }, score] }, then: 1, else: 0 }))), 1],
        })),
      },
    },
  },
  pointBuy: {
    id: 'point-buy',
    message: 'Point buy permits base scores 8–15 and a total cost of at most 27.',
    requirement: {
      expression: {
        op: 'and',
        args: [
          ...ABILITIES.map((ability): Expression => ({ op: 'and', args: [{ op: 'gte', args: [{ stat: `base.${ability}` }, 8] }, { op: 'lte', args: [{ stat: `base.${ability}` }, 15] }] })),
          { op: 'lte', args: [add(...ABILITIES.map((ability) => table('pointBuy', { stat: `base.${ability}` }))), 27] },
        ],
      },
    },
  },
  levelRange: {
    id: 'level-range',
    message: 'DnD5e 2024 characters have total level 1–20.',
    requirement: { expression: { op: 'and', args: [{ op: 'gte', args: [{ context: 'characterLevel' }, 1] }, { op: 'lte', args: [{ context: 'characterLevel' }, 20] }] } },
  },
} as const;

export const validation = (method: AbilityMethod) => [
  ...(method === 'standard-array' ? [VALIDATION.standardArray] : method === 'point-buy' ? [VALIDATION.pointBuy] : []),
  VALIDATION.levelRange,
];

/**
 * The parts of the System definition every configuration shares. Configurations
 * reference these by JSON pointer and write out only id, validation and multiclassing.
 */
export function sharedDefinition(input: { classes: string[]; species: string[]; backgrounds: string[]; tagDisplayNames: Record<string, string> }): Omit<SystemDefinition, 'id' | 'revision' | 'name' | 'allowMultipleClasses' | 'validation'> {
  const slots = Array.from({ length: 9 }, (_, slot) => ({ level: slot + 1, key: `spell-slot.${slot + 1}`, scope: 'character' as const }));
  return {
    stats: stats(),
    classes: input.classes,
    allowDuplicateClasses: false,
    characterLevel: { context: 'totalClassLevels' },
    contextDefaults: { spellComponentsAvailable: true },
    advancement: {
      0: [
        { id: 'species', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { ids: input.species }, retraining: { allowed: false } },
        { id: 'background', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { ids: input.backgrounds }, retraining: { allowed: false } },
        { id: 'languages', kind: 'grantFeature', feature: id('languages') },
        { id: 'heroic-inspiration', kind: 'grantFeature', feature: id('resource.heroic-inspiration') },
        { id: 'temporary-hit-points', kind: 'grantFeature', feature: id('resource.temporary-hit-points') },
        { id: 'death-save.successes', kind: 'grantFeature', feature: id('resource.death-save.successes') },
        { id: 'death-save.failures', kind: 'grantFeature', feature: id('resource.death-save.failures') },
      ],
    },
    commandRules: {
      // SRD 5.2.1 p. 104: one spell slot per turn replaces the 2014 bonus-action rule; the
      // engine's spellTurn policy is the 2014 rule, so it is deliberately not configured.
      // Arcane Recovery (p. 78): after a Short Rest, once per Long Rest, slots up to level 5.
      selectedRecovery: {
        capabilityName: 'Arcane Recovery',
        requiredEvent: 'short-rest',
        boundaryEvent: 'long-rest',
        budgetStat: 'arcaneRecoveryBudget',
        eventKind: 'dnd2024-arcane-recovery',
        targets: Object.fromEntries([1, 2, 3, 4, 5].map((level) => [String(level), { key: `spell-slot.${level}`, scope: 'character' as const, weight: level }])),
      },
    },
    tagDisplayNames: input.tagDisplayNames,
    sheetSections: sheetSections(),
    featureCategories: [
      { id: 'class', name: 'Class Features', tags: ['class-feature'] },
      { id: 'feats', name: 'Feats', tags: ['feat'] },
      { id: 'skills', name: 'Skill proficiencies', tags: ['skill-proficiency'] },
      { id: 'spells', name: 'Spells', tags: ['spell'] },
      { id: 'species', name: 'Species', tags: ['species'] },
    ],
    currency: {
      name: 'Coins',
      primary: 'gp',
      decimalPlaces: 0,
      denominations: [
        { id: 'cp', name: 'Copper', symbol: 'cp', value: 1 },
        { id: 'sp', name: 'Silver', symbol: 'sp', value: 10 },
        { id: 'ep', name: 'Electrum', symbol: 'ep', value: 50 },
        { id: 'gp', name: 'Gold', symbol: 'gp', value: 100 },
        { id: 'pp', name: 'Platinum', symbol: 'pp', value: 1000 },
      ],
    },
    spellDisplay: {
      spellKey: 'spell',
      levelKey: 'spellLevel',
      slotLevelKey: 'spellSlotLevel',
      ritualKey: 'ritual',
      castingAbilityKey: 'castingAbility',
      slots: [...slots, { key: 'pact-slot', scope: 'character', levelStat: 'pactSlotLevel' }],
      castingBonusStats: Object.fromEntries(ABILITIES.map((ability) => [ability, `modifier.${ability}`])),
    },
    importantDetails: ['Name', 'Alignment'],
    sheetTabs: [
      { id: 'choices', name: 'Build & choices', content: 'choices' },
      { id: 'stats', name: 'Character sheet', content: 'sheet', placement: 'rail', sections: ['abilities', 'combat', 'saves'] },
      { id: 'skills', name: 'Skills', content: 'sections', placement: 'rail', sections: ['skills'] },
      { id: 'items', name: 'Items', content: 'items' },
      { id: 'features', name: 'Features & traits', content: 'features' },
      { id: 'resources', name: 'Abilities & resources', content: 'resources' },
      { id: 'spells', name: 'Spells', content: 'spells' },
      { id: 'notes', name: 'Notes', content: 'notes' },
      { id: 'rolls', name: 'Roll history', content: 'rolls' },
    ],
    healingFeaturesTag: 'rest-healing',
    terminology: { classSingular: 'Class', classPlural: 'Classes', creatureSingular: 'Species', creaturePlural: 'Species', creatureTag: 'species' },
    equipmentRules: { attunementLimitStat: 'attunementLimit', preventDuplicateAttunement: true },
    resetConditions: [
      { id: 'short-rest', name: 'Short Rest', description: 'Complete a Short Rest.' },
      { id: 'long-rest', name: 'Long Rest', description: 'Complete a Long Rest.' },
      { id: 'dawn', name: 'Dawn', description: 'The next dawn occurs.' },
    ],
    healthRules: {
      resourceKey: 'hit-points',
      temporaryResourceKey: 'temporary-hit-points',
      resetResourceKeysOnHealing: ['death-save.successes', 'death-save.failures'],
      clearOnReset: { 'long-rest': ['temporary-hit-points', 'death-save.successes', 'death-save.failures'] },
    },
    resetButtons: [
      { event: 'short-rest', displayName: 'Short Rest', recoveries: ['short-rest'] },
      { event: 'long-rest', displayName: 'Long Rest', recoveries: ['long-rest', 'dawn'] },
    ],
    sheetDisplay: {
      overview: [
        { stat: 'armorClass', name: 'Armor Class' },
        { stat: 'initiative', name: 'Initiative', signed: true, roll: { dice: '1d20' } },
        { stat: 'speed', name: 'Speed', unit: 'ft' },
        { stat: 'proficiencyBonus', name: 'Proficiency', signed: true },
        { stat: 'passivePerception', name: 'Passive Perception' },
      ],
      health: { name: 'Hit Points', showHealingFeatures: true, countersVisibleAtOrBelow: 0, counters: ['death-save.successes', 'death-save.failures'], healingResourceIcons: true },
      descriptionProcessing: {
        classLevelPhrases: true,
        statPhrases: [...ABILITIES.map((ability) => ({ phrase: `${ability} modifier`, stat: `modifier.${ability}` })), { phrase: 'proficiency bonus', stat: 'proficiencyBonus' }],
      },
      resources: { compact: true, showDetailsByDefault: false },
      inventory: { search: true, categoryFilter: true },
      spells: {
        compact: true,
        search: true,
        levelFilter: true,
        zeroLevelName: 'Cantrip',
        zeroLevelHeading: 'Cantrips',
        slotPipLimit: 12,
        columns: [
          { name: 'Casting time', metadataKey: 'castingTime' },
          { name: 'Range', metadataKey: 'range' },
        ],
        castingStats: (['intelligence', 'wisdom', 'charisma'] as const).map((ability) => ({ ability, attackStat: `casting.${ability}.attack`, saveStat: `casting.${ability}.dc` })),
        actionFilter: true,
      },
      restPreview: true,
      rollHistory: true,
      showAllStats: false,
      detailsDrawer: true,
      actions: {
        categories: [
          { id: 'action', name: 'Actions', kinds: ['action'] },
          { id: 'bonus', name: 'Bonus Actions', kinds: ['bonus-action'] },
          { id: 'reaction', name: 'Reactions', kinds: ['reaction'] },
          { id: 'special', name: 'Other / no action cost', kinds: ['special'] },
        ],
        itemCategories: ['Weapons'],
        columns: [
          { name: 'Casting time', metadataKey: 'castingTime' },
          { name: 'Range', metadataKey: 'range' },
        ],
      },
      statuses: [{ name: 'Defenses & conditions', tags: ['resistance', 'immunity', 'condition'] }],
      abilities: { groupByActionCost: true, actionFilter: true },
    },
  } as Omit<SystemDefinition, 'id' | 'revision' | 'name' | 'allowMultipleClasses' | 'validation'>;
}

const tracker = (key: string, name: string, units: string, extra: Partial<FeatureDefinition> = {}, maximum?: Expression, initialAmount: Expression = 0): FeatureDefinition => ({
  id: id(`resource.${key}`),
  revision: 1,
  name,
  displayName: name,
  tags: ['resource-tracker'],
  components: [{ id: 'tracker', kind: 'trackResource', key, name, units, integer: true, initialAmount, ...(maximum === undefined ? {} : { maximum }), recovery: [] }],
  ...extra,
});

/** Shared rules Features: skills, tools, languages, masteries, trackers and rest healing. */
export function coreFeatures(): FeatureDefinition[] {
  const features: FeatureDefinition[] = [tablesFeature()];
  const proficiency = quote('Skill Proficiencies', [8, 9]);
  for (const [name, ability] of SKILLS) {
    const stat = `training.skill.${slug(name)}`;
    features.push({
      id: skill(name),
      revision: 1,
      name: `Proficiency: ${name}`,
      displayName: `${name} Proficiency`,
      ...proficiency,
      mechanicalSummary: [`Adds your Proficiency Bonus to ${title(ability)} (${name}) checks.`],
      tags: ['skill-proficiency'],
      prerequisites: { not: { stat, minimum: 1 } },
      repeat: { maximum: 20, scope: 'character' },
      textAliases: [name],
      components: [{ id: 'training', kind: 'useBlock', block: 'core:training', arguments: { stat, rank: 1 } }],
    });
    features.push({
      id: id(`expertise.${slug(name)}`),
      revision: 1,
      name: `Expertise: ${name}`,
      displayName: `${name} Expertise`,
      ...quote('Expertise', [176, 191]),
      tags: ['expertise'],
      prerequisites: { all: [{ stat, minimum: 1 }, { not: { stat, minimum: 2 } }] },
      repeat: { maximum: 20, scope: 'character' },
      components: [{ id: 'training', kind: 'useBlock', block: 'core:training', arguments: { stat, rank: 2 } }],
    });
  }
  for (const [name, ability, kind] of TOOLS) {
    const entry = sectionStarting(name, [93, 94]);
    const stat = `training.tool.${slug(name)}`;
    features.push({
      id: tool(name),
      revision: 1,
      name: `Proficiency: ${name}`,
      displayName: `${name} Proficiency`,
      // Tool entries keep Ability, Utilize and Craft lines in the table text (pp. 93–94).
      description: [entry.text, entry.table].filter(Boolean).join('\n'),
      source: source(entry.page),
      mechanicalSummary: [`Uses ${title(ability)}. Proficiency adds your Proficiency Bonus to checks made with these tools.`],
      tags: ['tool-proficiency', kind === 'artisan' ? 'artisan-tools' : 'other-tools'],
      prerequisites: { not: { stat, minimum: 1 } },
      repeat: { maximum: 20, scope: 'character' },
      textAliases: [name],
      components: [{ id: 'training', kind: 'useBlock', block: 'core:training', arguments: { stat, rank: 1 } }],
    });
  }
  const languages = quote('Choose Languages', [20, 21]);
  for (const name of ['Common', ...STANDARD_LANGUAGES, ...RARE_LANGUAGES]) {
    const rare = RARE_LANGUAGES.includes(name);
    features.push({
      id: language(name),
      revision: 1,
      name: `Language: ${name}`,
      displayName: name,
      ...languages,
      tags: ['language', rare ? 'rare-language' : 'standard-language'],
      prerequisites: { not: { feature: language(name) } },
      repeat: { maximum: 1, scope: 'character' },
      components: [{ id: 'rules', kind: 'describe', text: `You can speak, read and write ${name}.` }],
    });
  }
  features.push({
    id: id('languages'),
    revision: 1,
    name: 'Starting languages',
    displayName: 'Languages',
    ...languages,
    components: [
      { id: 'common', kind: 'grantFeature', feature: language('Common') },
      { id: 'standard', kind: 'chooseFeatures', minimum: 2, maximum: 2, candidates: { ids: STANDARD_LANGUAGES.map(language) }, retraining: { allowed: false } },
    ],
  });
  for (const [weapon, category, range, property] of WEAPONS) {
    const rule = section(property, [90, 90]);
    features.push({
      id: mastery(weapon),
      revision: 1,
      name: `Weapon Mastery: ${weapon}`,
      displayName: `${weapon} (${property})`,
      description: `${property}. ${rule.text}`,
      source: source(rule.page),
      mechanicalSummary: [`${title(category)} ${range} weapon. Lets you use its ${property} mastery property.`],
      tags: ['weapon-mastery', `${category}-weapon`, `${range}-weapon`, ...(FINESSE.includes(weapon) ? ['finesse-weapon'] : []), ...(LIGHT.includes(weapon) ? ['light-weapon'] : [])],
      prerequisites: { not: { feature: mastery(weapon) } },
      repeat: { maximum: 1, scope: 'character' },
      components: [{ id: 'rules', kind: 'describe', text: `You can use the ${property} property of ${weapon} attacks.` }],
    });
  }
  const resting = quote('Short Rest', [176, 191]);
  const hitPointDice = quote('Hit Point Dice', [176, 191]);
  for (const die of HIT_DICE) {
    const key = `hit-dice.d${die}`;
    features.push(
      tracker(key, `Hit Point Dice (d${die})`, 'dice', { ...hitPointDice, repeat: { maximum: 20, scope: 'character' } }, { stat: `resource.capacity.${key}` }, { stat: `resource.capacity.${key}` }),
      {
        id: id(key),
        revision: 1,
        name: `Short Rest Healing (d${die})`,
        displayName: `Short Rest Healing (d${die})`,
        ...resting,
        tags: ['rest-healing'],
        repeat: { maximum: 20, scope: 'character' },
        components: [
          { id: 'pool', kind: 'grantFeature', feature: id(`resource.${key}`) },
          { id: 'spend', kind: 'grantCapability', name: `Spend Hit Point Die (d${die})`, costs: [{ key, amount: 1 }] },
          { id: 'roll', kind: 'grantFeature', feature: id(`${key}.roll`) },
        ],
      },
      {
        id: id(`${key}.roll`),
        revision: 1,
        name: `Hit Point Die Healing (d${die})`,
        displayName: `Hit Point Die Healing (d${die})`,
        textReferences: [id(key)],
        tags: ['roll-feature'],
        repeat: { maximum: 1, scope: 'parent' },
        roll: { id: 'healing', label: `Hit Point Die Healing (d${die})`, dice: `1d${die}`, bonus: { stat: 'modifier.constitution' }, capability: `Spend Hit Point Die (d${die})`, restoreResource: 'hit-points' },
        components: [],
      },
    );
    // SRD 5.2.1 p. 185: a Long Rest restores all spent Hit Point Dice.
    const pool = features.find((feature) => feature.id === id(`resource.${key}`))!;
    Object.assign(pool.components[0], { recovery: [{ event: 'long-rest', amount: 'full' }] });
  }
  features.push(
    {
      ...tracker('hit-points', 'Hit Points', 'HP', quote('Hit Points', [176, 191]), { stat: 'hitPoints' }),
      components: [{ id: 'tracker', kind: 'trackResource', key: 'hit-points', name: 'Hit Points', units: 'HP', integer: true, maximum: { stat: 'hitPoints' }, initialAmount: { stat: 'hitPoints' }, recovery: [{ event: 'long-rest', amount: 'full' }] }],
    },
    tracker('temporary-hit-points', 'Temporary Hit Points', 'HP', quote('Temporary Hit Points', [176, 191])),
    tracker('death-save.successes', 'Death Saving Throw successes', 'saves', quote('Death Saving Throw', [176, 191]), 3),
    tracker('death-save.failures', 'Death Saving Throw failures', 'saves', quote('Death Saving Throw', [176, 191]), 3),
    tracker('heroic-inspiration', 'Heroic Inspiration', 'inspiration', quote('Heroic Inspiration', [176, 191]), 1),
    ...Array.from({ length: 9 }, (_, index): FeatureDefinition => {
      const level = index + 1;
      return {
        ...tracker(`spell-slot.${level}`, `Level ${level} Spell Slots`, 'slots', quote('Spell', [176, 191]), { stat: `spellSlots.${level}` }, { stat: `spellSlots.${level}` }),
        components: [{ id: 'tracker', kind: 'trackResource', key: `spell-slot.${level}`, name: `Level ${level} Spell Slots`, units: 'slots', integer: true, maximum: { stat: `spellSlots.${level}` }, initialAmount: { stat: `spellSlots.${level}` }, recovery: [{ event: 'long-rest', amount: 'full' }] }],
      };
    }),
    {
      ...tracker('pact-slot', 'Pact Magic Slots', 'slots', {}, { stat: 'pactSlotCount' }, { stat: 'pactSlotCount' }),
      components: [{ id: 'tracker', kind: 'trackResource', key: 'pact-slot', name: 'Pact Magic Slots', units: 'slots', integer: true, maximum: { stat: 'pactSlotCount' }, initialAmount: { stat: 'pactSlotCount' }, recovery: [{ event: 'short-rest', amount: 'full' }, { event: 'long-rest', amount: 'full' }] }],
    },
    {
      id: id('spell-slots'),
      revision: 1,
      name: 'Spell Slots',
      displayName: 'Spell Slots',
      ...quote('Spell', [176, 191]),
      repeat: { maximum: 20, scope: 'character' },
      components: Array.from({ length: 9 }, (_, index) => ({ id: `slot-${index + 1}`, kind: 'grantFeature' as const, feature: id(`resource.spell-slot.${index + 1}`) })),
    },
    {
      id: id('walking-speed'),
      revision: 1,
      name: 'Speed',
      displayName: 'Speed',
      ...quote('Speed', [176, 191]),
      tags: ['species-trait'],
      parameters: { feet: { kind: 'number', default: 30, minimum: 0 } },
      components: [{ id: 'speed', kind: 'modifyStat', stat: 'walkingSpeed', operation: 'override', value: { parameter: 'feet' } }],
    },
    {
      id: id('darkvision'),
      revision: 1,
      name: 'Darkvision',
      displayName: 'Darkvision',
      ...quote('Darkvision', [176, 191]),
      tags: ['species-trait'],
      parameters: { feet: { kind: 'number', default: 60, minimum: 0 } },
      components: [{ id: 'range', kind: 'modifyStat', stat: 'darkvision', operation: 'floor', value: { parameter: 'feet' } }],
    },
  );
  return features;
}
