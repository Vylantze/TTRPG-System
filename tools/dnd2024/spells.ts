import type { BlockDefinition, Expression, FeatureDefinition } from '@/src/model.js';
import type { Ability } from './core.ts';
import { entries, id, slug, source } from './srd.ts';

export interface Spell {
  name: string;
  level: number;
  school: string;
  classes: string[];
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  ritual: boolean;
  concentration: boolean;
  body: string;
  page: number;
}

const HEAD = /^(?:Level (\d) (\w+)|(\w+) Cantrip) \(([^)]+)\)\s*/;
const FIELDS = /^Casting Time: (.+?) Range: (.+?) Components?: (.+?) Duration: (.+)$/;
const INLINE = /^Casting Time: (.+?) Range: (.+?) Components?: (.+?) Duration: (Instantaneous|Concentration, up to [\w ]+?|Until dispelled(?: or triggered)?|\d+ (?:round|minute|hour|day)s?|Special) /;

/** Every spell in SRD 5.2.1's Spell Descriptions (pp. 107–175), parsed from its header. */
export const SPELLS: Spell[] = entries('h3', [107, 175])
  .filter((entry) => HEAD.test(entry.text))
  .map((entry) => {
    const head = HEAD.exec(entry.text)!;
    let body = entry.text.slice(head[0].length);
    let fields = entry.table ? FIELDS.exec(entry.table) : null;
    if (!fields) {
      // A few spells keep their header lines in the body column (Chill Touch, p. 115).
      fields = INLINE.exec(body);
      if (!fields) throw new Error(`Cannot parse the header of ${entry.title}.`);
      body = body.slice(fields[0].length);
    }
    const [, castingTime, range, components, duration] = fields;
    return {
      name: entry.title,
      level: head[1] ? Number(head[1]) : 0,
      school: head[2] ?? head[3],
      classes: head[4].split(/,\s*/).map((name) => name.toLowerCase()),
      castingTime,
      range,
      components,
      duration,
      ritual: /\bor Ritual\b/.test(castingTime),
      concentration: duration.startsWith('Concentration'),
      body,
      page: entry.page,
    };
  });

export const spell = (name: string) => id(`spell.${slug(name)}`);
export function spellNamed(name: string): Spell {
  const found = SPELLS.find((entry) => entry.name === name);
  if (!found) throw new Error(`Unknown SRD spell ${name}.`);
  return found;
}

const ordinal = (level: number) => (level === 0 ? 'Cantrip' : `Level ${level}`);
export const actionKind = (castingTime: string) =>
  castingTime.startsWith('Bonus Action') ? 'bonus-action' : castingTime.startsWith('Reaction') ? 'reaction' : castingTime.startsWith('Action') ? 'action' : 'special';

/**
 * Spells named with everyday words link from prose only next to "cast" or "spell", so
 * "a shield and light crossbow" stays plain text while "the light spell" links.
 */
const EVERYDAY_NAMES = new Set([
  'Aid', 'Alarm', 'Bane', 'Banishment', 'Blight', 'Blink', 'Blur', 'Bless', 'Clone', 'Command', 'Confusion', 'Creation', 'Darkness', 'Darkvision', 'Dream', 'Fear',
  'Fly', 'Gate', 'Grease', 'Guidance', 'Harm', 'Haste', 'Heal', 'Heroism', 'Identify', 'Jump', 'Knock', 'Light', 'Mending', 'Message', 'Resistance', 'Sanctuary',
  'Seeming', 'Sending', 'Shatter', 'Shield', 'Silence', 'Sleep', 'Slow', 'Suggestion', 'Symbol', 'Teleport', 'Web', 'Wish',
]);
const LINK_CONTEXT = { before: ['cast', 'casts', 'casting', 'cast the', 'casts the', 'casting the'], after: ['spell', 'cantrip'] };

const UPGRADE = /\n(?:Using a Higher-Level Spell Slot|Cantrip Upgrade)\. ([^\n]+)/;

/**
 * Roll Features for the dice in a spell's main effect. Upcast dice ("increases by 1d6
 * for each spell slot level above 3") and cantrip dice ("when you reach levels 5 (2d10),
 * 11 (3d10), and 17 (4d10)") scale the first roll of the same die size.
 */
