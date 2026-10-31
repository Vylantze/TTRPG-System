import type { ClassDefinition, Component, Expression, FeatureDefinition, ScalingTable } from '@/src/model.js';
import type { ClassFeature } from '../types/ClassFeature.ts';
import type { ClassSpec } from '../types/ClassSpec.ts';
import type { Ctx } from '../types/Ctx.ts';
import type { SpellcastingSpec } from '../types/SpellcastingSpec.ts';
import { title, skill, tool, type Ability } from '../core.ts';

export type { ClassFeature, ClassSpec, Ctx };
import { actionKind, castingArguments, classSpell, spellNamed, SPELLS } from '../spells.ts';
import { classSections, id, inClass, slug, source } from '../srd.ts';

/** Class-level thresholds such as Second Wind uses: [[1, 2], [4, 3], [10, 4]]. */
export function steps(rows: [number, number][]): ScalingTable {
  return { mode: 'threshold', rows: [{ key: 0, value: 0 }, ...rows.map(([key, value]) => ({ key, value }))], below: 'error', above: 'boundary' };
}
export const classLevel: Expression = { context: 'classLevel' };
export const byLevel = (table: string, owner?: string): Expression => ({ table, input: classLevel, ...(owner ? { owner } : {}) });

const DEFAULT_IMPROVEMENTS = [4, 8, 12, 16];

export function pool(owner: string, key: string, name: string, maximum: Expression, recovery: { event: string; amount: Expression | 'full' }[]): FeatureDefinition {
  return {
    id: id(`resource.${key}`),
    revision: 1,
    name: `${name} Resource`,
    displayName: `${name} Resource`,
    textReferences: [owner],
    tags: ['resource-tracker'],
    components: [
      { id: 'capacity', kind: 'defineStat', stat: { id: `resource.capacity.${key}`, name: `${name} Maximum`, kind: 'derived', expression: maximum, integer: true, minimum: 0 } },
      { id: 'tracker', kind: 'trackResource', key, name, units: 'uses', integer: true, maximum: { stat: `resource.capacity.${key}` }, initialAmount: { stat: `resource.capacity.${key}` }, recovery },
    ],
  };
}

export const full = (event: string) => ({ event, amount: 'full' as const });

/**
 * A class feature's SRD paragraph, looked up by its "Level N: Name" heading within the
 * class chapter; subclass features are looked up after the subclass heading.
 */
function featureText(ctx: Ctx, level: number, name: string, subclass: string | null) {
  const chapter = classSections(ctx.name);
  const from = subclass ? chapter.findIndex((entry) => entry.title === subclass) : 0;
  const to = subclass ? chapter.length : chapter.findIndex((entry) => entry.title.startsWith(`${ctx.name} Subclass: `));
  const found = chapter.slice(from, to < 0 ? chapter.length : to).filter((entry) => entry.title === `Level ${level}: ${name}`);
  if (found.length !== 1) throw new Error(`SRD ${ctx.name} feature "Level ${level}: ${name}" matched ${found.length} times.`);
  return found[0];
}

function featureDefinition(ctx: Ctx, owner: string, spec: ClassFeature, subclass: string | null, tags: string[]): FeatureDefinition {
  const entry = featureText(ctx, spec.level, spec.name, subclass);
  return {
    id: owner,
    revision: 1,
    name: spec.name,
    displayName: spec.name,
    description: entry.text,
    source: source(entry.page),
    tags: [...tags, ...(spec.tags ?? [])],
    ...(spec.tables ? { tables: spec.tables } : {}),
    ...(spec.summary ? { mechanicalSummary: spec.summary } : {}),
    components: spec.components?.(ctx, owner) ?? [{ id: 'rules', kind: 'describe', text: `${spec.name}: see the description.` }],
  };
}

const proficiency = (componentId: string, stat: string, starting = false): Component => ({
  id: componentId,
  kind: 'modifyStat',
  stat,
  operation: 'floor',
  value: 1,
  ...(starting ? { condition: { context: 'isStartingClass' } } : {}),
});

