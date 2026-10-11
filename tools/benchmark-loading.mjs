import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { loadSystemFile, SystemRegistry } from '@/dist/index.js';
import { retainSystemSnapshot } from '@/dist/system-snapshot.js';

const root = new URL('../src/systems/dnd5e-2014/', import.meta.url);
const manifest = await readFile(new URL('system.json', root), 'utf8');
async function measure(name, task) {
  const start = performance.now();
  const result = await task();
  console.log(`${name}: ${Math.round(performance.now() - start)} ms`);
  return result;
}
const file = retainSystemSnapshot(await measure('Cold package validation', () => loadSystemFile(manifest, (path) => readFile(new URL(path, root), 'utf8'))));
for (let run = 0; run < 3; run++) {
  await measure(run ? 'Reused snapshot engine' : 'First snapshot engine', () => {
    const registry = new SystemRegistry();
    registry.load(file);
    return registry.createEngine(file.id, file.revision);
  });
}
