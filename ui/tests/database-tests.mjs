import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { createServer } from 'vite';
import { catalogue } from '@/examples/catalogue.js';
import { Engine } from '@/dist/index.js';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const { WorkspaceDatabase } = await server.ssrLoadModule('/src/WorkspaceDatabase.ts');
const { writeWorkspace, STORAGE_KEY } = await server.ssrLoadModule('/src/workspace.ts');
const file = { format: 'ttrpg-system', version: 1, id: catalogue.system.id, revision: 1, options: {}, features: catalogue.features, configurations: [{ id: catalogue.id, revision: 1, options: {}, system: catalogue.system, classes: catalogue.classes }] };
const character = new Engine(catalogue).createCharacter('hero', 'Hero', [{ id: 'main', class: 'example:adventurer', level: 1 }], [], { draft: true });
const workspace = () => ({ version: 1, systems: [file], characters: [structuredClone(character)], active: 'hero' });

test('database migrates legacy storage once and retains its recovery copy', async () => {
  const values = new Map(), legacy = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  writeWorkspace(legacy, workspace());
  const raw = legacy.getItem(STORAGE_KEY), factory = new IDBFactory();
  const first = new WorkspaceDatabase(factory);
  assert.deepEqual(await first.load(legacy), workspace());
  assert.equal(legacy.getItem(STORAGE_KEY), raw);
  await first.save({ ...workspace(), characters: [{ ...character, name: 'Edited' }] });
  await first.close();
  const second = new WorkspaceDatabase(factory);
  assert.equal((await second.load(legacy)).characters[0].name, 'Edited');
  await second.close();
});

test('database queues edits, preserves unloaded characters, and replaces System snapshots', async () => {
  const factory = new IDBFactory(), db = new WorkspaceDatabase(factory);
  await db.load();
  await db.save(workspace());
  const renamed = { ...file, configurations: [{ ...file.configurations[0], system: { ...file.configurations[0].system, name: 'Renamed' } }] };
  await Promise.all([db.save({ ...workspace(), systems: [renamed] }), db.save({ ...workspace(), systems: [] })]);
  await db.close();
  const reopened = new WorkspaceDatabase(factory);
  const loaded = await reopened.load();
  assert.deepEqual(loaded.systems, []);
  assert.equal(loaded.characters[0].id, character.id);
  await reopened.save({ ...loaded, systems: [renamed] });
  await reopened.close();
  const again = new WorkspaceDatabase(factory);
  assert.equal((await again.load()).systems[0].configurations[0].system.name, 'Renamed');
  await again.close();
});

test('stale tabs cannot overwrite newer database changes', async () => {
  const factory = new IDBFactory(), first = new WorkspaceDatabase(factory), second = new WorkspaceDatabase(factory);
  await first.load();
  await first.save(workspace());
  await second.load();
  await first.save({ ...workspace(), characters: [{ ...character, name: 'Newer' }] });
  await assert.rejects(second.save({ ...workspace(), characters: [] }), /Another tab/);
  await first.close();
  await second.close();
  const reopened = new WorkspaceDatabase(factory);
  assert.equal((await reopened.load()).characters[0].name, 'Newer');
  await reopened.close();
});

test('failed validation leaves the previous transaction intact and later saves work', async () => {
  const factory = new IDBFactory(), db = new WorkspaceDatabase(factory);
  await db.load();
  await db.save(workspace());
  await assert.rejects(db.save({ ...workspace(), systems: [{ ...file, version: 999 }] }));
  await assert.rejects(db.save({ ...workspace(), characters: [character, character] }), /Duplicate/);
  await db.save({ ...workspace(), active: undefined });
  await db.close();
  const reopened = new WorkspaceDatabase(factory);
  assert.equal((await reopened.load()).characters.length, 1);
  await reopened.close();
});

test('an aborted transaction rolls back records and does not poison the save queue', async () => {
  const factory = new IDBFactory(), db = new WorkspaceDatabase(factory);
  await db.load();
  await db.save(workspace());
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (...args) {
    const result = put.apply(this, args);
    if (this.name === 'workspace') this.transaction.abort();
    return result;
  };
  try {
    await assert.rejects(db.save({ ...workspace(), systems: [], characters: [] }), /transaction/i);
  } finally {
    IDBObjectStore.prototype.put = put;
  }
  const observer = new WorkspaceDatabase(factory);
  assert.deepEqual(await observer.load(), workspace());
  await observer.close();
  await db.save({ ...workspace(), characters: [{ ...character, name: 'Recovered' }] });
  await db.close();
  const reopened = new WorkspaceDatabase(factory);
  assert.equal((await reopened.load()).characters[0].name, 'Recovered');
  await reopened.close();
});

test('malformed legacy data does not initialize an empty database', async () => {
  const db = new WorkspaceDatabase(new IDBFactory());
  await assert.rejects(db.load({ getItem: () => '{bad json' }));
  assert.deepEqual(await db.load(), { version: 1, systems: [], characters: [] });
  await db.close();
});

await server.close();
