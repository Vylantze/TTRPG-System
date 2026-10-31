import type { Component, Predicate } from '@/src/model.js';
import type { ClassFeature, ClassSpec, Ctx } from './common.ts';
import { alwaysPrepared, byLevel, classLevel, freeCast, full, pool, spellcasting, steps, usesFeature } from './common.ts';
import { castingArguments, spell, SPELLS } from '../spells.ts';
import { id, section, slug, source } from '../srd.ts';

/** Option Features read from an options section, such as Metamagic or Eldritch Invocations. */
function optionFeatures(ctx: Ctx, owner: string, pages: [number, number], tag: string, list: { name: string; prerequisites?: Predicate; components?: Component[] }[]) {
  for (const option of list) {
    const entry = section(option.name, pages);
    ctx.extra.push({
      id: `${owner}.${slug(option.name)}`,
      revision: 1,
      name: option.name,
      displayName: option.name,
      description: entry.text,
      source: source(entry.page),
      tags: ['class-option', tag],
      ...(option.prerequisites ? { prerequisites: option.prerequisites } : {}),
      repeat: /\nRepeatable\.|can take this invocation more than once/i.test(entry.text) ? { maximum: 20, scope: 'character' } : { maximum: 1, scope: 'character' },
      components: option.components ?? [{ id: 'rules', kind: 'describe', text: option.name }],
    });
  }
}

const METAMAGIC: [string, number][] = [
  ['Careful Spell', 1],
  ['Distant Spell', 1],
  ['Empowered Spell', 1],
  ['Extended Spell', 1],
  ['Heightened Spell', 2],
  ['Quickened Spell', 2],
  ['Seeking Spell', 1],
  ['Subtle Spell', 1],
  ['Transmuted Spell', 1],
  ['Twinned Spell', 1],
];

/** Sorcerer, SRD 5.2.1 pp. 64–70, with Draconic Sorcery. */
export const sorcerer: ClassSpec = {
  name: 'Sorcerer',
  pages: [64, 70],
  die: 6,
  saves: ['constitution', 'charisma'],
  skills: { count: 2, from: ['Arcana', 'Deception', 'Insight', 'Intimidation', 'Persuasion', 'Religion'] },
  weapons: { simple: true },
  armor: [],
  multiclass: { prerequisites: { stat: 'charisma', minimum: 13 }, armor: [] },
  features: [
    spellcasting({ ability: 'charisma', caster: 'full', cantrips: [[1, 4], [4, 5], [10, 6]], prepared: [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22], changes: 'level' }),
    { level: 1, name: 'Innate Sorcery', components: usesFeature('innate-sorcery', 'Innate Sorcery', 2, [full('long-rest')], { action: 'bonus-action', description: 'For 1 minute: +1 to your Sorcerer spell save DC and Advantage on Sorcerer spell attacks.' }) },
    {
      level: 2,
      name: 'Font of Magic',
      components: (ctx, owner) => [
        ...usesFeature('sorcery-points', 'Sorcery Points', classLevel, [full('long-rest')])(ctx, owner),
        { id: 'create-slot', kind: 'grantCapability', name: 'Create Spell Slot', action: { kind: 'bonus-action', amount: 1 }, description: 'Spend 2/3/5/6/7 Sorcery Points for a level 1–5 slot (adjust the trackers).' },
      ],
    },
    {
      level: 2,
      name: 'Metamagic',
      tables: { options: steps([[2, 2], [10, 4], [17, 6]]) },
      components: (ctx, owner) => {
        optionFeatures(
          ctx,
          owner,
          [66, 68],
          'metamagic',
          METAMAGIC.map(([name, cost]) => ({ name, components: [{ id: 'use', kind: 'grantCapability', name, costs: [{ key: 'sorcery-points', amount: cost }] }] })),
        );
        return [{ id: 'options', kind: 'chooseFeatures', minimum: byLevel('options'), maximum: byLevel('options'), candidates: { tags: ['metamagic'] }, retraining: { allowed: true } }];
      },
    },
    { level: 5, name: 'Sorcerous Restoration', components: usesFeature('sorcerous-restoration', 'Sorcerous Restoration', 1, [full('long-rest')], { description: 'After a Short Rest, regain Sorcery Points up to half your Sorcerer level (round down).' }) },
    { level: 7, name: 'Sorcery Incarnate' },
    { level: 20, name: 'Arcane Apotheosis' },
  ],
  subclassLevels: [3, 6, 14, 18],
  subclass: {
    name: 'Draconic Sorcery',
    features: [
      {
        level: 3,
        name: 'Draconic Resilience',
        components: () => [
          { id: 'hit-points', kind: 'modifyStat', stat: 'hitPoints', operation: 'add', value: classLevel },
          { id: 'unarmored', kind: 'modifyStat', stat: 'unarmoredDefense', operation: 'floor', value: { stat: 'modifier.charisma' } },
        ],
      },
      { level: 3, name: 'Draconic Spells', components: (ctx) => alwaysPrepared(ctx, 'charisma', [[3, ['Alter Self', 'Chromatic Orb', 'Command', 'Dragon’s Breath']], [5, ['Fear', 'Fly']], [7, ['Arcane Eye', 'Charm Monster']], [9, ['Legend Lore', 'Summon Dragon']]]) },
      { level: 6, name: 'Elemental Affinity' },
      { level: 14, name: 'Dragon Wings', components: usesFeature('dragon-wings', 'Dragon Wings', 1, [full('long-rest')], { action: 'bonus-action', description: 'Fly Speed 60 feet for 1 hour. Spend 3 Sorcery Points to restore the use.' }) },
      { level: 18, name: 'Dragon Companion', components: (ctx, owner) => freeCast(ctx, owner, 'charisma', 'Summon Dragon', 1, [full('long-rest')], 'Dragon Companion') },
    ],
  },
};

