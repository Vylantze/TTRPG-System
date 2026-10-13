import {
  compareVersions,
  releaseVersion,
  versionChange,
  classifyReleaseChange,
  parseSystemFile,
  type SystemFile,
} from '@/src/index';
import { retainSystemSnapshot } from '@/src/system-snapshot';
import type { Workspace } from '@/ui/src/types/Workspace';

/** Compare release metadata only; patch content is validated before it is applied. */
export function bundledUpdateKind(
  loaded: SystemFile,
  bundled: Pick<SystemFile, 'id' | 'revision' | 'contentVersion' | 'assetVersions'>,
): 'none' | 'patch' | 'minor' | 'major' {
  const incoming = releaseVersion(bundled.contentVersion),
    current = releaseVersion(loaded.contentVersion);
  if (
    bundled.assetVersions !== undefined
    && (!bundled.assetVersions
      || typeof bundled.assetVersions !== 'object'
      || Array.isArray(bundled.assetVersions))
  )
    throw new Error('Invalid bundled asset version.');
  for (const version of Object.values(bundled.assetVersions ?? {})) {
    try {
      releaseVersion(version);
    } catch {
      throw new Error('Invalid bundled asset version.');
    }
  }
  if (
    loaded.id !== bundled.id
    || loaded.revision !== bundled.revision
    || compareVersions(incoming, current) < 0
  )
    return 'none';
  let kind = versionChange(current, incoming);
  const ranks = { none: 0, patch: 1, minor: 2, major: 3 };
  for (const [path, version] of Object.entries(bundled.assetVersions ?? {})) {
    const previous = loaded.assetVersions?.[path];
    const assetKind = previous === undefined ? 'minor' : versionChange(previous, version);
    if (ranks[assetKind] > ranks[kind]) kind = assetKind;
  }
  return kind;
}

/** Patches never offer a reload; minor/major releases do. */
export function hasBundledUpdate(
  loaded: SystemFile,
  bundled: Pick<SystemFile, 'id' | 'revision' | 'contentVersion' | 'assetVersions'>,
): boolean {
  return ['minor', 'major'].includes(bundledUpdateKind(loaded, bundled));
}

/** A patch cannot alter mechanics, layout, character saves, or pinned definitions. */
export function applySystemPatch(
  workspace: Workspace,
  existing: SystemFile,
  incoming: unknown,
): Workspace {
  if (!workspace.systems.includes(existing)) return workspace;
  const replacement = retainSystemSnapshot(parseSystemFile(incoming));
  if (bundledUpdateKind(existing, replacement) !== 'patch')
    throw new Error('This update requires a System reload.');
  if (!['none', 'patch'].includes(classifyReleaseChange(existing, replacement)))
    throw new Error(
      'The patch changes rules or layout and must be published as a minor or major release.',
    );
  return {
    ...workspace,
    systems: workspace.systems.map((file) => (file === existing ? replacement : file)),
  };
}
