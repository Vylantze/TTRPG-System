import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, applyEdit, useAbility, settleAbility, recoverResources, serializeCharacter, deserializeCharacter, validateCatalogue, parseSystemFile } from '@/dist/index.js';

const feature = (id, components, extra = {}) => ({ id, name: id, revision: 1, components, ...extra });
const grant = (id, target) => ({ id, kind: 'grantFeature', feature: target });
const root = (id) => ({ id, feature: id, acquiredCharacterLevel: 0 });
const catalogue = (features, blocks) => ({ id: 'blocks', revision: 1, system: { id: 'blocks', revision: 1, name: 'Blocks', allowMultipleClasses: true, characterLevel: { context: 'totalClassLevels' }, stats: [{ id: 'base', name: 'Base', kind: 'input', default: 5 }] }, classes: [], features, ...(blocks ? { blocks } : {}) });
const stat = { id: 'capacity', name: 'Capacity', kind: 'derived', expression: { stat: 'base' } };
const tracker = () => feature('tracker', [{ id: 'stat', kind: 'defineStat', stat: structuredClone(stat) }, { id: 'pool', kind: 'trackResource', key: 'energy', name: 'Energy', units: 'points', maximum: { stat: 'capacity' }, initialAmount: 2, recovery: [{ event: 'rest', amount: 'full' }] }]);
const pool = (engine, character) => Object.values(engine.evaluate(character).resources)[0];
const spell = (pending = false) => feature('ability', [{ id: 'use', kind: 'grantCapability', name: 'Use', costs: [{ key: 'energy', amount: 1 }], ...(pending ? { spendOnOutcomes: ['hit'] } : {}) }], { resources: [{ id: 'energy', key: 'energy' }] });

test('recursive parameterized blocks compile to single-stat operations and reject cycles', () => {
  const blocks = [
    { id: 'atomic', parameters: { target: { kind: 'string' }, rank: { kind: 'number', integer: true } }, components: [{ id: 'floor', kind: 'modifyStat', stat: { argument: 'target' }, operation: 'floor', value: { argument: 'rank' } }] },
    { id: 'training', parameters: { target: { kind: 'string' } }, components: [{ id: 'nested', kind: 'useBlock', block: 'atomic', arguments: { target: { argument: 'target' }, rank: 7 } }] },
  ];
  const authored = catalogue([feature('skill', [{ id: 'training', kind: 'useBlock', block: 'training', arguments: { target: 'base' } }])], blocks);
  const engine = new Engine(authored);
  const character = engine.createCharacter('c', 'C', [], [root('skill')]);
  assert.equal(engine.evaluate(character).stats.base.value, 7);
  assert.equal(engine.getFeature('skill').components[0].kind, 'modifyStat');
  assert.equal(authored.features[0].components[0].kind, 'useBlock');
  const cyclic = structuredClone(authored);
  cyclic.blocks[0].components = [{ id: 'cycle', kind: 'useBlock', block: 'training', arguments: { target: 'base' } }];
  assert.throws(() => new Engine(cyclic), /cycle/i);
  const bad = structuredClone(authored);
  bad.features[0].components[0].arguments.target = 4;
  assert.throws(() => new Engine(bad), /argument/i);
  const file = { format: 'ttrpg-system', version: 1, id: 'blocks', revision: 1, options: {}, features: authored.features, blocks, configurations: [{ id: 'blocks', revision: 1, options: {}, system: authored.system, classes: [] }] };
  assert.equal(parseSystemFile(JSON.stringify(file)).blocks.length, 2);
});

