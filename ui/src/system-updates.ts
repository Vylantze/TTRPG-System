import type { SystemFile } from '@/src/index';

/** Legacy bundles predate explicit content versions and are treated as version 1. */
export function hasBundledUpdate(loaded: SystemFile, bundled: Pick<SystemFile, 'id' | 'revision' | 'contentVersion'>): boolean {
  if (bundled.contentVersion !== undefined && (!Number.isSafeInteger(bundled.contentVersion) || bundled.contentVersion < 1)) throw new Error('Invalid bundled System content version.');
  return loaded.id === bundled.id && loaded.revision === bundled.revision && (bundled.contentVersion ?? 1) > (loaded.contentVersion ?? 1);
}