const warlockLevel = (level: number): Predicate => ({ expression: { op: 'gte', args: [{ context: `level.${id('warlock')}` }, level] } });
const invocation = (name: string) => ({ feature: id(`warlock.eldritch-invocations.${slug(name)}`) });
const INVOCATIONS: { name: string; level?: number; requires?: string; spell?: string }[] = [
  { name: 'Agonizing Blast', level: 2 },
  { name: 'Armor of Shadows', spell: 'Mage Armor' },
  { name: 'Ascendant Step', level: 5, spell: 'Levitate' },
  { name: 'Devil’s Sight', level: 2 },
  { name: 'Devouring Blade', level: 12, requires: 'Thirsting Blade' },
  { name: 'Eldritch Mind' },
  { name: 'Eldritch Smite', level: 5, requires: 'Pact of the Blade' },
  { name: 'Eldritch Spear', level: 2 },
  { name: 'Fiendish Vigor', level: 2, spell: 'False Life' },
  { name: 'Gaze of Two Minds', level: 5 },
  { name: 'Gift of the Depths', level: 5 },
  { name: 'Gift of the Protectors', level: 9, requires: 'Pact of the Tome' },
  { name: 'Investment of the Chain Master', level: 5, requires: 'Pact of the Chain' },
  { name: 'Lessons of the First Ones', level: 2 },
  { name: 'Lifedrinker', level: 9, requires: 'Pact of the Blade' },
  { name: 'Mask of Many Faces', level: 2, spell: 'Disguise Self' },
  { name: 'Master of Myriad Forms', level: 5, spell: 'Alter Self' },
  { name: 'Misty Visions', level: 2, spell: 'Silent Image' },
  { name: 'One with Shadows', level: 5 },
  { name: 'Otherworldly Leap', level: 2, spell: 'Jump' },
  { name: 'Pact of the Blade' },
  { name: 'Pact of the Chain', spell: 'Find Familiar' },
  { name: 'Pact of the Tome' },
  { name: 'Repelling Blast', level: 2 },
  { name: 'Thirsting Blade', level: 5, requires: 'Pact of the Blade' },
  { name: 'Visions of Distant Realms', level: 9, spell: 'Arcane Eye' },
  { name: 'Whispers of the Grave', level: 7, spell: 'Speak with Dead' },
  { name: 'Witch Sight', level: 15 },
];

