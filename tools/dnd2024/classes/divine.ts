import type { Component, Expression } from '@/src/model.js';
import type { ClassSpec, Ctx } from './common.ts';
import { alwaysPrepared, atLeastOne, byLevel, classLevel, expertise, freeCast, full, pool, shortRestOne, spellcasting, steps, usesFeature, weaponMastery } from './common.ts';
import { ABILITIES, language, RARE_LANGUAGES, SKILLS, STANDARD_LANGUAGES } from '../core.ts';
import { id, slug } from '../srd.ts';

const FULL_PREPARED = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
const HALF_PREPARED = [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15];
const noHeavyArmor: Expression = { op: 'lt', args: [{ stat: 'armorIndex' }, 9] };
const ALL_SKILLS = SKILLS.map(([name]) => name);

/** A choice between named options of one class feature, each option its own Feature. */
function options(ctx: Ctx, owner: string, list: { name: string; components: Component[]; summary?: string }[], retraining = false): Component[] {
  const ids = list.map((option) => {
    const optionId = `${owner}.${slug(option.name)}`;
    ctx.extra.push({
      id: optionId,
      revision: 1,
      name: option.name,
      displayName: option.name,
      textReferences: [owner],
      tags: ['class-option'],
      ...(option.summary ? { mechanicalSummary: [option.summary] } : {}),
      components: option.components.length ? option.components : [{ id: 'rules', kind: 'describe', text: option.summary ?? option.name }],
    });
    return optionId;
  });
  return [{ id: 'option', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { ids }, retraining: { allowed: retraining, ...(retraining ? { events: ['long-rest'] } : {}) } }];
}

/** "+N to Intelligence (X or Y) checks equal to your Wisdom modifier (minimum +1)". */
const checkBonus = (skills: string[]): Component[] => skills.map((name) => ({ id: `bonus.${slug(name)}`, kind: 'modifyStat', stat: `skill.${slug(name)}`, operation: 'add', value: atLeastOne('modifier.wisdom') }) as Component);

const channelDivinity = (key: string) =>
  (ctx: Ctx, owner: string): Component[] => {
    ctx.extra.push(pool(owner, key, 'Channel Divinity', { table: 'uses', owner, input: classLevel }, shortRestOne));
    return [{ id: 'pool', kind: 'grantFeature', feature: id(`resource.${key}`) }];
  };

