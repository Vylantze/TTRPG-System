import type { Component, Expression } from '@/src/model.js';
import type { ClassSpec } from './common.ts';
import { atLeastOne, byLevel, classLevel, expertise, full, perLevel, shortRestOne, steps, usesFeature, weaponMastery } from './common.ts';
import { FINESSE, language, LIGHT, mastery, RARE_LANGUAGES, SKILLS, STANDARD_LANGUAGES, WEAPONS } from '../core.ts';
import { id, slug } from '../srd.ts';

const noHeavyArmor: Expression = { op: 'lt', args: [{ stat: 'armorIndex' }, 9] };
const describe = (text: string): Component[] => [{ id: 'rules', kind: 'describe', text }];

/** Barbarian, SRD 5.2.1 pp. 28–30, with the Path of the Berserker. */
export const barbarian: ClassSpec = {
  name: 'Barbarian',
  pages: [28, 31],
  die: 12,
  saves: ['strength', 'constitution'],
  skills: { count: 2, from: ['Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival'] },
  weapons: { simple: true, martial: true },
  armor: ['light', 'medium', 'shield'],
  multiclass: { prerequisites: { stat: 'strength', minimum: 13 }, armor: ['shield'], martial: true },
  features: [
    {
      level: 1,
      name: 'Rage',
      tables: { rages: perLevel([2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6]), damage: steps([[1, 2], [9, 3], [16, 4]]) },
      summary: ['Rages per Long Rest follow the Rages column; a Short Rest restores one. Rage Damage is +2, +3 at level 9 and +4 at level 16.'],
      components: (ctx, owner) => [
        { id: 'damage', kind: 'defineStat', stat: { id: 'rageDamage', name: 'Rage Damage', kind: 'derived', expression: byLevel('damage', owner) } },
        ...usesFeature('rage', 'Rage', byLevel('rages', owner), shortRestOne, { action: 'bonus-action', description: 'Resistance to Bludgeoning, Piercing and Slashing; Rage Damage on Strength attacks; Advantage on Strength checks and saves. Not in Heavy armor.' })(ctx, owner),
      ],
    },
    { level: 1, name: 'Unarmored Defense', components: () => [{ id: 'unarmored', kind: 'modifyStat', stat: 'unarmoredDefense', operation: 'floor', value: { stat: 'modifier.constitution' } }] },
    { level: 1, name: 'Weapon Mastery', ...weaponMastery([[1, 2], [4, 3], [10, 4]], ['melee-weapon']) },
    { level: 2, name: 'Danger Sense' },
    { level: 2, name: 'Reckless Attack' },
    { level: 3, name: 'Primal Knowledge', components: () => [{ id: 'skill', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { ids: ['Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival'].map((name) => id(`skill.${slug(name)}`)) }, retraining: { allowed: false } }] },
    { level: 5, name: 'Extra Attack', components: () => [{ id: 'attacks', kind: 'modifyStat', stat: 'attacksPerAction', operation: 'floor', value: 2 }] },
    { level: 5, name: 'Fast Movement', components: () => [{ id: 'speed', kind: 'modifyStat', stat: 'walkingSpeed', operation: 'add', value: { if: noHeavyArmor, then: 10, else: 0 } }] },
    { level: 7, name: 'Feral Instinct' },
    { level: 7, name: 'Instinctive Pounce' },
    { level: 9, name: 'Brutal Strike' },
    { level: 11, name: 'Relentless Rage' },
    { level: 13, name: 'Improved Brutal Strike' },
    { level: 15, name: 'Persistent Rage' },
    { level: 17, name: 'Improved Brutal Strike' },
    { level: 18, name: 'Indomitable Might' },
    {
      level: 20,
      name: 'Primal Champion',
      components: () => [
        { id: 'strength', kind: 'modifyStat', stat: 'strength', operation: 'add', value: 4 },
        { id: 'constitution', kind: 'modifyStat', stat: 'constitution', operation: 'add', value: 4 },
      ],
      summary: ['Strength and Constitution each increase by 4, to a maximum of 25 (the cap is applied at the table).'],
    },
  ],
  subclassLevels: [3, 6, 10, 14],
  subclass: {
    name: 'Path of the Berserker',
    features: [
      { level: 3, name: 'Frenzy' },
      { level: 6, name: 'Mindless Rage' },
      { level: 10, name: 'Retaliation' },
      { level: 14, name: 'Intimidating Presence', components: usesFeature('intimidating-presence', 'Intimidating Presence', 1, [full('long-rest')], { action: 'bonus-action', description: 'Frighten creatures in a 30-foot Emanation; can also be restored by spending a Rage use.' }) },
    ],
  },
};

