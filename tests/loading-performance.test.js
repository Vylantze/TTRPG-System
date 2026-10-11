import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSystemFile, parseSystemFile, SystemRegistry, FeatureTextIndex } from '@/dist/index.js';
import { retainSystemSnapshot } from '@/dist/system-snapshot.js';

const file = { format: 'ttrpg-system', version: 1, id: 'cache', revision: 1, options: {}, features: [], configurations: [{ id: 'cache', revision: 1, options: {}, system: { id: 'cache', revision: 1, name: 'Cache', allowMultipleClasses: false, characterLevel: 0, stats: [] }, classes: [] }] };

test('immutable validated snapshots reuse engines while public mutable imports remain isolated', () => {
  const snapshot = retainSystemSnapshot(parseSystemFile(file));
  assert.equal(parseSystemFile(snapshot), snapshot);
  assert.throws(() => {
    snapshot.configurations[0].system.name = 'Changed';
  }, TypeError);
  const first = new SystemRegistry(), second = new SystemRegistry();
  first.load(snapshot);
  second.load(snapshot);
  assert.equal(first.createEngine(file.id, 1), second.createEngine(file.id, 1));
  first.unload(file.id, 1);
  assert.throws(() => first.createEngine(file.id, 1), /Required System/);
  assert.ok(second.createEngine(file.id, 1));
  const changed = structuredClone(file);
  changed.configurations[0].system.name = 'New version';
  const replacement = new SystemRegistry();
  replacement.load(changed);
  assert.notEqual(replacement.createEngine(file.id, 1), second.createEngine(file.id, 1));
  changed.configurations[0].system.name = 'External mutation';
  assert.equal(replacement.createEngine(file.id, 1).catalogue.system.name, 'New version');
  const invalid = structuredClone(file);
  invalid.features = [{ id: 'invalid' }];
  assert.throws(() => parseSystemFile(invalid));
});

test('package reads run concurrently with bounded fan-out and preserve reference order', async () => {
  const parts = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`part-${index}.json`, [{ id: `feature-${index}`, revision: 1, name: `Feature ${index}`, components: [] }]]));
  let active = 0, peak = 0;
  const calls = [];
  const loaded = await loadSystemFile({ ...file, features: Object.keys(parts).map(($ref) => ({ $ref })) }, async (path) => {
    active++;
    peak = Math.max(peak, active);
    calls.push(path);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    return parts[path];
  });
  assert.equal(peak, 4);
  assert.equal(new Set(calls).size, 9);
  assert.deepEqual(loaded.features.map((feature) => feature.id), Array.from({ length: 9 }, (_, index) => `feature-${index}`));
});

test('failed parallel packages publish no cached data', async () => {
  const writes = [];
  const input = { ...file, assetVersions: { 'a.json': '1.0.0', 'b.json': '1.0.0' }, features: [{ $ref: 'a.json' }, { $ref: 'b.json' }] };
  await assert.rejects(loadSystemFile(input, async (path) => {
    if (path === 'b.json') throw new Error('read failed');
    return { assetVersion: '1.0.0', data: [] };
  }, { async get() {}, async set(...args) { writes.push(args); } }), /read failed/);
  assert.deepEqual(writes, []);
});

test('cached rule links isolate returned arrays and account for exclusions', () => {
  const index = new FeatureTextIndex([{ id: 'wind', revision: 1, name: 'Second Wind', components: [] }]);
  const first = index.resolve('Use Second Wind.');
  first[0].features.push('corruption');
  assert.deepEqual(index.resolve('Use Second Wind.')[0].features, ['wind']);
  assert.deepEqual(index.resolve('Use Second Wind.', ['wind']), []);
});
