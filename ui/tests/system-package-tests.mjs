import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { IDBFactory } from 'fake-indexeddb';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { Engine } from '@/dist/index.js';

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const { loadSelectedSystem } = await server.ssrLoadModule('/src/load-system-package.ts');
const { SystemAssetDatabase } = await server.ssrLoadModule('/src/SystemAssetDatabase.ts');
const { CharacterBuilder } = await server.ssrLoadModule('/src/CharacterBuilder.tsx');
const system = { id: 'package', revision: 1, name: 'Package', allowMultipleClasses: false, characterLevel: 0, stats: [], resetConditions: [{ id: 'short-rest', name: 'Take a breather', description: 'Take a break.' }, { id: 'long-rest', name: 'Make camp', description: 'Finish resting.' }, { id: 'dawn', name: 'New day', description: 'Sunrise.' }, { id: 'hidden', name: 'Hidden condition', description: 'Triggered elsewhere.', showButton: false }] };
const file = { format: 'ttrpg-system', version: 1, id: 'package', revision: 1, options: {}, features: [], configurations: [{ id: 'package', revision: 1, options: {}, system, classes: [] }] };

test('file import accepts self-contained exports and complete packages, rejecting missing parts', async () => {
  assert.deepEqual(await loadSelectedSystem([new File([JSON.stringify(file)], 'export.json')]), file);
  const manifest = new File([JSON.stringify({ ...file, features: [{ $ref: 'features.json' }] })], 'system.json');
  assert.deepEqual(await loadSelectedSystem([manifest, new File(['[]'], 'features.json')]), file);
  await assert.rejects(loadSelectedSystem([manifest]), /Missing features.json/);
});

test('System-labelled reset controls appear once above the tabs on every sheet tab', () => {
  const engine = new Engine({ id: 'package', revision: 1, system, classes: [], features: [] });
  const character = { ...engine.createCharacter('hero', 'Hero', []), buildState: 'finalized' };
  for (const view of ['stats', 'resources', 'items', 'notes']) {
    globalThis.window = { location: { hash: `#characters/hero?view=${view}` } };
    const html = renderToStaticMarkup(React.createElement(CharacterBuilder, { engine, character, update() {}, openFeature() {}, report() {} }));
    assert.ok(html.indexOf('aria-label="Character resets"') < html.indexOf('aria-label="Character sections"'));
    assert.ok(!html.includes('>Hidden condition</button>'));
    assert.ok(html.includes('title="Take a break."'));
    for (const label of ['Take a breather', 'Make camp', 'New day']) assert.equal(html.split(`>${label}</button>`).length - 1, 1);
  }
  delete globalThis.window;
});

test('asset database persists across loaders and replaces only the selected asset', async () => {
  const factory = new IDBFactory();
  const first = new SystemAssetDatabase(factory);
  await first.set('spells', { version: 1, document: { assetVersion: 1, data: [] } });
  await first.set('classes', { version: 1, document: { assetVersion: 1, data: ['class'] } });
  const reopened = new SystemAssetDatabase(factory);
  assert.equal((await reopened.get('spells')).version, 1);
  await reopened.set('spells', { version: 2, document: { assetVersion: 2, data: ['spell'] } });
  assert.equal((await first.get('spells')).version, 2);
  assert.equal((await first.get('classes')).version, 1);
});

test.after(() => server.close());
