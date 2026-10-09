import type { Engine } from '@/src/engine.js';
import type { EvaluationResult } from '@/src/model/EvaluationResult.js';
import type { SpellGroup } from '@/src/types/SpellGroup.js';

/** Group evaluated capabilities only; never invent a casting mode or bypass its costs. */
export function spellGroups(engine: Engine, result: EvaluationResult): SpellGroup[] {
  const policy = engine.catalogue.system.spellDisplay;
  if (!policy) return [];
  const groups = new Map<string, SpellGroup>();
  for (const capability of result.capabilities) {
    const meta = capability.definition.metadata;
    const feature = meta?.[policy.spellKey], level = meta?.[policy.levelKey], castingAbility = meta?.[policy.castingAbilityKey];
    if (typeof feature !== 'string' || typeof level !== 'number' || typeof castingAbility !== 'string') continue;
    const id = JSON.stringify([feature, castingAbility]);
    const group = groups.get(id) ?? { id, feature, level, castingAbility, name: engine.getFeature(feature)?.displayName ?? engine.getFeature(feature)?.name ?? capability.definition.name, modes: [] };
    group.modes.push({ capability, slotLevel: Number(meta?.[policy.slotLevelKey] ?? level), ritual: meta?.[policy.ritualKey] === true, available: Object.entries(capability.costs).every(([pool, amount]) => (result.resources[pool]?.available ?? 0) >= amount) });
    groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

export function spellSlotPools(engine: Engine, result: EvaluationResult) {
  return (engine.catalogue.system.spellDisplay?.slots ?? []).flatMap((slot) => Object.values(result.resources).filter((pool) => pool.key === slot.key && pool.scope === slot.scope).map((pool) => ({ level: slot.level, pool }))).sort((a, b) => a.level - b.level);
}