/** Bard, SRD 5.2.1 pp. 31–36, with the College of Lore. */
export const bard: ClassSpec = {
  name: 'Bard',
  pages: [31, 36],
  die: 8,
  saves: ['dexterity', 'charisma'],
  skills: { count: 3, from: 'any' },
  weapons: { simple: true },
  armor: ['light'],
  // Three Musical Instruments; instruments share one proficiency Feature here.
  tools: { count: 1, from: ['Musical Instrument'] },
  multiclass: { prerequisites: { stat: 'charisma', minimum: 13 }, armor: ['light'], skills: 1, tools: 1 },
  features: [
    {
      level: 1,
      name: 'Bardic Inspiration',
      tables: { die: steps([[1, 6], [5, 8], [10, 10], [15, 12]]) },
      summary: ['Uses equal your Charisma modifier (minimum 1). From level 5 (Font of Inspiration) a Short Rest also restores all uses.'],
      components: (ctx, owner) => {
        ctx.extra.push(
          pool(owner, 'bardic-inspiration', 'Bardic Inspiration', atLeastOne('modifier.charisma'), [{ event: 'short-rest', amount: { if: { op: 'gte', args: [classLevel, 5] }, then: { stat: 'resource.capacity.bardic-inspiration' }, else: 0 } }, full('long-rest')]),
          {
            id: `${owner}.roll`,
            revision: 1,
            name: 'Bardic Inspiration die',
            displayName: 'Bardic Inspiration die',
            textReferences: [owner],
            tags: ['roll-feature'],
            repeat: { maximum: 1, scope: 'parent' },
            roll: { id: 'die', label: 'Bardic Inspiration die', dice: { count: 1, sides: { stat: 'bardicInspirationDie' } } },
            components: [],
          },
        );
        return [
          { id: 'die', kind: 'defineStat', stat: { id: 'bardicInspirationDie', name: 'Bardic Inspiration die', kind: 'derived', expression: byLevel('die', owner) } },
          { id: 'pool', kind: 'grantFeature', feature: id('resource.bardic-inspiration') },
          { id: 'use', kind: 'grantCapability', name: 'Bardic Inspiration', action: { kind: 'bonus-action', amount: 1 }, costs: [{ key: 'bardic-inspiration', amount: 1 }] },
          { id: 'roll', kind: 'grantFeature', feature: `${owner}.roll` },
        ];
      },
    },
    spellcasting({ ability: 'charisma', caster: 'full', cantrips: [[1, 2], [4, 3], [10, 4]], prepared: FULL_PREPARED, changes: 'level' }),
    { level: 2, name: 'Expertise', components: () => [expertise(2)], summary: ['Two skills at level 2 and two more at level 9.'] },
    {
      level: 2,
      name: 'Jack of All Trades',
      components: () =>
        SKILLS.map(([name]): Component => ({
          id: `skill.${slug(name)}`,
          kind: 'modifyStat',
          stat: `skill.${slug(name)}`,
          operation: 'add',
          value: { if: { op: 'eq', args: [{ stat: `training.skill.${slug(name)}` }, 0] }, then: { op: 'floor', args: [{ op: 'divide', args: [{ stat: 'proficiencyBonus' }, 2] }] }, else: 0 },
        })),
    },
    { level: 5, name: 'Font of Inspiration' },
    { level: 7, name: 'Countercharm', components: () => [{ id: 'countercharm', kind: 'grantCapability', name: 'Countercharm', action: { kind: 'reaction', amount: 1 } }] },
    { level: 9, name: 'Expertise', entry: () => ({ id: 'expertise-9', kind: 'chooseFeatures', minimum: 2, maximum: 2, candidates: { tags: ['expertise'] }, retraining: { allowed: false } }) },
    { level: 10, name: 'Magical Secrets', summary: ['Choosing Cleric, Druid and Wizard spells for Bard preparation is managed at the table for now.'] },
    { level: 18, name: 'Superior Inspiration' },
    { level: 20, name: 'Words of Creation', components: (ctx) => alwaysPrepared(ctx, 'charisma', [[3, ['Power Word Heal', 'Power Word Kill']]]) },
  ],
  subclassLevels: [3, 6, 14],
  subclass: {
    name: 'College of Lore',
    features: [
      { level: 3, name: 'Bonus Proficiencies', components: () => [{ id: 'skills', kind: 'chooseFeatures', minimum: 3, maximum: 3, candidates: { tags: ['skill-proficiency'] }, retraining: { allowed: false } }] },
      { level: 3, name: 'Cutting Words', components: () => [{ id: 'cutting-words', kind: 'grantCapability', name: 'Cutting Words', action: { kind: 'reaction', amount: 1 }, costs: [{ key: 'bardic-inspiration', amount: 1 }] }] },
      { level: 6, name: 'Magical Discoveries', summary: ['The two extra spells from the Cleric, Druid or Wizard list are managed at the table for now.'] },
      { level: 14, name: 'Peerless Skill' },
    ],
  },
};

