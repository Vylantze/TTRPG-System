import { RuleError } from '@/src/expression.js';
import type { Catalogue } from '@/src/model/Catalogue.js';
import type { EffectPolicy } from '@/src/model/EffectPolicy.js';
import type { EffectOperation } from '@/src/model/EffectOperation.js';
import type { EffectInstance } from '@/src/model/EffectInstance.js';
import type { EffectTagFilter } from '@/src/model/EffectTagFilter.js';

function object(value: unknown): asserts value is Record<string, unknown> {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || Object.keys(value).some((key) => ['__proto__', 'constructor', 'prototype'].includes(key))
  )
    throw new RuleError('EFFECT_SCHEMA', 'Expected a safe effect object.');
}
function text(value: unknown): asserts value is string {
  if (
    typeof value !== 'string'
    || !value
    || ['__proto__', 'constructor', 'prototype'].includes(value)
  )
    throw new RuleError('EFFECT_SCHEMA', 'Expected a nonempty safe effect identifier.');
}
function positive(value: unknown): void {
  if (!Number.isSafeInteger(value) || Number(value) <= 0)
    throw new RuleError('EFFECT_SCHEMA', 'Expected a positive safe integer.');
}
function strings(value: unknown): asserts value is string[] {
  if (!Array.isArray(value) || value.length > 10000)
    throw new RuleError('EFFECT_SCHEMA', 'Expected an effect identifier list.');
  value.forEach(text);
  if (new Set(value).size !== value.length)
    throw new RuleError('EFFECT_SCHEMA', 'Duplicate effect identifiers.');
}
function parameters(value: unknown): void {
  if (value === undefined) return;
  object(value);
  if (
    Object.values(value).some(
      (entry) =>
        !['number', 'string', 'boolean'].includes(typeof entry)
        || (typeof entry === 'number' && !Number.isFinite(entry)),
    )
  )
    throw new RuleError('EFFECT_SCHEMA', 'Effect parameters must be finite scalar values.');
}
function duration(value: unknown): void {
  object(value);
  text(value.clock);
  positive(value.amount);
}
export function checkEffectFilter(value: unknown): asserts value is EffectTagFilter {
  object(value);
  if (Object.keys(value).some((key) => !['all', 'any', 'none'].includes(key)))
    throw new RuleError('EFFECT_SCHEMA', 'Unknown tag filter clause.');
  for (const tags of Object.values(value)) strings(tags);
  if (!Object.values(value).some((tags) => (tags as string[]).length))
    throw new RuleError('EFFECT_SCHEMA', 'Removal needs a nonempty tag filter.');
}
export function checkEffectPolicy(value: unknown): asserts value is EffectPolicy {
  object(value);
  strings(value.tags);
  if (value.duration !== undefined) duration(value.duration);
  if (value.endOn !== undefined) strings(value.endOn);
  if (value.removalMethods !== undefined) strings(value.removalMethods);
  if (value.stacking !== undefined) {
    object(value.stacking);
    if (!['stack', 'replace', 'reject'].includes(String(value.stacking.mode)))
      throw new RuleError('EFFECT_SCHEMA', 'Unknown effect stacking mode.');
    if (value.stacking.key !== undefined) text(value.stacking.key);
  }
}
export function checkEffectOperation(
  value: unknown,
  catalogue?: Catalogue,
): asserts value is EffectOperation {
  object(value);
  if (value.kind === 'applyEffect') {
    text(value.feature);
    parameters(value.parameters);
    if (
      catalogue
      && !catalogue.features.some((feature) => feature.id === value.feature && feature.effect)
    )
      throw new RuleError('EFFECT_DEFINITION', 'Application requires an effect-enabled Feature.');
  } else if (value.kind === 'removeEffects') {
    checkEffectFilter(value.tags);
    if (value.maximum !== undefined) positive(value.maximum);
    if (value.method !== undefined) text(value.method);
  } else throw new RuleError('EFFECT_SCHEMA', 'Unknown effect operation.');
}
export function checkEffectInstances(value: unknown): asserts value is EffectInstance[] {
  if (!Array.isArray(value) || value.length > 10000)
    throw new RuleError('EFFECT_SCHEMA', 'Expected at most 10000 effects.');
  const ids = new Set<string>();
  for (const effect of value) {
    object(effect);
    text(effect.id);
    text(effect.feature);
    positive(effect.revision);
    if (ids.has(effect.id))
      throw new RuleError('EFFECT_SCHEMA', 'Duplicate effect application ID.');
    ids.add(effect.id);
    object(effect.source);
    if ((effect.source.character !== undefined) === (effect.source.origin !== undefined))
      throw new RuleError('EFFECT_SCHEMA', 'Supply exactly one source character or origin.');
    if (effect.source.character !== undefined) text(effect.source.character);
    if (effect.source.origin !== undefined) text(effect.source.origin);
    text(effect.source.application);
    if (effect.source.feature !== undefined) text(effect.source.feature);
    if (effect.source.instance !== undefined) text(effect.source.instance);
    parameters(effect.parameters);
    if (effect.remaining !== undefined) duration(effect.remaining);
  }
}