/** Builds a class, its subclass and every Feature they reference. */
export function buildClass(spec: ClassSpec): { definition: ClassDefinition; features: FeatureDefinition[] } {
  const key = slug(spec.name);
  const ctx: Ctx = { key, name: spec.name, pages: spec.pages, extra: [] };
  const own = (name: string) => id(`${key}.${slug(name)}`);
  const features: FeatureDefinition[] = [];
  // The first class heading shares a line with the chapter title ("Classes Barbarian", p. 28).
  const heading = classSections(spec.name)[0];
  if (!heading) throw new Error(`Missing SRD class heading ${spec.name}.`);
  const core = heading.table ?? '';
  // The Core Traits table, one labelled line per row; the 2024 SRD has no class introduction.
  const traits = core
    .replace(/ [A-Z][a-z]+ Features .*$/, '')
    .replace(/^Core [A-Za-z]+ Traits /, '')
    .replace(/ ?(Primary Ability|Hit Point Die|Saving Throw Proficiencies|Saving Throw|Skill Proficiencies|Weapon Proficiencies|Tool Proficiencies|Armor Training|Starting Equipment) /g, '\n$1: ')
    .replace(/\nSaving Throw: (\w+ and \w+) Proficiencies/, '\nSaving Throw Proficiencies: $1')
    .trim();

  // Hit points: full die at level 1 of the starting class, otherwise the fixed average.
  const average = spec.die / 2 + 1;
  features.push({
    id: own('hit-points'),
    revision: 1,
    name: `${spec.name} Hit Points`,
    displayName: `${spec.name} Hit Points`,
    description: `Hit Point Die: D${spec.die} per ${spec.name} level. Hit Points at level 1: ${spec.die} + your Constitution modifier. Hit Points per later level: 1D${spec.die} (or ${average}) + your Constitution modifier.`,
    source: source(heading.page),
    tags: ['class-feature'],
    // "per Wizard level" names the die, not a value; only the modifier resolves on the sheet.
    processDescriptionAutomatically: false,
    descriptionOverride: [{ originalString: 'your Constitution modifier', overrideString: '{{stat:modifier.constitution}}' }],
    repeat: { maximum: 20, scope: 'progression' },
    parameters: { roll: { kind: 'number', default: average, integer: true, minimum: 1, maximum: spec.die } },
    components: [
      {
        id: 'hit-points',
        kind: 'modifyStat',
        stat: 'hitPoints',
        operation: 'add',
        value: {
          op: 'max',
          args: [1, { op: 'add', args: [{ if: { op: 'and', args: [{ context: 'isStartingClass' }, { op: 'eq', args: [{ context: 'acquiredClassLevel' }, 1] }] }, then: spec.die, else: { parameter: 'roll' } }, { stat: 'modifier.constitution' }] }],
        },
      },
      { id: 'hit-die', kind: 'modifyStat', stat: `resource.capacity.hit-dice.d${spec.die}`, operation: 'add', value: 1 },
      { id: 'hp-tracker', kind: 'grantFeature', feature: id('resource.hit-points') },
    ],
  });

  // Starting proficiencies (Core Traits table) versus the multiclass subset.
  const skillIds = spec.skills.from === 'any' ? null : spec.skills.from.map(skill);
  const skillCandidates = skillIds ? { ids: skillIds } : { tags: ['skill-proficiency'] };
  const entry: Component[] = [
    ...spec.saves.map((ability) => proficiency(`save.${ability}`, `training.save.${ability}`, true)),
    ...spec.armor.map((kind) => proficiency(`armor.${kind}`, `training.armor.${kind}`, !spec.multiclass.armor.includes(kind))),
    ...(spec.weapons.simple ? [proficiency('weapons.simple', 'training.weapons.simple', true)] : []),
    ...(spec.weapons.martial ? [proficiency('weapons.martial', 'training.weapons.martial', !spec.multiclass.martial)] : []),
    {
      id: 'skills',
      kind: 'chooseFeatures',
      minimum: { if: { context: 'isStartingClass' }, then: spec.skills.count, else: spec.multiclass.skills ?? 0 },
      maximum: { if: { context: 'isStartingClass' }, then: spec.skills.count, else: spec.multiclass.skills ?? 0 },
      candidates: skillCandidates,
      retraining: { allowed: false },
    },
  ];
  if (spec.tools) {
    const from = typeof spec.tools.from === 'string' ? { tags: [spec.tools.from] } : { ids: spec.tools.from.map(tool) };
    const count = spec.tools.count;
    const multiclass = spec.multiclass.tools ?? 0;
    // A fixed tool (Rogue's Thieves' Tools) still applies when a background gave it already.
    const fixed = Array.isArray(spec.tools.from) && spec.tools.from.length === count;
    entry.push({ id: 'tools', kind: 'chooseFeatures', minimum: { if: { context: 'isStartingClass' }, then: count, else: multiclass }, maximum: { if: { context: 'isStartingClass' }, then: count, else: multiclass }, candidates: from, retraining: { allowed: false }, ...(fixed ? { ignorePrerequisites: true } : {}) });
  }
  const equipment = /Starting Equipment (.+?)(?= [A-Z][a-z]+ Features|$)/.exec(core)?.[1];
  if (equipment) entry.push({ id: 'equipment', kind: 'describe', text: `Starting equipment (starting class only): ${equipment}` });
  const multiclassText = inClass(spec.name, 'As a Multiclass Character');
  features.push({
    id: own('core-traits'),
    revision: 1,
    name: `Core ${spec.name} Traits`,
    displayName: `Core ${spec.name} Traits`,
    description: [traits, '', `As a Multiclass Character: ${multiclassText.text}`].join('\n'),
    source: source(heading.page),
    tags: ['class-feature'],
    components: entry,
  });

  const levels: ClassDefinition['levels'] = {};
  const at = (level: number) => (levels[level] ??= []);
  for (let level = 1; level <= 20; level += 1) at(level).push({ id: 'hit-points', kind: 'grantFeature', feature: own('hit-points') });
  at(1).push({ id: 'core-traits', kind: 'grantFeature', feature: own('core-traits') }, { id: 'rest-healing', kind: 'grantFeature', feature: id(`hit-dice.d${spec.die}`) });

  for (const feature of spec.features) {
    // A name repeated at a later level ("Improved Brutal Strike", 13 and 17) is its own
    // Feature with its own text, unless the later entry only adds choices (entry).
    const repeated = !feature.entry && features.some((existing) => existing.id === own(feature.name));
    const owner = repeated ? own(`${feature.name} ${feature.level}`) : own(feature.name);
    if (!features.some((existing) => existing.id === owner)) features.push(featureDefinition(ctx, owner, feature, null, ['class-feature']));
    at(feature.level).push(feature.entry?.(ctx, owner) ?? { id: slug(feature.name), kind: 'grantFeature', feature: owner });
  }
  const improvement = inClass(spec.name, 'Level 4: Ability Score Improvement');
  features.push({
    id: own('ability-score-improvement'),
    revision: 1,
    name: 'Ability Score Improvement',
    displayName: 'Ability Score Improvement',
    description: improvement.text,
    source: source(improvement.page),
    tags: ['class-feature'],
    repeat: { maximum: 20, scope: 'progression' },
    components: [{ id: 'feat', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { tags: ['feat'] }, retraining: { allowed: false } }],
  });
  for (const level of spec.improvements ?? DEFAULT_IMPROVEMENTS) at(level).push({ id: 'improvement', kind: 'grantFeature', feature: own('ability-score-improvement') });
  const boon = inClass(spec.name, 'Level 19: Epic Boon');
  features.push({
    id: own('epic-boon'),
    revision: 1,
    name: 'Epic Boon',
    displayName: 'Epic Boon',
    description: boon.text,
    source: source(boon.page),
    tags: ['class-feature'],
    components: [{ id: 'feat', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { tags: ['feat'] }, retraining: { allowed: false } }],
  });
  at(19).push({ id: 'epic-boon', kind: 'grantFeature', feature: own('epic-boon') });

  // Subclass: chosen at level 3; its features arrive at their class levels.
  const subclassHeading = inClass(spec.name, `${spec.name} Subclass: ${spec.subclass.name}`);
  const subclassId = id(`${key}.subclass.${slug(spec.subclass.name)}`);
  const subclassComponents: Component[] = [];
  for (const feature of spec.subclass.features) {
    const owner = `${subclassId}.${slug(feature.name)}`;
    // A subclass feature belongs to its subclass; the page shows "Requires <subclass>".
    features.push({ ...featureDefinition(ctx, owner, feature, subclassHeading.title, ['class-feature', 'subclass-feature']), prerequisites: { feature: subclassId } });
    subclassComponents.push({ id: slug(feature.name), kind: 'grantFeature', feature: owner, ...(feature.level > 3 ? { atClassLevel: feature.level } : {}) } as Component);
  }
  features.push({
    id: subclassId,
    revision: 1,
    name: spec.subclass.name,
    displayName: spec.subclass.name,
    description: subclassHeading.text,
    source: source(subclassHeading.page),
    tags: ['subclass', `${key}-subclass`],
    components: subclassComponents,
  });
  const subclassChoice = inClass(spec.name, `Level 3: ${spec.name} Subclass`);
  features.push({
    id: own('subclass'),
    revision: 1,
    name: `${spec.name} Subclass`,
    displayName: `${spec.name} Subclass`,
    description: subclassChoice.text,
    source: source(subclassChoice.page),
    tags: ['class-feature'],
    components: [{ id: 'subclass', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { tags: [`${key}-subclass`] }, retraining: { allowed: false }, eligibility: 'acquisition' }],
  });
  at(3).push({ id: 'subclass', kind: 'grantFeature', feature: own('subclass') });

  const description = heading;
  return {
    definition: {
      id: id(key),
      revision: 1,
      name: spec.name,
      description: traits,
      source: source(description.page),
      levels,
      multiclassPrerequisites: spec.multiclass.prerequisites,
    },
    features: [...features, ...ctx.extra],
  };
}

