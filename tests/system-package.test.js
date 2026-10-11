import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSystemFile, resolveSystemFile, Engine, validateCatalogue, migrateCharacterStructure, recoverResources, adjustResource } from '@/dist/index.js';

const system = { id: 'package', revision: 1, name: 'Package', allowMultipleClasses: false, characterLevel: 0, stats: [] };
const manifest = { format: 'ttrpg-system', version: 1, contentVersion: 1, id: 'package', revision: 1, options: {}, features: [{ $ref: 'features.json' }], configurations: [{ id: 'package', revision: 1, options: {}, system: { $ref: 'definitions.json#/base' }, classes: { $ref: 'classes.json' } }] };
const parts = { 'features.json': [{ id: 'feature', revision: 1, name: 'Feature', components: [] }], 'definitions.json': { base: system }, 'classes.json': [] };

test('references assemble a complete System without changing inline exports', async () => {
  const file = resolveSystemFile(manifest, parts);
  assert.equal(file.features[0].id, 'feature');
  assert.equal(file.configurations[0].system.name, 'Package');
  assert.deepEqual(resolveSystemFile(file), file);
  const calls = [];
  const loaded = await loadSystemFile(manifest, async (path) => {
    calls.push(path);
    return JSON.stringify(parts[path]);
  });
  assert.deepEqual(loaded, file);
  assert.equal(new Set(calls).size, calls.length);
  new Engine({ id: file.id, revision: 1, system: file.configurations[0].system, classes: [], features: file.features });
});

test('missing files, invalid pointers, cycles, and external or escaping paths reject the whole package', async () => {
  assert.throws(() => resolveSystemFile(manifest, {}), /Missing referenced file/);
  for (const ref of ['../secret.json', 'https://example.com/content.json', '/absolute.json', 'features.json#/missing', 'features.json#bad', 'features.json#/bad~2escape']) {
    const input = { ...manifest, features: [{ $ref: ref }] };
    assert.throws(() => resolveSystemFile(input, parts), /reference|pointer/i);
  }
  assert.throws(() => resolveSystemFile(manifest, { ...parts, 'features.json': [{ $ref: 'features.json' }] }), /Cyclic/);
  assert.throws(() => resolveSystemFile({ ...manifest, features: [{ $ref: 'features.json', extra: true }] }, parts), /only a \$ref/);
  await assert.rejects(loadSystemFile(manifest, async () => {
    throw new Error('offline');
  }), /offline/);
  assert.throws(() => resolveSystemFile(manifest, { ...parts, 'features.json': [{ id: 'broken' }] }), /./);
});

test('System reset buttons validate ordered unique event IDs and labels', () => {
  const catalogue = { id: 'test', revision: 1, system: { ...system, resetButtons: [{ event: 'camp', label: 'Make camp' }] }, classes: [], features: [] };
  assert.deepEqual(validateCatalogue(catalogue), []);
  for (const buttons of [[{ event: 'camp', label: '' }], [{ event: 'camp', label: 'Camp' }, { event: 'camp', label: 'Camp again' }]]) {
    assert.ok(validateCatalogue({ ...catalogue, system: { ...system, resetButtons: buttons } }).length);
  }
});

test('reorganizing package definitions leaves character revision pins unchanged', () => {
  const features = ['first', 'second'].map((id) => ({ id, revision: 1, name: id, components: [] }));
  const catalogue = { id: 'package', revision: 1, system, classes: [], features };
  const before = new Engine(catalogue);
  const after = new Engine({ ...catalogue, features: [...features].reverse() });
  const character = before.createCharacter('hero', 'Hero', []);
  assert.equal(JSON.stringify(migrateCharacterStructure(character, before, after)), JSON.stringify(character));
});

test('asset versions reuse cached documents and fetch only changed parts', async () => {
  const root = { ...manifest, assetVersions: Object.fromEntries(Object.keys(parts).map((path) => [path, 1])) };
  const documents = Object.fromEntries(Object.entries(parts).map(([path, data]) => [path, { assetVersion: 1, data }]));
  const stored = new Map(), reads = [];
  const cache = { get: async (key) => stored.get(key), set: async (key, value) => {
    stored.set(key, value);
  } };
  const read = async (path) => {
    reads.push(path);
    return documents[path];
  };
  const first = await loadSystemFile(root, read, cache);
  assert.equal(reads.length, 3);
  reads.length = 0;
  assert.deepEqual(await loadSystemFile(root, read, cache), first);
  assert.deepEqual(reads, []);
  root.assetVersions['features.json'] = 2;
  documents['features.json'] = { assetVersion: 2, data: [{ ...parts['features.json'][0], name: 'Updated' }] };
  assert.equal((await loadSystemFile(root, read, cache)).features[0].name, 'Updated');
  assert.deepEqual(reads, ['features.json']);
  const snapshot = structuredClone([...stored]);
  root.assetVersions['features.json'] = 3;
  await assert.rejects(loadSystemFile(root, read, cache), /version mismatch/);
  assert.deepEqual([...stored], snapshot);
  documents['features.json'] = { assetVersion: 3, data: [{ id: 'broken' }] };
  await assert.rejects(loadSystemFile(root, read, cache));
  assert.deepEqual([...stored], snapshot);
  delete root.assetVersions['classes.json'];
  await assert.rejects(loadSystemFile(root, read, cache), /Missing asset version/);
});

test('Features reference System reset conditions, with amounts remaining on the shared resource', () => {
  const rules = { id: 'resets', revision: 1, system: { ...system, resetConditions: [{ id: 'camp', name: 'Make camp', description: 'Complete a camp rest.' }] }, classes: [{ id: 'class', revision: 1, name: 'Class', levels: { 1: [{ id: 'a', kind: 'grantFeature', feature: 'a' }, { id: 'b', kind: 'grantFeature', feature: 'a' }] } }], features: [{ id: 'a', revision: 1, name: 'Ability', components: [{ id: 'uses', kind: 'trackResource', key: 'uses', name: 'Uses', units: 'uses', maximum: 5, initialAmount: 5, recovery: [{ event: 'camp', amount: 1 }] }] }] };
  const engine = new Engine(rules);
  let character = engine.createCharacter('hero', 'Hero', [{ id: 'main', class: 'class', level: 1 }]);
  const pool = Object.values(engine.evaluate(character).resources)[0];
  character = adjustResource(engine, character, pool.id, -3, 'spend');
  const restored = recoverResources(engine, character, 'camp', 'rest');
  assert.equal(engine.evaluate(restored).resources[pool.id].current, 3);
  assert.deepEqual(recoverResources(engine, restored, 'camp', 'rest'), restored);
  assert.throws(() => recoverResources(engine, character, 'typo', 'bad'), /Unknown System reset/);
  rules.features[0].components[0].recovery[0].event = 'typo';
  assert.ok(validateCatalogue(rules).some((error) => error.code === 'RECOVERY'));
});
