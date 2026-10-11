import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, SystemRegistry, migrateCharacterStructure, featureRollExpression, validateCatalogue } from '@/dist/index.js';

const fixture = () => ({ id: 'audit', revision: 1, system: { id: 'audit', revision: 1, name: 'Audit', allowMultipleClasses: true, characterLevel: { context: 'maximumClassLevel' }, stats: [] }, classes: [{ id: 'a', revision: 1, name: 'A', levels: { 1: [{ id: 'root', kind: 'grantFeature', feature: 'root' }] } }, { id: 'b', revision: 1, name: 'B', levels: {} }], features: [{ id: 'root', revision: 1, name: 'Root', components: [{ id: 'pool', kind: 'defineResource', key: 'uses', scope: 'instance', units: 'uses', integer: true, capacity: 10, recovery: [] }] }] });

test('literal false acquisition conditions are rejected rather than granting Features', () => {
  for (const kind of ['grantFeature', 'chooseFeatures']) {
    const c = fixture();
    c.features.push({ id: 'child', revision: 1, name: 'Child', components: [] });
    c.features[0].components.push(kind === 'grantFeature' ? { id: 'disabled', kind, feature: 'child', condition: false } : { id: 'disabled', kind, minimum: 1, maximum: 1, candidates: { ids: ['child'] }, condition: false });
    assert.ok(validateCatalogue(c).some((d) => d.code === (kind === 'grantFeature' ? 'CONDITIONAL_GRANT' : 'CONDITIONAL_CHOICE')));
  }
});

test('scoped resource expenditure survives nesting a previously direct Feature', () => {
  for (const scope of ['instance', 'parent']) {
    const c = fixture();
    c.features[0].components[0].scope = scope;
    const before = new Engine(c), next = structuredClone(c);
    next.classes[0].levels[1] = [{ id: 'root', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { ids: ['root'] } }];
    const after = new Engine(next), character = before.createCharacter('hero', 'Hero', [{ id: 'main', class: 'a', level: 1 }]);
    const pool = Object.values(before.evaluate(character).resources)[0];
    character.resources[pool.id] = { spent: 8 };
    const migrated = migrateCharacterStructure(character, before, after);
    assert.equal(Object.values(after.evaluate(migrated).resources)[0].available, 2);
  }
});

test('level-gated descendants use the System character-level formula instead of event count', () => {
  const c = fixture();
  c.features[0].components = [{ id: 'later', kind: 'grantFeature', feature: 'child', atClassLevel: 2 }];
  c.features.push({ id: 'child', revision: 1, name: 'Child', components: [] });
  const engine = new Engine(c), character = engine.createCharacter('hero', 'Hero', [{ id: 'b', class: 'b', level: 2 }, { id: 'a', class: 'a', level: 2 }]);
  assert.equal(engine.evaluate(character).instances.find((i) => i.feature === 'child').acquiredCharacterLevel, 2);
});

test('merging shared resource pools preserves expenditure from both old pools', () => {
  const data = fixture();
  data.features[0].components[0] = { id: 'pool', kind: 'trackResource', key: 'first', name: 'Uses', units: 'uses', integer: true, maximum: 3, initialAmount: 3, recovery: [] };
  data.features.push({ id: 'second', revision: 1, name: 'Second', components: [{ ...data.features[0].components[0], key: 'second' }] });
  data.features[0].components.push({ id: 'second', kind: 'grantFeature', feature: 'second' });
  const before = new Engine(data), next = structuredClone(data);
  next.features[1].components[0].key = 'first';
  const after = new Engine(next), character = before.createCharacter('hero', 'Hero', [{ id: 'main', class: 'a', level: 1 }]);
  for (const pool of Object.values(before.evaluate(character).resources)) character.resources[pool.id] = { spent: 1, current: 2 };
  const migrated = migrateCharacterStructure(character, before, after);
  const pools = Object.values(after.evaluate(migrated).resources);
  assert.equal(pools.length, 1);
  assert.equal(pools[0].available, 1);
  assert.equal(Object.keys(migrated.resources).length, 1);
});

test('equivalent explicit and default options reuse an engine', () => {
  const c = fixture(), registry = new SystemRegistry();
  registry.load({ format: 'ttrpg-system', version: 1, id: c.system.id, revision: 1, options: { example: { default: false, values: [false] } }, features: c.features, configurations: [{ id: c.id, revision: 1, options: { example: false }, system: c.system, classes: c.classes }] });
  assert.equal(registry.createEngine('audit', 1), registry.createEngine('audit', 1, { example: false }));
});

test('spell dice scale by character level or the selected slot and casting ability', () => {
  const cantrip = { id: 'damage', label: 'Damage', dice: '1d10', characterScaling: [{ level: 5, count: 2 }, { level: 11, count: 3 }, { level: 17, count: 4 }] };
  for (const [level, dice] of [[1, '1d10'], [5, '2d10'], [11, '3d10'], [17, '4d10']]) assert.equal(featureRollExpression(cantrip, {}, { characterLevel: level, stats: {} }), dice);
  const heal = { id: 'heal', label: 'Heal', dice: '1d8', bonus: { castingAbility: true }, slotScaling: { baseLevel: 1, dicePerLevel: 1 } };
  assert.equal(featureRollExpression(heal, {}, { stats: { 'custom.casting': { value: 3 } } }, { slotLevel: 3, bonusStat: 'custom.casting' }), '3d8 + 3');
  assert.throws(() => featureRollExpression(heal, {}, { stats: {} }, { slotLevel: 3 }), /unavailable stat/);
});
