import type { Component, FeatureDefinition, StatDefinition } from '../../model.js';
import { abilities, skills, languages, feature, modifier, stat, context, op, parameter, choice, grant, describe, threshold, id } from './primitives.js';
import { wizardSpells } from './spells.js';

const language = (name: string): Component => ({ ...grant(`language.${name}`), ignorePrerequisites: true });
const training = (name: string): Component => ({ ...grant(`skill.${name}`), ignorePrerequisites: true });
const ability = (name: string, value: number): Component => modifier(name, name, 'add', value);
const vision = modifier('darkvision', 'darkvision', 'floor', 60);
export const originStats: StatDefinition[] = [
  { id: 'darkvision', name: 'Darkvision range', kind: 'derived', expression: 0 },
  { id: 'sizeCategory', name: 'Size (0 Small, 1 Medium)', kind: 'derived', expression: 1 },
  { id: 'breathWeaponDice', name: 'Dragonborn breath d6 count', kind: 'derived', expression: { table: 'breathDice', owner: id('race.dragonborn'), input: context('characterLevel') } },
  { id: 'breathWeaponDC', name: 'Dragonborn breath save DC', kind: 'derived', expression: op('add', 8, stat('modifier.constitution'), stat('proficiencyBonus')) },
  { id: 'infernalSpellDC', name: 'Infernal Legacy spell save DC', kind: 'derived', expression: op('add', 8, stat('modifier.charisma'), stat('proficiencyBonus')) }
];
export const raceNames = ['human','hill-dwarf','high-elf','lightfoot-halfling','dragonborn','rock-gnome','half-elf','half-orc','tiefling'];

