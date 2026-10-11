import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { Engine } from '@/dist/index.js';

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const { loadSelectedSystem } = await server.ssrLoadModule('/src/load-system-package.ts');
const { CharacterBuilder } = await server.ssrLoadModule('/src/CharacterBuilder.tsx');
const system = { id: 'package', revision: 1, name: 'Package', allowMultipleClasses: false, characterLevel: 0, stats: [], resetButtons: [{ event: 'short-rest', label: 'Take a breather' }, { event: 'long-rest', label: 'Make camp' }, { event: 'dawn', label: 'New day' }] };
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
    for (const label of ['Take a breather', 'Make camp', 'New day']) assert.equal(html.split(`>${label}</button>`).length - 1, 1);
  }
  delete globalThis.window;
});

test.after(() => server.close());
