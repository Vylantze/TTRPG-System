import type { Capability, Component, FeatureDefinition, Expression } from '../../model.js';
import { feature, id, op, stat, context, modifier, describe, choice, grant } from './primitives.js';
import { wizardSpells, type Spell } from './spells.js';

const mayCast = op('and', op('gte', stat('armorProficient'), 1), context('spellComponentsAvailable'));
const castingAction = (s: Spell): Capability['action'] => s.castingTime.startsWith('1 bonus action') ? { kind: 'bonus-action', amount: 1 } : s.castingTime.startsWith('1 reaction') ? { kind: 'reaction', amount: 1 } : s.castingTime === '1 action' ? { kind: 'action', amount: 1 } : undefined;
const metadata = (s: Spell) => ({ spell: id(`spell.${s.slug}`), spellLevel: s.level, castingTime: s.castingTime, castingAbility: 'intelligence', school: s.school, sourcePage: s.page, range: s.range, components: s.components });
function cast(s: Spell, suffix: string, costs: Capability['costs'] = [], condition: Expression = mayCast, spellSlotLevel = s.level): Capability {
  return { id: suffix, kind: 'grantCapability', name: `${s.name}${suffix === 'ritual' ? ' (ritual)' : suffix.startsWith('slot-') ? ` (slot ${spellSlotLevel})` : ''}`, action: castingAction(s), condition, costs, metadata: { ...metadata(s), ...(suffix === 'ritual' ? { castingTime: `${s.castingTime} + 10 minutes` } : {}), spellSlotLevel, ritual: suffix === 'ritual', castingMode: suffix }, description: `SRD 5.1 p. ${s.page}. Spell effects, concentration, components, targets, duration, and upcast effects require adjudication. ${suffix === 'ritual' ? 'Ritual adds ten minutes to casting time; it does not require preparation.' : `Casting time: ${s.castingTime}.`}` };
}