test('created stats and shared trackers follow all active providers without duplicating capacity', () => {
  const engine = new Engine(catalogue([tracker(), feature('a', [grant('tracker', 'tracker')]), feature('b', [grant('tracker', 'tracker')]), spell()]));
  let character = engine.createCharacter('c', 'C', [], [root('a'), root('b'), root('ability')]);
  assert.equal(engine.evaluate(character).status, 'valid');
  assert.equal(pool(engine, character).capacity, 5);
  assert.equal(pool(engine, character).current, 2);
  assert.equal(pool(engine, character).providers.length, 2);
  character = applyEdit(engine, character, [{ kind: 'removeRoot', id: 'a' }], 'remove-a');
  assert.equal(pool(engine, character).current, 2);
  character = applyEdit(engine, character, [{ kind: 'removeRoot', id: 'b' }], 'remove-b');
  const result = engine.evaluate(character);
  assert.equal(result.stats.capacity, undefined);
  assert.deepEqual(result.resources, {});
  assert.equal(result.status, 'invalid');
  character = applyEdit(engine, character, [{ kind: 'root', acquisition: root('a') }], 'restore');
  assert.equal(pool(engine, character).current, 2);
});

test('capacity edits preserve current amounts; explicit assignment grants apply once and roundtrip', () => {
  const bonus = feature('bonus', [{ id: 'grant', kind: 'grantResource', key: 'energy', amount: 2 }]);
  const engine = new Engine(catalogue([tracker(), spell(), bonus]));
  let character = engine.createCharacter('c', 'C', [], [root('tracker'), root('ability')]);
  const ability = engine.evaluate(character).capabilities[0].id;
  character = useAbility(engine, character, ability, 'use').character;
  assert.equal(pool(engine, character).current, 1);
  character = applyEdit(engine, character, [{ kind: 'input', stat: 'base', value: 9 }], 'grow');
  assert.equal(pool(engine, character).capacity, 9);
  assert.equal(pool(engine, character).current, 1);
  character = applyEdit(engine, character, [{ kind: 'root', acquisition: root('bonus') }], 'bonus');
  assert.equal(pool(engine, character).current, 3);
  character = deserializeCharacter(serializeCharacter(character), engine);
  assert.equal(pool(engine, character).current, 3);
  character = applyEdit(engine, character, [{ kind: 'removeRoot', id: 'bonus' }], 'remove');
  character = applyEdit(engine, character, [{ kind: 'root', acquisition: root('bonus') }], 'readd');
  assert.equal(pool(engine, character).current, 3);
  character = recoverResources(engine, character, 'rest', 'rest');
  assert.equal(pool(engine, character).current, 9);
});

test('reservations settle against the shared current amount and release without spending', () => {
  const engine = new Engine(catalogue([tracker(), spell(true)]));
  let character = engine.createCharacter('c', 'C', [], [root('tracker'), root('ability')]);
  const ability = engine.evaluate(character).capabilities[0].id;
  character = useAbility(engine, character, ability, 'reserve').character;
  assert.equal(pool(engine, character).current, 2);
  assert.equal(pool(engine, character).available, 1);
  character = settleAbility(character, 'reserve', 'miss', 'miss');
  assert.equal(pool(engine, character).available, 2);
  character = useAbility(engine, character, ability, 'reserve2').character;
  character = settleAbility(character, 'reserve2', 'hit', 'hit');
  assert.equal(pool(engine, character).current, 1);
});

test('trackers support negative ranges and no maximum but cannot reset an unbounded pool to full', () => {
  const f = feature('free', [{ id: 'pool', kind: 'trackResource', key: 'free', name: 'Free', units: 'points', minimum: -10, initialAmount: -2, recovery: [{ event: 'rest', amount: 3 }] }]);
  const engine = new Engine(catalogue([f]));
  let character = engine.createCharacter('c', 'C', [], [root('free')]);
  assert.equal(pool(engine, character).current, -2);
  assert.equal(pool(engine, character).available, 8);
  character = recoverResources(engine, character, 'rest', 'rest');
  assert.equal(pool(engine, character).current, 1);
  const invalid = structuredClone(f);
  invalid.components[0].recovery[0].amount = 'full';
  assert.ok(validateCatalogue(catalogue([invalid])).length);
  const bounded = structuredClone(f);
  bounded.components[0].key = 'energy';
  bounded.components[0].maximum = -1;
  const boundedEngine = new Engine(catalogue([bounded, spell()]));
  const negative = boundedEngine.createCharacter('c', 'C', [], [root('free'), root('ability')]);
  assert.equal(boundedEngine.evaluate(negative).status, 'valid');
  const spent = useAbility(boundedEngine, negative, boundedEngine.evaluate(negative).capabilities[0].id, 'spend').character;
  assert.equal(pool(boundedEngine, spent).current, -3);
});

