import { Engine, clone } from './engine.js';
import { RuleError, constrain, number } from './expression.js';
import type { Character, Edit, EditPreview, EvaluationResult } from './model.js';
import type { UseOptions } from './types/UseOptions.js';
import { checkCharacter } from './validation.js';
import { storeTrackers } from './resource-trackers.js';
export type { UseOptions } from './types/UseOptions.js';

function requireValid(result: EvaluationResult): void {
  if (result.status !== 'valid') throw new RuleError('INVALID_BUILD', 'This command requires a valid, complete character.');
}
function stamp(character: Character, id: string, payload: unknown): boolean {
  if (!id) throw new RuleError('EVENT_ID', 'An event ID is required.');
  const fingerprint = canonical(payload);
  const prior = character.events.find((e) => e.id === id);
  if (prior) {
    if (prior.fingerprint !== fingerprint) throw new RuleError('EVENT_CONFLICT', 'Event ID was reused with different data.');
    return false;
  }
  character.events.push({ id, fingerprint });
  return true;
}
function canonical(value: unknown): string {
  const order = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(order);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, x]) => [k, order(x)]));
    return v;
  };
  return JSON.stringify(order(value));
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
  if (cost && cost.amount > 0) {
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
export function recoverResources(engine: Engine, input: Character, recoveryEvent: string, eventId: string): Character {
  checkCharacter(input);
  const character = clone(input);
  if (input.buildState === 'draft') throw new RuleError('DRAFT', 'Finalize the construction draft before recovery.');
  if (!stamp(character, eventId, { kind: 'recover', recoveryEvent })) return character;
  const result = engine.evaluate(character);
  requireValid(result);
  storeTrackers(character, result.resources);
  for (const pool of Object.values(result.resources)) {
    const rules = pool.recovery.filter((r) => r.event === recoveryEvent);
    // Every provider was validated to use identical recovery rules. Apply the pool rule once.
    for (const rule of rules) {
      const source = result.instances.find((i) => i.id === pool.providers[0])!;
      const amount = rule.amount === 'full' ? Infinity : number(engine.evaluateForInstance(character, rule.amount, source));
      if (amount < 0) throw new RuleError('RECOVERY', 'Negative recovery amount.');
      if (amount !== Infinity) constrain(amount, { integer: pool.integer, minimum: 0 });
      const spent = character.resources[pool.id]?.spent ?? pool.spent;
      if (pool.tracking) {
        const current = number(Math.min(pool.capacity, character.resources[pool.id].current! + amount));
        character.resources[pool.id] = { ...character.resources[pool.id], current, spent: Number.isFinite(pool.capacity) ? pool.capacity - current : 0 };
      } else character.resources[pool.id] = { spent: Math.max(0, spent - amount) };
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
    const errors = result.diagnostics.filter((d) => ['REVISION', 'HISTORY', 'UNKNOWN_INPUT', 'UNKNOWN_CLASS', 'UNKNOWN_SELECTION'].includes(d.code));
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