/** Cleric, SRD 5.2.1 pp. 36–41, with the Life Domain. */
export const cleric: ClassSpec = {
  name: 'Cleric',
  pages: [36, 41],
  die: 8,
  saves: ['wisdom', 'charisma'],
  skills: { count: 2, from: ['History', 'Insight', 'Medicine', 'Persuasion', 'Religion'] },
  weapons: { simple: true },
  armor: ['light', 'medium', 'shield'],
  multiclass: { prerequisites: { stat: 'wisdom', minimum: 13 }, armor: ['light', 'medium', 'shield'] },
  features: [
    spellcasting({ ability: 'wisdom', caster: 'full', cantrips: [[1, 3], [4, 4], [10, 5]], prepared: FULL_PREPARED, changes: 'long-rest' }),
    {
      level: 1,
      name: 'Divine Order',
      components: (ctx, owner) =>
        options(ctx, owner, [
          { name: 'Protector', components: [{ id: 'martial', kind: 'modifyStat', stat: 'training.weapons.martial', operation: 'floor', value: 1 }, { id: 'heavy', kind: 'modifyStat', stat: 'training.armor.heavy', operation: 'floor', value: 1 }] },
          { name: 'Thaumaturge', components: [{ id: 'cantrip', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { tags: ['cleric-cantrip'] }, retraining: { allowed: true } }, ...checkBonus(['Arcana', 'Religion'])] },
        ]),
    },
    {
      level: 2,
      name: 'Channel Divinity',
      tables: { uses: steps([[2, 2], [6, 3], [18, 4]]) },
      components: (ctx, owner) => {
        ctx.extra.push({
          id: `${owner}.divine-spark`,
          revision: 1,
          name: 'Divine Spark',
          displayName: 'Divine Spark',
          textReferences: [owner],
          tags: ['roll-feature'],
          repeat: { maximum: 1, scope: 'parent' },
          roll: { id: 'spark', label: 'Divine Spark', dice: '1d8', bonus: { stat: 'modifier.wisdom' }, capability: 'Divine Spark', characterScaling: [{ level: 7, count: 2 }, { level: 13, count: 3 }, { level: 18, count: 4 }] },
          components: [],
        });
        return [
          ...channelDivinity('channel-divinity')(ctx, owner),
          { id: 'divine-spark', kind: 'grantCapability', name: 'Divine Spark', action: { kind: 'action', amount: 1 }, costs: [{ key: 'channel-divinity', amount: 1 }] },
          { id: 'spark-roll', kind: 'grantFeature', feature: `${owner}.divine-spark` },
          { id: 'turn-undead', kind: 'grantCapability', name: 'Turn Undead', action: { kind: 'action', amount: 1 }, costs: [{ key: 'channel-divinity', amount: 1 }] },
        ];
      },
    },
    { level: 5, name: 'Sear Undead' },
    {
      level: 7,
      name: 'Blessed Strikes',
      components: (ctx, owner) =>
        options(ctx, owner, [
          { name: 'Divine Strike', components: [], summary: 'Once per turn, a weapon hit deals an extra 1d8 Necrotic or Radiant damage (2d8 from level 14).' },
          { name: 'Potent Spellcasting', components: [], summary: 'Add your Wisdom modifier to Cleric cantrip damage; from level 14, grant Temporary Hit Points.' },
        ]),
    },
    { level: 10, name: 'Divine Intervention', components: usesFeature('divine-intervention', 'Divine Intervention', 1, [full('long-rest')], { action: 'action', description: 'Cast a Cleric spell of level 5 or lower without a slot or Material components.' }) },
    { level: 14, name: 'Improved Blessed Strikes' },
    { level: 20, name: 'Greater Divine Intervention' },
  ],
  subclassLevels: [3, 6, 17],
  subclass: {
    name: 'Life Domain',
    features: [
      { level: 3, name: 'Disciple of Life' },
      { level: 3, name: 'Life Domain Spells', components: (ctx) => alwaysPrepared(ctx, 'wisdom', [[3, ['Aid', 'Bless', 'Cure Wounds', 'Lesser Restoration']], [5, ['Mass Healing Word', 'Revivify']], [7, ['Aura of Life', 'Death Ward']], [9, ['Greater Restoration', 'Mass Cure Wounds']]]) },
      { level: 3, name: 'Preserve Life', components: () => [{ id: 'preserve-life', kind: 'grantCapability', name: 'Preserve Life', action: { kind: 'action', amount: 1 }, costs: [{ key: 'channel-divinity', amount: 1 }], description: 'Divide five times your Cleric level in healing among Bloodied creatures within 30 feet.' }] },
      { level: 6, name: 'Blessed Healer' },
      { level: 17, name: 'Supreme Healing' },
    ],
  },
};