function spellRolls(entry: Spell): FeatureDefinition[] {
  const effect = entry.body.split(UPGRADE)[0];
  const upgrade = UPGRADE.exec(entry.body)?.[1] ?? '';
  const found = [...effect.matchAll(/\b(\d+)d(\d+)(\s*(?:\+|plus)\s*your spellcasting ability modifier)?/g)];
  const unique = [...new Map(found.map((match) => [match[0], match])).values()].slice(0, 3);
  return unique.map((match, index): FeatureDefinition => {
    const [, count, sides, modifier] = match;
    const perSlot = /increases? by (\d+)d(\d+) for each spell slot level above (\d)/.exec(upgrade);
    const cantrip = entry.level === 0 ? [...upgrade.matchAll(/(\d+) \((\d+)d(\d+)\)/g)] : [];
    const first = index === unique.findIndex((other) => other[2] === sides);
    const label = `${entry.name}: ${count}d${sides}${modifier ? ' + spellcasting modifier' : ''}`;
    return {
      id: `${spell(entry.name)}.roll.${index + 1}`,
      revision: 1,
      name: label,
      displayName: label,
      source: source(entry.page),
      textReferences: [spell(entry.name)],
      tags: ['roll-feature'],
      repeat: { maximum: 1, scope: 'parent' },
      roll: {
        id: `roll-${index + 1}`,
        label,
        dice: `${count}d${sides}`,
        spell: spell(entry.name),
        ...(modifier ? { bonus: { castingAbility: true as const } } : {}),
        ...(first && perSlot && perSlot[2] === sides ? { slotScaling: { baseLevel: Number(perSlot[3]), dicePerLevel: Number(perSlot[1]) } } : {}),
        ...(first && cantrip.length && cantrip.every((step) => step[3] === sides) ? { characterScaling: cantrip.map((step) => ({ level: Number(step[1]), count: Number(step[2]) })) } : {}),
      },
      components: [],
    };
  });
}

/** The canonical spell: full source text, tagged with the class lists that include it. */
export function spellFeatures(): FeatureDefinition[] {
  return SPELLS.flatMap((entry) => {
    const rolls = spellRolls(entry);
    return [canonicalSpell(entry, rolls), ...rolls];
  });
}

function canonicalSpell(entry: Spell, rolls: FeatureDefinition[]): FeatureDefinition {
  {
    const heading = entry.level === 0 ? `${entry.school} Cantrip` : `Level ${entry.level} ${entry.school}`;
    const description = [
      `${heading} (${entry.classes.map((name) => name[0].toUpperCase() + name.slice(1)).join(', ')})`,
      `Casting Time: ${entry.castingTime}`,
      `Range: ${entry.range}`,
      `Components: ${entry.components}`,
      `Duration: ${entry.duration}`,
      '',
      entry.body,
    ].join('\n');
    return {
      id: spell(entry.name),
      revision: 1,
      name: entry.name,
      displayName: entry.name,
      description,
      source: source(entry.page),
      tags: ['spell', ...entry.classes.map((name) => `${name}-list`), entry.level === 0 ? 'cantrip' : 'leveled-spell', ...(entry.ritual ? ['ritual'] : []), ...(entry.concentration ? ['concentration'] : [])],
      contentLevel: entry.level,
      ...(EVERYDAY_NAMES.has(entry.name) ? { textLinkContext: LINK_CONTEXT } : {}),
      repeat: { maximum: 20, scope: 'character' },
      components: [
        { id: 'rules', kind: 'describe', text: `${ordinal(entry.level)} ${entry.school.toLowerCase()} spell. Effects are resolved at the table from the spell's description.` },
        ...rolls.map((roll, index) => ({ id: `roll-feature-${index + 1}`, kind: 'grantFeature' as const, feature: roll.id })),
      ],
    } satisfies FeatureDefinition;
  }
}

/** Casting needs trained armor, components, and the character level an origin trait sets. */
const usable: Expression = {
  op: 'and',
  args: [{ op: 'gte', args: [{ stat: 'armorProficient' }, 1] }, { context: 'spellComponentsAvailable' }, { op: 'gte', args: [{ context: 'characterLevel' }, { argument: 'minimumLevel' } as unknown as Expression] }],
};

/**
 * One casting block per spell level. A block expands into a capability for each
 * slot level that can cast the spell, Pact Magic slots and, when allowed, a ritual.
 */