/** "Choose N weapons" Weapon Mastery, swappable after a Long Rest. */
export function weaponMastery(rows: [number, number][], tags: string[] = ['weapon-mastery']): Pick<ClassFeature, 'tables' | 'components'> {
  return {
    tables: { masteries: steps(rows) },
    components: () => [
      {
        id: 'masteries',
        kind: 'chooseFeatures',
        minimum: byLevel('masteries'),
        maximum: byLevel('masteries'),
        candidates: { tags },
        retraining: { allowed: true, events: ['long-rest'] },
      },
    ],
  };
}

/** A Fighting Style choice from the shared Fighting Style feats. */
export const fightingStyle = (): Pick<ClassFeature, 'components' | 'tags'> => ({
  tags: ['fighting-style-feature'],
  components: () => [{ id: 'style', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { tags: ['fighting-style-feat'] }, retraining: { allowed: true } }],
});

export const abilityTitle = title;

export const perLevel = (values: number[]): ScalingTable => steps(values.map((value, index) => [index + 1, value] as [number, number]));

const half = (expression: Expression): Expression => ({ op: 'ceil', args: [{ op: 'divide', args: [expression, 2] }] });

/**
 * A class's Spellcasting (or Pact Magic) feature: caster level contribution, slot
 * trackers, cantrip and prepared-spell choices, and one casting entry per spell on
 * the class list, generated from each SRD spell's class list.
 */
