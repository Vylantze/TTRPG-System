import { canonical, stamp } from '@/src/command-event.js';
import { checkMoney, moneyTotal } from '@/src/currency.js';
import { rollDice } from '@/src/dice.js';
import { Engine, clone } from '@/src/engine.js';
import { RuleError, constrain, number } from '@/src/expression.js';
import type { Character, Edit, EditPreview, EvaluationResult } from '@/src/model.js';
import type { UseOptions } from '@/src/types/UseOptions.js';
import { checkCharacter, record } from '@/src/validation.js';
import { storeTrackers } from '@/src/resource-trackers.js';
import { checkInventory } from '@/src/items.js';
import type { InventoryEntry } from '@/src/model/InventoryEntry.js';
export type { UseOptions } from '@/src/types/UseOptions.js';

export function setMoney(engine: Engine, input: Character, money: Record<string, number>, eventId: string): Character {
  checkCharacter(input);
  if (input.system.id !== engine.catalogue.system.id || input.system.revision !== engine.catalogue.system.revision || input.catalogue.id !== engine.catalogue.id || input.catalogue.revision !== engine.catalogue.revision) throw new RuleError('REVISION', 'System or catalogue revision mismatch.');
  checkMoney(money, engine.catalogue.system);
  const character = clone(input);
  if (!stamp(character, eventId, { kind: 'money', money })) return character;
  character.money = clone(money);
  moneyTotal(character, engine.catalogue.system);
  return character;
}

export function updateInventory(engine: Engine, input: Character, inventory: InventoryEntry[], eventId: string): Character {
  checkCharacter(input);
  const character = clone(input);
  if (!stamp(character, eventId, { kind: 'inventory', inventory })) return character;
  const before = engine.evaluate(input);
  storeTrackers(character, before.resources);
  character.inventory = clone(inventory);
  checkInventory(character, engine.catalogue);
  const after = engine.evaluate(character);
  if (before.status === 'valid') requireValid(after);
  storeTrackers(character, after.resources);
  return character;
}

function requireValid(result: EvaluationResult): void {
  if (result.status !== 'valid') throw new RuleError('INVALID_BUILD', 'This command requires a valid, complete character.');
}
/** Explicit manual tracking adjustment. Reservations cannot be spent twice. */
export function adjustResource(engine: Engine, input: Character, poolId: string, delta: number, eventId: string): Character {
  checkCharacter(input);
  if (input.buildState === 'draft') throw new RuleError('DRAFT', 'Finalize the character before adjusting resources.');
  const character = clone(input);
  if (!stamp(character, eventId, { kind: 'adjustResource', poolId, delta })) return character;
  const result = engine.evaluate(input);
  requireValid(result);
  const pool = result.resources[poolId];
  if (!pool) throw new RuleError('MISSING_RESOURCE', 'This character does not have that resource.');
  constrain(number(delta), { integer: pool.integer });
  const current = constrain((pool.current ?? pool.capacity - pool.spent) + delta, { minimum: (pool.minimum ?? 0) + pool.reserved, maximum: pool.capacity, integer: pool.integer });
  storeTrackers(character, result.resources);
  character.resources[poolId] = { ...character.resources[poolId], spent: Number.isFinite(pool.capacity) ? pool.capacity - current : 0, ...(pool.tracking ? { current } : {}) };
  if (delta > 0 && pool.key === engine.catalogue.system.healthRules?.resourceKey) for (const counter of Object.values(result.resources).filter((counter) => engine.catalogue.system.healthRules?.resetResourceKeysOnHealing?.includes(counter.key))) {
    if (counter.reserved > 0) throw new RuleError('RESOURCE_RESERVATION', 'Release reservations before clearing a health counter.');
    character.resources[counter.id] = { ...character.resources[counter.id], spent: Number.isFinite(counter.capacity) ? counter.capacity - (counter.minimum ?? 0) : 0, ...(counter.tracking ? { current: counter.minimum ?? 0 } : {}) };
  }
  return character;
}