export function castingBlocks(): BlockDefinition[] {
  const parameters = {
    castingAbility: { kind: 'string' as const },
    ritualAllowed: { kind: 'boolean' as const, default: false },
    spellName: { kind: 'string' as const },
    spell: { kind: 'string' as const },
    school: { kind: 'string' as const },
    sourcePage: { kind: 'number' as const },
    castingTime: { kind: 'string' as const },
    range: { kind: 'string' as const },
    components: { kind: 'string' as const },
    actionKind: { kind: 'string' as const },
    actionAmount: { kind: 'number' as const },
    minimumLevel: { kind: 'number' as const, default: 0, integer: true, minimum: 0 },
  };
  const metadata = (level: number, slotLevel: number, mode: string, ritual = false) => ({
    spell: { argument: 'spell' },
    spellLevel: level,
    school: { argument: 'school' },
    sourcePage: { argument: 'sourcePage' },
    castingTime: { argument: 'castingTime' },
    range: { argument: 'range' },
    components: { argument: 'components' },
    castingAbility: { argument: 'castingAbility' },
    spellSlotLevel: slotLevel,
    ritual,
    castingMode: mode,
  });
  const action = { kind: { argument: 'actionKind' }, amount: { argument: 'actionAmount' } };
  return Array.from({ length: 10 }, (_, level) => {
    const components: Record<string, unknown>[] = [];
    if (level === 0) {
      components.push({ id: 'cantrip', kind: 'grantCapability', name: { argument: 'spellName' }, condition: usable, costs: [], metadata: metadata(0, 0, 'cantrip'), action });
    }
    for (let slot = Math.max(1, level); level > 0 && slot <= 9; slot += 1) {
      components.push({
        id: `slot-${slot}`,
        kind: 'grantCapability',
        name: { argument: 'spellName' },
        condition: { op: 'and', args: [usable, { op: 'gte', args: [{ stat: `spellSlots.${slot}` }, 1] }] },
        costs: [{ key: `spell-slot.${slot}`, amount: 1 }],
        metadata: metadata(level, slot, `slot-${slot}`),
        action,
      });
    }
    for (let slot = Math.max(1, level); level > 0 && slot <= 5; slot += 1) {
      components.push({
        id: `pact-${slot}`,
        kind: 'grantCapability',
        name: { argument: 'spellName' },
        condition: { op: 'and', args: [usable, { op: 'eq', args: [{ stat: 'pactSlotLevel' }, slot] }, { op: 'gte', args: [{ stat: 'pactSlotCount' }, 1] }] },
        costs: [{ key: 'pact-slot', amount: 1 }],
        metadata: metadata(level, slot, `pact-${slot}`),
        action,
      });
    }
    if (level > 0) {
      components.push({ id: 'ritual', kind: 'grantCapability', name: { argument: 'spellName' }, condition: { op: 'and', args: [{ argument: 'ritualAllowed' }, usable] }, costs: [], metadata: metadata(level, 0, 'ritual', true) });
    }
    return { id: id(`casting.level-${level}`), parameters, components };
  });
}

/** Block arguments that cast one spell with an ability. */
export function castingArguments(entry: Spell, ability: Ability, ritualAllowed: boolean, minimumLevel = 0) {
  return {
    castingAbility: ability,
    ritualAllowed: ritualAllowed && entry.ritual,
    spellName: entry.name,
    spell: spell(entry.name),
    school: entry.school.toLowerCase(),
    sourcePage: entry.page,
    castingTime: entry.castingTime,
    range: entry.range,
    components: entry.components,
    actionKind: actionKind(entry.castingTime),
    actionAmount: 1,
    minimumLevel,
  };
}

/**
 * A class's casting entry for one spell. It shares the canonical description and
 * adds the class's spellcasting ability; generated from each spell's class list,
 * so every spell is authored once.
 */
export function classSpell(className: string, entry: Spell, ability: Ability, ritualAllowed: boolean): FeatureDefinition {
  return {
    id: id(`${className}.spell.${slug(entry.name)}`),
    revision: 1,
    name: entry.name,
    displayName: entry.name,
    tags: [`${className}-spell`, entry.level === 0 ? `${className}-cantrip` : `${className}-leveled-spell`],
    contentLevel: entry.level,
    textReferences: [spell(entry.name)],
    // Reached only through the class's Spellcasting (the Warlock's is Pact Magic).
    prerequisites: { feature: id(`${className}.${className === 'warlock' ? 'pact-magic' : 'spellcasting'}`) },
    repeat: { maximum: 1, scope: 'character' },
    components: [
      { id: 'casting', kind: 'useBlock', block: id(`casting.level-${entry.level}`), arguments: castingArguments(entry, ability, ritualAllowed) },
      { id: 'spell-rules', kind: 'grantFeature', feature: spell(entry.name) },
    ],
  };
}