const martialArtsDie = steps([[1, 6], [5, 8], [11, 10], [17, 12]]);

/** Monk, SRD 5.2.1 pp. 49–53, with the Warrior of the Open Hand. */
export const monk: ClassSpec = {
  name: 'Monk',
  pages: [49, 53],
  die: 8,
  saves: ['strength', 'dexterity'],
  skills: { count: 2, from: ['Acrobatics', 'Athletics', 'History', 'Insight', 'Religion', 'Stealth'] },
  weapons: { simple: true },
  armor: [],
  tools: { count: 1, from: ['Brewer’s Supplies', 'Calligrapher’s Supplies', 'Carpenter’s Tools', 'Cartographer’s Tools', 'Cobbler’s Tools', 'Cook’s Utensils', 'Glassblower’s Tools', 'Jeweler’s Tools', 'Leatherworker’s Tools', 'Mason’s Tools', 'Painter’s Supplies', 'Potter’s Tools', 'Smith’s Tools', 'Tinker’s Tools', 'Weaver’s Tools', 'Woodcarver’s Tools', 'Alchemist’s Supplies', 'Musical Instrument'] },
  multiclass: { prerequisites: { all: [{ stat: 'dexterity', minimum: 13 }, { stat: 'wisdom', minimum: 13 }] }, armor: [] },
  features: [
    {
      level: 1,
      name: 'Martial Arts',
      tables: { die: martialArtsDie },
      components: (ctx, owner) => {
        ctx.extra.push({
          id: `${owner}.roll`,
          revision: 1,
          name: 'Martial Arts damage',
          displayName: 'Martial Arts damage',
          textReferences: [owner],
          tags: ['roll-feature'],
          repeat: { maximum: 1, scope: 'parent' },
          roll: { id: 'damage', label: 'Martial Arts damage', dice: { count: 1, sides: { stat: 'martialArtsDie' } }, bonus: { stat: 'modifier.dexterity' } },
          components: [],
        });
        return [
          { id: 'die', kind: 'defineStat', stat: { id: 'martialArtsDie', name: 'Martial Arts die', kind: 'derived', expression: byLevel('die', owner) } },
          { id: 'bonus-strike', kind: 'grantCapability', name: 'Bonus Unarmed Strike', action: { kind: 'bonus-action', amount: 1 } },
          { id: 'roll', kind: 'grantFeature', feature: `${owner}.roll` },
        ];
      },
    },
    {
      level: 1,
      name: 'Unarmored Defense',
      components: () => [{ id: 'unarmored', kind: 'modifyStat', stat: 'unarmoredDefense', operation: 'floor', value: { stat: 'modifier.wisdom' }, condition: { op: 'eq', args: [{ stat: 'shield' }, 0] } }],
    },
    {
      level: 2,
      name: 'Monk’s Focus',
      components: (ctx, owner) => [
        { id: 'dc', kind: 'defineStat', stat: { id: 'focusSaveDC', name: 'Focus save DC', kind: 'derived', expression: { op: 'add', args: [8, { stat: 'modifier.wisdom' }, { stat: 'proficiencyBonus' }] } } },
        ...usesFeature('focus', 'Focus Points', classLevel, [full('short-rest'), full('long-rest')])(ctx, owner),
        { id: 'flurry', kind: 'grantCapability', name: 'Flurry of Blows', action: { kind: 'bonus-action', amount: 1 }, costs: [{ key: 'focus', amount: 1 }] },
        { id: 'patient-defense', kind: 'grantCapability', name: 'Patient Defense', action: { kind: 'bonus-action', amount: 1 }, costs: [{ key: 'focus', amount: 1 }], description: 'Disengage and Dodge as a Bonus Action (Disengage alone costs nothing).' },
        { id: 'step-of-the-wind', kind: 'grantCapability', name: 'Step of the Wind', action: { kind: 'bonus-action', amount: 1 }, costs: [{ key: 'focus', amount: 1 }], description: 'Disengage and Dash, doubling jump distance (Dash alone costs nothing).' },
      ],
    },
    {
      level: 2,
      name: 'Unarmored Movement',
      tables: { bonus: steps([[2, 10], [6, 15], [10, 20], [14, 25], [18, 30]]) },
      components: () => [{ id: 'speed', kind: 'modifyStat', stat: 'walkingSpeed', operation: 'add', value: { if: { op: 'and', args: [{ op: 'eq', args: [{ stat: 'armorIndex' }, 0] }, { op: 'eq', args: [{ stat: 'shield' }, 0] }] }, then: byLevel('bonus'), else: 0 } }],
    },
    { level: 2, name: 'Uncanny Metabolism', components: usesFeature('uncanny-metabolism', 'Uncanny Metabolism', 1, [full('long-rest')], { description: 'When you roll Initiative, regain all Focus Points and heal one Martial Arts die plus your Monk level.' }) },
    { level: 3, name: 'Deflect Attacks', components: () => [{ id: 'deflect', kind: 'grantCapability', name: 'Deflect Attacks', action: { kind: 'reaction', amount: 1 }, description: 'Reduce attack damage by 1d10 + Dexterity modifier + Monk level; spend 1 Focus Point to redirect it.' }] },
    { level: 4, name: 'Slow Fall', components: () => [{ id: 'slow-fall', kind: 'grantCapability', name: 'Slow Fall', action: { kind: 'reaction', amount: 1 }, description: 'Reduce falling damage by five times your Monk level.' }] },
    { level: 5, name: 'Extra Attack', components: () => [{ id: 'attacks', kind: 'modifyStat', stat: 'attacksPerAction', operation: 'floor', value: 2 }] },
    { level: 5, name: 'Stunning Strike', components: () => [{ id: 'stun', kind: 'grantCapability', name: 'Stunning Strike', costs: [{ key: 'focus', amount: 1 }], description: 'Once per turn on a hit: Constitution save against your Focus save DC or Stunned.' }] },
    { level: 6, name: 'Empowered Strikes' },
    { level: 7, name: 'Evasion' },
    { level: 9, name: 'Acrobatic Movement' },
    { level: 10, name: 'Heightened Focus' },
    { level: 10, name: 'Self-Restoration' },
    { level: 13, name: 'Deflect Energy' },
    {
      level: 14,
      name: 'Disciplined Survivor',
      components: () => ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map((ability): Component => ({ id: `save.${ability}`, kind: 'modifyStat', stat: `training.save.${ability}`, operation: 'floor', value: 1 })),
    },
    { level: 15, name: 'Perfect Focus' },
    { level: 18, name: 'Superior Defense' },
    {
      level: 20,
      name: 'Body and Mind',
      components: () => [
        { id: 'dexterity', kind: 'modifyStat', stat: 'dexterity', operation: 'add', value: 4 },
        { id: 'wisdom', kind: 'modifyStat', stat: 'wisdom', operation: 'add', value: 4 },
      ],
    },
  ],
  subclassLevels: [3, 6, 11, 17],
  subclass: {
    name: 'Warrior of the Open Hand',
    features: [
      { level: 3, name: 'Open Hand Technique' },
      { level: 6, name: 'Wholeness of Body', components: usesFeature('wholeness-of-body', 'Wholeness of Body', atLeastOne('modifier.wisdom'), [full('long-rest')], { action: 'bonus-action', description: 'Roll your Martial Arts die and regain that many Hit Points plus your Wisdom modifier (minimum 1).' }) },
      { level: 11, name: 'Fleet Step' },
      { level: 17, name: 'Quivering Palm', components: () => [{ id: 'quivering-palm', kind: 'grantCapability', name: 'Quivering Palm', costs: [{ key: 'focus', amount: 4 }], description: 'Set imperceptible vibrations; end them later for 10d12 Force damage on a failed Constitution save.' }] },
    ],
  },
};