/** System-defined free checks use evaluated stats and persist across sheet tabs. */
export function rollStat(engine: Engine, input: Character, stat: string, eventId: string, random?: () => number): Character {
  checkCharacter(input);
  const character = clone(input);
  if (!stamp(character, eventId, { kind: 'rollStat', stat })) return character;
  const result = engine.evaluate(input);
  requireValid(result);
  const row = [...engine.catalogue.system.sheetSections?.flatMap((section) => section.rows) ?? [], ...engine.catalogue.system.sheetDisplay?.overview ?? []].find((entry) => entry.stat === stat && entry.roll);
  if (!row?.roll) throw new RuleError('ROLL', 'This stat has no configured sheet roll.');
  const bonusResult = result.stats[row.roll.bonusStat ?? row.stat];
  const bonus = bonusResult?.value;
  if (!Number.isFinite(bonus)) throw new RuleError('ROLL', 'The check bonus is unavailable.');
  const expression = `${row.roll.dice} ${bonus! < 0 ? '-' : '+'} ${Math.abs(bonus!)}`;
  const rolled = rollDice(expression, random);
  character.statRolls = [...character.statRolls ?? [], { id: eventId, stat, name: row.name ?? engine.getStatDefinition(stat)?.name ?? stat, expression, ...rolled, modifierReasons: (bonusResult?.contributions ?? []).map((term) => `${term.amount} (${term.label})`).join(' + ') || undefined }].slice(-100);
  return character;
}

