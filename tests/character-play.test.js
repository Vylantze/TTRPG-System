import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SystemRegistry, reopenCharacter, applyEdit, finalizeCharacter, adjustResource, rollDice, rollFeature, applyFeatureRoll, serializeCharacter, deserializeCharacter } from '@/dist/index.js';
import { exampleCharacter } from '@/examples/dnd2014-character.js';

const file = JSON.parse(readFileSync(new URL('../src/systems/dnd5e-2014/system.json', import.meta.url), 'utf8'));
test('multiclass sample is valid and shares one HP pool; engine cache invalidates on unload', () => {
  const registry = new SystemRegistry();
  registry.load(file);
  const character = JSON.parse(readFileSync(new URL('../src/systems/dnd5e-2014/multiclass-sample.json', import.meta.url), 'utf8'));
  const engine = registry.engineForCharacter(character);
  assert.equal(registry.engineForCharacter({ ...character, name: 'Renamed' }), engine);
  const result = engine.evaluate(character);
  assert.equal(result.status, 'valid');
  assert.equal(result.characterLevel, 5);
  assert.deepEqual(character.progressions.map((p) => p.level), [2, 3]);
  assert.equal(Object.values(result.resources).filter((pool) => pool.key === 'hit-points').length, 1);
  registry.unload(file.id, file.revision);
  assert.throws(() => registry.engineForCharacter(character), /must be loaded/);
  registry.load(file);
  assert.notEqual(registry.engineForCharacter(character), engine);
});
test('finalized samples reopen for race changes and race Features supply speed', () => {
  const { engine, character } = exampleCharacter();
  const finalized = finalizeCharacter(engine, character, 'finalize');
  const draft = reopenCharacter(engine, finalized, 'edit-build');
  assert.equal(draft.buildState, 'draft');
  assert.equal(finalized.buildState, 'finalized');
  const changed = applyEdit(engine, draft, [{ kind: 'select', selection: 'advancement/0/race', picks: [{ id: 'halfling', feature: 'dnd5e:2014:race.lightfoot-halfling' }] }], 'change-race');
  assert.equal(engine.evaluate(changed).stats.walkingSpeed.value, 25);
  const empty = applyEdit(engine, changed, [{ kind: 'select', selection: 'advancement/0/race', picks: [] }], 'no-race');
  assert.equal(engine.evaluate(empty).stats.walkingSpeed.value, 0);
});
test('Second Wind spends its use on roll, persists the result, and applies healing once later', () => {
  const { engine, character } = exampleCharacter({ classes: [{ class: 'fighter', level: 2 }] });
  let ready = finalizeCharacter(engine, character, 'finalize');
  const result = engine.evaluate(ready);
  const hp = Object.values(result.resources).find((pool) => pool.key === 'hit-points');
  const wind = Object.values(result.resources).find((pool) => pool.key === 'second-wind');
  const instance = result.instances.find((item) => item.feature === 'dnd5e:2014:fighter.second-wind.roll.healing');
  ready = adjustResource(engine, ready, hp.id, hp.capacity - hp.current - 3, 'damage');
  const rolled = rollFeature(engine, ready, instance.id, 'heal', () => 0.1);
  assert.equal(rolled.outcome.total, 4);
  assert.equal(rolled.outcome.breakdown, '2 (1d10) + 2');
  assert.equal(engine.evaluate(rolled.character).resources[hp.id].current, hp.capacity - 3);
  assert.equal(engine.evaluate(rolled.character).resources[wind.id].current, 0);
  assert.throws(() => rollFeature(engine, rolled.character, instance.id, 'again'), /Insufficient/);
  assert.throws(() => rollFeature(engine, rolled.character, instance.id, 'heal'), /already recorded/);
  const restored = deserializeCharacter(serializeCharacter(rolled.character), engine);
  assert.deepEqual(restored.rollResults[0], rolled.outcome);
  const applied = applyFeatureRoll(engine, restored, 'heal', 'apply-heal');
  assert.equal(applied.applied, 3);
  assert.equal(engine.evaluate(applied.character).resources[hp.id].current, hp.capacity);
  assert.equal(engine.evaluate(applied.character).resources[wind.id].current, 0);
  assert.throws(() => applyFeatureRoll(engine, applied.character, 'heal', 'apply-twice'), /already applied/);
  assert.equal(engine.evaluate(ready).resources[wind.id].current, 1);
});
test('dice parser supports additive dice and rejects executable or unbounded notation', () => {
  assert.deepEqual(rollDice('2d6 + 2 - 1', () => 0), { total: 3, breakdown: '1 + 1 (2d6) + 2 - 1' });
  assert.throws(() => rollDice('100000d6'), /limits/);
  assert.throws(() => rollDice('alert(1)'), /Unsupported/);
});

test('Roll Features are atomic children and full-health application still completes once', () => {
  const { engine, character } = exampleCharacter({ classes: [{ class: 'fighter', level: 2 }] });
  let ready = finalizeCharacter(engine, character, 'finalize');
  const hp = Object.values(engine.evaluate(ready).resources).find((pool) => pool.key === 'hit-points');
  ready = adjustResource(engine, ready, hp.id, hp.capacity - hp.current, 'fill-hp');
  const rolls = file.features.filter((feature) => feature.roll);
  assert.ok(rolls.length > 100);
  assert.ok(rolls.every((feature) => feature.components.length === 0));
  assert.ok(file.features.every((feature) => !feature.rolls));
  const instance = engine.evaluate(ready).instances.find((item) => item.feature === 'dnd5e:2014:fighter.second-wind.roll.healing');
  const rolled = rollFeature(engine, ready, instance.id, 'full-health-roll', () => 0);
  const applied = applyFeatureRoll(engine, rolled.character, 'full-health-roll', 'full-health-apply');
  assert.equal(applied.applied, 0);
  assert.throws(() => applyFeatureRoll(engine, applied.character, 'full-health-roll', 'repeat'), /already applied/);
});