const LANDS: [string, [number, string[]][]][] = [
  ['Arid Land', [[3, ['Blur', 'Burning Hands', 'Fire Bolt']], [5, ['Fireball']], [7, ['Blight']], [9, ['Wall of Stone']]]],
  ['Polar Land', [[3, ['Fog Cloud', 'Hold Person', 'Ray of Frost']], [5, ['Sleet Storm']], [7, ['Ice Storm']], [9, ['Cone of Cold']]]],
  ['Temperate Land', [[3, ['Misty Step', 'Shocking Grasp', 'Sleep']], [5, ['Lightning Bolt']], [7, ['Freedom of Movement']], [9, ['Tree Stride']]]],
  ['Tropical Land', [[3, ['Acid Splash', 'Ray of Sickness', 'Web']], [5, ['Stinking Cloud']], [7, ['Polymorph']], [9, ['Insect Plague']]]],
];

/** Druid, SRD 5.2.1 pp. 41–47, with the Circle of the Land. */
export const druid: ClassSpec = {
  name: 'Druid',
  pages: [41, 47],
  die: 8,
  saves: ['intelligence', 'wisdom'],
  skills: { count: 2, from: ['Arcana', 'Animal Handling', 'Insight', 'Medicine', 'Nature', 'Perception', 'Religion', 'Survival'] },
  weapons: { simple: true },
  armor: ['light', 'shield'],
  tools: { count: 1, from: ['Herbalism Kit'] },
  multiclass: { prerequisites: { stat: 'wisdom', minimum: 13 }, armor: ['light', 'shield'] },
  features: [
    spellcasting({ ability: 'wisdom', caster: 'full', cantrips: [[1, 2], [4, 3], [10, 4]], prepared: FULL_PREPARED, changes: 'long-rest' }),
    { level: 1, name: 'Druidic', components: (ctx) => [{ id: 'druidic', kind: 'grantFeature', feature: language('Druidic'), ignorePrerequisites: true }, ...alwaysPrepared(ctx, 'wisdom', [[1, ['Speak with Animals']]])] },
    {
      level: 1,
      name: 'Primal Order',
      components: (ctx, owner) =>
        options(ctx, owner, [
          { name: 'Magician', components: [{ id: 'cantrip', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { tags: ['druid-cantrip'] }, retraining: { allowed: true } }, ...checkBonus(['Arcana', 'Nature'])] },
          { name: 'Warden', components: [{ id: 'martial', kind: 'modifyStat', stat: 'training.weapons.martial', operation: 'floor', value: 1 }, { id: 'medium', kind: 'modifyStat', stat: 'training.armor.medium', operation: 'floor', value: 1 }] },
        ]),
    },
    {
      level: 2,
      name: 'Wild Shape',
      tables: { uses: steps([[2, 2], [6, 3], [17, 4]]) },
      components: (ctx, owner) => [
        ...usesFeature('wild-shape', 'Wild Shape', byLevel('uses', owner), shortRestOne, { action: 'bonus-action', description: 'Shape-shift into a known Beast form for half your Druid level in hours.' })(ctx, owner),
      ],
    },
    { level: 2, name: 'Wild Companion', components: () => [{ id: 'wild-companion', kind: 'grantCapability', name: 'Wild Companion', action: { kind: 'action', amount: 1 }, costs: [{ key: 'wild-shape', amount: 1 }], description: 'Cast Find Familiar without Material components (or spend a spell slot instead).' }] },
    { level: 5, name: 'Wild Resurgence' },
    {
      level: 7,
      name: 'Elemental Fury',
      components: (ctx, owner) =>
        options(ctx, owner, [
          { name: 'Potent Spellcasting', components: [], summary: 'Add your Wisdom modifier to Druid cantrip damage.' },
          { name: 'Primal Strike', components: [], summary: 'Once per turn, a weapon or Beast-form hit deals an extra 1d8 Cold, Fire, Lightning or Thunder damage (2d8 from level 15).' },
        ]),
    },
    { level: 15, name: 'Improved Elemental Fury' },
    { level: 18, name: 'Beast Spells' },
    { level: 20, name: 'Archdruid' },
  ],
  subclassLevels: [3, 6, 10, 14],
  subclass: {
    name: 'Circle of the Land',
    features: [
      {
        level: 3,
        name: 'Circle of the Land Spells',
        components: (ctx, owner) =>
          options(
            ctx,
            owner,
            LANDS.map(([name, spells]) => ({ name, components: alwaysPrepared(ctx, 'wisdom', spells) })),
            true,
          ),
      },
      { level: 3, name: 'Land’s Aid', components: () => [{ id: 'lands-aid', kind: 'grantCapability', name: 'Land’s Aid', action: { kind: 'action', amount: 1 }, costs: [{ key: 'wild-shape', amount: 1 }] }] },
      { level: 6, name: 'Natural Recovery', components: usesFeature('natural-recovery', 'Natural Recovery', 1, [full('long-rest')], { description: 'Cast a prepared Circle spell without a slot, or recover slots after a Short Rest (half your Druid level, rounded up).' }) },
      { level: 10, name: 'Nature’s Ward' },
      { level: 14, name: 'Nature’s Sanctuary', components: () => [{ id: 'sanctuary', kind: 'grantCapability', name: 'Nature’s Sanctuary', action: { kind: 'action', amount: 1 }, costs: [{ key: 'wild-shape', amount: 1 }] }] },
    ],
  },
};