/** Damage absorbs temporary HP first; healing is capped and clears configured counters. */
export function changeHealth(engine: Engine, input: Character, kind: 'damage' | 'heal', amount: number, eventId: string): Character {
  checkCharacter(input);
  if (input.buildState === 'draft') throw new RuleError('DRAFT', 'Finalize the character before changing health.');
  constrain(number(amount), { minimum: 0 });
  if (!['damage', 'heal'].includes(kind)) throw new RuleError('HEALTH', 'Unknown health operation.');
  const character = clone(input);
  if (!stamp(character, eventId, { kind: 'health', operation: kind, amount })) return character;
  const result = engine.evaluate(input);
  requireValid(result);
  const policy = engine.catalogue.system.healthRules;
  const pools = Object.values(result.resources);
  const health = pools.find((pool) => pool.key === policy?.resourceKey);
  if (!policy || !health) throw new RuleError('HEALTH', 'No health pool is configured for this character.');
  constrain(amount, { integer: health.integer });
  storeTrackers(character, result.resources);
  const set = (pool: (typeof pools)[number], current: number) => {
    current = constrain(current, { minimum: (pool.minimum ?? 0) + pool.reserved, maximum: pool.capacity, integer: pool.integer, clamp: true });
    character.resources[pool.id] = { ...character.resources[pool.id], spent: Number.isFinite(pool.capacity) ? pool.capacity - current : 0, ...(pool.tracking ? { current } : {}) };
  };
  const temporary = pools.find((pool) => pool.key === policy.temporaryResourceKey);
  const absorbed = kind === 'damage' && temporary ? Math.min(amount, temporary.available) : 0;
  if (temporary && absorbed) set(temporary, (temporary.current ?? temporary.capacity - temporary.spent) - absorbed);
  const current = health.current ?? health.capacity - health.spent;
  set(health, current + (kind === 'heal' ? amount : -(amount - absorbed)));
  if (kind === 'heal' && amount > 0 && current < health.capacity) for (const pool of pools.filter((pool) => policy.resetResourceKeysOnHealing?.includes(pool.key))) {
    if (pool.reserved > 0) throw new RuleError('RESOURCE_RESERVATION', 'Release reservations before clearing a health counter.');
    set(pool, pool.minimum ?? 0);
  }
  return character;
}
export function previewEdit(engine: Engine, input: Character, edits: Edit[]): EditPreview {
  checkCharacter(input);
  const before = engine.evaluate(input), character = clone(input);
  storeTrackers(character, before.resources);
  let retraining = false;
  for (const edit of edits) {
    switch (edit.kind) {
      case 'input': character.inputs[edit.stat] = number(edit.value);
        break;
      case 'removeProgression': {
        if (character.buildState !== 'draft') throw new RuleError('DRAFT', 'Only construction drafts can remove class progressions; use an explicit migration for finalized characters.');
        if (!character.progressions.some((p) => p.id === edit.progression)) throw new RuleError('UNKNOWN_PROGRESSION', 'Unknown class progression.');
        character.progressions = character.progressions.filter((p) => p.id !== edit.progression);
        character.history = character.history.filter((h) => h.progression !== edit.progression);
        const prefix = `class/${encodeURIComponent(edit.progression)}/`;
        for (const id of Object.keys(character.selections)) if (id.startsWith(prefix)) delete character.selections[id];
        for (const id of Object.keys(character.bindings)) if (id.startsWith(prefix)) delete character.bindings[id];
        break;
      }
      case 'addProgression': {
        if (character.progressions.some((p) => p.id === edit.progression.id)) throw new RuleError('DUPLICATE_PROGRESSION', 'Progression ID already exists.');
        const p = clone(edit.progression);
        constrain(p.level, { integer: true, minimum: 0 });
        character.progressions.push(p);
        for (let level = 1; level <= p.level; level++) character.history.push({ progression: p.id, level });
        break;
      }
      case 'select': {
        const current = engine.evaluate(character), slot = current.selections.find((s) => s.id === edit.selection);
        if (!slot) throw new RuleError('UNKNOWN_SELECTION', `Unknown active selection ${edit.selection}.`);
        if ((character.selections[edit.selection]?.length ?? 0) > 0 && JSON.stringify(character.selections[edit.selection]) !== JSON.stringify(edit.picks)) {
          const policy = slot.definition.retraining;
          if (character.buildState !== 'draft' && !policy?.allowed && !(edit.event && policy?.events?.includes(edit.event))) throw new RuleError('RETRAINING', 'This selection does not permit replacement at this event.');
          retraining = true;
        }
        // Remove only owned descendant choices/bindings; independent siblings remain.
        const old = character.selections[edit.selection] ?? [];
        const removed = old.filter((p) => !edit.picks.some((n) => n.id === p.id && n.feature === p.feature && JSON.stringify(n.parameters) === JSON.stringify(p.parameters)));
        for (const pick of removed) {
          const prefix = `${edit.selection}/pick/${encodeURIComponent(pick.id)}/`;
          for (const id of Object.keys(character.selections)) if (id.startsWith(prefix)) delete character.selections[id];
          for (const id of Object.keys(character.bindings)) if (id.startsWith(prefix)) delete character.bindings[id];
        }
        character.selections[edit.selection] = clone(edit.picks);
        break;
      }
      case 'level': {
        const progression = character.progressions.find((p) => p.id === edit.progression);
        if (!progression) throw new RuleError('UNKNOWN_PROGRESSION', 'Unknown class progression.');
        const level = constrain(edit.level, { integer: true, minimum: 0 });
        const priorMaximum = Math.max(0, ...character.history.filter((h) => h.progression === progression.id).map((h) => h.level));
        for (let next = priorMaximum + 1; next <= level; next++) character.history.push({ progression: progression.id, level: next });
        progression.level = level;
        break;
      }
      case 'root': {
        if (character.roots.some((r) => r.id === edit.acquisition.id)) {
          retraining = true;
          character.roots = character.roots.filter((r) => r.id !== edit.acquisition.id);
          const prefix = `root/${encodeURIComponent(edit.acquisition.id)}/`;
          for (const id of Object.keys(character.selections)) if (id.startsWith(prefix)) delete character.selections[id];
          for (const id of Object.keys(character.bindings)) if (id.startsWith(prefix)) delete character.bindings[id];
        }
        character.roots.push(clone(edit.acquisition));
        break;
      }
      case 'removeRoot': {
        retraining = true;
        character.roots = character.roots.filter((r) => r.id !== edit.id);
        const prefix = `root/${encodeURIComponent(edit.id)}/`;
        for (const id of Object.keys(character.selections)) if (id.startsWith(prefix)) delete character.selections[id];
        for (const id of Object.keys(character.bindings)) if (id.startsWith(prefix)) delete character.bindings[id];
        break;
      }
      case 'alternative': character.alternatives[edit.stat] = edit.alternative;
        break;
      case 'bind': character.bindings[edit.requirement] = edit.pool;
        break;
      default: throw new RuleError('UNKNOWN_EDIT', 'Unknown edit command.');
    }
  }
  const provisional = engine.evaluate(character);
  storeTrackers(character, provisional.resources);
  for (const pool of Object.values(provisional.resources)) if (!Object.hasOwn(character.resources, pool.id)) {
    // Replacement never supplies free recovery; an equivalent stable pool preserves expenditure.
    character.resources[pool.id] = { spent: (retraining && character.buildState !== 'draft') || pool.initial === 'empty' ? pool.capacity : 0 };
  }
  const after = engine.evaluate(character);
  const active = (r: EvaluationResult) => r.instances.filter((i) => i.active && i.eligible).map((i) => i.id + ':' + i.feature);
  const prior = active(before), next = active(after);
  return { character, before, after, added: next.filter((id) => !prior.includes(id)), removed: prior.filter((id) => !next.includes(id)),
    changedStats: [...new Set([...Object.keys(before.stats), ...Object.keys(after.stats)])].filter((id) => before.stats[id]?.value !== after.stats[id]?.value),
    changedResources: [...new Set([...Object.keys(before.resources), ...Object.keys(after.resources)])].filter((id) => JSON.stringify(before.resources[id]) !== JSON.stringify(after.resources[id])) };
}
export function applyEdit(engine: Engine, input: Character, edits: Edit[], eventId: string, options: { requireValid?: boolean } = {}): Character {
  checkCharacter(input);
  const copy = clone(input);
  if (!stamp(copy, eventId, { kind: 'edit', edits })) return copy;
  const preview = previewEdit(engine, copy, edits);
  if (options.requireValid) requireValid(preview.after);
  checkCharacter(preview.character);
  return preview.character;
}
/** Explicitly reopen construction; preserve balances and reject unresolved reservations. */
export function reopenCharacter(engine: Engine, input: Character, eventId: string): Character {
  checkCharacter(input);
  if (Object.keys(input.pending).length) throw new RuleError('PENDING', 'Resolve reserved abilities before editing the build.');
  const character = clone(input);
  if (!stamp(character, eventId, { kind: 'reopen' })) return character;
  storeTrackers(character, engine.evaluate(character).resources);
  character.buildState = 'draft';
  return character;
}
export function finalizeCharacter(engine: Engine, input: Character, eventId: string): Character {
  checkCharacter(input);
  const character = clone(input);
  if (!stamp(character, eventId, { kind: 'finalize' })) return character;
  requireValid(engine.evaluate(character));
  storeTrackers(character, engine.evaluate(character).resources);
  character.buildState = 'finalized';
  return character;
}
export function useAbility(engine: Engine, input: Character, ability: string, eventId: string, options: UseOptions = {}): { character: Character; actions?: Record<string, number>; pending: boolean } {
  checkCharacter(input);
  if (input.buildState === 'draft') throw new RuleError('DRAFT', 'Finalize the construction draft before using abilities.');
  const character = clone(input), payload = { kind: 'use', ability, options };
  const prior = character.events.find((e) => e.id === eventId);
  if (prior) {
    if (prior.fingerprint !== canonical(payload)) throw new RuleError('EVENT_CONFLICT', 'Event ID collision.');
    return { character, actions: clone(prior.actions), pending: !!character.pending[eventId] };
  }
  const result = engine.evaluate(character, options.runtime);
  requireValid(result);
  storeTrackers(character, result.resources);
  const capability = result.capabilities.find((c) => c.id === ability);
  if (!capability) throw new RuleError('ABILITY', 'This ability is unavailable.');
  const actions = options.actions ? clone(options.actions) : undefined;
  if (actions) for (const value of Object.values(actions)) constrain(value, { integer: true, minimum: 0 });
  const cost = capability.definition.action;
  if (options.actionTracking !== undefined && options.actionTracking !== 'manual') throw new RuleError('ACTION_TRACKING', 'Invalid action tracking mode.');
  if (options.actionTracking === 'manual' && actions) throw new RuleError('ACTION_TRACKING', 'Manual action tracking cannot include a budget.');
  if (cost && cost.amount > 0 && options.actionTracking !== 'manual') {
    if (!actions || number(actions[cost.kind] ?? 0) < cost.amount) throw new RuleError('ACTION_COST', `Insufficient ${cost.kind} actions.`);
    actions[cost.kind] -= cost.amount;
  }
  for (const [id, amount] of Object.entries(capability.costs)) if (result.resources[id].available < amount) throw new RuleError('RESOURCE_COST', `Insufficient ${result.resources[id].key}.`);
  stamp(character, eventId, payload);
  if (actions) character.events.at(-1)!.actions = clone(actions);
  const pending = capability.definition.spendOnOutcomes !== undefined;
  if (pending) character.pending[eventId] = { ability, costs: clone(capability.costs), spendOnOutcomes: [...capability.definition.spendOnOutcomes!] };
  else for (const [id, amount] of Object.entries(capability.costs)) {
    const pool = result.resources[id];
    character.resources[id] = { ...character.resources[id], spent: pool.spent + amount, ...(pool.tracking ? { current: pool.current! - amount } : {}) };
  }
  return { character, actions, pending };
}
export function settleAbility(input: Character, pendingId: string, outcome: string, eventId: string): Character {
  checkCharacter(input);
  const character = clone(input);
  if (!stamp(character, eventId, { kind: 'settle', pendingId, outcome })) return character;
  const pending = character.pending[pendingId];
  if (!pending) throw new RuleError('PENDING_USE', 'Unknown or already settled ability use.');
  if (pending.spendOnOutcomes.includes(outcome)) for (const [id, amount] of Object.entries(pending.costs)) {
    const state = character.resources[id];
    character.resources[id] = { ...state, spent: (state?.spent ?? 0) + amount, ...(state?.current !== undefined ? { current: state.current - amount } : {}) };
  }
  delete character.pending[pendingId];
  return character;
}
/** Configured reset buttons perform all referenced recoveries on a cloned character. */
export function recoverResources(engine: Engine, input: Character, recoveryEvent: string, eventId: string, allocation?: Record<string, number>, random?: () => number): Character {
  const recoveries = engine.catalogue.system.resetButtons?.find((button) => button.event === recoveryEvent)?.recoveries ?? [recoveryEvent];
  let character = recoverSingleEvent(engine, input, recoveryEvent, eventId, recoveries.includes(recoveryEvent) ? allocation : undefined, random, !recoveries.includes(recoveryEvent));
  for (const event of recoveries.filter((event) => event !== recoveryEvent)) character = recoverSingleEvent(engine, character, event, `${eventId}/${event}`, undefined, random);
  return character;
}
function recoverSingleEvent(engine: Engine, input: Character, recoveryEvent: string, eventId: string, allocation?: Record<string, number>, random?: () => number, markerOnly = false): Character {
  checkCharacter(input);
  if (engine.catalogue.system.resetConditions && !engine.catalogue.system.resetConditions.some((condition) => condition.id === recoveryEvent)) throw new RuleError('RECOVERY', 'Unknown System reset condition.');
  const character = clone(input);
  if (input.buildState === 'draft') throw new RuleError('DRAFT', 'Finalize the construction draft before recovery.');
  if (!stamp(character, eventId, { kind: 'recover', recoveryEvent, ...(allocation !== undefined ? { allocation } : {}) })) return character;
  const result = engine.evaluate(character);
  requireValid(result);
  storeTrackers(character, result.resources);
  if (markerOnly) return character;
  const policy = engine.catalogue.system.recoveryAllocations?.[recoveryEvent];
  const amounts: Record<string, number> = {};
  if (allocation !== undefined && !policy) throw new RuleError('RECOVERY', 'This event has no recovery allocation.');
  if (policy) {
    let budget = constrain(result.stats[policy.budgetStat].value, { integer: true, minimum: 0 });
    if (allocation !== undefined) {
      record(allocation);
      for (const key of Object.keys(allocation)) if (!policy.keys.includes(key)) throw new RuleError('RECOVERY', 'Unknown allocated resource.');
    }
    for (const key of policy.keys) {
      const pool = Object.values(result.resources).find((pool) => pool.key === key && pool.scope === 'character');
      const count = allocation !== undefined ? allocation[key] ?? 0 : Math.min(budget, pool?.spent ?? 0);
      constrain(count, { integer: true, minimum: 0 });
      if (count > (pool?.spent ?? 0) || count > budget) throw new RuleError('RECOVERY', 'Recovery exceeds spent resources or the shared budget.');
      budget -= count;
      if (pool) amounts[pool.id] = count;
    }
  }
  for (const pool of Object.values(result.resources)) {
    const rules = pool.id in amounts ? [{ event: recoveryEvent, amount: amounts[pool.id] }] : pool.recovery.filter((r) => r.event === recoveryEvent);
    // Every provider was validated to use identical recovery rules. Apply the pool rule once.
    for (const rule of rules) {
      const source = result.instances.find((i) => i.id === pool.providers[0])!;
      const amount = rule.amount === 'full' ? Infinity : number(engine.evaluateForInstance(character, rule.amount, source)) + ('dice' in rule && typeof rule.dice === 'string' ? rollDice(rule.dice, random).total : 0);
      if (amount < 0) throw new RuleError('RECOVERY', 'Negative recovery amount.');
      if (amount !== Infinity) constrain(amount, { integer: pool.integer, minimum: 0 });
      const spent = character.resources[pool.id]?.spent ?? pool.spent;
      if (pool.tracking) {
        const current = number(Math.min(pool.capacity, character.resources[pool.id].current! + amount));
        character.resources[pool.id] = { ...character.resources[pool.id], current, spent: Number.isFinite(pool.capacity) ? pool.capacity - current : 0 };
      } else character.resources[pool.id] = { spent: Math.max(0, spent - amount) };
    }
    if (engine.catalogue.system.healthRules?.clearOnReset?.[recoveryEvent]?.includes(pool.key)) {
      if (pool.reserved > 0) throw new RuleError('RESOURCE_RESERVATION', 'Release reservations before clearing a health pool.');
      character.resources[pool.id] = { ...character.resources[pool.id], spent: Number.isFinite(pool.capacity) ? pool.capacity - (pool.minimum ?? 0) : 0, ...(pool.tracking ? { current: pool.minimum ?? 0 } : {}) };
    }
  }
  return character;
}
export function serializeCharacter(character: Character): string {
  checkCharacter(character);
  return JSON.stringify(character, null, 2);
}
export function deserializeCharacter(text: string, engine?: Engine): Character {
  if (text.length > 10_000_000) throw new RuleError('SAVE_SIZE', 'Save exceeds 10 MB.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new RuleError('SAVE_JSON', 'Invalid character JSON.');
  }
  checkCharacter(parsed);
  if (engine) {
    const result = engine.evaluate(parsed);
    const errors = result.diagnostics.filter((d) => d.code.startsWith('EFFECT_') || ['MONEY', 'INVENTORY', 'REVISION', 'HISTORY', 'UNKNOWN_INPUT', 'UNKNOWN_CLASS', 'UNKNOWN_SELECTION'].includes(d.code));
    if (errors.length) throw new RuleError(errors[0].code, errors[0].message);
  }
  return parsed;
}
/** Content migration is explicit and requires a complete target save, never an implicit rules upgrade. */
export function previewMigration(engine: Engine, target: Character): EvaluationResult {
  return engine.evaluate(target);
}
export function migrateCharacter(engine: Engine, source: Character, target: Character, eventId: string): Character {
  checkCharacter(source);
  checkCharacter(target);
  if (source.id !== target.id) throw new RuleError('MIGRATION_ID', 'Migration must retain character identity.');
  if (Object.keys(source.pending).length || Object.keys(target.pending).length) throw new RuleError('PENDING_USE', 'Settle pending uses before migration.');
  const character = clone(target);
  character.events = clone(source.events);
  if (!stamp(character, eventId, { kind: 'migration', target: { ...target, events: [] } })) return clone(source);
  const evaluation = engine.evaluate(character);
  requireValid(evaluation);
  for (const pool of Object.values(evaluation.resources)) {
    if (pool.tracking) {
      const prior = source.resources[pool.id];
      const current = constrain(prior?.current ?? pool.minimum!, { minimum: pool.minimum, maximum: pool.capacity, integer: pool.integer, clamp: true });
      character.resources[pool.id] = { current, spent: Number.isFinite(pool.capacity) ? pool.capacity - current : 0, grants: clone(prior?.grants ?? pool.grants) };
    } else character.resources[pool.id] = clone(source.resources[pool.id] ?? { spent: pool.capacity });
  }
  requireValid(engine.evaluate(character));
  return character;
}
