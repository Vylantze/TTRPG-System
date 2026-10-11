import type { SystemFile } from '@/src/index';

/** Legacy bundles predate explicit content versions and are treated as version 1. */
export function hasBundledUpdate(loaded: SystemFile, bundled: Pick<SystemFile, 'id' | 'revision' | 'contentVersion' | 'assetVersions'>): boolean {
  if (bundled.contentVersion !== undefined && (!Number.isSafeInteger(bundled.contentVersion) || bundled.contentVersion < 1)) throw new Error('Invalid bundled System content version.');
  if (bundled.assetVersions !== undefined && (!bundled.assetVersions || typeof bundled.assetVersions !== 'object' || Array.isArray(bundled.assetVersions) || Object.values(bundled.assetVersions).some((version) => !Number.isSafeInteger(version) || version < 1))) throw new Error('Invalid bundled asset version.');
  if (loaded.id !== bundled.id || loaded.revision !== bundled.revision || (bundled.contentVersion ?? 1) < (loaded.contentVersion ?? 1)) return false;
  return (bundled.contentVersion ?? 1) > (loaded.contentVersion ?? 1) || Object.entries(bundled.assetVersions ?? {}).some(([path, version]) => version > (loaded.assetVersions?.[path] ?? 0));
}
