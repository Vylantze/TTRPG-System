import type { FeatureDefinition, StatDefinition, SystemDefinition, Expression } from '../../model.js';
import { abilities, skills, languages, feature, modifier, stat, context, op, when, parameter, table, id, level, choice, describe, slotRows } from './primitives.js';

export interface Dnd2014Options { multiclass?: boolean; feats?: boolean; abilityMethod?: 'standard-array' | 'point-buy' | 'manual' }
export const armor = [
  { name: 'Unarmored', base: 10, dexterityCap: 99, category: 0, strength: 0, stealthDisadvantage: false },
  { name: 'Padded', base: 11, dexterityCap: 99, category: 1, strength: 0, stealthDisadvantage: true },
  { name: 'Leather', base: 11, dexterityCap: 99, category: 1, strength: 0, stealthDisadvantage: false },
  { name: 'Studded leather', base: 12, dexterityCap: 99, category: 1, strength: 0, stealthDisadvantage: false },
  { name: 'Hide', base: 12, dexterityCap: 2, category: 2, strength: 0, stealthDisadvantage: false },
  { name: 'Chain shirt', base: 13, dexterityCap: 2, category: 2, strength: 0, stealthDisadvantage: false },
  { name: 'Scale mail', base: 14, dexterityCap: 2, category: 2, strength: 0, stealthDisadvantage: true },
  { name: 'Breastplate', base: 14, dexterityCap: 2, category: 2, strength: 0, stealthDisadvantage: false },
  { name: 'Half plate', base: 15, dexterityCap: 2, category: 2, strength: 0, stealthDisadvantage: true },
  { name: 'Ring mail', base: 14, dexterityCap: 0, category: 3, strength: 0, stealthDisadvantage: true },
  { name: 'Chain mail', base: 16, dexterityCap: 0, category: 3, strength: 13, stealthDisadvantage: true },
  { name: 'Splint', base: 17, dexterityCap: 0, category: 3, strength: 15, stealthDisadvantage: true },
  { name: 'Plate', base: 18, dexterityCap: 0, category: 3, strength: 15, stealthDisadvantage: true }
];
export const lookup = (name: string, input: Expression): Expression => ({ table: name, owner: id('tables'), input });
const derived = (id: string, expression: Expression): StatDefinition => ({ id, name: id, kind: 'derived', expression });
const zero = (id: string): StatDefinition => derived(id, 0);
export const stats: StatDefinition[] = [
  ...abilities.map((ability, i): StatDefinition => ({ id: `base.${ability}`, name: `Base ${ability}`, kind: 'input', default: [15,14,13,12,10,8][i], integer: true, minimum: 1, maximum: 30 })),
  ...abilities.map(ability => derived(ability, stat(`base.${ability}`))),
  ...abilities.map(ability => derived(`modifier.${ability}`, op('floor', op('divide', op('subtract', stat(ability), 10), 2)))),
  derived('proficiencyBonus', when(op('gt', context('characterLevel'), 0), op('add', 2, op('floor', op('divide', op('subtract', context('characterLevel'), 1), 4))))),
  ...abilities.flatMap(ability => [zero(`training.save.${ability}`), derived(`save.${ability}`, op('add', stat(`modifier.${ability}`), op('multiply', stat(`training.save.${ability}`), stat('proficiencyBonus'))))]),
  ...Object.entries(skills).flatMap(([skill, ability]) => [zero(`training.skill.${skill}`), derived(`skill.${skill}`, op('add', stat(`modifier.${ability}`), op('multiply', stat(`training.skill.${skill}`), stat('proficiencyBonus'))))]),
  zero('training.tool.thieves-tools'), derived('check.thieves-tools', op('add', stat('modifier.dexterity'), op('multiply', stat('training.tool.thieves-tools'), stat('proficiencyBonus')))),
  ...['light','medium','heavy','shield'].map(a => zero(`training.armor.${a}`)),
  zero('training.weapons.simple'), zero('training.weapons.martial'),
  derived('hitPoints', 0), derived('attacksPerAction', 1), derived('criticalThreshold', 20),
  derived('initiative', stat('modifier.dexterity')), derived('passivePerception', op('add', 10, stat('skill.perception'))),
  { id: 'armorIndex', name: 'Worn armor index', kind: 'input', default: 0, integer: true, minimum: 0, maximum: armor.length - 1 },
  { id: 'shield', name: 'Wielding a shield', kind: 'input', default: 0, integer: true, minimum: 0, maximum: 1 },
  zero('armorStrengthExemption'), derived('walkingSpeed', 30),
  derived('speed', op('subtract', stat('walkingSpeed'), when(op('and', op('lt', stat('strength'), lookup('armorStrength', stat('armorIndex'))), op('eq', stat('armorStrengthExemption'), 0)), 10))),
  derived('armorClass', op('add', lookup('armorBase', stat('armorIndex')), when(op('eq', lookup('armorCategory', stat('armorIndex')), 3), 0, op('min', stat('modifier.dexterity'), lookup('armorDexterityCap', stat('armorIndex')))), op('multiply', 2, stat('shield')))),
  derived('armorProficient', when(op('and', op('or', op('eq', stat('armorIndex'), 0), op('and', op('eq', lookup('armorCategory', stat('armorIndex')), 1), op('gte', stat('training.armor.light'), 1)), op('and', op('eq', lookup('armorCategory', stat('armorIndex')), 2), op('gte', stat('training.armor.medium'), 1)), op('and', op('eq', lookup('armorCategory', stat('armorIndex')), 3), op('gte', stat('training.armor.heavy'), 1))), op('or', op('eq', stat('shield'), 0), op('gte', stat('training.armor.shield'), 1))), 1)),
  zero('rangedWeaponAttackBonus'), zero('oneHandedWeaponDamageBonus'),
  derived('sneakAttackDice', 0), derived('remarkableAthleteBonus', 0),
  derived('wizardSpellLevel', when(op('gt', level('wizard'), 0), op('min', 9, op('ceil', op('divide', level('wizard'), 2))))),
  derived('wizardSpellAttack', op('add', stat('modifier.intelligence'), stat('proficiencyBonus'))),
  derived('wizardSpellDC', op('add', 8, stat('wizardSpellAttack'))),
  derived('wizardPreparationLimit', op('max', 1, op('add', stat('modifier.intelligence'), level('wizard')))),
  derived('arcaneRecoveryBudget', op('ceil', op('divide', level('wizard'), 2))),
  ...Array.from({ length: 9 }, (_, i) => derived(`spellSlots.${i + 1}`, lookup(`slots${i + 1}`, level('wizard'))))
];