/** Mystic Arcanum: one Warlock spell of a level, cast once per Long Rest without a slot. */
function arcanum(ctx: Ctx, owner: string, level: number): Component {
  const key = `mystic-arcanum.${level}`;
  ctx.extra.push(pool(owner, key, `Mystic Arcanum (level ${level})`, 1, [full('long-rest')]));
  for (const entry of SPELLS.filter((candidate) => candidate.level === level && candidate.classes.includes('warlock'))) {
    ctx.extra.push({
      id: id(`warlock.arcanum.${slug(entry.name)}`),
      revision: 1,
      name: `${entry.name} (Mystic Arcanum)`,
      displayName: entry.name,
      textReferences: [spell(entry.name)],
      contentLevel: level,
      tags: [`warlock-arcanum-${level}`],
      components: [
        { id: 'spell-rules', kind: 'grantFeature', feature: spell(entry.name) },
        { id: 'pool', kind: 'grantFeature', feature: id(`resource.${key}`) },
        {
          id: 'cast',
          kind: 'grantCapability',
          name: `${entry.name} (Mystic Arcanum)`,
          costs: [{ key, amount: 1 }],
          action: { kind: entry.castingTime.startsWith('Bonus') ? 'bonus-action' : entry.castingTime.startsWith('Reaction') ? 'reaction' : 'action', amount: 1 },
          metadata: { ...castingArguments(entry, 'charisma', false), spellLevel: level, spellSlotLevel: level, ritual: false, castingMode: 'free' },
        } as Component,
      ],
    });
  }
  return { id: `arcanum-${level}`, kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { tags: [`warlock-arcanum-${level}`] }, retraining: { allowed: true } };
}

const arcanumLevels: ClassFeature[] = [
  { level: 11, name: 'Mystic Arcanum', components: (ctx, owner) => [arcanum(ctx, owner, 6)] },
  ...([[13, 7], [15, 8], [17, 9]] as const).map(([classLevelValue, spellLevel]): ClassFeature => ({
    level: classLevelValue,
    name: 'Mystic Arcanum',
    entry: (ctx, owner) => {
      const choice = arcanum(ctx, owner, spellLevel);
      return choice as Extract<Component, { kind: 'chooseFeatures' }>;
    },
  })),
];

/** Warlock, SRD 5.2.1 pp. 70–77, with the Fiend Patron. */
export const warlock: ClassSpec = {
  name: 'Warlock',
  pages: [70, 77],
  die: 8,
  saves: ['wisdom', 'charisma'],
  skills: { count: 2, from: ['Arcana', 'Deception', 'History', 'Intimidation', 'Investigation', 'Nature', 'Religion'] },
  weapons: { simple: true },
  armor: ['light'],
  multiclass: { prerequisites: { stat: 'charisma', minimum: 13 }, armor: ['light'] },
  features: [
    {
      level: 1,
      name: 'Eldritch Invocations',
      tables: { count: steps([[1, 1], [2, 3], [5, 5], [7, 6], [9, 7], [12, 8], [15, 9], [18, 10]]) },
      components: (ctx, owner) => {
        optionFeatures(
          ctx,
          owner,
          [72, 74],
          'eldritch-invocation',
          INVOCATIONS.map((entry) => {
            const prerequisites = [entry.level ? warlockLevel(entry.level) : null, entry.requires ? invocation(entry.requires) : null].filter((value): value is Predicate => value !== null);
            const components: Component[] = [];
            if (entry.spell) components.push({ id: 'spell', kind: 'grantFeature', feature: spell(entry.spell) });
            if (entry.name === 'Lessons of the First Ones') components.push({ id: 'feat', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { tags: ['origin-feat'] }, retraining: { allowed: false } });
            if (entry.name === 'Pact of the Chain') components.push({ id: 'familiar', kind: 'grantCapability', name: 'Find Familiar (Pact of the Chain)', action: { kind: 'action', amount: 1 }, description: 'Cast Find Familiar as a Magic action without a slot.' });
            return {
              name: entry.name,
              ...(prerequisites.length ? { prerequisites: prerequisites.length === 1 ? prerequisites[0] : { all: prerequisites } } : {}),
              ...(components.length ? { components: [...components, { id: 'rules', kind: 'describe', text: entry.name }] } : {}),
            };
          }),
        );
        // The choice is owned by the level 1 feature, so prerequisites such as "Level 5+ Warlock"
        // must be checked against the current Warlock level, not the level 1 acquisition.
        return [{ id: 'invocations', kind: 'chooseFeatures', minimum: byLevel('count'), maximum: byLevel('count'), candidates: { tags: ['eldritch-invocation'] }, eligibility: 'current', retraining: { allowed: true } }];
      },
    },
    spellcasting({ ability: 'charisma', caster: 'pact', name: 'Pact Magic', cantrips: [[1, 2], [4, 3], [10, 4]], prepared: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15], changes: 'level' }),
    { level: 2, name: 'Magical Cunning', components: usesFeature('magical-cunning', 'Magical Cunning', 1, [full('long-rest')], { description: 'After a 1-minute rite, regain up to half your Pact Magic slots (round up); all of them from level 20.' }) },
    { level: 9, name: 'Contact Patron', components: (ctx, owner) => [...alwaysPrepared(ctx, 'charisma', [[1, ['Contact Other Plane']]]), ...freeCast(ctx, owner, 'charisma', 'Contact Other Plane', 1, [full('long-rest')], 'Contact Patron')] },
    ...arcanumLevels,
    { level: 20, name: 'Eldritch Master' },
  ],
  subclassLevels: [3, 6, 10, 14],
  subclass: {
    name: 'Fiend Patron',
    features: [
      { level: 3, name: 'Dark One’s Blessing', summary: ['Temporary Hit Points equal to Charisma modifier + Warlock level (minimum 1).'] },
      { level: 3, name: 'Fiend Spells', components: (ctx) => alwaysPrepared(ctx, 'charisma', [[3, ['Burning Hands', 'Command', 'Scorching Ray', 'Suggestion']], [5, ['Fireball', 'Stinking Cloud']], [7, ['Fire Shield', 'Wall of Fire']], [9, ['Geas', 'Insect Plague']]]) },
      { level: 6, name: 'Dark One’s Own Luck', components: usesFeature('dark-ones-own-luck', 'Dark One’s Own Luck', { op: 'max', args: [1, { stat: 'modifier.charisma' }] }, [full('long-rest')], { description: 'Add 1d10 to an ability check or saving throw.' }) },
      { level: 10, name: 'Fiendish Resilience' },
      { level: 14, name: 'Hurl Through Hell', components: usesFeature('hurl-through-hell', 'Hurl Through Hell', 1, [full('long-rest')], { description: 'On a hit: Charisma save or 8d10 Psychic damage and Incapacitated. Can also be restored with a Pact Magic slot.' }) },
    ],
  },
};

