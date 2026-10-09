import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Engine, adjustResource, updateInventory, itemProperties, parseSystemFile, deserializeCharacter } from '@/dist/index.js';
import { createDnd2014Engine } from '@/dist/systems/dnd5e-2014/index.js';

const engine = createDnd2014Engine();
const characters = JSON.parse(readFileSync(new URL('../src/systems/dnd5e-2014/starter-characters.json', import.meta.url), 'utf8'));

test('inventory is separate from acquired Features and equipment changes recalculate AC', () => {
  const fighter = characters[0];
  const before = engine.evaluate(fighter);
  assert.equal(before.stats.armorClass.value, 17);
  const inventory = fighter.inventory.map((entry) => ({ ...entry, equipped: false }));
  const after = updateInventory(engine, fighter, inventory, 'remove-armor');
  assert.equal(engine.evaluate(after).stats.armorClass.value, 9);
  assert.deepEqual(engine.evaluate(after).instances, before.instances);
  assert(!engine.catalogue.features.some((feature) => feature.id.includes(':item.')));
  assert.equal(itemProperties(engine.catalogue, 'dnd5e:2014:item.greataxe')['Damage type'], 'Slashing');
  assert.equal(itemProperties(engine.catalogue, 'dnd5e:2014:item.greataxe')['Damage dice'], '1d12');
  assert.deepEqual(updateInventory(engine, after, inventory, 'remove-armor'), after);
  assert.throws(() => updateInventory(engine, after, fighter.inventory, 'remove-armor'), /reused/);
  assert.equal(engine.evaluate(updateInventory(engine, after, fighter.inventory, 'equip-armor')).stats.armorClass.value, 17);
});

test('inventory rejects unknown items, invalid quantities, duplicate identities and conflicting armor slots', () => {
  const fighter = characters[0];
  for (const inventory of [[{ id: 'x', item: 'missing', quantity: 1, equipped: false }], [{ ...fighter.inventory[0], quantity: 0 }], [fighter.inventory[0], fighter.inventory[0]], [...fighter.inventory, { id: 'extra', item: 'dnd5e:2014:item.leather-armor', quantity: 1, equipped: true }]]) {
    assert.throws(() => updateInventory(engine, fighter, inventory, 'invalid'));
    assert.throws(() => deserializeCharacter(JSON.stringify({ ...fighter, inventory }), engine));
  }
});

test('item Features detect recursive cycles and invalid stat modifiers without entering character selections', () => {
  const catalogue = structuredClone(engine.catalogue);
  catalogue.itemFeatures[0].features = [catalogue.itemFeatures[0].id];
  assert.throws(() => new Engine(catalogue), /cycle/);
  const bad = structuredClone(engine.catalogue);
  bad.itemFeatures[0].modifiers = [{ kind: 'modifyStat', id: 'bad', stat: 'missing', operation: 'add', value: 1 }];
  assert.throws(() => new Engine(bad), /stat/i);
  const file = JSON.parse(readFileSync(new URL('../src/systems/dnd5e-2014/system.json', import.meta.url), 'utf8'));
  file.configurations[0].system.sheetSections[0].rows[0].stat = 'missing';
  assert.throws(() => parseSystemFile(file), /displayed stat/);
});

test('resource adjustments enforce ownership, capacity, integer amounts and idempotency', () => {
  const fighter = characters[0], result = engine.evaluate(fighter);
  const pool = Object.values(result.resources).find((resource) => resource.key === 'second-wind');
  assert(pool);
  assert(!result.capabilities.some((capability) => capability.definition.name === 'Arcane Recovery'));
  const reduced = adjustResource(engine, fighter, pool.id, -1, 'decrease');
  assert.equal(engine.evaluate(reduced).resources[pool.id].current, 0);
  assert.deepEqual(adjustResource(engine, reduced, pool.id, -1, 'decrease'), reduced);
  assert.throws(() => adjustResource(engine, reduced, pool.id, -1, 'below-minimum'));
  assert.throws(() => adjustResource(engine, fighter, pool.id, 1, 'above-maximum'));
  assert.throws(() => adjustResource(engine, fighter, pool.id, -0.5, 'fraction'));
  assert.throws(() => adjustResource(engine, fighter, 'unowned', -1, 'unowned'));
  assert.throws(() => adjustResource(engine, { ...fighter, buildState: 'draft' }, pool.id, -1, 'draft'));
  const restored = adjustResource(engine, reduced, pool.id, 1, 'increase');
  assert.equal(engine.evaluate(restored).resources[pool.id].current, 1);
  assert.deepEqual(restored.resources[pool.id].grants, reduced.resources[pool.id].grants);
});

test('manual resource adjustments support fractional unbounded trackers and protect reservations', () => {
  const engine = new Engine({ id: 'test', revision: 1, system: { id: 'test', revision: 1, name: 'Test', allowMultipleClasses: false, characterLevel: 0, stats: [] }, classes: [], features: [{ id: 'tracker', revision: 1, name: 'Tracker', components: [{ id: 'energy', kind: 'trackResource', key: 'energy', name: 'Energy', units: 'points', minimum: -5, initialAmount: 2, recovery: [] }] }] });
  const character = engine.createCharacter('test', 'Test', [], [{ id: 'tracker', feature: 'tracker', acquiredCharacterLevel: 0 }]);
  const pool = Object.values(engine.evaluate(character).resources)[0];
  const raised = adjustResource(engine, character, pool.id, 100.5, 'raise');
  assert.equal(engine.evaluate(raised).resources[pool.id].current, 102.5);
  character.pending.reserve = { ability: 'pending', costs: { [pool.id]: 3 }, spendOnOutcomes: ['hit'] };
  assert.throws(() => adjustResource(engine, character, pool.id, -5, 'reserved'));
  const lowered = adjustResource(engine, character, pool.id, -4, 'lower');
  assert.equal(engine.evaluate(lowered).resources[pool.id].current, -2);
  assert.equal(engine.evaluate(lowered).resources[pool.id].available, 0);
});

test('manual adjustments retain expenditure-based legacy pool semantics', () => {
  const engine = new Engine({ id: 'legacy', revision: 1, system: { id: 'legacy', revision: 1, name: 'Legacy', allowMultipleClasses: false, characterLevel: 0, stats: [] }, classes: [], features: [{ id: 'tracker', revision: 1, name: 'Tracker', components: [{ id: 'energy', kind: 'defineResource', key: 'energy', scope: 'character', units: 'uses', capacity: 3, integer: true, recovery: [] }] }] });
  const character = engine.createCharacter('test', 'Test', [], [{ id: 'tracker', feature: 'tracker', acquiredCharacterLevel: 0 }]);
  const pool = Object.values(engine.evaluate(character).resources)[0];
  const lowered = adjustResource(engine, character, pool.id, -2, 'lower');
  assert.equal(engine.evaluate(lowered).resources[pool.id].available, 1);
  assert.equal(lowered.resources[pool.id].spent, 2);
});
