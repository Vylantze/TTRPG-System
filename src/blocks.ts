import type { Catalogue, Component, Value } from './model.js';
import { RuleError } from './expression.js';

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const safeName = (v: unknown): v is string => typeof v === 'string' && !!v && !['__proto__', 'constructor', 'prototype'].includes(v);

/** Expand declarative composition before ordinary catalogue validation. */
export function compileBlocks(input: Catalogue): Catalogue {
  if (!input?.blocks?.length) return input;
  const blocks = new Map(input.blocks.map((b) => [b.id, b]));
  if (blocks.size !== input.blocks.length) throw new RuleError('BLOCK_ID', 'Duplicate block ID.');
  for (const b of blocks.values()) {
    if (!safeName(b.id) || !Array.isArray(b.components) || !b.components.length) throw new RuleError('BLOCK_SCHEMA', 'Blocks require an ID and components.');
    if (b.parameters !== undefined && !object(b.parameters)) throw new RuleError('BLOCK_SCHEMA', 'Invalid block parameters.');
  }
  const substitute = (value: unknown, args: Record<string, Value>, depth = 0): unknown => {
    if (depth > 64) throw new RuleError('BLOCK_DEPTH', 'Block data is too deep.');
    if (Array.isArray(value)) return value.map((v) => substitute(v, args, depth + 1));
    if (!object(value)) return value;
    if (Object.hasOwn(value, 'argument')) {
      if (Object.keys(value).length !== 1 || !safeName(value.argument) || !Object.hasOwn(args, value.argument)) throw new RuleError('BLOCK_ARGUMENT', 'Unknown block argument.');
      return args[value.argument];
    }
    return Object.fromEntries(Object.entries(value).map(([k, v]) => {
      if (!safeName(k)) throw new RuleError('BLOCK_SCHEMA', 'Unsafe block key.');
      return [k, substitute(v, args, depth + 1)];
    }));
  };
  let expanded = 0;
  const expand = (component: Record<string, unknown>, path: string[] = []): Component[] => {
    if (++expanded > 10000) throw new RuleError('BLOCK_LIMIT', 'Block expansion exceeds 10000 components.');
    if (!object(component) || !safeName(component.id)) throw new RuleError('BLOCK_SCHEMA', 'Invalid block component.');
    if (component.kind !== 'useBlock') return [component as unknown as Component];
    if (component.condition !== undefined) throw new RuleError('BLOCK_SCHEMA', 'Put conditions on atomic blocks.');
    const id = String(component.block), block = blocks.get(id);
    if (!block) throw new RuleError('UNKNOWN_BLOCK', `Unknown block ${id}.`);
    if (path.includes(id) || path.length >= 32) throw new RuleError('BLOCK_CYCLE', `Recursive block cycle or depth limit: ${[...path, id].join(' -> ')}.`);
    const supplied = component.arguments ?? {};
    if (!object(supplied)) throw new RuleError('BLOCK_ARGUMENT', 'Invalid block arguments.');
    const args: Record<string, Value> = {};
    for (const [key, p] of Object.entries(block.parameters ?? {})) {
      if (!safeName(key) || !object(p) || !['string', 'number', 'boolean'].includes(p.kind)) throw new RuleError('BLOCK_ARGUMENT', 'Invalid parameter definition.');
      const v = Object.hasOwn(supplied, key) ? supplied[key] : p.default;
      if (typeof v !== p.kind || (p.options && !p.options.includes(v as Value)) || (typeof v === 'number' && (!Number.isFinite(v) || (p.integer && !Number.isInteger(v)) || v < (p.minimum ?? -Infinity) || v > (p.maximum ?? Infinity)))) throw new RuleError('BLOCK_ARGUMENT', `Invalid argument ${key}.`);
      args[key] = v as Value;
    }
    if (Object.keys(supplied).some((k) => !Object.hasOwn(block.parameters ?? {}, k))) throw new RuleError('BLOCK_ARGUMENT', 'Unknown supplied argument.');
    const children = block.components.flatMap((c) => expand(substitute(c, args) as Record<string, unknown>, [...path, id]));
    return children.map((c) => ({ ...c, id: children.length === 1 ? component.id as string : `${component.id}/${c.id}` }));
  };
  return { ...input, features: input.features.map((f) => ({ ...f, components: f.components.flatMap((c) => expand(c as unknown as Record<string, unknown>)) })) };
}
