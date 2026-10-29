import { clone, type Engine } from '@/src/engine.js';
import { RuleError } from '@/src/expression.js';
import { checkCharacter } from '@/src/validation.js';
import { canonical, stamp } from '@/src/command-event.js';
import { storeTrackers } from '@/src/resource-trackers.js';
import { checkEffectDefinitions, effectPath } from '@/src/effect-state.js';
import {
  checkEffectFilter,
  checkEffectInstances,
  checkEffectOperation,
} from '@/src/effect-validation.js';
import { useAbility } from '@/src/commands.js';
import type { Character } from '@/src/model/Character.js';
import type { EffectInstance } from '@/src/model/EffectInstance.js';
import type { EffectTagFilter } from '@/src/model/EffectTagFilter.js';
import type { EffectOperation } from '@/src/model/EffectOperation.js';
import type { ApplyEffectRequest } from '@/src/types/ApplyEffectRequest.js';
import type { EffectLifecycleEvent } from '@/src/types/EffectLifecycleEvent.js';

function prepare(engine: Engine, input: Character, allowInvalid = false): Character {
  checkCharacter(input);
  if (input.buildState === 'draft')
    throw new RuleError('DRAFT', 'Finalize the character before applying effects.');
  if (Object.keys(input.pending).length)
    throw new RuleError('PENDING_USE', 'Settle reserved uses before changing effects.');
  const result = engine.evaluate(input);
  const structuralError = result.diagnostics.find(
    (entry) =>
      ['REVISION', 'HISTORY', 'SCHEMA'].includes(entry.code) || entry.code.startsWith('EFFECT_'),
  );
  if (structuralError) throw new RuleError(structuralError.code, structuralError.message);
  if (!allowInvalid && result.status !== 'valid')
    throw new RuleError('INVALID_BUILD', 'Effect commands require a valid character.');
  const character = clone(input);
  storeTrackers(character, result.resources);
  return character;
}
function finish(engine: Engine, character: Character, requireValid: boolean): Character {
  checkCharacter(character);
  const result = engine.evaluate(character);
  if (requireValid && result.status !== 'valid')
    throw new RuleError('EFFECT_APPLICATION', result.diagnostics.map((d) => d.message).join(' '));
  storeTrackers(character, result.resources);
  // Retain inaccessible pool receipts: removing/reapplying a provider must not refill it.
  return character;
}
function erase(character: Character, ids: string[]): void {
  const prefixes = ids.map((id) => effectPath(id) + '/');
  character.effects = (character.effects ?? []).filter((effect) => !ids.includes(effect.id));
  for (const entries of [character.selections, character.bindings])
    for (const key of Object.keys(entries))
      if (prefixes.some((prefix) => key.startsWith(prefix))) delete entries[key];
}
function replay(input: Character, eventId: string, payload: unknown): Character | undefined {
  checkCharacter(input);
  const copy = clone(input);
  return stamp(copy, eventId, payload) ? undefined : copy;
}

/** Direct application for adjudicated events. Does not spend a caster's resources. */
export function applyEffect(
  engine: Engine,
  input: Character,
  request: ApplyEffectRequest,
  eventId: string,
): Character {
  const payload = { kind: 'applyEffect', request };
  const prior = replay(input, eventId, payload);
  if (prior) return prior;
  const character = prepare(engine, input);
  const definition = engine.getFeature(request.feature);
  if (!definition?.effect)
    throw new RuleError('EFFECT_DEFINITION', 'Only an effect-enabled Feature can be applied.');
  const effect: EffectInstance = {
    ...clone(request),
    revision: definition.revision,
    ...(definition.effect.duration ? { remaining: clone(definition.effect.duration) } : {}),
  };
  checkEffectInstances([effect]);
  if (
    character.effects?.some((entry) => entry.id === effect.id)
    || character.events.some((event) => event.id === `effect-id/${effect.id}`)
  )
    throw new RuleError('EFFECT_ID', 'Effect application IDs cannot be reused.');
  const key = definition.effect.stacking?.key ?? definition.id;
  const peers = (character.effects ?? []).filter(
    (entry) => (engine.getFeature(entry.feature)?.effect?.stacking?.key ?? entry.feature) === key,
  );
  const mode = definition.effect.stacking?.mode ?? 'reject';
  if (peers.length && mode === 'reject')
    throw new RuleError('EFFECT_STACKING', 'This effect is already applied.');
  if (mode === 'replace')
    erase(
      character,
      peers.map((entry) => entry.id),
    );
  character.effects = [...(character.effects ?? []), effect];
  stamp(character, `effect-id/${effect.id}`, { kind: 'effectIdentity', request });
  stamp(character, eventId, payload);
  return finish(engine, character, true);
}

