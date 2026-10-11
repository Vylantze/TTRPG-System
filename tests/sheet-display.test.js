import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, adjustResource, changeHealth, rollStat, recoverResources, serializeCharacter, deserializeCharacter } from '@/dist/index.js';

function setup() {
  const keys = ['vitality', 'ward', 'successes', 'failures'];
  const features = keys.map((key) => ({ id: key, revision: 1, name: key, components: [{ id: 'tracker', kind: 'trackResource', key, name: key, units: 'points', integer: true, initialAmount: key === 'vitality' ? 10 : 0, ...(key === 'ward' ? {} : { maximum: key === 'vitality' ? 10 : 3 }), recovery: [] }] }));
  const catalogue = { id: 'sheet', revision: 1, classes: [], features, system: { id: 'sheet', revision: 1, name: 'Custom sheet', allowMultipleClasses: false, characterLevel: 0, stats: [{ id: 'bonus', name: 'Bonus', kind: 'derived', expression: 3 }], resetConditions: [{ id: 'rest', name: 'Rest', description: 'Complete a rest.' }], healthRules: { resourceKey: 'vitality', temporaryResourceKey: 'ward', resetResourceKeysOnHealing: ['successes', 'failures'], clearOnReset: { rest: ['ward', 'successes', 'failures'] } }, sheetDisplay: { overview: [{ stat: 'bonus', roll: { dice: '1d20' } }] }, advancement: { 0: keys.map((key) => ({ id: key, kind: 'grantFeature', feature: key })) } } };
  const engine = new Engine(catalogue);
  return { engine, character: engine.createCharacter('test', 'Test'), catalogue };
}
const pool = (engine, character, key) => Object.values(engine.evaluate(character).resources).find((pool) => pool.key === key);

test('System health roles absorb temporary points, clamp healing/damage, and reset counters without hardcoded HP keys', () => {
  const { engine, character } = setup();
  const ward = pool(engine, character, 'ward');
  let next = adjustResource(engine, character, ward.id, 5, 'ward');
  next = changeHealth(engine, next, 'damage', 8, 'damage');
  assert.equal(pool(engine, next, 'ward').current, 0);
  assert.equal(pool(engine, next, 'vitality').current, 7);
  const repeated = changeHealth(engine, next, 'damage', 8, 'damage');
  assert.deepEqual(repeated, next);
  next = changeHealth(engine, next, 'damage', 100, 'zero');
  assert.equal(pool(engine, next, 'vitality').current, 0);
  next = adjustResource(engine, next, pool(engine, next, 'failures').id, 2, 'failures');
  next = changeHealth(engine, next, 'heal', 100, 'healing');
  assert.equal(pool(engine, next, 'vitality').current, 10);
  assert.equal(pool(engine, next, 'failures').current, 0);
  assert.throws(() => changeHealth(engine, next, 'damage', -1, 'negative'));
  assert.throws(() => changeHealth(engine, { ...next, buildState: 'draft' }, 'damage', 1, 'draft'));
});

test('System reset policies clear temporary health and counters; direct supported healing also clears counters', () => {
  const { engine, character } = setup();
  let next = adjustResource(engine, character, pool(engine, character, 'ward').id, 9, 'ward');
  next = adjustResource(engine, next, pool(engine, next, 'failures').id, 2, 'failures');
  next = recoverResources(engine, next, 'rest', 'rest');
  assert.equal(pool(engine, next, 'ward').current, 0);
  assert.equal(pool(engine, next, 'failures').current, 0);
  next = changeHealth(engine, next, 'damage', 10, 'zero');
  next = adjustResource(engine, next, pool(engine, next, 'failures').id, 2, 'failures2');
  next = adjustResource(engine, next, pool(engine, next, 'vitality').id, 1, 'heal');
  assert.equal(pool(engine, next, 'failures').current, 0);
});

test('Configured free stat checks persist, retain their breakdown, and retry without rerolling', () => {
  const { engine, character } = setup();
  const next = rollStat(engine, character, 'bonus', 'check', () => 0);
  assert.equal(next.statRolls[0].total, 4);
  assert.match(next.statRolls[0].breakdown, /1 \(1d20\) \+ 3/);
  assert.deepEqual(rollStat(engine, next, 'bonus', 'check', () => 0.99), next);
  assert.deepEqual(deserializeCharacter(serializeCharacter(next)).statRolls, next.statRolls);
  assert.throws(() => rollStat(engine, character, 'unknown', 'invalid'));
  assert.throws(() => new Engine({ ...setup().catalogue, system: { ...setup().catalogue.system, sheetDisplay: { overview: [{ stat: 'missing' }] } } }), /Unknown sheet stat/);
  assert.throws(() => new Engine({ ...setup().catalogue, system: { ...setup().catalogue.system, healthRules: { resourceKey: 'missing' } } }), /Unknown sheet resource/);
});