export const commonFeatures: FeatureDefinition[] = [
  feature('tables', '2014 rules tables', [], { tables: {
    pointBuy: table([0,1,2,3,4,5,7,9], 8),
    armorBase: table(armor.map(a => a.base)), armorCategory: table(armor.map(a => a.category)),
    armorDexterityCap: table(armor.map(a => a.dexterityCap)), armorStrength: table(armor.map(a => a.strength)),
    ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`slots${i + 1}`, table(slotRows.map(row => row[i]))]))
  } }),
  ...Object.keys(skills).map(skill => feature(`skill.${skill}`, `Proficiency: ${skill}`, [modifier('training', `training.skill.${skill}`, 'floor', 1)], { tags: ['skill-proficiency'], prerequisites: { not: { stat: `training.skill.${skill}`, minimum: 1 } }, repeat: { maximum: 20, scope: 'character' } })),
  ...[...Object.keys(skills).map(s => ['skill', s]), ['tool', 'thieves-tools']].map(([kind, skill]) => feature(`expertise.${skill}`, `Expertise: ${skill}`, [modifier('expertise', `training.${kind}.${skill}`, 'floor', 2)], { tags: ['expertise'], prerequisites: { stat: `training.${kind}.${skill}`, minimum: 1 } })),
  ...languages.map(language => feature(`language.${language}`, `Language: ${language}`, [describe(`Speak, read, and write ${language}. Exotic language choices require GM permission.`)], { tags: ['language'], prerequisites: { not: { feature: id(`language.${language}`) } }, repeat: { maximum: 10, scope: 'character' } })),
  feature('ability-score-improvement', 'Ability Score Improvement', abilities.map(a => modifier(a, a, 'add', parameter(a))), {
    repeat: { maximum: 20, scope: 'character' }, parameters: Object.fromEntries(abilities.map(a => [a, { kind: 'number' as const, default: a === 'strength' ? 2 : 0, integer: true, minimum: 0, maximum: 2 }])),
    prerequisites: { expression: op('and', op('eq', op('add', ...abilities.map(parameter)), 2), ...abilities.map(a => op('or', op('eq', parameter(a), 0), op('lte', op('add', stat(a), parameter(a)), 20)))) },
    maintenance: { expression: op('and', ...abilities.map(a => op('or', op('eq', parameter(a), 0), op('lte', op('add', stat(a), parameter(a)), 20)))) }
  }),
  feature('feat.grappler', 'Grappler', [describe('Gain advantage on attacks against a creature you grapple. Use an action and another grapple check to pin it; a successful pin restrains both creatures.'), { id: 'pin', kind: 'grantCapability', name: 'Pin grappled creature', action: { kind: 'action', amount: 1 } }], { tags: ['feat'], prerequisites: { stat: 'strength', minimum: 13 }, maintenance: { stat: 'strength', minimum: 13 } })
];

export function system(options: Required<Dnd2014Options>, raceIds: string[]): SystemDefinition {
  const abilityRules = options.abilityMethod === 'standard-array' ? [
    { id: 'standard-array', message: 'Assign the standard array 15, 14, 13, 12, 10, 8 exactly once before racial adjustments.', requirement: { expression: op('and', ...[15,14,13,12,10,8].map(n => op('eq', op('add', ...abilities.map(a => when(op('eq', stat(`base.${a}`), n), 1))), 1))) } }
  ] : options.abilityMethod === 'point-buy' ? [
    { id: 'point-buy', message: 'Point buy permits base scores 8–15 and a total cost of at most 27.', requirement: { expression: op('and', ...abilities.map(a => op('and', op('gte', stat(`base.${a}`), 8), op('lte', stat(`base.${a}`), 15))), op('lte', op('add', ...abilities.map(a => lookup('pointBuy', stat(`base.${a}`)))), 27)) } }
  ] : [];
  return {
    id: 'dnd5e:2014-srd5.1', revision: 1, name: 'DnD5e 2014', stats,
    allowMultipleClasses: options.multiclass, allowDuplicateClasses: false, characterLevel: context('totalClassLevels'),
    rootCandidates: { tags: ['wizard-spellbook'] },
    contextDefaults: { spellComponentsAvailable: true },
    validation: [
      ...abilityRules,
      ...(!options.feats ? [{ id: 'optional-feats', requirement: { not: { tag: 'feat' } }, message: 'The optional feat rule is disabled in this catalogue.' }] : []),
      { id: 'level-range', requirement: { expression: op('and', op('gte', context('characterLevel'), 1), op('lte', context('characterLevel'), 20)) }, message: 'DnD5e 2014 characters have total level 1–20.' }
    ],
    advancement: { 0: [choice('race', raceIds), choice('background', ['background.acolyte'])] }
  };
}
