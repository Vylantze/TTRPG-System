import { loadSystemFile } from '@/src/index';
import bundledUrl from '@/src/systems/dnd5e-2014/system.json?url';
import { SystemAssetDatabase } from '@/ui/src/SystemAssetDatabase';

// Vite emits each JSON separately and rewrites its URL for the deployment base.
const bundledParts = Object.fromEntries(Object.entries(import.meta.glob('@/src/systems/dnd5e-2014/*.json', { query: '?url', import: 'default', eager: true }) as Record<string, string>).map(([path, url]) => [path.split('/').at(-1), url]));

export async function loadBundledSystem() {
  const read = async (url: string) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load System document: ${url}`);
    return response.text();
  };
  return loadSystemFile(await read(bundledUrl), (path) => {
    const url = bundledParts[path];
    if (!url) throw new Error(`Missing bundled System document: ${path}`);
    return read(url);
  }, typeof indexedDB === 'undefined' ? undefined : new SystemAssetDatabase(indexedDB));
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
  return loadSystemFile(await manifest.text(), async (path) => {
    const file = byPath.get(base + path);
    if (!file) throw new Error(`Missing ${path}. Select the manifest and all referenced files together.`);
    return file.text();
  });
}
