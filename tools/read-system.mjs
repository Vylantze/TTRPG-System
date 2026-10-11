import { readFileSync, writeFileSync } from 'node:fs';
import { resolveSystemFile } from '@/dist/system-package.js';

/** Authoring/test helper. Browser loading supplies its own document reader. */
export function readSystem(path) {
  const root = JSON.parse(readFileSync(path, 'utf8')), documents = {};
  const collect = (value) => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.$ref === 'string') {
      const name = value.$ref.split('#')[0];
      if (!Object.hasOwn(documents, name)) {
        documents[name] = JSON.parse(readFileSync(new URL(name, path), 'utf8'));
        collect(documents[name]);
      }
    } else Object.values(value).forEach(collect);
  };
  collect(root);
  return resolveSystemFile(root, documents);
}

/** Preserve the existing package's feature groups when a JS generator edits it. */
export function writeSystem(path, file) {
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  const save = (url, value) => writeFileSync(url, JSON.stringify(value, null, 2) + '\n');
  if (!manifest.features.some((entry) => entry.$ref)) return save(path, file);
  const groups = new Map(), membership = new Map();
  for (const ref of manifest.features) {
    const name = ref.$ref;
    groups.set(name, []);
    for (const feature of JSON.parse(readFileSync(new URL(name, path), 'utf8'))) membership.set(feature.id, name);
  }
  for (const feature of file.features) {
    const owner = feature.id.split('.roll.')[0];
    const name = membership.get(feature.id) ?? membership.get(owner) ?? (feature.roll?.spell ? 'spells.json' : 'features.json');
    groups.get(name).push(feature);
  }
  for (const [name, values] of groups) save(new URL(name, path), values);
  for (const key of ['blocks', 'items', 'itemFeatures']) if (manifest[key]?.$ref) save(new URL(manifest[key].$ref, path), file[key]);
  for (const key of ['system', 'classes']) {
    const variants = {};
    const filename = key === 'system' ? 'definitions.json' : 'classes.json';
    for (const config of file.configurations) {
      const name = Object.keys(variants).find((name) => JSON.stringify(variants[name]) === JSON.stringify(config[key])) ?? `variant-${Object.keys(variants).length + 1}`;
      variants[name] = config[key];
      manifest.configurations.find((entry) => entry.id === config.id)[key] = { $ref: `${filename}#/${name}` };
    }
    save(new URL(filename, path), variants);
  }
  save(path, { ...file, features: manifest.features, blocks: manifest.blocks, items: manifest.items, itemFeatures: manifest.itemFeatures, configurations: manifest.configurations });
}
