import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { Engine } from '@/dist/index.js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import uiPackage from '@/ui/package.json' with { type: 'json' };

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const { version } = uiPackage;
const { hasBundledUpdate, bundledUpdateKind, applySystemPatch } = await server.ssrLoadModule('/src/features/systems/model/system-updates.ts');
const { UiVersion } = await server.ssrLoadModule('/src/app/UiVersion.tsx');
const { reconcilePrototypeCharacters } = await server.ssrLoadModule('/src/features/characters/model/prototype-characters.ts');
const catalogue = { id: 'sample', revision: 1, system: { id: 'sample', revision: 1, name: 'Sample', allowMultipleClasses: false, characterLevel: { context: 'totalClassLevels' }, stats: [] }, classes: [{ id: 'class', revision: 1, name: 'Class', levels: {} }], features: [{ id: 'old', revision: 1, name: 'Old', components: [] }] };
const file = { format: 'ttrpg-system', version: 1, id: 'sample', revision: 1, options: {}, features: catalogue.features, configurations: [{ id: 'sample', revision: 1, options: {}, system: catalogue.system, classes: catalogue.classes }] };
const engine = new Engine(catalogue);
const character = (id) => engine.createCharacter(id, id, [{ id: 'main', class: 'class', level: 1 }]);

test('patches refresh without reload prompts while minor and major releases require reload', () => {
  assert.equal(bundledUpdateKind(file, { ...file, contentVersion: '1.0.1' }), 'patch');
  assert.equal(hasBundledUpdate(file, { ...file, contentVersion: '1.0.1' }), false);
  assert.equal(hasBundledUpdate(file, { ...file, contentVersion: '1.1.0' }), true);
  assert.equal(hasBundledUpdate(file, { ...file, contentVersion: '2.0.0' }), true);
  assert.equal(hasBundledUpdate({ ...file, contentVersion: '1.1.0' }, { ...file, contentVersion: '1.1.0', name: 'Different JSON' }), false);
  assert.equal(hasBundledUpdate({ ...file, contentVersion: '1.2.0' }, { ...file, contentVersion: '1.1.0' }), false);
  assert.equal(hasBundledUpdate(file, { ...file, id: 'other', contentVersion: '1.1.0' }), false);
  assert.equal(bundledUpdateKind({ ...file, contentVersion: 5 }, { ...file, contentVersion: '1.1.0' }), 'minor');
  for (const contentVersion of [0, -1, 1.5, '2', '1.01.0']) assert.throws(() => hasBundledUpdate(file, { ...file, contentVersion }), /version/);
});

test('manifest asset versions detect targeted updates without comparing content', () => {
  const loaded = { ...file, contentVersion: '1.1.0', assetVersions: { 'spells.json': '1.0.3', 'classes.json': '1.0.0' } };
  assert.equal(bundledUpdateKind(loaded, { ...loaded, assetVersions: { ...loaded.assetVersions, 'spells.json': '1.0.4' } }), 'patch');
  assert.equal(hasBundledUpdate(loaded, { ...loaded, assetVersions: { ...loaded.assetVersions, 'spells.json': '1.1.0' } }), true);
  assert.equal(bundledUpdateKind(loaded, { ...loaded, assetVersions: { ...loaded.assetVersions, 'spells.json': '2.0.0' } }), 'major');
  assert.equal(hasBundledUpdate(loaded, structuredClone(loaded)), false);
  assert.equal(hasBundledUpdate(loaded, { ...loaded, contentVersion: '1.0.0', assetVersions: { 'spells.json': '2.0.0' } }), false);
  assert.throws(() => hasBundledUpdate(loaded, { ...loaded, assetVersions: { 'spells.json': -1 } }), /asset version/);
});

test('automatic patches preserve edited saves exactly and reject mislabelled rules changes', () => {
  const existing = { ...file, contentVersion: '1.0.0' };
  const edited = { ...character('edited'), name: 'Keep my name', notes: { Story: 'Keep this' } };
  const workspace = { version: 1, systems: [existing], characters: [edited], active: edited.id };
  const patch = { ...existing, contentVersion: '1.0.1', features: existing.features.map((feature) => ({ ...feature, description: 'Corrected text' })) };
  const next = applySystemPatch(workspace, existing, patch);
  assert.equal(next.characters, workspace.characters);
  assert.equal(next.active, workspace.active);
  assert.equal(next.systems[0].features[0].description, 'Corrected text');
  assert.equal(Object.isFrozen(next.systems[0]), true);
  assert.throws(() => applySystemPatch(workspace, existing, { ...patch, features: [] }), /minor or major/);
  assert.throws(() => applySystemPatch(workspace, existing, { ...patch, contentVersion: '1.1.0' }), /reload/);
  assert.equal(applySystemPatch({ ...workspace, systems: [] }, existing, patch).systems.length, 0);
});

test('UI version note reads the published package version', () => {
  const html = renderToStaticMarkup(createElement(UiVersion));
  assert.match(html, /class="ui-version"/);
  assert.ok(html.includes(`UI version ${version}`));
  assert.ok(html.replace(/<!--[\s\S]*?-->/g, '').includes(`>${version}</div>`));
  assert.doesNotMatch(html, />UI v/);
});

test('reload preserves edited compatible characters and rebuilds only incompatible samples', () => {
  const edited = { ...character('edited'), name: 'My edited character', notes: { Story: 'Keep me' } };
  const sample = character('sample'), broken = character('broken');
  sample.roots = [{ id: 'old', feature: 'old', acquiredCharacterLevel: 1 }];
  broken.roots = structuredClone(sample.roots);
  const incoming = { ...file, contentVersion: '2.0.0', features: [] };
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
