import { releaseVersion } from '@/src/version-policy.js';

/** Decode auxiliary versioned documents; legacy saves are still accepted. */
export function assetData(input: unknown): unknown {
  if (!input || typeof input !== 'object' || !Object.hasOwn(input, 'assetVersion')) return input;
  const entry = input as { assetVersion: unknown; data?: unknown };
  releaseVersion(entry.assetVersion);
  if (!Object.hasOwn(entry, 'data')) throw new Error('Versioned asset is missing data.');
  return entry.data;
}