export const originFeatures: FeatureDefinition[] = [
  ...['smith','brewer','mason'].map(name => feature(`tool.${name}`, `Tool proficiency: ${name}`, [describe(`Proficiency with ${name}'s tools.`)])),
  feature('background.acolyte', 'Acolyte', [
    choice('insight', ['skill.insight','background-replacement.insight']), choice('religion', ['skill.religion','background-replacement.religion']), choice('languages', languages.map(l => `language.${l}`), 2),
    describe('Shelter of the Faithful: religious institutions sharing your faith may provide modest lodging, healing, and care. Equipment: holy symbol, prayer book or wheel, five sticks of incense, vestments, common clothes, and 15 gp. Personality, ideal, bond, and flaw are narrative choices.')
  ], { tags: ['background'] }),
  ...['insight','religion'].map(skill => feature(`background-replacement.${skill}`, `Replace duplicate background ${skill} proficiency`, [choice('replacement', Object.keys(skills).map(s => `skill.${s}`))], { prerequisites: { stat: `training.skill.${skill}`, minimum: 1 } })),
  feature('race.human', 'Human', [...abilities.map(a => ability(a, 1)), language('common'), choice('language', languages.filter(l => l !== 'common').map(l => `language.${l}`))], { tags: ['race'] }),
  feature('race.hill-dwarf', 'Hill Dwarf', [
    ability('constitution', 2), ability('wisdom', 1), vision, modifier('speed', 'walkingSpeed', 'override', 25),
    modifier('strength-exemption', 'armorStrengthExemption', 'floor', 1), modifier('toughness', 'hitPoints', 'add', context('characterLevel')),
    language('common'), language('dwarvish'), choice('artisan-tool', ['tool.smith','tool.brewer','tool.mason']),
    describe('Dwarven Resilience gives advantage on saves against poison and resistance to poison damage. Stonecunning doubles proficiency on Intelligence (History) checks about the origin of stonework. Dwarven Combat Training grants battleaxe, handaxe, light hammer, and warhammer proficiency.')
  ], { tags: ['race'] }),
  feature('race.high-elf', 'High Elf', [
    ability('dexterity', 2), ability('intelligence', 1), vision, training('perception'), language('common'), language('elvish'),
    choice('language', languages.filter(l => !['common','elvish'].includes(l)).map(l => `language.${l}`)),
    choice('cantrip', wizardSpells.filter(s => s.level === 0).map(s => `racial-cantrip.${s.slug}`)),
    describe('Fey Ancestry gives advantage against charm and immunity to magical sleep. Trance replaces sleep with four hours of meditation. Elf Weapon Training grants longsword, shortsword, shortbow, and longbow proficiency.')
  ], { tags: ['race'] }),
  feature('race.lightfoot-halfling', 'Lightfoot Halfling', [
    ability('dexterity', 2), ability('charisma', 1), modifier('speed', 'walkingSpeed', 'override', 25), modifier('size', 'sizeCategory', 'override', 0),
    language('common'), language('halfling'), describe('Lucky rerolls a natural 1 on an attack, ability check, or save. Brave gives advantage against fear. Halfling Nimbleness permits moving through larger creatures. Naturally Stealthy permits hiding behind a creature at least one size larger.')
  ], { tags: ['race'] }),
  feature('race.dragonborn', 'Dragonborn', [
    ability('strength', 2), ability('charisma', 1), language('common'), language('draconic'),
    { id: 'breath', kind: 'defineResource', key: 'dragonborn-breath', scope: 'character', units: 'uses', capacity: 1, integer: true, recovery: [{ event: 'short-rest', amount: 'full' }, { event: 'long-rest', amount: 'full' }] },
    choice('ancestry', ['black','blue','brass','bronze','copper','gold','green','red','silver','white'].map(a => `dragon-ancestry.${a}`))
  ], { tags: ['race'], tables: { breathDice: threshold([0,2],[6,3],[11,4],[16,5]) } }),
  ...[
    ['black','acid','line','dexterity'], ['blue','lightning','line','dexterity'], ['brass','fire','line','dexterity'], ['bronze','lightning','line','dexterity'], ['copper','acid','line','dexterity'],
    ['gold','fire','cone','dexterity'], ['green','poison','cone','constitution'], ['red','fire','cone','dexterity'], ['silver','cold','cone','constitution'], ['white','cold','cone','constitution']
  ].map(([color, damage, shape, save]) => feature(`dragon-ancestry.${color}`, `${color} dragon ancestry`, [
    describe(`Resistance to ${damage}. Breath area: ${shape === 'line' ? '5 by 30 foot line' : '15 foot cone'}; ${save} save against breathWeaponDC, half damage on success.`),
    { id: 'exhale', kind: 'grantCapability', name: 'Breath Weapon', action: { kind: 'action', amount: 1 }, costs: [{ key: 'dragonborn-breath', requirement: 'breath', amount: 1 }], metadata: { damage, diceStat: 'breathWeaponDice', die: 6, save, dcStat: 'breathWeaponDC' } }
  ], { resources: [{ id: 'breath', key: 'dragonborn-breath', scope: 'character', units: 'uses', minimumCapacity: 1 }] })),
  feature('race.rock-gnome', 'Rock Gnome', [
    ability('intelligence', 2), ability('constitution', 1), vision, language('common'), language('gnomish'),
    modifier('speed', 'walkingSpeed', 'override', 25), modifier('size', 'sizeCategory', 'override', 0),
    describe('Gnome Cunning gives advantage on Intelligence, Wisdom, and Charisma saves against magic. Artificer’s Lore doubles proficiency on History checks about magic items, alchemical objects, or technological devices. Tinker grants tinkers’ tools proficiency and permits maintaining up to three Tiny clockwork devices; construction costs one hour and 10 gp. Device lifetimes and gold are tracked manually.')
  ], { tags: ['race'] }),
  feature('race.half-elf', 'Half-Elf', [
    ability('charisma', 2), ...abilities.filter(a => a !== 'charisma').map(a => modifier(a, a, 'add', parameter(a))),
    vision, language('common'), language('elvish'), choice('language', languages.filter(l => !['common','elvish'].includes(l)).map(l => `language.${l}`)),
    choice('skills', Object.keys(skills).map(s => `skill.${s}`), 2), describe('Fey Ancestry gives advantage against charm and immunity to magical sleep.')
  ], { tags: ['race'], parameters: Object.fromEntries(abilities.filter(a => a !== 'charisma').map(a => [a, { kind: 'number' as const, integer: true, minimum: 0, maximum: 1, default: ['strength','dexterity'].includes(a) ? 1 : 0 }])), prerequisites: { expression: op('eq', op('add', ...abilities.filter(a => a !== 'charisma').map(parameter)), 2) } }),
  feature('race.half-orc', 'Half-Orc', [
    ability('strength', 2), ability('constitution', 1), vision, language('common'), language('orc'), training('intimidation'),
    { id: 'endurance', kind: 'defineResource', key: 'relentless-endurance', scope: 'character', units: 'uses', integer: true, capacity: 1, recovery: [{ event: 'long-rest', amount: 'full' }] },
    { id: 'survive', kind: 'grantCapability', name: 'Relentless Endurance', costs: [{ key: 'relentless-endurance', amount: 1 }], description: 'When reduced to 0 HP without being killed outright, drop to 1 HP instead.' },
    describe('Savage Attacks adds one weapon damage die to the extra damage of a critical hit with a melee weapon.')
  ], { tags: ['race'] }),
  feature('race.tiefling', 'Tiefling', [
    ability('intelligence', 1), ability('charisma', 2), vision, language('common'), language('infernal'), describe('Hellish Resistance grants fire resistance. Infernal Legacy grants thaumaturgy; Charisma is its casting ability.'),
    { id: 'thaumaturgy', kind: 'grantCapability', name: 'Thaumaturgy', condition: op('and', op('gte', stat('armorProficient'), 1), context('spellComponentsAvailable')), action: { kind: 'action', amount: 1 }, metadata: { castingAbility: 'charisma', spellLevel: 0, castingTime: '1 action', dcStat: 'infernalSpellDC' } },
    ...[{ name: 'Hellish Rebuke', key: 'infernal-rebuke', at: 3, slot: 2, action: 'reaction' }, { name: 'Darkness', key: 'infernal-darkness', at: 5, slot: 2, action: 'action' }].flatMap(({ name, key, at, slot, action }): Component[] => [
      { id: key, kind: 'defineResource', key, scope: 'character', units: 'uses', integer: true, capacity: { if: op('gte', context('characterLevel'), at), then: 1, else: 0 }, recovery: [{ event: 'long-rest', amount: 'full' }] },
      { id: `${key}-cast`, kind: 'grantCapability', name, condition: op('and', op('gte', context('characterLevel'), at), op('gte', stat('armorProficient'), 1), context('spellComponentsAvailable')), action: { kind: action, amount: 1 }, costs: [{ key, amount: 1 }], metadata: { castingAbility: 'charisma', spellSlotLevel: slot, spellLevel: name === 'Hellish Rebuke' ? 1 : 2, castingTime: `1 ${action}`, dcStat: 'infernalSpellDC' } }
    ])
  ], { tags: ['race'] })
];
