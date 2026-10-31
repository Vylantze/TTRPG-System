import type { Component, Expression, FeatureDefinition, Predicate } from '@/src/model.js';
import { ABILITIES, SKILLS, TOOLS, title, type Ability, skill, tool } from './core.ts';
import { castingArguments, spell, spellNamed } from './spells.ts';
import { id, section, slug, source } from './srd.ts';

const ORIGINS: [number, number] = [83, 87];
const FEATS: [number, number] = [87, 88];
const CASTING_ABILITIES = ['intelligence', 'wisdom', 'charisma'] as const;

/** Split "Name. Text" trait paragraphs; later paragraphs without a name continue the trait. */
export function traits(text: string): Map<string, string> {
  const result = new Map<string, string>();
  let current = '';
  const paragraphs = text.split('\n');
  // The opening "As a Goliath, you have these special traits." can run into the first trait.
  paragraphs[0] = paragraphs[0].replace(/^.*?traits\.\s*/, '');
  for (const paragraph of paragraphs.filter(Boolean)) {
    const named = /^([A-Z][\w’' -]+?)\. /.exec(paragraph);
    if (named && !/^(You|When|Once|If|In|The|This|For|Each)\b/.test(named[1])) current = named[1];
    if (current) result.set(current, [result.get(current), paragraph].filter(Boolean).join('\n'));
  }
  return result;
}

const atLevel = (level: number): Expression => ({ op: 'gte', args: [{ context: 'characterLevel' }, level] });
const proficiencyUses = { stat: 'proficiencyBonus' };

function pool(owner: string, key: string, name: string, maximum: Expression, recovery: string[]): FeatureDefinition {
  return {
    id: id(`resource.${key}`),
    revision: 1,
    name: `${name} Resource`,
    displayName: `${name} Resource`,
    textReferences: [owner],
    tags: ['resource-tracker'],
    components: [
      { id: 'capacity', kind: 'defineStat', stat: { id: `resource.capacity.${key}`, name: `${name} Maximum`, kind: 'derived', expression: maximum, integer: true, minimum: 0 } },
      {
        id: 'tracker',
        kind: 'trackResource',
        key,
        name,
        units: 'uses',
        integer: true,
        maximum: { stat: `resource.capacity.${key}` },
        initialAmount: { stat: `resource.capacity.${key}` },
        recovery: recovery.map((event) => ({ event, amount: 'full' as const })),
      },
    ],
  };
}

interface Trait {
  name: string;
  components?: Component[];
  tags?: string[];
  summary?: string[];
}

/** One trait sub-Feature carrying the trait's own source paragraph. */
function trait(owner: string, page: number, text: Map<string, string>, entry: Trait): FeatureDefinition {
  const description = text.get(entry.name);
  if (!description) throw new Error(`Missing SRD trait ${entry.name} for ${owner}.`);
  return {
    id: `${owner}.${slug(entry.name)}`,
    revision: 1,
    name: entry.name,
    displayName: entry.name,
    description,
    source: source(page),
    tags: ['species-trait', ...(entry.tags ?? [])],
    ...(entry.summary ? { mechanicalSummary: entry.summary } : {}),
    components: entry.components ?? [{ id: 'rules', kind: 'describe', text: description.replace(/^[^.]+\. /, '') }],
  };
}

/**
 * Spells an origin grants with a chosen spellcasting ability. Each ability variant
 * holds the same spells, so a character picks the origin option, then the ability.
 */
function originSpells(owner: string, name: string, spells: { name: string; level: number; free: 'none' | 'long-rest' | 'proficiency' }[], page: number, extra: FeatureDefinition[]): FeatureDefinition {
  const variants = CASTING_ABILITIES.map((ability): FeatureDefinition => {
    const components: Component[] = [];
    for (const entry of spells) {
      const data = spellNamed(entry.name);
      const key = `${slug(owner.replace(/^dnd5e:2024:/, ''))}.${slug(entry.name)}`;
      // Grants cannot depend on character level, so later spells are granted at once and
      // their capabilities and uses stay unavailable until the level is reached.
      const condition = entry.level > 1 ? atLevel(entry.level) : undefined;
      const gated = (value: Expression): Expression => (condition ? { if: condition, then: value, else: 0 } : value);
      if (!condition) components.push({ id: `rules.${slug(entry.name)}`, kind: 'grantFeature', feature: spell(entry.name) });
      if (data.level === 0) {
        components.push({ id: `cast.${slug(entry.name)}`, kind: 'useBlock', block: id('casting.level-0'), arguments: castingArguments(data, ability, false) });
        continue;
      }
      if (entry.free !== 'none') {
        const uses = entry.free === 'proficiency' ? proficiencyUses : 1;
        // One shared pool per spell, whichever ability variant is chosen.
        if (ability === CASTING_ABILITIES[0]) extra.push(pool(spell(entry.name), key, `${entry.name} (${name})`, gated(uses), ['long-rest']));
        components.push({ id: `pool.${slug(entry.name)}`, kind: 'grantFeature', feature: id(`resource.${key}`) });
        components.push({
          id: `free.${slug(entry.name)}`,
          kind: 'grantCapability',
          name: `${entry.name} (${name})`,
          ...(condition ? { condition } : {}),
          costs: [{ key, amount: 1 }],
          action: { kind: data.castingTime.startsWith('Bonus') ? 'bonus-action' : data.castingTime.startsWith('Reaction') ? 'reaction' : 'action', amount: 1 },
          metadata: { ...castingArguments(data, ability, false), spellLevel: data.level, spellSlotLevel: data.level, ritual: false, castingMode: 'free' },
        } as Component);
      }
      // "You can also cast the spell using any spell slots you have" (SRD 5.2.1 pp. 84–87).
      extra.push({
        id: `${owner}.${ability}.${slug(entry.name)}`,
        revision: 1,
        name: `${entry.name} (${name})`,
        displayName: entry.name,
        textReferences: [spell(entry.name)],
        contentLevel: data.level,
        ...(condition ? { mechanicalSummary: [`Available from character level ${entry.level}.`] } : {}),
        components: [{ id: 'casting', kind: 'useBlock', block: id(`casting.level-${data.level}`), arguments: castingArguments(data, ability, false, entry.level > 1 ? entry.level : 0) }],
      });
      components.push({ id: `slots.${slug(entry.name)}`, kind: 'grantFeature', feature: `${owner}.${ability}.${slug(entry.name)}` });
    }
    return {
      id: `${owner}.${ability}`,
      revision: 1,
      name: `${name} (${title(ability)})`,
      displayName: `${title(ability)} spellcasting`,
      textReferences: [owner],
      tags: ['spellcasting-ability-choice'],
      components,
    };
  });
  extra.push(...variants);
  return {
    id: owner,
    revision: 1,
    name,
    displayName: name,
    source: source(page),
    tags: ['species-option'],
    components: [{ id: 'ability', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { ids: variants.map((variant) => variant.id) }, retraining: { allowed: false } }],
  };
}

function choice(componentId: string, ids: string[], count = 1, extra: Partial<Component> = {}): Component {
  return { id: componentId, kind: 'chooseFeatures', minimum: count, maximum: count, candidates: { ids }, retraining: { allowed: false }, ...extra } as Component;
}

const resistance = (type: string): FeatureDefinition => ({
  id: id(`resistance.${slug(type)}`),
  revision: 1,
  name: `${type} Resistance`,
  displayName: `Resistance to ${type} damage`,
  tags: ['resistance'],
  repeat: { maximum: 20, scope: 'character' },
  components: [{ id: 'rules', kind: 'describe', text: `You take half damage from ${type} damage.` }],
});

const DRAGONS: [string, string][] = [
  ['Black', 'Acid'],
  ['Blue', 'Lightning'],
  ['Brass', 'Fire'],
  ['Bronze', 'Lightning'],
  ['Copper', 'Acid'],
  ['Gold', 'Fire'],
  ['Green', 'Poison'],
  ['Red', 'Fire'],
  ['Silver', 'Cold'],
  ['White', 'Cold'],
];

const sizeChoice = (owner: string, page: number): FeatureDefinition[] => [
  { id: `${owner}.size.medium`, revision: 1, name: 'Medium', displayName: 'Medium size', source: source(page), textReferences: [owner], tags: ['species-option'], components: [] },
  { id: `${owner}.size.small`, revision: 1, name: 'Small', displayName: 'Small size', source: source(page), textReferences: [owner], tags: ['species-option'], components: [{ id: 'size', kind: 'modifyStat', stat: 'sizeCategory', operation: 'override', value: 0 }] },
];

export function species(): FeatureDefinition[] {
  const features: FeatureDefinition[] = [];
  const types = ['Acid', 'Cold', 'Fire', 'Lightning', 'Poison', 'Necrotic'];
  features.push(...types.map(resistance));
  const define = (name: string, speed: number, darkvision: number, small: boolean | 'choice', build: (owner: string, text: Map<string, string>, page: number) => Component[]) => {
    const entry = section(name, ORIGINS);
    const owner = id(`species.${slug(name)}`);
    const text = traits(entry.text);
    const components: Component[] = [{ id: 'speed', kind: 'grantFeature', feature: id('walking-speed'), parameters: { feet: speed } }];
    if (darkvision) components.push({ id: 'darkvision', kind: 'grantFeature', feature: id('darkvision'), parameters: { feet: darkvision } });
    if (small === true) components.push({ id: 'size', kind: 'modifyStat', stat: 'sizeCategory', operation: 'override', value: 0 });
    if (small === 'choice') {
      const sizes = sizeChoice(owner, entry.page);
      features.push(...sizes);
      components.push(choice('size', sizes.map((size) => size.id)));
    }
    components.push(...build(owner, text, entry.page));
    features.push({
      id: owner,
      revision: 1,
      name,
      displayName: name,
      description: [entry.table?.match(/^Creature Type: .*?Speed: \d+ feet/)?.[0], entry.text].filter(Boolean).join('\n'),
      source: source(entry.page),
      tags: ['species'],
      components,
    });
    return { owner, text, page: entry.page };
  };
  const add = (owner: string, text: Map<string, string>, page: number, entry: Trait): Component => {
    const feature = trait(owner, page, text, entry);
    features.push(feature);
    return { id: slug(entry.name), kind: 'grantFeature', feature: feature.id };
  };

  define('Dragonborn', 30, 60, false, (owner, text, page) => {
    const ancestors = DRAGONS.map(([dragon, type]): FeatureDefinition => ({
      id: `${owner}.ancestry.${slug(dragon)}`,
      revision: 1,
      name: `${dragon} Dragon Ancestry`,
      displayName: `${dragon} (${type})`,
      source: source(page),
      tags: ['species-option'],
      textReferences: [`${owner}.draconic-ancestry`],
      mechanicalSummary: [`Breath Weapon deals ${type} damage; Resistance to ${type} damage.`],
      components: [{ id: 'resistance', kind: 'grantFeature', feature: id(`resistance.${slug(type)}`) }],
    }));
    features.push(...ancestors, pool(`${owner}.breath-weapon`, 'breath-weapon', 'Breath Weapon', proficiencyUses, ['long-rest']), pool(`${owner}.draconic-flight`, 'draconic-flight', 'Draconic Flight', { if: atLevel(5), then: 1, else: 0 }, ['long-rest']));
    features.push({
      id: `${owner}.breath-weapon.roll`,
      revision: 1,
      name: 'Breath Weapon damage',
      displayName: 'Breath Weapon damage',
      textReferences: [`${owner}.breath-weapon`],
      tags: ['roll-feature'],
      repeat: { maximum: 1, scope: 'parent' },
      roll: { id: 'damage', label: 'Breath Weapon damage', dice: '1d10', characterScaling: [{ level: 5, count: 2 }, { level: 11, count: 3 }, { level: 17, count: 4 }], capability: 'Breath Weapon' },
      components: [],
    });
    return [
      add(owner, text, page, { name: 'Draconic Ancestry', components: [choice('dragon', ancestors.map((ancestor) => ancestor.id))] }),
      add(owner, text, page, {
        name: 'Breath Weapon',
        summary: ['Save DC 8 + Constitution modifier + Proficiency Bonus. Uses equal your Proficiency Bonus per Long Rest.'],
        components: [
          { id: 'dc', kind: 'defineStat', stat: { id: 'breathWeaponDC', name: 'Breath Weapon save DC', kind: 'derived', expression: { op: 'add', args: [8, { stat: 'modifier.constitution' }, { stat: 'proficiencyBonus' }] } } },
          { id: 'pool', kind: 'grantFeature', feature: id('resource.breath-weapon') },
          { id: 'use', kind: 'grantCapability', name: 'Breath Weapon', costs: [{ key: 'breath-weapon', amount: 1 }], description: 'Replaces one attack of the Attack action.' },
          { id: 'roll', kind: 'grantFeature', feature: `${owner}.breath-weapon.roll` },
        ],
      }),
      add(owner, text, page, { name: 'Damage Resistance', tags: ['resistance'] }),
      add(owner, text, page, {
        name: 'Draconic Flight',
        components: [
          { id: 'pool', kind: 'grantFeature', feature: id('resource.draconic-flight') },
          { id: 'use', kind: 'grantCapability', name: 'Draconic Flight', condition: atLevel(5), action: { kind: 'bonus-action', amount: 1 }, costs: [{ key: 'draconic-flight', amount: 1 }] },
        ],
      }),
    ];
  });

  define('Dwarf', 30, 120, false, (owner, text, page) => {
    features.push(pool(`${owner}.stonecunning`, 'stonecunning', 'Stonecunning', proficiencyUses, ['long-rest']));
    return [
      add(owner, text, page, { name: 'Dwarven Resilience', tags: ['resistance'], components: [{ id: 'poison', kind: 'grantFeature', feature: id('resistance.poison') }] }),
      add(owner, text, page, { name: 'Dwarven Toughness', components: [{ id: 'hit-points', kind: 'modifyStat', stat: 'hitPoints', operation: 'add', value: { context: 'characterLevel' } }] }),
      add(owner, text, page, {
        name: 'Stonecunning',
        components: [
          { id: 'pool', kind: 'grantFeature', feature: id('resource.stonecunning') },
          { id: 'use', kind: 'grantCapability', name: 'Stonecunning', action: { kind: 'bonus-action', amount: 1 }, costs: [{ key: 'stonecunning', amount: 1 }], description: 'Tremorsense 60 feet for 10 minutes while on or touching stone.' },
        ],
      }),
    ];
  });

  define('Elf', 30, 60, false, (owner, text, page) => {
    const lineages: [string, string, string, string, Component[]][] = [
      ['Drow', 'Dancing Lights', 'Faerie Fire', 'Darkness', [{ id: 'darkvision', kind: 'modifyStat', stat: 'darkvision', operation: 'floor', value: 120 }]],
      ['High Elf', 'Prestidigitation', 'Detect Magic', 'Misty Step', []],
      ['Wood Elf', 'Druidcraft', 'Longstrider', 'Pass without Trace', [{ id: 'speed', kind: 'modifyStat', stat: 'walkingSpeed', operation: 'add', value: 5 }]],
    ];
    const options = lineages.map(([name, cantrip, third, fifth, extra]) => {
      const option = originSpells(`${owner}.lineage.${slug(name)}`, name, [{ name: cantrip, level: 1, free: 'none' }, { name: third, level: 3, free: 'long-rest' }, { name: fifth, level: 5, free: 'long-rest' }], page, features);
      option.components.push(...extra);
      option.mechanicalSummary = [`Level 1: ${cantrip}${name === 'Drow' ? ', Darkvision 120 feet' : name === 'Wood Elf' ? ', Speed 35 feet' : ''}. Level 3: ${third}. Level 5: ${fifth}.`];
      features.push(option);
      return option.id;
    });
    return [
      add(owner, text, page, { name: 'Elven Lineage', components: [choice('lineage', options)] }),
      add(owner, text, page, { name: 'Fey Ancestry' }),
      add(owner, text, page, { name: 'Keen Senses', components: [choice('skill', ['Insight', 'Perception', 'Survival'].map(skill))] }),
      add(owner, text, page, { name: 'Trance' }),
    ];
  });

  define('Gnome', 30, 60, true, (owner, text, page) => {
    const forest = originSpells(`${owner}.lineage.forest-gnome`, 'Forest Gnome', [{ name: 'Minor Illusion', level: 1, free: 'none' }, { name: 'Speak with Animals', level: 1, free: 'proficiency' }], page, features);
    const rock = originSpells(`${owner}.lineage.rock-gnome`, 'Rock Gnome', [{ name: 'Mending', level: 1, free: 'none' }, { name: 'Prestidigitation', level: 1, free: 'none' }], page, features);
    forest.mechanicalSummary = ['Minor Illusion; Speak with Animals always prepared, cast without a slot a number of times equal to your Proficiency Bonus.'];
    rock.mechanicalSummary = ['Can also build up to three Tiny clockwork devices with Prestidigitation (see the trait text).'];
    features.push(forest, rock);
    return [add(owner, text, page, { name: 'Gnomish Cunning' }), add(owner, text, page, { name: 'Gnomish Lineage', components: [choice('lineage', [forest.id, rock.id])] })];
  });

  define('Goliath', 35, 0, false, (owner, text, page) => {
    const giants: [string, string, string][] = [
      ['Cloud’s Jaunt', 'Cloud Giant', 'bonus-action'],
      ['Fire’s Burn', 'Fire Giant', 'special'],
      ['Frost’s Chill', 'Frost Giant', 'special'],
      ['Hill’s Tumble', 'Hill Giant', 'special'],
      ['Stone’s Endurance', 'Stone Giant', 'reaction'],
      ['Storm’s Thunder', 'Storm Giant', 'reaction'],
    ];
    const ancestry = text.get('Giant Ancestry') ?? '';
    features.push(pool(`${owner}.giant-ancestry`, 'giant-ancestry', 'Giant Ancestry', proficiencyUses, ['long-rest']), pool(`${owner}.large-form`, 'large-form', 'Large Form', { if: atLevel(5), then: 1, else: 0 }, ['long-rest']));
    const boons = giants.map(([boon, giant, action]): FeatureDefinition => {
      const rule = new RegExp(`${boon} \\(${giant}\\)\\. (.+?)(?= [A-Z][a-z’]+’s [A-Z][a-z]+ \\(|$)`, 's').exec(ancestry)?.[1];
      if (!rule) throw new Error(`Missing Giant Ancestry option ${boon}.`);
      return {
        id: `${owner}.giant-ancestry.${slug(giant)}`,
        revision: 1,
        name: boon,
        displayName: `${boon} (${giant})`,
        description: `${boon} (${giant}). ${rule.replace(/\n/g, ' ')}`,
        source: source(page),
        tags: ['species-option'],
        components: [{ id: 'use', kind: 'grantCapability', name: boon, costs: [{ key: 'giant-ancestry', amount: 1 }], ...(action === 'special' ? {} : { action: { kind: action, amount: 1 } }) }],
      };
    });
    features.push(...boons);
    return [
      add(owner, text, page, { name: 'Giant Ancestry', components: [{ id: 'pool', kind: 'grantFeature', feature: id('resource.giant-ancestry') }, choice('boon', boons.map((boon) => boon.id))] }),
      add(owner, text, page, {
        name: 'Large Form',
        components: [
          { id: 'pool', kind: 'grantFeature', feature: id('resource.large-form') },
          { id: 'use', kind: 'grantCapability', name: 'Large Form', condition: atLevel(5), action: { kind: 'bonus-action', amount: 1 }, costs: [{ key: 'large-form', amount: 1 }] },
        ],
      }),
      add(owner, text, page, { name: 'Powerful Build' }),
    ];
  });

  define('Halfling', 30, 0, true, (owner, text, page) =>
    ['Brave', 'Halfling Nimbleness', 'Luck', 'Naturally Stealthy'].map((name) => add(owner, text, page, { name })),
  );

  define('Human', 30, 0, 'choice', (owner, text, page) => [
    add(owner, text, page, { name: 'Resourceful', summary: ['Gain Heroic Inspiration when you finish a Long Rest; mark it on the Heroic Inspiration tracker.'] }),
    add(owner, text, page, { name: 'Skillful', components: [{ id: 'skill', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { tags: ['skill-proficiency'] }, retraining: { allowed: false } }] }),
    add(owner, text, page, { name: 'Versatile', components: [{ id: 'feat', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { tags: ['origin-feat'] }, retraining: { allowed: false } }] }),
  ]);

  define('Orc', 30, 120, false, (owner, text, page) => {
    features.push(pool(`${owner}.adrenaline-rush`, 'adrenaline-rush', 'Adrenaline Rush', proficiencyUses, ['short-rest', 'long-rest']), pool(`${owner}.relentless-endurance`, 'relentless-endurance', 'Relentless Endurance', 1, ['long-rest']));
    return [
      add(owner, text, page, {
        name: 'Adrenaline Rush',
        components: [
          { id: 'pool', kind: 'grantFeature', feature: id('resource.adrenaline-rush') },
          { id: 'use', kind: 'grantCapability', name: 'Adrenaline Rush', action: { kind: 'bonus-action', amount: 1 }, costs: [{ key: 'adrenaline-rush', amount: 1 }], description: 'Dash, then gain Temporary Hit Points equal to your Proficiency Bonus.' },
        ],
      }),
      add(owner, text, page, {
        name: 'Relentless Endurance',
        components: [
          { id: 'pool', kind: 'grantFeature', feature: id('resource.relentless-endurance') },
          { id: 'use', kind: 'grantCapability', name: 'Relentless Endurance', costs: [{ key: 'relentless-endurance', amount: 1 }], description: 'Drop to 1 Hit Point instead of 0.' },
        ],
      }),
    ];
  });

  define('Tiefling', 30, 60, 'choice', (owner, text, page) => {
    const legacies: [string, string, string, string, string][] = [
      ['Abyssal', 'Poison', 'Poison Spray', 'Ray of Sickness', 'Hold Person'],
      ['Chthonic', 'Necrotic', 'Chill Touch', 'False Life', 'Ray of Enfeeblement'],
      ['Infernal', 'Fire', 'Fire Bolt', 'Hellish Rebuke', 'Darkness'],
    ];
    const options = legacies.map(([name, type, cantrip, third, fifth]) => {
      const spells = [{ name: cantrip, level: 1, free: 'none' as const }, { name: 'Thaumaturgy', level: 1, free: 'none' as const }, { name: third, level: 3, free: 'long-rest' as const }, { name: fifth, level: 5, free: 'long-rest' as const }];
      const option = originSpells(`${owner}.legacy.${slug(name)}`, `${name} Legacy`, spells, page, features);
      option.components.push({ id: 'resistance', kind: 'grantFeature', feature: id(`resistance.${slug(type)}`) });
      option.mechanicalSummary = [`Resistance to ${type} damage. Level 1: ${cantrip}. Level 3: ${third}. Level 5: ${fifth}. Thaumaturgy uses the same ability.`];
      features.push(option);
      return option.id;
    });
    return [add(owner, text, page, { name: 'Fiendish Legacy', components: [choice('legacy', options)] }), add(owner, text, page, { name: 'Otherworldly Presence', summary: ['Thaumaturgy is granted with your Fiendish Legacy spellcasting ability.'] })];
  });
  return features;
}

/** Ability adjustments of 2024 backgrounds: +2/+1 or +1/+1/+1 among three named abilities. */
function backgroundAbilities(owner: string, abilities: Ability[], page: number): FeatureDefinition {
  const parameters = Object.fromEntries(abilities.map((ability, index) => [ability, { kind: 'number' as const, default: index === 0 ? 2 : index === 1 ? 1 : 0, integer: true, minimum: 0, maximum: 2 }]));
  const values = abilities.map((ability) => ({ parameter: ability }));
  return {
    id: `${owner}.ability-scores`,
    revision: 1,
    name: 'Background ability scores',
    displayName: `Ability Scores (${abilities.map(title).join(', ')})`,
    description: `Increase one of these scores by 2 and a different one by 1, or increase all three by 1. None of these increases can raise a score above 20.`,
    source: source(page),
    tags: ['ability-adjustment'],
    parameters,
    prerequisites: {
      expression: {
        op: 'and',
        args: [
          { op: 'eq', args: [{ op: 'add', args: values }, 3] },
          ...abilities.map((ability): Expression => ({ op: 'lte', args: [{ op: 'add', args: [{ stat: `base.${ability}` }, { parameter: ability }] }, 20] })),
        ],
      },
    },
    components: abilities.map((ability) => ({ id: ability, kind: 'modifyStat', stat: ability, operation: 'add', value: { parameter: ability } })),
  };
}

const BACKGROUNDS: { name: string; abilities: Ability[]; feat: string; skills: string[]; tool: string | null }[] = [
  { name: 'Acolyte', abilities: ['intelligence', 'wisdom', 'charisma'], feat: 'magic-initiate.cleric', skills: ['Insight', 'Religion'], tool: 'Calligrapher’s Supplies' },
  { name: 'Criminal', abilities: ['dexterity', 'constitution', 'intelligence'], feat: 'alert', skills: ['Sleight of Hand', 'Stealth'], tool: 'Thieves’ Tools' },
  { name: 'Sage', abilities: ['constitution', 'intelligence', 'wisdom'], feat: 'magic-initiate.wizard', skills: ['Arcana', 'History'], tool: 'Calligrapher’s Supplies' },
  { name: 'Soldier', abilities: ['strength', 'dexterity', 'constitution'], feat: 'savage-attacker', skills: ['Athletics', 'Intimidation'], tool: 'Gaming Set' },
];

export function backgrounds(): FeatureDefinition[] {
  const features: FeatureDefinition[] = [];
  for (const entry of BACKGROUNDS) {
    const text = section(entry.name, ORIGINS);
    const owner = id(`background.${slug(entry.name)}`);
    const abilities = backgroundAbilities(owner, entry.abilities, text.page);
    const raw = [text.text, text.table].filter(Boolean).join(' ');
    const equipment = /Equipment: (.+)$/.exec(raw)?.[1] ?? '';
    features.push(abilities, {
      id: owner,
      revision: 1,
      name: entry.name,
      displayName: entry.name,
      description: raw.replace(/ (Feat|Skill Proficiencies|Tool Proficiency|Equipment): /g, '\n$1: '),
      source: source(text.page),
      tags: ['background'],
      components: [
        // A one-option choice, so the player sets the +2/+1 or +1/+1/+1 split on the pick.
        { id: 'ability-scores', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { ids: [abilities.id] }, retraining: { allowed: false } },
        { id: 'feat', kind: 'grantFeature', feature: id(`feat.${entry.feat}`), ignorePrerequisites: true },
        ...entry.skills.map((name): Component => ({ id: `skill.${slug(name)}`, kind: 'grantFeature', feature: skill(name) })),
        ...(entry.tool ? [{ id: 'tool', kind: 'grantFeature', feature: tool(entry.tool) } as Component] : []),
        { id: 'equipment', kind: 'describe', text: `Starting equipment: ${equipment}` },
      ],
    });
  }
  return features;
}

/** "Increase one ability score of your choice by N", within a list of abilities and a cap. */
function increase(abilities: readonly Ability[], total: number, perAbility: number, cap: number): Pick<FeatureDefinition, 'parameters' | 'components'> & { prerequisites: Predicate } {
  return {
    parameters: Object.fromEntries(abilities.map((ability, index) => [ability, { kind: 'number' as const, default: index === 0 ? total : 0, integer: true, minimum: 0, maximum: perAbility }])),
    prerequisites: {
      expression: {
        op: 'and',
        args: [
          { op: 'eq', args: [{ op: 'add', args: abilities.map((ability) => ({ parameter: ability })) }, total] },
          ...abilities.map((ability): Expression => ({ op: 'or', args: [{ op: 'eq', args: [{ parameter: ability }, 0] }, { op: 'lte', args: [{ op: 'add', args: [{ stat: ability }, { parameter: ability }] }, cap] }] })),
        ],
      },
    },
    components: abilities.map((ability) => ({ id: ability, kind: 'modifyStat', stat: ability, operation: 'add', value: { parameter: ability } })),
  };
}

export function feats(): FeatureDefinition[] {
  const features: FeatureDefinition[] = [];
  const feat = (name: string, category: 'origin' | 'general' | 'fighting-style' | 'epic-boon', build: Partial<FeatureDefinition> & { components?: Component[] } = {}, featId = slug(name)) => {
    const entry = section(name, FEATS);
    const prerequisites: Predicate[] = [];
    if (category === 'general') prerequisites.push({ level: 4 });
    if (category === 'epic-boon') prerequisites.push({ level: 19 });
    if (category === 'fighting-style') prerequisites.push({ tag: 'fighting-style-feature' });
    if (build.prerequisites) prerequisites.push(build.prerequisites);
    const repeatable = /\nRepeatable\./.test(entry.text);
    features.push({
      id: id(`feat.${featId}`),
      revision: 1,
      name,
      displayName: name,
      description: entry.text,
      source: source(entry.page),
      ...build,
      tags: ['feat', `${category}-feat`, ...(build.tags ?? [])],
      ...(prerequisites.length ? { prerequisites: prerequisites.length === 1 ? prerequisites[0] : { all: prerequisites } } : {}),
      repeat: build.repeat ?? (repeatable ? { maximum: 20, scope: 'character' } : { maximum: 1, scope: 'character' }),
      components: build.components ?? [{ id: 'rules', kind: 'describe', text: entry.text.replace(/^[^\n]*?(Feat|\))\s*/, '') }],
    });
  };
  feat('Alert', 'origin', { components: [{ id: 'initiative', kind: 'modifyStat', stat: 'initiative', operation: 'add', value: { stat: 'proficiencyBonus' } }] });
  for (const list of ['cleric', 'druid', 'wizard']) {
    const lists = CASTING_ABILITIES.map((ability): FeatureDefinition => ({
      id: id(`feat.magic-initiate.${list}.${ability}`),
      revision: 1,
      name: `Magic Initiate (${title(list)}, ${title(ability)})`,
      displayName: `${title(ability)} spellcasting`,
      textReferences: [id(`feat.magic-initiate.${list}`)],
      tags: ['spellcasting-ability-choice'],
      components: [
        { id: 'cantrips', kind: 'chooseFeatures', minimum: 2, maximum: 2, candidates: { tags: [`initiate-${list}-${ability}-cantrip`] }, retraining: { allowed: true } },
        { id: 'spell', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { tags: [`initiate-${list}-${ability}-spell`] }, retraining: { allowed: true } },
        { id: 'pool', kind: 'grantFeature', feature: id(`resource.magic-initiate.${list}`) },
      ],
    }));
    features.push(...lists, pool(id(`feat.magic-initiate.${list}`), `magic-initiate.${list}`, `Magic Initiate (${title(list)}) free casting`, 1, ['long-rest']));
    feat('Magic Initiate', 'origin', { // Repeatable only with a different spell list, so each list's version is taken once.
      repeat: { maximum: 1, scope: 'character' }, displayName: `Magic Initiate (${title(list)})`, name: `Magic Initiate (${title(list)})`, components: [choice('ability', lists.map((entry) => entry.id))] }, `magic-initiate.${list}`);
  }
  feat('Savage Attacker', 'origin');
  feat('Skilled', 'origin', {
    // Choice tags must all match, so skills-or-tools is an explicit ID list.
    components: [{ id: 'proficiencies', kind: 'chooseFeatures', minimum: 3, maximum: 3, candidates: { ids: [...SKILLS.map(([name]) => skill(name)), ...TOOLS.map(([name]) => tool(name))] }, retraining: { allowed: false } }],
  });
  feat('Ability Score Improvement', 'general', { ...increase(ABILITIES, 2, 2, 20) });
  feat('Grappler', 'general', {
    ...increase(['strength', 'dexterity'], 1, 1, 20),
    prerequisites: { any: [{ stat: 'strength', minimum: 13 }, { stat: 'dexterity', minimum: 13 }] },
  });
  feat('Archery', 'fighting-style', { components: [{ id: 'ranged', kind: 'modifyStat', stat: 'rangedWeaponAttackBonus', operation: 'add', value: 2 }] });
  feat('Defense', 'fighting-style', { components: [{ id: 'armor', kind: 'modifyStat', stat: 'armorClass', operation: 'add', value: { if: { op: 'gt', args: [{ stat: 'armorIndex' }, 0] }, then: 1, else: 0 } }] });
  feat('Great Weapon Fighting', 'fighting-style');
  feat('Two-Weapon Fighting', 'fighting-style');
  const boon = (name: string, abilities: readonly Ability[], extra: Component[] = [], prerequisites?: Predicate) => {
    const scores = increase(abilities, 1, 1, 30);
    feat(name, 'epic-boon', { parameters: scores.parameters, prerequisites: prerequisites ? { all: [scores.prerequisites, prerequisites] } : scores.prerequisites, components: [...scores.components, ...extra] });
  };
  boon('Boon of Combat Prowess', ABILITIES, [{ id: 'peerless-aim', kind: 'grantCapability', name: 'Peerless Aim', description: 'Turn a missed attack roll into a hit; once until the start of your next turn.' }]);
  boon('Boon of Dimensional Travel', ABILITIES, [{ id: 'blink-steps', kind: 'grantCapability', name: 'Blink Steps', description: 'Teleport up to 30 feet after the Attack or Magic action.' }]);
  features.push(pool(id('feat.boon-of-fate'), 'improve-fate', 'Improve Fate', 1, ['short-rest', 'long-rest']));
  boon('Boon of Fate', ABILITIES, [
    { id: 'pool', kind: 'grantFeature', feature: id('resource.improve-fate') },
    { id: 'improve-fate', kind: 'grantCapability', name: 'Improve Fate', costs: [{ key: 'improve-fate', amount: 1 }], description: 'Roll 2d4 as a bonus or penalty to a D20 Test within 60 feet. Also recovers when you roll Initiative.' },
  ]);
  boon('Boon of Irresistible Offense', ['strength', 'dexterity']);
  boon('Boon of Spell Recall', CASTING_ABILITIES, [], { tag: 'spellcasting-feature' });
  boon('Boon of the Night Spirit', ABILITIES, [{ id: 'merge', kind: 'grantCapability', name: 'Merge with Shadows', action: { kind: 'bonus-action', amount: 1 }, description: 'In Dim Light or Darkness, become Invisible until you act.' }]);
  boon('Boon of Truesight', ABILITIES);
  return features;
}

/**
 * Magic Initiate spell options: one casting entry per list, ability and spell, tagged
 * so the feat's ability choice offers that list's cantrips and level 1 spells.
 */
export function initiateSpells(lists: Record<string, string[]>): FeatureDefinition[] {
  const features: FeatureDefinition[] = [];
  for (const [list, names] of Object.entries(lists)) {
    for (const ability of CASTING_ABILITIES) {
      for (const name of names) {
        const data = spellNamed(name);
        if (data.level > 1) continue;
        const key = `magic-initiate.${list}`;
        const components: Component[] = [
          { id: 'casting', kind: 'useBlock', block: id(`casting.level-${data.level}`), arguments: castingArguments(data, ability, false) },
          { id: 'spell-rules', kind: 'grantFeature', feature: spell(name) },
        ];
        if (data.level === 1) {
          components.push({
            id: 'free',
            kind: 'grantCapability',
            name: `${name} (Magic Initiate)`,
            costs: [{ key, amount: 1 }],
            metadata: { ...castingArguments(data, ability, false), spellLevel: 1, spellSlotLevel: 1, ritual: false, castingMode: 'free' },
          } as Component);
        }
        features.push({
          id: id(`feat.magic-initiate.${list}.${ability}.${slug(name)}`),
          revision: 1,
          name: `${name} (Magic Initiate)`,
          displayName: name,
          textReferences: [spell(name)],
          contentLevel: data.level,
          tags: [`initiate-${list}-${ability}-${data.level === 0 ? 'cantrip' : 'spell'}`],
          repeat: { maximum: 1, scope: 'parent' },
          components,
        });
      }
    }
  }
  return features;
}

export { SKILLS, TOOLS };