/** Fighting Style, or learning two cantrips from another class list (Blessed Warrior, Druidic Warrior). */
function styleOrCantrips(ctx: Ctx, owner: string, option: string, list: 'cleric' | 'druid', ability: 'charisma' | 'wisdom'): Component[] {
  const optionId = `${owner}.${slug(option)}`;
  ctx.extra.push({
    id: optionId,
    revision: 1,
    name: option,
    displayName: option,
    textReferences: [owner],
    tags: ['class-option'],
    components: [{ id: 'cantrips', kind: 'chooseFeatures', minimum: 2, maximum: 2, candidates: { tags: [`initiate-${list}-${ability}-cantrip`] }, retraining: { allowed: true } }],
  });
  // Candidate tags must all match, so the feats and the option are listed by ID in one choice.
  const styles = ['Archery', 'Defense', 'Great Weapon Fighting', 'Two-Weapon Fighting'].map((name) => id(`feat.${slug(name)}`));
  return [{ id: 'style', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { ids: [...styles, optionId] }, retraining: { allowed: true } }];
}

/** Paladin, SRD 5.2.1 pp. 53–57, with the Oath of Devotion. */
export const paladin: ClassSpec = {
  name: 'Paladin',
  pages: [53, 57],
  die: 10,
  saves: ['wisdom', 'charisma'],
  skills: { count: 2, from: ['Athletics', 'Insight', 'Intimidation', 'Medicine', 'Persuasion', 'Religion'] },
  weapons: { simple: true, martial: true },
  armor: ['light', 'medium', 'heavy', 'shield'],
  multiclass: { prerequisites: { all: [{ stat: 'strength', minimum: 13 }, { stat: 'charisma', minimum: 13 }] }, armor: ['light', 'medium', 'shield'], martial: true },
  features: [
    {
      level: 1,
      name: 'Lay On Hands',
      components: usesFeature('lay-on-hands', 'Lay On Hands', { op: 'multiply', args: [5, classLevel] }, [full('long-rest')], { action: 'bonus-action', description: 'Restore Hit Points from the pool, or spend 5 to remove the Poisoned condition. Spend the amount used.' }),
    },
    spellcasting({ ability: 'charisma', caster: 'half', prepared: HALF_PREPARED, changes: 'long-rest' }),
    { level: 1, name: 'Weapon Mastery', ...weaponMastery([[1, 2]]) },
    { level: 2, name: 'Fighting Style', tags: ['fighting-style-feature'], summary: ['Choose a Fighting Style feat, or Blessed Warrior: two Cleric cantrips using Charisma.'], components: (ctx, owner) => styleOrCantrips(ctx, owner, 'Blessed Warrior', 'cleric', 'charisma') },
    { level: 2, name: 'Paladin’s Smite', components: (ctx, owner) => [...alwaysPrepared(ctx, 'charisma', [[1, ['Divine Smite']]]), ...freeCast(ctx, owner, 'charisma', 'Divine Smite', 1, [full('long-rest')])] },
    {
      level: 3,
      name: 'Channel Divinity',
      tables: { uses: steps([[3, 2], [11, 3]]) },
      components: (ctx, owner) => [
        ...channelDivinity('paladin-channel-divinity')(ctx, owner),
        { id: 'divine-sense', kind: 'grantCapability', name: 'Divine Sense', action: { kind: 'bonus-action', amount: 1 }, costs: [{ key: 'paladin-channel-divinity', amount: 1 }] },
      ],
    },
    { level: 5, name: 'Extra Attack', components: () => [{ id: 'attacks', kind: 'modifyStat', stat: 'attacksPerAction', operation: 'floor', value: 2 }] },
    { level: 5, name: 'Faithful Steed', components: (ctx, owner) => [...alwaysPrepared(ctx, 'charisma', [[1, ['Find Steed']]]), ...freeCast(ctx, owner, 'charisma', 'Find Steed', 1, [full('long-rest')])] },
    {
      level: 6,
      name: 'Aura of Protection',
      summary: ['Your own saving throws include the bonus; allies in the aura add it at the table.'],
      components: () => ABILITIES.map((ability): Component => ({ id: `save.${ability}`, kind: 'modifyStat', stat: `save.${ability}`, operation: 'add', value: atLeastOne('modifier.charisma') })),
    },
    { level: 9, name: 'Abjure Foes', components: () => [{ id: 'abjure-foes', kind: 'grantCapability', name: 'Abjure Foes', action: { kind: 'action', amount: 1 }, costs: [{ key: 'paladin-channel-divinity', amount: 1 }] }] },
    { level: 10, name: 'Aura of Courage' },
    { level: 11, name: 'Radiant Strikes' },
    { level: 14, name: 'Restoring Touch' },
    { level: 18, name: 'Aura Expansion' },
  ],
  subclassLevels: [3, 7, 15, 20],
  subclass: {
    name: 'Oath of Devotion',
    features: [
      { level: 3, name: 'Oath of Devotion Spells', components: (ctx) => alwaysPrepared(ctx, 'charisma', [[3, ['Protection from Evil and Good', 'Shield of Faith']], [5, ['Aid', 'Zone of Truth']], [9, ['Beacon of Hope', 'Dispel Magic']], [13, ['Freedom of Movement', 'Guardian of Faith']], [17, ['Commune', 'Flame Strike']]]) },
      { level: 3, name: 'Sacred Weapon', components: () => [{ id: 'sacred-weapon', kind: 'grantCapability', name: 'Sacred Weapon', costs: [{ key: 'paladin-channel-divinity', amount: 1 }], description: 'When you take the Attack action: add your Charisma modifier to weapon attack rolls for 10 minutes.' }] },
      { level: 7, name: 'Aura of Devotion' },
      { level: 15, name: 'Smite of Protection' },
      { level: 20, name: 'Holy Nimbus', components: usesFeature('holy-nimbus', 'Holy Nimbus', 1, [full('long-rest')], { action: 'bonus-action' }) },
    ],
  },
};