const ROGUE_SKILLS = ['Acrobatics', 'Athletics', 'Deception', 'Insight', 'Intimidation', 'Investigation', 'Perception', 'Persuasion', 'Sleight of Hand', 'Stealth'];

/** Rogue, SRD 5.2.1 pp. 61–64, with the Thief. */
export const rogue: ClassSpec = {
  name: 'Rogue',
  pages: [61, 64],
  die: 8,
  saves: ['dexterity', 'intelligence'],
  skills: { count: 4, from: ROGUE_SKILLS },
  weapons: { simple: true },
  armor: ['light'],
  tools: { count: 1, from: ['Thieves’ Tools'] },
  multiclass: { prerequisites: { stat: 'dexterity', minimum: 13 }, armor: ['light'], skills: 1, tools: 1 },
  improvements: [4, 8, 10, 12, 16],
  features: [
    { level: 1, name: 'Expertise', components: () => [expertise(2)], summary: ['Two skills at level 1 and two more at level 6.'] },
    {
      level: 1,
      name: 'Sneak Attack',
      components: (ctx, owner) => {
        ctx.extra.push({
          id: `${owner}.roll`,
          revision: 1,
          name: 'Sneak Attack damage',
          displayName: 'Sneak Attack damage',
          textReferences: [owner],
          tags: ['roll-feature'],
          repeat: { maximum: 1, scope: 'parent' },
          roll: { id: 'damage', label: 'Sneak Attack damage', dice: { count: { stat: 'sneakAttackDice' }, sides: 6 } },
          components: [],
        });
        return [
          { id: 'dice', kind: 'defineStat', stat: { id: 'sneakAttackDice', name: 'Sneak Attack dice', kind: 'derived', expression: { op: 'ceil', args: [{ op: 'divide', args: [classLevel, 2] }] } } },
          { id: 'roll', kind: 'grantFeature', feature: `${owner}.roll` },
        ];
      },
    },
    {
      level: 1,
      name: 'Thieves’ Cant',
      components: () => [
        { id: 'cant', kind: 'grantFeature', feature: language('Thieves’ Cant'), ignorePrerequisites: true },
        { id: 'language', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { ids: [...STANDARD_LANGUAGES, ...RARE_LANGUAGES.filter((name) => name !== 'Thieves’ Cant')].map(language) }, retraining: { allowed: false } },
      ],
    },
    { level: 1, name: 'Weapon Mastery', ...weaponMastery([[1, 2]]), components: () => [{ id: 'masteries', kind: 'chooseFeatures', minimum: 2, maximum: 2, candidates: { ids: WEAPONS.filter(([name, category]) => category === 'simple' || FINESSE.includes(name) || LIGHT.includes(name)).map(([name]) => mastery(name)) }, retraining: { allowed: true, events: ['long-rest'] } }] },
    { level: 2, name: 'Cunning Action', components: () => [{ id: 'cunning-action', kind: 'grantCapability', name: 'Cunning Action', action: { kind: 'bonus-action', amount: 1 }, description: 'Dash, Disengage or Hide.' }] },
    { level: 3, name: 'Steady Aim', components: () => [{ id: 'steady-aim', kind: 'grantCapability', name: 'Steady Aim', action: { kind: 'bonus-action', amount: 1 }, description: 'Advantage on your next attack this turn; you must not have moved, and your Speed becomes 0.' }] },
    { level: 5, name: 'Cunning Strike' },
    { level: 5, name: 'Uncanny Dodge', components: () => [{ id: 'uncanny-dodge', kind: 'grantCapability', name: 'Uncanny Dodge', action: { kind: 'reaction', amount: 1 }, description: 'Halve the damage of an attack that hits you.' }] },
    { level: 6, name: 'Expertise', entry: () => ({ id: 'expertise-6', kind: 'chooseFeatures', minimum: 2, maximum: 2, candidates: { tags: ['expertise'] }, retraining: { allowed: false } }) },
    { level: 7, name: 'Evasion' },
    { level: 7, name: 'Reliable Talent' },
    { level: 11, name: 'Improved Cunning Strike' },
    { level: 14, name: 'Devious Strikes' },
    {
      level: 15,
      name: 'Slippery Mind',
      components: () => [
        { id: 'wisdom', kind: 'modifyStat', stat: 'training.save.wisdom', operation: 'floor', value: 1 },
        { id: 'charisma', kind: 'modifyStat', stat: 'training.save.charisma', operation: 'floor', value: 1 },
      ],
    },
    { level: 18, name: 'Elusive' },
    { level: 20, name: 'Stroke of Luck', components: usesFeature('stroke-of-luck', 'Stroke of Luck', 1, [full('short-rest'), full('long-rest')], { description: 'Turn a failed D20 Test into a roll of 20.' }) },
  ],
  subclassLevels: [3, 9, 13, 17],
  subclass: {
    name: 'Thief',
    features: [
      { level: 3, name: 'Fast Hands' },
      { level: 3, name: 'Second-Story Work' },
      { level: 9, name: 'Supreme Sneak' },
      { level: 13, name: 'Use Magic Device', components: () => [{ id: 'attunement', kind: 'modifyStat', stat: 'attunementLimit', operation: 'floor', value: 4 }] },
      { level: 17, name: 'Thief’s Reflexes' },
    ],
  },
};

export const SKILL_NAMES = SKILLS.map(([name]) => name);
export { describe };
