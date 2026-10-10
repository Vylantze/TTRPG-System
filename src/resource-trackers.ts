import type { Character, Expression, FeatureDefinition, Instance, PoolResult } from '@/src/model.js';
import { constrain, RuleError } from '@/src/expression.js';

/** Shared identity, independent current amounts, and idempotent assignment grants. */
export function trackerPools(character: Character, instances: Instance[], features: Map<string, FeatureDefinition>, read: (expression: Expression, instance: Instance) => number | boolean): Record<string, PoolResult> {
  const result: Record<string, PoolResult> = {};
  const active = instances.filter((i) => i.active && i.eligible);
  const contracts = new Map<string, string>();
  for (const instance of active) for (const component of features.get(instance.feature)!.components) {
    if (component.kind !== 'trackResource' || (component.condition && !read(component.condition, instance))) continue;
    const id = `pool/character/character/${encodeURIComponent(component.key)}`;
    const minimum = component.minimum ?? 0, integer = component.integer ?? false;
    const capacity = component.maximum === undefined ? Infinity : constrain(read(component.maximum, instance) as number, { minimum, integer });
    const initial = constrain(read(component.initialAmount, instance) as number, { minimum, maximum: capacity, integer, clamp: true });
    const recovery = component.recovery.map((r) => ({ ...r, amount: r.amount === 'full' ? 'full' as const : constrain(read(r.amount, instance) as number, { minimum: 0, integer }) }));
    const signature = JSON.stringify({ minimum, capacity, initial, integer, units: component.units, contract: component.contract, recovery });
    if (contracts.has(id) && contracts.get(id) !== signature) throw new RuleError('RESOURCE_CONFLICT', `Conflicting shared tracker definitions for ${component.key}.`);
    contracts.set(id, signature);
    if (result[id]) {
      result[id].providers.push(instance.id);
      continue;
    }
    const state = character.resources[id];
    const current = constrain(state?.current ?? initial, { minimum, maximum: capacity, integer, clamp: true });
    result[id] = { id, key: component.key, name: component.name, scope: 'character', units: component.units, contract: component.contract, integer, capacity, minimum,
      tracking: true, current, available: 0, spent: 0, reserved: 0, providers: [instance.id], recovery, initial: 'empty', grants: [...state?.grants ?? []] };
  }
  for (const instance of active) for (const component of features.get(instance.feature)!.components) {
    if (component.kind !== 'grantResource' || (component.condition && !read(component.condition, instance))) continue;
    const pool = result[`pool/character/character/${encodeURIComponent(component.key)}`];
    if (!pool) continue; // Final evaluation diagnoses missing providers, independent of admission order.
    const token = JSON.stringify([instance.id, component.id]);
    if (pool.grants!.includes(token)) continue;
    const amount = constrain(read(component.amount, instance) as number, { minimum: 0, integer: pool.integer });
    pool.current = constrain(pool.current! + amount, { minimum: pool.minimum, maximum: pool.capacity, integer: pool.integer, clamp: true });
    pool.grants!.push(token);
  }
  for (const pool of Object.values(result)) {
    pool.reserved = Object.values(character.pending).reduce((n, pending) => n + (pending.costs[pool.id] ?? 0), 0);
    constrain(pool.reserved, { minimum: 0, integer: pool.integer });
    if (pool.reserved > pool.current! - pool.minimum!) throw new RuleError('RESOURCE_RESERVATION', `Reservations exceed the current amount of ${pool.key}.`);
    pool.available = Math.max(0, pool.current! - pool.minimum! - pool.reserved);
    pool.spent = Number.isFinite(pool.capacity) ? pool.capacity - pool.current! : 0;
  }
  return result;
}

export function storeTrackers(character: Character, pools: Record<string, PoolResult>): void {
  for (const pool of Object.values(pools)) if (pool.tracking) character.resources[pool.id] = { spent: pool.spent, current: pool.current, grants: pool.grants };
}
