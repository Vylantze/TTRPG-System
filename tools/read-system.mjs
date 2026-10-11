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

/** Auxiliary content and sample saves use the same version envelope as linked assets. */
export function readAsset(path) {
  const document = JSON.parse(readFileSync(path, 'utf8'));
  return document.data ?? document;
}
export function writeAsset(path, data) {
  const previous = JSON.parse(readFileSync(path, 'utf8'));
  writeFileSync(path, JSON.stringify({ assetVersion: previous.assetVersion ?? '1.0.0', data }, null, 2) + '\n');
}

/** Preserve the existing package's feature groups when a JS generator edits it. */
export function writeSystem(path, file) {
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  const save = (url, value) => {
    const existing = JSON.parse(readFileSync(url, 'utf8'));
    if (url.href !== path.href && existing.assetVersion !== undefined) value = { assetVersion: existing.assetVersion, data: value };
    if (JSON.stringify(existing) !== JSON.stringify(value)) writeFileSync(url, JSON.stringify(value, null, 2) + '\n');
  };
  if (!manifest.features.some((entry) => entry.$ref)) return save(path, file);
  const groups = new Map(), membership = new Map();
  for (const ref of manifest.features) {
    const name = ref.$ref;
    groups.set(name, []);
    const asset = JSON.parse(readFileSync(new URL(name, path), 'utf8'));
    for (const feature of asset.data ?? asset) membership.set(feature.id, name);
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