/** Queries applied effects only; Feature tags on build roots/items are never candidates. */
export function matchingEffects(
  engine: Engine,
  character: Character,
  tags: EffectTagFilter,
  method?: string,
): EffectInstance[] {
  checkCharacter(character);
  checkEffectDefinitions(character, (id) => engine.getFeature(id));
  checkEffectFilter(tags);
  return clone(
    (character.effects ?? []).filter((effect) => {
      const policy = engine.getFeature(effect.feature)?.effect;
      if (!policy) return false;
      return (
        (tags.all ?? []).every((tag) => policy.tags.includes(tag))
        && (!tags.any?.length || tags.any.some((tag) => policy.tags.includes(tag)))
        && !(tags.none ?? []).some((tag) => policy.tags.includes(tag))
        && (policy.removalMethods === undefined
          || (method !== undefined && policy.removalMethods.includes(method)))
      );
    }),
  );
}

export function removeEffects(
  engine: Engine,
  input: Character,
  operation: Extract<EffectOperation, { kind: 'removeEffects' }>,
  eventId: string,
  selected?: string[],
): Character {
  checkEffectOperation(operation);
  const payload = { kind: 'removeEffects', operation, selected };
  const prior = replay(input, eventId, payload);
  if (prior) return prior;
  const character = prepare(engine, input, true);
  const matches = matchingEffects(engine, character, operation.tags, operation.method).map(
    (effect) => effect.id,
  );
  const ids = selected ?? matches;
  if (
    !Array.isArray(ids)
    || ids.some((id) => typeof id !== 'string' || !matches.includes(id))
    || new Set(ids).size !== ids.length
  )
    throw new RuleError('EFFECT_SELECTION', 'Select unique matching effect instances.');
  if (operation.maximum !== undefined && ids.length > operation.maximum)
    throw new RuleError('EFFECT_SELECTION', 'Explicitly select no more than the removal limit.');
  erase(character, ids);
  stamp(character, eventId, payload);
  // Dependencies may become invalid; never retain an effect just to preserve build validity.
  return finish(engine, character, false);
}