/** Wizard, SRD 5.2.1 pp. 77–83, with the Evoker. */
export const wizard: ClassSpec = {
  name: 'Wizard',
  pages: [77, 83],
  die: 6,
  saves: ['intelligence', 'wisdom'],
  skills: { count: 2, from: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Nature', 'Religion'] },
  weapons: { simple: true },
  armor: [],
  multiclass: { prerequisites: { stat: 'intelligence', minimum: 13 }, armor: [] },
  features: [
    {
      ...spellcasting({ ability: 'intelligence', caster: 'full', cantrips: [[1, 3], [4, 4], [10, 5]], prepared: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25], changes: 'long-rest' }),
      summary: ['Intelligence is the spellcasting ability; prepared spells change after a Long Rest.', 'Spellbook contents are not tracked separately yet: prepare from the Wizard list and keep the spellbook in Notes.'],
    },
    { level: 1, name: 'Ritual Adept' },
    {
      level: 1,
      name: 'Arcane Recovery',
      components: (ctx, owner) => [
        { id: 'budget', kind: 'defineStat', stat: { id: 'arcaneRecoveryBudget', name: 'Arcane Recovery budget', kind: 'derived', expression: { op: 'ceil', args: [{ op: 'divide', args: [classLevel, 2] }] } } },
        ...usesFeature('arcane-recovery', 'Arcane Recovery', 1, [full('long-rest')])(ctx, owner),
        { id: 'recover', kind: 'grantCapability', name: 'Arcane Recovery', costs: [{ key: 'arcane-recovery', amount: 1 }], metadata: { recoveryBudgetStat: 'arcaneRecoveryBudget', maximumSlotLevel: 5 } },
      ],
    },
    { level: 2, name: 'Scholar', components: () => [{ id: 'expertise', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { ids: ['Arcana', 'History', 'Investigation', 'Medicine', 'Nature', 'Religion'].map((name) => id(`expertise.${slug(name)}`)) }, retraining: { allowed: false } }] },
    { level: 5, name: 'Memorize Spell' },
    { level: 18, name: 'Spell Mastery' },
    { level: 20, name: 'Signature Spells' },
  ],
  subclassLevels: [3, 6, 10, 14],
  subclass: {
    name: 'Evoker',
    features: [
      { level: 3, name: 'Evocation Savant' },
      { level: 3, name: 'Potent Cantrip' },
      { level: 6, name: 'Sculpt Spells' },
      { level: 10, name: 'Empowered Evocation' },
      { level: 14, name: 'Overchannel' },
    ],
  },
};