export function spellcasting(spec: SpellcastingSpec): ClassFeature {
  return {
    level: spec.level ?? 1,
    name: spec.name ?? 'Spellcasting',
    tags: ['spellcasting-feature'],
    tables: {
      prepared: perLevel(spec.prepared),
      ...(spec.cantrips ? { cantrips: steps(spec.cantrips) } : {}),
      ...(spec.caster === 'pact'
        ? {
            pactLevel: perLevel([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]),
            pactSlots: perLevel([1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4]),
          }
        : {}),
    },
    summary: [
      `${abilityTitle(spec.ability)} is the spellcasting ability. ${spec.changes === 'long-rest' ? 'Prepared spells can change after a Long Rest.' : 'One prepared spell can change when you gain a level.'}`,
      spec.caster === 'half' ? 'Counts half its class level, rounded up, toward Spell Slots (SRD 5.2.1 p. 25).' : spec.caster === 'pact' ? 'Pact Magic slots recover on a Short or Long Rest.' : 'Counts its full class level toward Spell Slots.',
    ],
    components: (ctx) => {
      const list = SPELLS.filter((entry) => entry.classes.includes(ctx.key));
      ctx.extra.push(...list.map((entry) => classSpell(ctx.key, entry, spec.ability, true)));
      const components: Component[] = [];
      if (spec.caster === 'pact') {
        components.push(
          { id: 'pact-level', kind: 'modifyStat', stat: 'pactSlotLevel', operation: 'floor', value: byLevel('pactLevel') },
          { id: 'pact-slots', kind: 'modifyStat', stat: 'pactSlotCount', operation: 'floor', value: byLevel('pactSlots') },
          { id: 'pact-tracker', kind: 'grantFeature', feature: id('resource.pact-slot') },
        );
      } else {
        components.push(
          { id: 'caster-level', kind: 'modifyStat', stat: 'casterLevel', operation: 'add', value: spec.caster === 'full' ? classLevel : half(classLevel) },
          { id: 'slots', kind: 'grantFeature', feature: id('spell-slots') },
        );
      }
      if (spec.cantrips) {
        components.push({ id: 'cantrips', kind: 'chooseFeatures', minimum: 0, maximum: byLevel('cantrips'), candidates: { tags: [`${ctx.key}-cantrip`] }, retraining: { allowed: true } });
      }
      const maximumLevel: Expression = spec.caster === 'full' ? { op: 'min', args: [9, half(classLevel)] } : spec.caster === 'half' ? { op: 'ceil', args: [{ op: 'divide', args: [classLevel, 4] }] } : byLevel('pactLevel');
      components.push({
        id: 'prepared',
        kind: 'chooseFeatures',
        minimum: 0,
        maximum: byLevel('prepared'),
        candidates: { tags: [`${ctx.key}-leveled-spell`], maximumLevel },
        eligibility: 'current',
        retraining: spec.changes === 'long-rest' ? { allowed: true, events: ['long-rest'] } : { allowed: true },
      });
      return components;
    },
  };
}