test('conflicting stat definitions, stat cycles, and multiple direct trackers are rejected', () => {
  const first = tracker(), second = tracker();
  second.id = 'second';
  second.components[0].stat = { ...stat, expression: 99 };
  assert.throws(() => new Engine(catalogue([first, second])), /Conflicting definition/);
  const cycle = tracker();
  cycle.components[0].stat.expression = { stat: 'capacity' };
  assert.throws(() => new Engine(catalogue([cycle])), /cycle/i);
  const multiple = tracker();
  multiple.components.push({ ...multiple.components[1], id: 'another', key: 'other' });
  assert.throws(() => new Engine(catalogue([multiple])), /only one resource/i);
});

test('scaling tables change maximum independently; milestone grants are applied only once', () => {
  const f = tracker();
  f.tables = { capacity: { mode: 'threshold', rows: [{ key: 0, value: 3 }, { key: 5, value: 6 }], below: 'boundary', above: 'boundary' } };
  f.components[0].stat.expression = { table: 'capacity', owner: 'tracker', input: { stat: 'base' } };
  const bonus = feature('milestone', [{ id: 'level-five', kind: 'grantResource', key: 'energy', amount: 1, condition: { op: 'gte', args: [{ stat: 'base' }, 5] } }]);
  const engine = new Engine(catalogue([f, bonus]));
  let character = engine.createCharacter('c', 'C', [], [root('tracker')]);
  character = applyEdit(engine, character, [{ kind: 'input', stat: 'base', value: 1 }, { kind: 'root', acquisition: root('milestone') }], 'start');
  assert.equal(pool(engine, character).capacity, 3);
  assert.equal(pool(engine, character).current, 2);
  character = applyEdit(engine, character, [{ kind: 'input', stat: 'base', value: 5 }], 'grow');
  assert.equal(pool(engine, character).capacity, 6);
  assert.equal(pool(engine, character).current, 3);
  character = applyEdit(engine, character, [{ kind: 'input', stat: 'base', value: 1 }], 'down');
  character = applyEdit(engine, character, [{ kind: 'input', stat: 'base', value: 5 }], 'up');
  assert.equal(pool(engine, character).current, 3);
});

test('multi-resource abilities spend atomically and incompatible shared definitions fail', () => {
  const second = feature('second', [{ id: 'pool', kind: 'trackResource', key: 'other', name: 'Other', units: 'uses', maximum: 2, initialAmount: 0, recovery: [] }]);
  const ability = spell();
  ability.components[0].costs.push({ key: 'other', amount: 1 });
  const engine = new Engine(catalogue([tracker(), second, ability, feature('package', [grant('one', 'tracker'), grant('two', 'second')])]));
  const character = engine.createCharacter('c', 'C', [], [root('package'), root('ability')]);
  const snapshot = serializeCharacter(character);
  assert.throws(() => useAbility(engine, character, engine.evaluate(character).capabilities[0].id, 'use'), /Insufficient/);
  assert.equal(serializeCharacter(character), snapshot);
  second.components[0].key = 'energy';
  const conflict = new Engine(catalogue([tracker(), second]));
  const result = conflict.evaluate(conflict.createCharacter('c', 'C', [], [root('tracker'), root('second')]));
  assert.ok(result.diagnostics.some((d) => d.code === 'RESOURCE_CONFLICT'));
});