/** End effects through authored lifecycle events or consume explicit game-clock ticks. */
export function advanceEffects(
  engine: Engine,
  input: Character,
  event: EffectLifecycleEvent,
  eventId: string,
): Character {
  const clock = 'clock' in event;
  if (clock) {
    if (typeof event.clock !== 'string' || !event.clock || 'event' in event)
      throw new RuleError('EFFECT_EVENT', 'Supply exactly one named game clock.');
    if (!Number.isSafeInteger(event.amount) || event.amount <= 0)
      throw new RuleError('EFFECT_EVENT', 'Supply positive game-clock ticks.');
  } else if (typeof event.event !== 'string' || !event.event) {
    throw new RuleError('EFFECT_EVENT', 'Supply a named lifecycle event.');
  }
  if (event.source) {
    const { character, origin, application } = event.source;
    if (
      (character !== undefined) === (origin !== undefined)
      || typeof application !== 'string'
      || !application
    )
      throw new RuleError(
        'EFFECT_EVENT',
        'Source needs exactly one character or origin and an application ID.',
      );
    if (typeof (character ?? origin) !== 'string' || !(character ?? origin))
      throw new RuleError('EFFECT_EVENT', 'Source identifier must be nonempty text.');
  }
  const payload = { kind: 'advanceEffects', event };
  const prior = replay(input, eventId, payload);
  if (prior) return prior;
  const character = prepare(engine, input, true);
  const ended: string[] = [];
  for (const effect of character.effects ?? []) {
    if (
      event.source
      && (effect.source.character !== event.source.character
        || effect.source.origin !== event.source.origin
        || effect.source.application !== event.source.application)
    )
      continue;
    if (clock) {
      if (effect.remaining?.clock !== event.clock) continue;
      if (effect.remaining.amount <= event.amount) ended.push(effect.id);
      else effect.remaining.amount -= event.amount;
    } else if (engine.getFeature(effect.feature)?.effect?.endOn?.includes(event.event))
      ended.push(effect.id);
  }
  erase(character, ended);
  stamp(character, eventId, payload);
  return finish(engine, character, false);
}

/** Atomic in memory: persist both returned characters together. No partial result on failure. */
export function useEffectAbility(
  engine: Engine,
  actor: Character,
  target: Character,
  ability: string,
  eventId: string,
  selections: Record<string, string[]> = {},
): { actor: Character; target: Character } {
  if (!eventId) throw new RuleError('EVENT_ID', 'An event ID is required.');
  const self = actor.id === target.id;
  if (self && canonical(actor) !== canonical(target))
    throw new RuleError('EFFECT_TARGET', 'Self-targeting requires the same character snapshot.');
  const payload = {
    kind: 'effectAbility',
    actor: actor.id,
    target: target.id,
    ability,
    selections,
  };
  const receipt = `effect-ability/${eventId}`;
  const previousActor = replay(actor, receipt, payload),
    previousTarget = replay(target, receipt, payload);
  if (previousActor || previousTarget) {
    if (!previousActor || !previousTarget)
      throw new RuleError(
        'EFFECT_TRANSACTION',
        'Incomplete effect transaction; restore both saved participants.',
      );
    return { actor: previousActor, target: previousTarget };
  }
  prepare(engine, actor);
  prepare(engine, target);
  const actorResult = engine.evaluate(actor);
  const capability = actorResult.capabilities.find((entry) => entry.id === ability);
  if (!capability?.definition.effects?.length || capability.definition.spendOnOutcomes)
    throw new RuleError('EFFECT_ABILITY', 'An immediate effect ability is required.');
  const operations = capability.definition.effects;
  if (
    Object.keys(selections).some(
      (key) => !/^\d+$/.test(key) || operations[Number(key)]?.kind !== 'removeEffects',
    )
  )
    throw new RuleError('EFFECT_SELECTION', 'Unknown removal operation selection.');
  let paid = useAbility(engine, actor, ability, `effect-use/${eventId}`, {
    actionTracking: 'manual',
  }).character;
  let changed = self ? paid : clone(target);
  for (const [index, operation] of operations.entries()) {
    const id = `${eventId}/${index}`;
    if (operation.kind === 'applyEffect')
      changed = applyEffect(
        engine,
        changed,
        {
          id,
          feature: operation.feature,
          parameters: operation.parameters,
          source: {
            character: actor.id,
            instance: capability.source,
            feature: actorResult.instances.find((instance) => instance.id === capability.source)
              ?.feature,
            application: eventId,
          },
        },
        `effect-operation/${id}`,
      );
    else
      changed = removeEffects(
        engine,
        changed,
        operation,
        `effect-operation/${id}`,
        selections[String(index)],
      );
  }
  stamp(changed, receipt, payload);
  if (self) paid = changed;
  else stamp(paid, receipt, payload);
  return { actor: paid, target: changed };
}