/** Ranger, SRD 5.2.1 pp. 57–61, with the Hunter. */
export const ranger: ClassSpec = {
  name: 'Ranger',
  pages: [57, 61],
  die: 10,
  saves: ['strength', 'dexterity'],
  skills: { count: 3, from: ['Animal Handling', 'Athletics', 'Insight', 'Investigation', 'Nature', 'Perception', 'Stealth', 'Survival'] },
  weapons: { simple: true, martial: true },
  armor: ['light', 'medium', 'shield'],
  multiclass: { prerequisites: { all: [{ stat: 'dexterity', minimum: 13 }, { stat: 'wisdom', minimum: 13 }] }, armor: ['light', 'medium', 'shield'], martial: true, skills: 1 },
  features: [
    spellcasting({ ability: 'wisdom', caster: 'half', prepared: HALF_PREPARED, changes: 'long-rest' }),
    {
      level: 1,
      name: 'Favored Enemy',
      tables: { uses: steps([[1, 2], [5, 3], [9, 4], [13, 5], [17, 6]]) },
      components: (ctx, owner) => [...alwaysPrepared(ctx, 'wisdom', [[1, ['Hunter’s Mark']]]), ...freeCast(ctx, owner, 'wisdom', 'Hunter’s Mark', byLevel('uses', owner), [full('long-rest')], 'Favored Enemy')],
    },
    { level: 1, name: 'Weapon Mastery', ...weaponMastery([[1, 2]]) },
    {
      level: 2,
      name: 'Deft Explorer',
      components: () => [
        expertise(1),
        { id: 'languages', kind: 'chooseFeatures', minimum: 2, maximum: 2, candidates: { ids: [...STANDARD_LANGUAGES, ...RARE_LANGUAGES].map(language) }, retraining: { allowed: false } },
      ],
    },
    { level: 2, name: 'Fighting Style', tags: ['fighting-style-feature'], summary: ['Choose a Fighting Style feat, or Druidic Warrior: two Druid cantrips using Wisdom.'], components: (ctx, owner) => styleOrCantrips(ctx, owner, 'Druidic Warrior', 'druid', 'wisdom') },
    { level: 5, name: 'Extra Attack', components: () => [{ id: 'attacks', kind: 'modifyStat', stat: 'attacksPerAction', operation: 'floor', value: 2 }] },
    { level: 6, name: 'Roving', components: () => [{ id: 'speed', kind: 'modifyStat', stat: 'walkingSpeed', operation: 'add', value: { if: noHeavyArmor, then: 10, else: 0 } }] },
    { level: 9, name: 'Expertise', components: () => [expertise(2)] },
    { level: 10, name: 'Tireless', components: usesFeature('tireless', 'Tireless', atLeastOne('modifier.wisdom'), [full('long-rest')], { action: 'action', description: 'Gain 1d8 + Wisdom modifier (minimum 1) Temporary Hit Points.' }) },
    { level: 13, name: 'Relentless Hunter' },
    { level: 14, name: 'Nature’s Veil', components: usesFeature('natures-veil', 'Nature’s Veil', atLeastOne('modifier.wisdom'), [full('long-rest')], { action: 'bonus-action' }) },
    { level: 17, name: 'Precise Hunter' },
    { level: 18, name: 'Feral Senses' },
    { level: 20, name: 'Foe Slayer' },
  ],
  subclassLevels: [3, 7, 11, 15],
  subclass: {
    name: 'Hunter',
    features: [
      { level: 3, name: 'Hunter’s Lore' },
      {
        level: 3,
        name: 'Hunter’s Prey',
        components: (ctx, owner) =>
          options(ctx, owner, [
            { name: 'Colossus Slayer', components: [], summary: 'Once per turn, deal an extra 1d8 damage to a creature missing any Hit Points.' },
            { name: 'Horde Breaker', components: [], summary: 'Once per turn, attack a second creature within 5 feet of the first with the same weapon.' },
          ], true),
      },
      {
        level: 7,
        name: 'Defensive Tactics',
        components: (ctx, owner) =>
          options(ctx, owner, [
            { name: 'Escape the Horde', components: [], summary: 'Opportunity Attacks have Disadvantage against you.' },
            { name: 'Multiattack Defense', components: [], summary: 'After a creature hits you, its other attacks this turn have Disadvantage.' },
          ], true),
      },
      { level: 11, name: 'Superior Hunter’s Prey' },
      { level: 15, name: 'Superior Hunter’s Defense', components: () => [{ id: 'defense', kind: 'grantCapability', name: 'Superior Hunter’s Defense', action: { kind: 'reaction', amount: 1 }, description: 'Gain Resistance to the damage type that hit you, until the end of the turn.' }] },
    ],
  },
};

export const SKILL_LIST = ALL_SKILLS;
