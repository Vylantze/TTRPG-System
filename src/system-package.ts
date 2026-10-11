import { parseSystemFile, type SystemFile } from '@/src/system-loader.js';
import { RuleError } from '@/src/expression.js';
import type { SystemAssetCache } from '@/src/types/SystemAssetCache.js';
import { releaseVersion } from '@/src/version-policy.js';

const limit = 20_000_000;
function versions(input: unknown): Record<string, string> | undefined {
  const value = (input as { assetVersions?: unknown })?.assetVersions;
  if (value === undefined) return;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RuleError('SYSTEM_VERSION', 'Invalid asset versions.');
  for (const [path, version] of Object.entries(value)) {
    reference({ $ref: path });
    try {
      releaseVersion(version);
    } catch { throw new RuleError('SYSTEM_VERSION', 'Invalid asset version.'); }
    if (path.includes('#')) throw new RuleError('SYSTEM_VERSION', 'Invalid asset version.');
  }
  return Object.fromEntries(Object.entries(value).map(([path, version]) => [path, releaseVersion(version)]));
}
function asset(value: unknown, path: string, expected?: Record<string, string>): unknown {
  if (!expected) return value;
  const entry = value as { assetVersion?: unknown; data?: unknown };
  let version: string | undefined;
  try {
    if (entry?.assetVersion !== undefined) version = releaseVersion(entry.assetVersion);
  } catch { /* Mismatched or malformed assets are rejected below. */ }
  if (!Object.hasOwn(expected, path) || !entry || version !== expected[path] || !Object.hasOwn(entry, 'data')) throw new RuleError('SYSTEM_VERSION', `Asset version mismatch: ${path}`);
  return entry.data;
}
function document(input: unknown): unknown {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > limit) throw new RuleError('SYSTEM_SIZE', 'System document exceeds 20 MB.');
  return JSON.parse(text);
}
function reference(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.hasOwn(value, '$ref')) return;
  const ref = (value as Record<string, unknown>).$ref;
  if (typeof ref !== 'string' || Object.keys(value).length !== 1) throw new RuleError('SYSTEM_REFERENCE', 'A reference must contain only a $ref string.');
  const [path, pointer, extra] = ref.split('#');
  if (!/^[\w.-]+(?:\/[\w.-]+)*\.json$/.test(path) || path.split('/').some((part) => part === '.' || part === '..') || extra !== undefined || (pointer !== undefined && pointer !== '' && !pointer.startsWith('/'))) throw new RuleError('SYSTEM_REFERENCE', `Invalid package-local reference: ${ref}`);
  return ref;
}
function walk(value: unknown, visit: (ref: string) => void, depth = 0): void {
  if (depth > 96) throw new RuleError('SYSTEM_REFERENCE', 'System references are too deep.');
  const ref = reference(value);
  if (ref) visit(ref);
  else if (Array.isArray(value)) value.forEach((entry) => walk(entry, visit, depth + 1));
  else if (value && typeof value === 'object') Object.values(value).forEach((entry) => walk(entry, visit, depth + 1));
}

/** Resolve package-root relative JSON references. No filesystem or network access. */
export function resolveSystemFile(input: unknown, documents: Record<string, unknown> = {}): SystemFile {
  const root = document(input), expected = versions(root);
  const parsed = new Map<string, unknown>();
  let bytes = 0;
  let nodes = 0;
  const resolve = (value: unknown, chain: string[] = [], depth = 0): unknown => {
    if (++nodes > 2_000_000) throw new RuleError('SYSTEM_SIZE', 'Expanded System has too many values.');
    if (depth > 96) throw new RuleError('SYSTEM_REFERENCE', 'System references are too deep.');
    const ref = reference(value);
    if (ref) {
      if (chain.includes(ref)) throw new RuleError('SYSTEM_REFERENCE', `Cyclic reference: ${ref}`);
      const [path, pointer] = ref.split('#');
      if (!parsed.has(path)) {
        if (!Object.hasOwn(documents, path)) throw new RuleError('SYSTEM_REFERENCE', `Missing referenced file: ${path}`);
        if (parsed.size >= 128) throw new RuleError('SYSTEM_REFERENCE', 'Too many referenced files.');
        parsed.set(path, asset(document(documents[path]), path, expected));
      }
      let target = parsed.get(path);
      for (const token of pointer ? pointer.slice(1).split('/') : []) {
        if (/~(?![01])/u.test(token)) throw new RuleError('SYSTEM_REFERENCE', `Invalid JSON pointer: ${ref}`);
        const key = token.replaceAll('~1', '/').replaceAll('~0', '~');
        if (!target || typeof target !== 'object' || !Object.hasOwn(target, key)) throw new RuleError('SYSTEM_REFERENCE', `Unresolved JSON pointer: ${ref}`);
        target = (target as Record<string, unknown>)[key];
      }
      return resolve(target, [...chain, ref], depth + 1);
    }
    if (Array.isArray(value)) return value.flatMap((entry) => {
      const resolved = resolve(entry, chain, depth + 1);
      return reference(entry) && Array.isArray(resolved) ? resolved : [resolved];
    });
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, resolve(entry, chain, depth + 1)]));
    bytes += typeof value === 'string' ? value.length * 3 : 8;
    if (bytes > limit * 3) throw new RuleError('SYSTEM_SIZE', 'Expanded System exceeds size limit.');
    return value;
  };
  return parseSystemFile(resolve(root));
}

/** The host supplies file access; missing parts never publish a partial System. */
export async function loadSystemFile(input: unknown, read: (path: string) => Promise<unknown>, cache?: SystemAssetCache): Promise<SystemFile> {
  const root = document(input), documents: Record<string, unknown> = Object.create(null);
  const expected = versions(root);
  const identity = root as { id: string; revision: number };
  const pending: { key: string; version: string; document: unknown }[] = [];
  const queue: string[] = [];
  const seen = new Set<string>();
  const collect = (ref: string) => {
    const path = ref.split('#')[0];
    if (!seen.has(path)) {
      if (seen.size >= 128) throw new RuleError('SYSTEM_REFERENCE', 'Too many referenced files.');
      seen.add(path);
      queue.push(path);
    }
  };
  walk(root, collect);
  let bytes = 0;
  while (queue.length) {
    await Promise.all(queue.splice(0, 4).map(async (path) => {
      if (expected && !Object.hasOwn(expected, path)) throw new RuleError('SYSTEM_VERSION', `Missing asset version: ${path}`);
      const version = expected?.[path];
      const key = JSON.stringify([identity.id, identity.revision, path]);
      const cached = version !== undefined ? await cache?.get(key) : undefined;
      let value: unknown;
      if (cached?.version === version && cached !== undefined) {
        try {
          value = document(cached.document);
          asset(value, path, expected);
        } catch { value = undefined; }
      }
      if (value === undefined) {
        value = document(await read(path));
        if (version !== undefined) pending.push({ key, version, document: value });
      }
      bytes += new TextEncoder().encode(JSON.stringify(value)).length;
      if (bytes > limit) throw new RuleError('SYSTEM_SIZE', 'Referenced System documents exceed 20 MB.');
      documents[path] = value;
      walk(asset(value, path, expected), collect);
    }));
  }
  const file = resolveSystemFile(root, documents);
  await Promise.all(pending.map((entry) => cache?.set(entry.key, { version: entry.version, document: entry.document })));
  return file;
}
