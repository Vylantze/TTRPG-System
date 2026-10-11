import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { Engine } from '@/dist/index.js';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const { hasBundledUpdate } = await server.ssrLoadModule('/src/system-updates.ts');
const { reconcilePrototypeCharacters } = await server.ssrLoadModule('/src/prototype-characters.ts');
const catalogue = { id: 'sample', revision: 1, system: { id: 'sample', revision: 1, name: 'Sample', allowMultipleClasses: false, characterLevel: { context: 'totalClassLevels' }, stats: [] }, classes: [{ id: 'class', revision: 1, name: 'Class', levels: {} }], features: [{ id: 'old', revision: 1, name: 'Old', components: [] }] };
const file = { format: 'ttrpg-system', version: 1, id: 'sample', revision: 1, options: {}, features: catalogue.features, configurations: [{ id: 'sample', revision: 1, options: {}, system: catalogue.system, classes: catalogue.classes }] };
const engine = new Engine(catalogue);
const character = (id) => engine.createCharacter(id, id, [{ id: 'main', class: 'class', level: 1 }]);

test('only a newer content version offers an update; legacy version is one', () => {
  assert.equal(hasBundledUpdate(file, { ...file, contentVersion: 2 }), true);
  assert.equal(hasBundledUpdate({ ...file, contentVersion: 2 }, { ...file, contentVersion: 2, name: 'Different JSON' }), false);
  assert.equal(hasBundledUpdate({ ...file, contentVersion: 3 }, { ...file, contentVersion: 2 }), false);
  assert.equal(hasBundledUpdate(file, { ...file, id: 'other', contentVersion: 2 }), false);
  for (const contentVersion of [0, -1, 1.5, '2']) assert.throws(() => hasBundledUpdate(file, { ...file, contentVersion }), /version/);
});

test('manifest asset versions detect targeted updates without comparing content', () => {
  const loaded = { ...file, contentVersion: 2, assetVersions: { 'spells.json': 3, 'classes.json': 1 } };
  assert.equal(hasBundledUpdate(loaded, { ...loaded, assetVersions: { ...loaded.assetVersions, 'spells.json': 4 } }), true);
  assert.equal(hasBundledUpdate(loaded, structuredClone(loaded)), false);
  assert.equal(hasBundledUpdate(loaded, { ...loaded, contentVersion: 1, assetVersions: { 'spells.json': 5 } }), false);
  assert.throws(() => hasBundledUpdate(loaded, { ...loaded, assetVersions: { 'spells.json': -1 } }), /asset version/);
});

test('reload preserves edited compatible characters and rebuilds only incompatible samples', () => {
  const edited = { ...character('edited'), name: 'My edited character', notes: { Story: 'Keep me' } };
  const sample = character('sample'), broken = character('broken');
  sample.roots = [{ id: 'old', feature: 'old', acquiredCharacterLevel: 1 }];
  broken.roots = structuredClone(sample.roots);
  const incoming = { ...file, contentVersion: 2, features: [] };
  const template = { ...character('sample'), contentRevisions: { class: 1 } };
  const result = reconcilePrototypeCharacters({ version: 1, systems: [file], characters: [edited, sample, broken], active: 'broken' }, [template], incoming);
  assert.deepEqual(result.workspace.characters.map((c) => c.id), ['edited', 'sample']);
  assert.equal(result.workspace.characters[0].name, edited.name);
  assert.deepEqual(result.workspace.characters[0].notes, edited.notes);
  assert.deepEqual(result.workspace.characters[1].roots, []);
  assert.deepEqual(result.rebuilt, ['sample']);
  assert.deepEqual(result.removed, ['broken']);
  assert.equal(result.workspace.active, undefined);
});

test('startup cleanup runs again and does not delete unfinished drafts or unloaded-System saves', () => {
  const draft = { ...character('draft'), buildState: 'draft' };
  const invalid = character('invalid');
  invalid.roots = [{ id: 'missing', feature: 'missing', acquiredCharacterLevel: 1 }];
  const workspace = { version: 1, systems: [file], characters: [draft, invalid] };
  assert.deepEqual(reconcilePrototypeCharacters(workspace, []).workspace.characters.map((c) => c.id), ['draft']);
  assert.deepEqual(reconcilePrototypeCharacters(workspace, []).removed, ['invalid']);
  assert.equal(reconcilePrototypeCharacters({ ...workspace, systems: [] }, []).workspace.characters.length, 2);
});

test.after(() => server.close());