/** A class casting entry for a spell, generated when the spell is not on the class's own list. */
export function ensureSpell(ctx: Ctx, ability: Ability, name: string): string {
  const entry = spellNamed(name);
  const wrapper = classSpell(ctx.key, entry, ability, true);
  if (!entry.classes.includes(ctx.key) && !ctx.extra.some((feature) => feature.id === wrapper.id)) ctx.extra.push(wrapper);
  return wrapper.id;
}

/** Always-prepared spells (domain, oath, patron lists) granted at the class levels shown. */
export function alwaysPrepared(ctx: Ctx, ability: Ability, spells: [number, string[]][]): Component[] {
  return spells.flatMap(([level, names]) =>
    names.map((name): Component => ({ id: `spell.${slug(name)}`, kind: 'grantFeature', feature: ensureSpell(ctx, ability, name), ...(level > 3 ? { atClassLevel: level } : {}) }) as Component),
  );
}

/** Casting a prepared spell without a slot, with its own pool (Paladin's Smite, Faithful Steed). */
export function freeCast(ctx: Ctx, owner: string, ability: Ability, name: string, maximum: Expression, recovery: { event: string; amount: Expression | 'full' }[], label = name): Component[] {
  const entry = spellNamed(name);
  const key = `${ctx.key}.free.${slug(name)}`;
  ctx.extra.push(pool(owner, key, `${label} (no slot)`, maximum, recovery));
  return [
    { id: `free-pool.${slug(name)}`, kind: 'grantFeature', feature: id(`resource.${key}`) },
    {
      id: `free.${slug(name)}`,
      kind: 'grantCapability',
      name: `${name} (no slot)`,
      costs: [{ key, amount: 1 }],
      action: { kind: actionKind(entry.castingTime), amount: 1 },
      metadata: { ...castingArguments(entry, ability, false), spellLevel: entry.level, spellSlotLevel: entry.level, ritual: false, castingMode: 'free' },
    } as Component,
  ];
}

/** Expertise in N skills you are proficient in. */
export const expertise = (count: number, from?: string[]): Component => ({
  id: 'expertise',
  kind: 'chooseFeatures',
  minimum: count,
  maximum: count,
  candidates: from ? { ids: from.map((name) => id(`expertise.${slug(name)}`)) } : { tags: ['expertise'] },
  retraining: { allowed: false },
});

/** A resource-spending capability with its pool. */
export function usesFeature(key: string, name: string, maximum: Expression, recovery: { event: string; amount: Expression | 'full' }[], capability?: { name?: string; action?: string; description?: string; cost?: number }): (ctx: Ctx, owner: string) => Component[] {
  return (ctx, owner) => {
    ctx.extra.push(pool(owner, key, name, maximum, recovery));
    return [
      { id: 'pool', kind: 'grantFeature', feature: id(`resource.${key}`) },
      ...(capability
        ? [
            {
              id: 'use',
              kind: 'grantCapability',
              name: capability.name ?? name,
              costs: [{ key, amount: capability.cost ?? 1 }],
              ...(capability.action ? { action: { kind: capability.action, amount: 1 } } : {}),
              ...(capability.description ? { description: capability.description } : {}),
            } as Component,
          ]
        : []),
    ];
  };
}

export const shortRestOne = [{ event: 'short-rest', amount: 1 }, full('long-rest')];
export const atLeastOne = (stat: string): Expression => ({ op: 'max', args: [1, { stat }] });
