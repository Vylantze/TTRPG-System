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

test('stat contributions follow selected branches, overrides and stacking, retaining negative sources', () => {
  const { catalogue } = setup();
  delete catalogue.system.sheetDisplay;
  catalogue.system.stats = [
    { id: 'base', name: 'Base', kind: 'derived', expression: 10 },
    { id: 'total', name: 'Total', kind: 'derived', expression: { op: 'add', args: [{ stat: 'base' }, { if: false, then: 999, else: 0 }] } },
  ];
  const effects = [
    ['replacement', 'override', 16], ['bonus', 'add', 2], ['penalty', 'add', -3], ['zero', 'add', 0],
    ['inactive', 'add', 100], ['suppressed', 'add', 1], ['winner', 'add', 4],
  ];
  catalogue.features.push(...effects.map(([id, operation, value]) => ({ id, revision: 1, name: id, components: [{ id: 'effect', kind: 'modifyStat', stat: 'base', operation, value, ...(id === 'inactive' ? { condition: false } : {}), ...(['suppressed', 'winner'].includes(id) ? { group: 'test', stacking: 'highest' } : {}) }] })));
  catalogue.system.advancement[0].push(...effects.map(([id]) => ({ id, kind: 'grantFeature', feature: id })));
  const engine = new Engine(catalogue);
  const result = engine.evaluate(engine.createCharacter('test', 'Test'));
  assert.equal(result.status, 'valid');
  assert.deepEqual(result.stats.total.contributions, [
    { amount: 16, label: 'replacement' }, { amount: 2, label: 'bonus' }, { amount: -3, label: 'penalty' }, { amount: 4, label: 'winner' },
  ]);
  assert.equal(result.stats.total.contributions.reduce((sum, term) => sum + term.amount, 0), result.stats.total.value);
});

test('stat contribution totals include multiplication and only effective bounds and constraints', () => {
  const { catalogue } = setup();
  delete catalogue.system.sheetDisplay;
  catalogue.system.stats = [{ id: 'score', name: 'Score', kind: 'derived', expression: 10, maximum: 18, clamp: true }];
  catalogue.features.push({ id: 'effects', revision: 1, name: 'Effects', components: [
    { id: 'double', kind: 'modifyStat', stat: 'score', operation: 'multiply', value: 2 },
    { id: 'floor', kind: 'modifyStat', stat: 'score', operation: 'floor', value: 5 },
    { id: 'ceiling', kind: 'modifyStat', stat: 'score', operation: 'ceiling', value: 19 },
  ] });
  catalogue.system.advancement[0].push({ id: 'effects', kind: 'grantFeature', feature: 'effects' });
  const engine = new Engine(catalogue), result = engine.evaluate(engine.createCharacter('test', 'Test'));
  assert.equal(result.stats.score.value, 18);
  assert.deepEqual(result.stats.score.contributions, [{ amount: 18, label: 'Score limit' }]);
  delete catalogue.system.stats[0].maximum;
  catalogue.features.at(-1).components = catalogue.features.at(-1).components.slice(0, 1);
  const multipliedEngine = new Engine(catalogue);
  const multiplied = multipliedEngine.evaluate(multipliedEngine.createCharacter('test', 'Test'));
  assert.deepEqual(multiplied.stats.score.contributions, [{ amount: 20, label: 'Score, Effects' }]);
});

test('System action grouping, filters, and healing dice settings validate their types', () => {
  const { catalogue } = setup();
  catalogue.system.sheetDisplay.abilities = { groupByActionCost: true, actionFilter: true };
  catalogue.system.sheetDisplay.spells = { actionFilter: true };
  catalogue.system.sheetDisplay.health = { healingResourceIcons: true };
  assert.doesNotThrow(() => new Engine(catalogue));
  for (const [section, key] of [['abilities', 'groupByActionCost'], ['abilities', 'actionFilter'], ['spells', 'actionFilter'], ['health', 'healingResourceIcons']]) {
    const invalid = structuredClone(catalogue);
    invalid.system.sheetDisplay[section][key] = 'yes';
    assert.throws(() => new Engine(invalid), /boolean/);
  }
});

test('multiplied expression labels exclude unselected branches and unused limits', () => {
  const { catalogue } = setup();
  delete catalogue.system.sheetDisplay;
  catalogue.system.stats = [
    { id: 'chosen', name: 'Chosen source', kind: 'derived', expression: 3 },
    { id: 'unused', name: 'Unused source', kind: 'derived', expression: 10 },
    { id: 'total', name: 'Total', kind: 'derived', expression: { op: 'multiply', args: [2, { if: true, then: { op: 'min', args: [{ stat: 'chosen' }, { stat: 'unused' }] }, else: { stat: 'unused' } }] } },
  ];
  const engine = new Engine(catalogue);
  const result = engine.evaluate(engine.createCharacter('test', 'Test'));
  assert.deepEqual(result.stats.total.contributions, [{ amount: 6, label: 'Chosen source' }]);
});

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

test('Fractional health obeys authored resource constraints, while integer health rejects fractional amounts', () => {
  const { catalogue } = setup();
  for (const feature of catalogue.features) feature.components[0].integer = false;
  const engine = new Engine(catalogue);
  let character = engine.createCharacter('fractional', 'Fractional');
  character = adjustResource(engine, character, pool(engine, character, 'ward').id, 2.5, 'ward');
  character = changeHealth(engine, character, 'damage', 3.25, 'damage');
  assert.equal(pool(engine, character, 'ward').current, 0);
  assert.equal(pool(engine, character, 'vitality').current, 9.25);
  const integer = setup();
  assert.throws(() => changeHealth(integer.engine, integer.character, 'heal', 0.5, 'fraction'), /integer/i);
});

test('Sheet configuration rejects malformed optional objects, unknown phrase stats and hidden sort columns', () => {
  const invalid = (display) => new Engine({ ...setup().catalogue, system: { ...setup().catalogue.system, sheetDisplay: display } });
  assert.throws(() => invalid({ health: false }), /configuration object/);
  assert.throws(() => invalid({ spells: null }), /configuration object/);
  assert.throws(() => invalid({ descriptionProcessing: { statPhrases: [{ phrase: 'energy', stat: 'missing' }] } }), /Unknown sheet stat/);
  assert.throws(() => invalid({ spells: { slotPipLimit: 1000 } }), /pip limit/);
  const { catalogue } = setup();
  catalogue.system.sheetSections = [{ id: 'test', name: 'Test', layout: 'skills', defaultSort: 'Ability', columns: ['Name', 'Bonus'], rows: [{ stat: 'bonus' }] }];
  assert.throws(() => new Engine(catalogue), /visible column/);
});
