import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSystemFile, resolveSystemFile, Engine, validateCatalogue, migrateCharacterStructure } from '@/dist/index.js';

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