export const magicFeatures: FeatureDefinition[] = [
  ...wizardSpells.map(s => feature(`spell.${s.slug}`, s.name, [describe(`${s.level === 0 ? 'Cantrip' : `Level ${s.level}`} ${s.school}${s.ritual ? ' (ritual)' : ''}. Casting time: ${s.castingTime}. Range: ${s.range}. Components: ${s.components}. Effects and duration: SRD 5.1 p. ${s.page}.`)], { tags: ['spell'], contentLevel: s.level, repeat: { maximum: 20, scope: 'character' } })),
  feature('wizard.spellcasting', 'Wizard Spellcasting', [
    ...Array.from({ length: 9 }, (_, i): Component => ({ id: `slot-${i+1}`, kind: 'defineResource', key: `spell-slot.${i+1}`, units: 'slots', scope: 'character', integer: true, capacity: stat(`spellSlots.${i+1}`), recovery: [{ event: 'long-rest', amount: 'full' }] })),
    choice('prepared', [], 0, { minimum: 1, maximum: stat('wizardPreparationLimit'), eligibility: 'current', candidates: { tags: ['wizard-prepared'], maximumLevel: stat('wizardSpellLevel') }, retraining: { allowed: false, events: ['long-rest'] } }),
    describe('Intelligence is the casting ability. A spellbook spell with the ritual tag may be cast as a ritual without preparation. Arcane focuses can replace eligible material components; costly or consumed components remain required. The caller supplies spellComponentsAvailable and uses castSpell for the 2014 bonus-action spell rule.')
  ], { tags: ['wizard-caster'] }),
  feature('wizard.arcane-recovery', 'Arcane Recovery', [
    { id: 'use', kind: 'defineResource', key: 'arcane-recovery', scope: 'progression', units: 'uses', integer: true, capacity: 1, recovery: [{ event: 'new-day', amount: 'full' }] },
    { id: 'recover', kind: 'grantCapability', name: 'Arcane Recovery', costs: [{ key: 'arcane-recovery', amount: 1 }], metadata: { recoveryBudgetStat: 'arcaneRecoveryBudget', maximumSlotLevel: 5 } },
    describe('Once per day after finishing a short rest, recover chosen expended slots whose combined levels total at most half Wizard level rounded up. No recovered slot may be level 6 or above. Use recoverArcaneSlots; a new-day event resets the daily use.')
  ]),
  feature('wizard.spell-mastery', 'Spell Mastery', [
    ...[1,2].map(n => choice(`level-${n}`, wizardSpells.filter(s => s.level === n).map(s => `mastery.${s.slug}`), 1, { eligibility: 'current', retraining: { allowed: false, events: ['eight-hours-study'] } }))
  ]),
  feature('wizard.signature-spells', 'Signature Spells', [choice('spells', wizardSpells.filter(s => s.level === 3).map(s => `signature.${s.slug}`), 2)]),
  ...wizardSpells.flatMap((s): FeatureDefinition[] => {
    if (s.level === 0) return [
      feature(`cantrip.${s.slug}`, s.name, [grant('spell-data', `spell.${s.slug}`), cast(s, 'cast')], { tags: ['wizard-cantrip'], contentLevel: 0 }),
      feature(`racial-cantrip.${s.slug}`, `${s.name} (High Elf)`, [grant('spell-data', `spell.${s.slug}`), cast(s, 'cast')], { tags: ['racial-cantrip'], contentLevel: 0 })
    ];
    const book = feature(`spellbook.${s.slug}`, `${s.name} (Spellbook)`, [
      grant('spell-data', `spell.${s.slug}`),
      describe(`Wizard level ${s.level} ${s.school} spell. Casting time ${s.castingTime}; range ${s.range}; components ${s.components}. Rules: SRD 5.1 p. ${s.page}.`),
      ...(s.ritual ? [{ ...cast(s, 'ritual'), action: undefined }] : [])
    ], { tags: ['wizard-spellbook'], contentLevel: s.level, prerequisites: { all: [{ feature: id('wizard.spellcasting') }, { stat: 'wizardSpellLevel', minimum: s.level }] } });
    const prepared = feature(`prepared.${s.slug}`, `${s.name} (Prepared)`, Array.from({ length: 10 - s.level }, (_, i) => cast(s, `slot-${s.level+i}`, [{ key: `spell-slot.${s.level+i}`, amount: 1 }], op('and', mayCast, op('gte', stat(`spellSlots.${s.level+i}`), 1)), s.level+i)), {
      tags: ['wizard-prepared'], contentLevel: s.level, prerequisites: { feature: book.id },
      resources: [{ id: 'spell-slot', key: `spell-slot.${s.level}`, scope: 'character', units: 'slots', minimumCapacity: 1 }],
      repeat: { maximum: 2, scope: 'character' }
    });
    const extra: FeatureDefinition[] = [];
    if (s.level <= 2) extra.push(feature(`mastery.${s.slug}`, `${s.name} (Spell Mastery)`, [cast(s, 'mastery', [], op('and', mayCast, op('gte', stat(`prepared.${s.slug}`), 1)))], { prerequisites: { feature: book.id }, contentLevel: s.level }));
    if (s.level === 3) extra.push(feature(`signature.${s.slug}`, `${s.name} (Signature Spell)`, [
      { id: 'daily-cast', kind: 'defineResource', key: `signature.${s.slug}`, units: 'uses', scope: 'progression', capacity: 1, integer: true, recovery: [{ event: 'short-rest', amount: 'full' }, { event: 'long-rest', amount: 'full' }] },
      cast(s, 'signature', [{ key: `signature.${s.slug}`, amount: 1 }]),
      { ...grant('always-prepared', `prepared.${s.slug}`), ignorePrerequisites: false }
    ], { prerequisites: { feature: book.id }, contentLevel: 3 }));
    // A separate marker stat makes the preparation condition data-driven for Spell Mastery.
    prepared.components.push(modifier('prepared-marker', `prepared.${s.slug}`, 'floor', 1));
    return [book, prepared, ...extra];
  })
];

export const preparationStats = wizardSpells.filter(s => s.level > 0).map(s => ({ id: `prepared.${s.slug}`, name: `${s.name} prepared`, kind: 'derived' as const, expression: 0 }));
