import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, assignEquipment, adjustResource, recoverResources, deployCompanion, validateCatalogue } from '@/dist/index.js';

function fixture(level = 3) {
  const data = {
    id: 'equipment', revision: 1,
    system: { id: 'equipment', revision: 1, name: 'Equipment test', allowMultipleClasses: true, characterLevel: { context: 'totalClassLevels' }, stats: [
      { id: 'defense', name: 'Defense', kind: 'derived', expression: 10 },
      { id: 'limit', name: 'Limit', kind: 'derived', expression: 1 },
      { id: 'bonus', name: 'Bonus', kind: 'derived', expression: 1 },
    ] },
    classes: [{ id: 'maker', revision: 1, name: 'Maker', levels: { 1: [{ id: 'package', kind: 'grantFeature', feature: 'package' }] } }],
    features: [
      { id: 'package', revision: 1, name: 'Package', components: [{ id: 'later', kind: 'grantFeature', feature: 'later', atClassLevel: 3 }, { id: 'first', kind: 'grantFeature', feature: 'effect' }, { id: 'second', kind: 'grantFeature', feature: 'second' }] },
      { id: 'later', revision: 1, name: 'Later', companion: { kind: 'object', stats: ['later'], resources: [], modes: ['A', 'B'] }, components: [{ id: 'stat', kind: 'defineStat', stat: { id: 'later', name: 'Later', kind: 'derived', expression: 3 } }] },
      { id: 'effect', revision: 1, name: 'Effect', equipmentEffect: { categories: ['Armor'], group: 'gear', capacityStat: 'limit', attunement: true, itemFeatures: ['defense'], bonusCapacity: { stat: 'bonus', itemProperty: 'special' } }, components: [{ id: 'charges', kind: 'trackResource', key: 'charges', name: 'Charges', units: 'charges', maximum: 6, initialAmount: 6, integer: true, condition: { context: 'equipmentAssigned' }, recovery: [{ event: 'dawn', amount: 0, dice: '1d4' }] }] },
      { id: 'second', revision: 1, name: 'Second', equipmentEffect: { categories: ['Armor'], group: 'gear', capacityStat: 'limit', bonusCapacity: { stat: 'bonus', itemProperty: 'special' } }, components: [] },
    ],
    items: [{ id: 'armor', revision: 1, name: 'Armor', category: 'Armor', features: [] }, { id: 'special', revision: 1, name: 'Special armor', category: 'Armor', features: ['special'] }],
    itemFeatures: [{ id: 'defense', name: 'Defense', modifiers: [{ id: 'defense', kind: 'modifyStat', stat: 'defense', operation: 'add', value: 2 }] }, { id: 'special', name: 'Special', properties: { special: true } }],
  };
  const engine = new Engine(data);
  const character = engine.createCharacter('test', 'Test', [{ id: 'maker', class: 'maker', level }]);
  character.inventory = [{ id: 'armor', item: 'armor', quantity: 1, equipped: true }, { id: 'other', item: 'armor', quantity: 1, equipped: false }, { id: 'special', item: 'special', quantity: 1, equipped: false }];
  const instances = engine.evaluate(character).instances;
  return { engine, character, data, effect: instances.find((instance) => instance.feature === 'effect').id, second: instances.find((instance) => instance.feature === 'second').id, later: instances.find((instance) => instance.feature === 'later').id };
}

test('Level-gated child follows class level and records its actual acquisition event', () => {
  const { engine, character, later } = fixture();
  let result = engine.evaluate(character);
  assert.equal(result.stats.later.value, 3);
  assert.equal(result.instances.find((instance) => instance.id === later).acquiredEvent, 3);
  character.progressions[0].level = 2;
  result = engine.evaluate(character);
  assert.equal(result.status, 'valid');
  assert.equal(result.stats.later, undefined);
});

test('Infused bonuses require equipped owned items and attunement; restricted capacity cannot fund ordinary items', () => {
  const { engine, effect, second, character: initial } = fixture();
  let character = initial;
  character = assignEquipment(engine, character, effect, { inventory: 'armor', attuned: false });
  assert.equal(engine.evaluate(character).stats.defense.value, 10);
  character = assignEquipment(engine, character, effect, { inventory: 'armor', attuned: true });
  assert.equal(engine.evaluate(character).stats.defense.value, 12);
  assert.throws(() => assignEquipment(engine, character, second, { inventory: 'armor', attuned: false }), /one technique/);
  assert.throws(() => assignEquipment(engine, character, second, { inventory: 'other', attuned: false }), /Too many/);
  character = assignEquipment(engine, character, second, { inventory: 'special', attuned: false });
  assert.equal(engine.evaluate(character).status, 'valid');
  character.inventory[0].equipped = false;
  assert.equal(engine.evaluate(character).stats.defense.value, 10);
});

test('Dawn dice recovery rolls once per shared pool and replay never rolls again', () => {
  const { engine, effect, character: initial } = fixture();
  let character = initial;
  character = assignEquipment(engine, character, effect, { recipient: 'Ally armor', item: 'armor', attuned: true });
  const pool = Object.values(engine.evaluate(character).resources)[0];
  character = adjustResource(engine, character, pool.id, -6, 'spend');
  let rolls = 0;
  const random = () => {
    rolls++;
    return 0.5;
  };
  character = recoverResources(engine, character, 'dawn', 'dawn', undefined, random);
  assert.equal(engine.evaluate(character).resources[pool.id].current, 3);
  assert.equal(rolls, 1);
  assert.deepEqual(recoverResources(engine, character, 'dawn', 'dawn', undefined, random), character);
  assert.equal(rolls, 1);
});

test('Companion mode is validated and irrelevant or forged deployments are invalid', () => {
  const { engine, character, later } = fixture();
  assert.throws(() => deployCompanion(engine, character, later, true, 'deploy', undefined, 'unknown'), /Unknown companion mode/);
  const next = deployCompanion(engine, character, later, true, 'deploy', undefined, 'B');
  assert.equal(next.companionModes[later], 'B');
  next.progressions[0].level = 2;
  assert.ok(engine.evaluate(next).diagnostics.some((entry) => entry.code === 'COMPANION'));
});

test('New authoring metadata rejects invalid references and dice', () => {
  const { data } = fixture();
  data.features[2].equipmentEffect.itemFeatures = ['missing'];
  assert.ok(validateCatalogue(data).length);
  data.features[2].equipmentEffect.itemFeatures = ['defense'];
  data.features[2].components[0].recovery[0].dice = '999999d4';
  assert.ok(validateCatalogue(data).length);
});

test('Orphaned assignments and companions can be removed incrementally after retraining', () => {
  const { engine, character: initial, effect, second, later } = fixture();
  let character = assignEquipment(engine, initial, effect, { inventory: 'armor', attuned: true });
  character = assignEquipment(engine, character, second, { inventory: 'special', attuned: false });
  character = deployCompanion(engine, character, later, true, 'create', undefined, 'A');
  character.progressions[0].level = 0;
  assert.equal(engine.evaluate(character).status, 'invalid');
  character = assignEquipment(engine, character, effect);
  character = assignEquipment(engine, character, second);
  character = deployCompanion(engine, character, later, false, 'dismiss');
  assert.equal(engine.evaluate(character).status, 'valid');
});
