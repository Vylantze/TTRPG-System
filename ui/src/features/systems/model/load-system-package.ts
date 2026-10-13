import { loadPackageAsync } from '@/ui/src/features/systems/model/system-worker-client';
import type { SystemFile } from '@/src/index';
import bundledUrl from '@/src/systems/dnd5e-2014/system.json?url';

// Vite emits each JSON separately and rewrites its URL for the deployment base.
const bundledParts = Object.fromEntries(Object.entries(import.meta.glob('@/src/systems/dnd5e-2014/*.json', { query: '?url', import: 'default', eager: true }) as Record<string, string>).map(([path, url]) => [path.split('/').at(-1), url]));

let pending: Promise<SystemFile> | undefined;
let previous: { key: string; file: SystemFile } | undefined;
export function loadBundledSystem() {
  pending ??= readBundledSystem().finally(() => {
    pending = undefined;
  });
  return pending;
}
async function readBundledSystem() {
  const read = async (url: string) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load System document: ${url}`);
    return response.text();
  };
  const manifest = JSON.parse(await read(bundledUrl));
  const key = JSON.stringify([manifest.id, manifest.revision, manifest.contentVersion, Object.entries(manifest.assetVersions ?? {}).sort()]);
  if (!import.meta.env.DEV && previous?.key === key) return previous.file;
  const file = await loadPackageAsync(manifest, undefined, bundledParts);
  if (!import.meta.env.DEV) previous = { key, file };
  return file;
}

/** Select system.json and its referenced files together; exports also load alone. */
export async function loadSelectedSystem(files: File[]) {
  const manifest = files.find((file) => file.name.toLowerCase() === 'system.json') ?? (files.length === 1 ? files[0] : undefined);
  if (!manifest) throw new Error('Select system.json together with its referenced JSON files.');
  const byPath = new Map<string, File>();
  for (const file of files) {
    const path = file.webkitRelativePath || file.name;
    if (byPath.has(path)) throw new Error(`Duplicate System file: ${path}`);
    byPath.set(path, file);
  }
  const base = manifest.webkitRelativePath?.slice(0, -manifest.name.length) ?? '';
  const documents = Object.fromEntries([...byPath].filter(([path]) => path.startsWith(base)).map(([path, file]) => [path.slice(base.length), file]));
  return loadPackageAsync(await manifest.text(), documents);
}
