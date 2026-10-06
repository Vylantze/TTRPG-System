import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, applyEdit, previewEdit, useAbility, settleAbility, recoverResources, serializeCharacter, deserializeCharacter,
  classEntryPath, selectionPath, rootPath, pickPath, validateCatalogue, evaluateExpression, migrateCharacter } from '../dist/index.js';
import { catalogue as fixture } from '../examples/catalogue.js';
const copy = value => structuredClone(value);
function setup(level = 1, source = fixture, functions = {}) {
  const engine = new Engine(source, functions);
  let character = engine.createCharacter('hero', 'Hero', [{ id: 'main', class: 'example:adventurer', level }]);
  character.selections[classEntryPath('main', 1, 'technique')] = [{ id: 'pick', feature: 'example:guard' }];
  if (level >= 2) character.selections[selectionPath(classEntryPath('main', 2, 'energy'), 'technique')] = [{ id: 'pick', feature: 'example:energy-technique' }];
  return { engine, character };
}
function addFeature(source, id, components, extra = {}) { source.features.push({ id, revision: 1, name: id, components, ...extra }); }
function root(character, id, feature, level = 0) { character.roots.push({ id, feature, acquiredCharacterLevel: level }); }
const code = (result, id) => result.diagnostics.some(d => d.code === id);

test('independent same-level choices produce distinct instances and derived totals', () => {
  const { engine, character } = setup();
  character.selections[classEntryPath('main', 1, 'talent')] = [{ id: 'pick', feature: 'example:agile' }];
  const r = engine.evaluate(character); assert.equal(r.status, 'valid'); assert.equal(r.stats.defense.value, 14);
  assert.equal(new Set(r.instances.map(i => i.id)).size, r.instances.length);
});
test('missing mandatory choices produce an incomplete draft', () => {
  const engine = new Engine(fixture), character = engine.createCharacter('a', 'A', [{ id: 'main', class: 'example:adventurer', level: 1 }]);
  assert.equal(engine.evaluate(character).status, 'incomplete');
});
test('nested choice waiver resolves sibling resource even when consumer is listed first', () => {
  const { engine, character } = setup(2), r = engine.evaluate(character);
  assert.equal(r.status, 'valid'); assert.equal(Object.values(r.resources)[0].capacity, 4);
  assert(r.instances.find(i => i.feature === 'example:energy-technique').waived);
});
test('waivers never bypass required resources', () => {
  const source = copy(fixture); source.features.find(f => f.id === 'example:energy-package').components = source.features.find(f => f.id === 'example:energy-package').components.filter(c => c.kind !== 'grantFeature');
  const { engine, character } = setup(2, source); assert(code(engine.evaluate(character), 'MISSING_RESOURCE'));
});
test('waiver is scoped to its selection and ordinary root prerequisites remain checked', () => {
  const { engine, character } = setup(2); root(character, 'unauthorized', 'example:energy-technique', 2);
  assert(code(engine.evaluate(character), 'PREREQUISITE'));
});
test('self and mutually circular prerequisites do not bootstrap eligibility', () => {
  const source = copy(fixture); addFeature(source, 'self', [], { prerequisites: { feature: 'self' } });
  addFeature(source, 'a', [], { prerequisites: { feature: 'b' } }); addFeature(source, 'b', [], { prerequisites: { feature: 'a' } });
  const { engine, character } = setup(1, source); root(character, 'self', 'self'); root(character, 'a', 'a'); root(character, 'b', 'b');
  assert.equal(engine.evaluate(character).diagnostics.filter(d => d.code === 'PREREQUISITE').length, 3);
});
test('resource-dependent provider cannot bootstrap its consumer', () => {
  const source = copy(fixture); source.features.find(f => f.id === 'example:energy-reserve').prerequisites = { feature: 'example:energy-technique' };
  const { engine, character } = setup(2, source); assert.equal(engine.evaluate(character).status, 'invalid');
});
test('basic changes flow through derived stats and higher floors preserve rank', () => {
  const { engine, character } = setup(3); character.inputs.agility = 4;
  const r = engine.evaluate(character); assert.equal(r.stats.rank.value, 2); assert.equal(r.stats.defense.value, 16);
});
test('inactive and suppressed modifiers retain explanations', () => {
  const { engine, character } = setup(); const r = engine.evaluate(character);
  assert.equal(r.stats.defense.modifiers[0].reason, 'Condition is false.');
});
test('typed additions use strongest bonus and worst penalty, distinct groups combine', () => {
  const source = copy(fixture);
  [1, 2, -1, -3].forEach((value, i) => addFeature(source, `bonus${i}`, [{ id: 'm', kind: 'modifyStat', stat: 'defense', operation: 'add', value, group: 'status', stacking: 'bestBonusAndWorstPenalty' }]));
  const { engine, character } = setup(1, source); [0, 1, 2, 3].forEach(i => root(character, `b${i}`, `bonus${i}`));
  const r = engine.evaluate(character); assert.equal(r.stats.defense.value, 12); assert.equal(r.stats.defense.modifiers.filter(m => m.amount !== undefined && !m.applied).length, 2);
});
test('override then additions then multipliers applies documented order', () => {
  const source = copy(fixture); addFeature(source, 'formula', [
    { id: 'o', kind: 'modifyStat', stat: 'agility', operation: 'override', value: 3, priority: 1 },
    { id: 'a', kind: 'modifyStat', stat: 'agility', operation: 'add', value: 2 },
    { id: 'm', kind: 'modifyStat', stat: 'agility', operation: 'multiply', value: 2 }
  ]); const { engine, character } = setup(1, source); root(character, 'f', 'formula'); assert.equal(engine.evaluate(character).stats.agility.value, 10);
});
test('modifier base reads its own pre-modifier value', () => {
  const source = copy(fixture); addFeature(source, 'base', [{ id: 'm', kind: 'modifyStat', stat: 'agility', operation: 'add', value: { base: true } }]);
  const { engine, character } = setup(1, source); root(character, 'base', 'base'); assert.equal(engine.evaluate(character).stats.agility.value, 4);
});
test('equal priority conflicting overrides are invalid', () => {
  const source = copy(fixture); addFeature(source, 'conflict', [1, 2].map(value => ({ id: String(value), kind: 'modifyStat', stat: 'agility', operation: 'override', value, priority: 1 })));
  const { engine, character } = setup(1, source); root(character, 'f', 'conflict'); assert(code(engine.evaluate(character), 'OVERRIDE_CONFLICT'));
});
test('floor above ceiling reports a conflict', () => {
  const source = copy(fixture); addFeature(source, 'conflict', [{ id: 'floor', kind: 'modifyStat', stat: 'agility', operation: 'floor', value: 10 }, { id: 'cap', kind: 'modifyStat', stat: 'agility', operation: 'ceiling', value: 3 }]);
  const { engine, character } = setup(1, source); root(character, 'f', 'conflict'); assert(code(engine.evaluate(character), 'BOUND_CONFLICT'));
});
test('catalogue rejects cycles through formulas or modifiers', () => {
  const source = copy(fixture); source.system.stats[0] = { id: 'agility', name: 'Agility', kind: 'derived', expression: { stat: 'defense' } };
  assert.equal(validateCatalogue(source)[0].code, 'STAT_CYCLE');
  const modifier = copy(fixture); addFeature(modifier, 'cycle', [{ id: 'm', kind: 'modifyStat', stat: 'agility', operation: 'add', value: { stat: 'defense' } }]);
  assert.equal(validateCatalogue(modifier)[0].code, 'STAT_CYCLE');
});
test('catalogue rejects composition and choice cycles', () => {
  const source = copy(fixture); source.features[0].components.push({ id: 'recursive', kind: 'grantFeature', feature: source.features[0].id });
  assert.equal(validateCatalogue(source)[0].code, 'COMPOSITION_CYCLE');
});
test('catalogue rejects missing references and malformed expressions', () => {
  const source = copy(fixture); source.classes[0].levels[1][0].feature = 'missing'; assert.equal(validateCatalogue(source)[0].code, 'UNKNOWN_FEATURE');
  source.classes[0].levels[1][0].feature = 'example:training'; source.system.characterLevel = { op: 'execute', args: [] }; assert.equal(validateCatalogue(source)[0].code, 'SCHEMA');
});
test('table thresholds and above-range policy combine with stat capacity', () => {
  const { engine, character } = setup(3); character.inputs.insight = 2;
  assert.equal(Object.values(engine.evaluate(character).resources)[0].capacity, 5);
});
test('exact missing keys, table boundary values and fallback behave explicitly', () => {
  const env = { context: {}, parameters: {}, stats: () => 0, functions: {}, owner: 'f', features: new Map([['f', { tables: { t: { mode: 'exact', rows: [{ key: 1, value: 2 }, { key: 3, value: 7 }], below: { fallback: 9 }, above: 'boundary', missing: 'error' } } }]]) };
  assert.equal(evaluateExpression({ table: 't', input: 0 }, env), 9); assert.equal(evaluateExpression({ table: 't', input: 8 }, env), 7);
  assert.throws(() => evaluateExpression({ table: 't', input: 2 }, env), /No exact/);
});
test('tables reject duplicate keys and empty rows', () => {
  const source = copy(fixture), table = source.features.find(f => f.tables).tables.capacity;
  table.rows.push({ key: 2, value: 99 }); assert.equal(validateCatalogue(source)[0].code, 'DUPLICATE_ID');
  table.rows = []; assert.equal(validateCatalogue(source)[0].code, 'SCHEMA');
});
test('capability expenditure and partial recovery are explicit and idempotent', () => {
  const { engine, character } = setup(2), r = engine.evaluate(character), ability = r.capabilities.find(c => c.definition.name === 'Energy pulse');
  const used = useAbility(engine, character, ability.id, 'use-1', { actions: { action: 1 } });
  const pool = Object.values(engine.evaluate(used.character).resources)[0]; assert.equal(pool.spent, 1); assert.equal(used.actions.action, 0);
  const repeated = useAbility(engine, used.character, ability.id, 'use-1', { actions: { action: 1 } }); assert.equal(Object.values(engine.evaluate(repeated.character).resources)[0].spent, 1); assert.equal(repeated.actions.action, 0);
  const recovered = recoverResources(engine, used.character, 'pause', 'recover'); assert.equal(Object.values(engine.evaluate(recovered).resources)[0].spent, 0);
  assert.deepEqual(recoverResources(engine, recovered, 'pause', 'recover'), recovered);
});
test('exhaustion preserves eligibility but prevents use', () => {
  const { engine, character } = setup(2), r = engine.evaluate(character), pool = Object.values(r.resources)[0];
  character.resources[pool.id] = { spent: pool.capacity };
  assert.equal(engine.evaluate(character).status, 'valid'); assert.throws(() => useAbility(engine, character, r.capabilities[0].id, 'fail', { actions: { action: 1 } }), /Insufficient/);
});
test('multiple insufficient costs spend nothing and do not mutate input', () => {
  const source = copy(fixture); const ability = source.features.find(f => f.id === 'example:energy-technique').components[0]; ability.costs.push({ key: 'energy', requirement: 'energy', amount: 99 });
  const { engine, character } = setup(2, source), before = serializeCharacter(character), r = engine.evaluate(character);
  assert.throws(() => useAbility(engine, character, r.capabilities[0].id, 'no', { actions: { action: 1 } }), /Insufficient/); assert.equal(serializeCharacter(character), before);
});
test('pending conditional use reserves capacity and failure releases it exactly once', () => {
  const { engine, character } = setup(2), r = engine.evaluate(character), ability = r.capabilities.find(c => c.definition.name === 'Attempt');
  const pending = useAbility(engine, character, ability.id, 'attempt').character;
  const pool = Object.values(engine.evaluate(pending).resources)[0]; assert.equal(pool.reserved, 1); assert.equal(pool.spent, 0);
  const settled = settleAbility(pending, 'attempt', 'failure', 'settle'); assert.equal(Object.values(engine.evaluate(settled).resources)[0].reserved, 0);
  assert.deepEqual(settleAbility(settled, 'attempt', 'failure', 'settle'), settled);
});
test('conditional success converts reservation to expenditure', () => {
  const { engine, character } = setup(2), r = engine.evaluate(character);
  const pending = useAbility(engine, character, r.capabilities.find(c => c.definition.name === 'Attempt').id, 'attempt').character;
  const settled = settleAbility(pending, 'attempt', 'success', 'settle'); assert.equal(Object.values(engine.evaluate(settled).resources)[0].spent, 1);
});
test('capacity decrease and increase retain expenditure', () => {
  const { engine, character } = setup(2), pool = Object.values(engine.evaluate(character).resources)[0]; character.resources[pool.id] = { spent: 3 };
  character.inputs.insight = 0; assert.equal(Object.values(engine.evaluate(character).resources)[0].available, 0);
  character.inputs.insight = 2; assert.equal(Object.values(engine.evaluate(character).resources)[0].available, 2);
});
test('save roundtrip preserves nested selections and pending expenditure', () => {
  const { engine, character } = setup(2), r = engine.evaluate(character);
  const pending = useAbility(engine, character, r.capabilities.find(c => c.definition.name === 'Attempt').id, 'attempt').character;
  const restored = deserializeCharacter(serializeCharacter(pending), engine); assert.deepEqual(restored, pending); assert.deepEqual(engine.evaluate(restored), engine.evaluate(pending));
});
test('unsupported save versions, malformed JSON and wrong revisions fail', () => {
  const { engine, character } = setup(); assert.throws(() => deserializeCharacter('bad'), /Invalid character JSON/);
  const bad = copy(character); bad.version = 2; assert.throws(() => deserializeCharacter(JSON.stringify(bad)), /Unsupported/);
  character.contentRevisions['example:guard']++; assert(code(engine.evaluate(character), 'REVISION'));
});
test('evaluation and preview are deterministic and never mutate definitions or characters', () => {
  const { engine, character } = setup(2); const saved = serializeCharacter(character), content = JSON.stringify(engine.catalogue);
  assert.deepEqual(engine.evaluate(character), engine.evaluate(character)); previewEdit(engine, character, [{ kind: 'input', stat: 'agility', value: 7 }]);
  assert.equal(serializeCharacter(character), saved); assert.equal(JSON.stringify(engine.catalogue), content); assert(Object.isFrozen(engine.catalogue.features[0]));
});
test('retraining owned choice removes nested history only and keeps sibling picks', () => {
  const { engine, character } = setup(); character.selections[classEntryPath('main', 1, 'talent')] = [{ id: 'a', feature: 'example:agile' }];
  const edited = applyEdit(engine, character, [{ kind: 'select', selection: classEntryPath('main', 1, 'technique'), picks: [{ id: 'l', feature: 'example:lore' }] }], 'retrain');
  assert.deepEqual(edited.selections[classEntryPath('main', 1, 'talent')], character.selections[classEntryPath('main', 1, 'talent')]); assert.equal(engine.evaluate(edited).status, 'valid');
});
test('removing provider makes dependent resource Features invalid until repaired', () => {
  const source = copy(fixture); addFeature(source, 'waived-root', [{ id: 'choice', kind: 'chooseFeatures', minimum: 1, maximum: 1, ignorePrerequisites: true, candidates: { ids: ['example:energy-technique'] }, retraining: { allowed: true } }]);
  const { engine, character } = setup(1, source); root(character, 'reserve', 'example:energy-reserve'); root(character, 'consumer', 'waived-root');
  character.selections[selectionPath(rootPath('consumer'), 'choice')] = [{ id: 'p', feature: 'example:energy-technique' }]; assert.equal(engine.evaluate(character).status, 'valid');
  const preview = previewEdit(engine, character, [{ kind: 'removeRoot', id: 'reserve' }]); assert(code(preview.after, 'MISSING_RESOURCE'));
  assert.throws(() => applyEdit(engine, character, [{ kind: 'removeRoot', id: 'reserve' }], 'remove', { requireValid: true }), /valid, complete/);
});
test('level reduction deactivates and restoration preserves old selections without duplicated grants', () => {
  const { engine, character } = setup(3), saved = serializeCharacter(character);
  const reduced = applyEdit(engine, character, [{ kind: 'level', progression: 'main', level: 1 }], 'down'); assert.equal(engine.evaluate(reduced).stats.rank.value, 1);
  const restored = applyEdit(engine, reduced, [{ kind: 'level', progression: 'main', level: 3 }], 'up'); assert.equal(engine.evaluate(restored).stats.rank.value, 2);
  assert.deepEqual(restored.selections, character.selections); assert.equal(serializeCharacter(character), saved);
});
test('acquisition-level candidate caps do not grow with current character level', () => {
  const { engine, character } = setup(3); character.selections[classEntryPath('main', 1, 'technique')] = [{ id: 'a', feature: 'example:advanced' }]; assert(code(engine.evaluate(character), 'CANDIDATE'));
});
test('candidate API explains waived and missing resource requirements', () => {
  const { engine, character } = setup(2), slot = selectionPath(classEntryPath('main', 2, 'energy'), 'technique');
  const candidate = engine.getCandidates(character, slot)[0]; assert(candidate.waived); assert.equal(candidate.status, 'valid');
});
test('independent repeated composite instances keep independent nested selections', () => {
  const source = copy(fixture); addFeature(source, 'composite', [{ id: 'choose', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { ids: ['example:agile'] } }], { repeat: { maximum: 2, scope: 'character' } });
  const { engine, character } = setup(1, source); root(character, 'a', 'composite'); root(character, 'b', 'composite');
  character.selections[selectionPath(rootPath('a'), 'choose')] = [{ id: 'same-id', feature: 'example:agile' }]; character.selections[selectionPath(rootPath('b'), 'choose')] = [{ id: 'same-id', feature: 'example:agile' }];
  const r = engine.evaluate(character); assert.equal(r.status, 'valid'); assert.equal(r.stats.agility.value, 4);
});
test('stat-based selection counts expose missing and excess picks', () => {
  const source = copy(fixture), choice = source.classes[0].levels[1][2]; choice.maximum = { stat: 'insight' }; choice.minimum = { stat: 'insight' };
  const { engine, character } = setup(1, source); assert.equal(engine.evaluate(character).status, 'incomplete');
  character.selections[classEntryPath('main', 1, 'talent')] = [{ id: 'p', feature: 'example:agile' }]; assert.equal(engine.evaluate(character).status, 'valid');
  character.inputs.insight = 0; assert(code(engine.evaluate(character), 'PICK_LIMIT'));
});
test('multiple class progressions obey System legality', () => {
  const source = copy(fixture); source.system.allowMultipleClasses = false;
  const { engine, character } = setup(1, source); character.progressions.push({ id: 'other', class: 'example:adventurer', level: 0 }); assert(code(engine.evaluate(character), 'MULTICLASS'));
});
test('registered pure functions type-check arguments and results', () => {
  const source = copy(fixture); source.system.stats.push({ id: 'double', name: 'Double', kind: 'derived', expression: { call: 'double', args: [{ stat: 'agility' }] } });
  const engine = new Engine(source, { double: { arguments: ['number'], result: 'number', invoke: x => x * 2 } });
  const character = engine.createCharacter('a', 'A'); assert.equal(engine.evaluate(character).stats.double.value, 4);
});
test('alternative stat formulas require explicit valid selection', () => {
  const source = copy(fixture); source.system.alternatives = { defense: [{ id: 'armor', expression: 18 }] };
  const { engine, character } = setup(1, source); character.alternatives.defense = 'armor'; assert.equal(engine.evaluate(character).stats.defense.value, 18);
});
test('invalid input bounds and divide-by-zero are diagnosed', () => {
  const source = copy(fixture); source.system.stats[0].minimum = 0;
  const { engine, character } = setup(1, source); character.inputs.agility = -1; assert(code(engine.evaluate(character), 'OUT_OF_BOUNDS'));
  const env = { context: {}, parameters: {}, stats: () => 0, features: new Map(), functions: {} }; assert.throws(() => evaluateExpression({ op: 'divide', args: [1, 0] }, env), /Division by zero/);
});
test('selection paths encode IDs to avoid accidental ownership collisions', () => {
  assert.notEqual(selectionPath(rootPath('a/b'), 'c'), selectionPath(rootPath('a'), 'b/c')); assert.notEqual(pickPath('s', 'a/b'), pickPath('s/a', 'b'));
});
test('historical eligibility cannot use a Feature acquired at a later level', () => {
  const source = copy(fixture); source.features.find(f => f.id === 'example:guard').prerequisites = { feature: 'example:expert' };
  const { engine, character } = setup(3, source); assert(code(engine.evaluate(character), 'PREREQUISITE'));
});
test('temporary bonuses cannot meet acquisition prerequisites or change selection capacity', () => {
  const source = copy(fixture); source.features.find(f => f.id === 'example:guard').components.push({ id: 'temporary', kind: 'modifyStat', stat: 'insight', operation: 'add', value: 10, condition: { context: 'guarded' } });
  source.classes[0].levels[1][2].maximum = { stat: 'insight' };
  const { engine, character } = setup(1, source);
  const r = engine.evaluate(character, { guarded: true }); assert.equal(r.stats.insight.value, 11); assert.equal(r.selections.find(s => s.id.endsWith('/talent')).maximum, 1);
});
test('a candidate cap may depend on automatic grants already acquired at the same level', () => {
  const source = copy(fixture); source.classes[0].levels[1][1].candidates.maximumLevel = { stat: 'rank' };
  const { engine, character } = setup(1, source); assert.equal(engine.evaluate(character).status, 'valid');
});
test('shared pool contributors combine once and recovery runs once', () => {
  const source = copy(fixture); const reserve = copy(source.features.find(f => f.id === 'example:energy-reserve')); reserve.id = 'other-reserve'; source.features.push(reserve);
  const { engine, character } = setup(2, source); root(character, 'other', 'other-reserve');
  const r = engine.evaluate(character), pool = Object.values(r.resources)[0]; assert.equal(pool.capacity, 6); assert.equal(pool.providers.length, 2);
  character.resources[pool.id] = { spent: 3 }; const recovered = recoverResources(engine, character, 'pause', 'recover'); assert.equal(recovered.resources[pool.id].spent, 2);
});
test('an incompatible provider cannot fulfill the required resource contract', () => {
  const source = copy(fixture); source.features.find(f => f.id === 'example:energy-reserve').components[0].units = 'points';
  const { engine, character } = setup(2, source); assert(code(engine.evaluate(character), 'MISSING_RESOURCE'));
});
test('consumer effects cannot bootstrap the provider capacity requirement', () => {
  const source = copy(fixture), consumer = source.features.find(f => f.id === 'example:energy-technique');
  consumer.resources[0].minimumCapacity = 5; consumer.components.push({ id: 'boost', kind: 'modifyStat', stat: 'insight', operation: 'add', value: 2 });
  const { engine, character } = setup(2, source); assert(code(engine.evaluate(character), 'MISSING_RESOURCE'));
});
test('root replacement clears owned nested choices and keeps independent roots', () => {
  const source = copy(fixture); addFeature(source, 'container', [{ id: 'nested', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { ids: ['example:agile'] } }]);
  const { engine, character } = setup(1, source); root(character, 'container', 'container'); root(character, 'independent', 'example:lore');
  character.selections[selectionPath(rootPath('container'), 'nested')] = [{ id: 'p', feature: 'example:agile' }];
  const edited = applyEdit(engine, character, [{ kind: 'root', acquisition: { id: 'container', feature: 'example:lore', acquiredCharacterLevel: 0 } }], 'replace');
  assert(!edited.selections[selectionPath(rootPath('container'), 'nested')]); assert(edited.roots.some(r => r.id === 'independent'));
});
test('new replacement pools initialize empty and equivalent pools retain spending', () => {
  const source = copy(fixture); addFeature(source, 'other-pool', [{ id: 'pool', kind: 'defineResource', key: 'other', scope: 'character', units: 'uses', capacity: 3, recovery: [] }]);
  const { engine, character } = setup(1, source); root(character, 'resource', 'example:energy-reserve');
  const edited = applyEdit(engine, character, [{ kind: 'root', acquisition: { id: 'resource', feature: 'other-pool', acquiredCharacterLevel: 0 } }], 'replace');
  const pool = Object.values(engine.evaluate(edited).resources)[0]; assert.equal(pool.available, 0); assert.equal(pool.spent, 3);
});
test('recovery formulas use registered functions and the supplying instance context', () => {
  const source = copy(fixture); source.features.find(f => f.id === 'example:energy-reserve').components[0].recovery.push({ event: 'custom', amount: { call: 'double', args: [{ stat: 'insight' }] } });
  const { engine, character } = setup(2, source, { double: { arguments: ['number'], result: 'number', invoke: x => x * 2 } });
  const pool = Object.values(engine.evaluate(character).resources)[0]; character.resources[pool.id] = { spent: 3 };
  assert.equal(recoverResources(engine, character, 'custom', 'recover').resources[pool.id].spent, 1);
});
test('non-sum character levels preserve acquisition ordering across equal character levels', () => {
  const source = copy(fixture); source.system.characterLevel = { context: 'maximumClassLevel' };
  addFeature(source, 'late', [], { prerequisites: { expression: { op: 'gte', args: [{ context: 'class.secondary' }, 1] } } });
  source.classes[0].levels[1] = [{ id: 'late', kind: 'grantFeature', feature: 'late' }];
  const engine = new Engine(source), character = engine.createCharacter('a', 'A', [{ id: 'main', class: 'example:adventurer', level: 1 }, { id: 'secondary', class: 'example:adventurer', level: 1 }]);
  const r = engine.evaluate(character); assert(r.diagnostics.some(d => d.path === classEntryPath('main', 1, 'late') && d.code === 'PREREQUISITE'));
});
test('class entry context distinguishes starting class from multiclass acquisition', () => {
  const source = copy(fixture); source.features.find(f => f.id === 'example:training').components[0].condition = { context: 'isStartingClass' };
  const { engine, character } = setup(1, source); const edited = applyEdit(engine, character, [{ kind: 'addProgression', progression: { id: 'second', class: 'example:adventurer', level: 1 } }], 'add');
  const r = engine.evaluate(edited); const initial = r.instances.find(i => i.id === classEntryPath('main', 1, 'training')); assert(initial.eligible);
  const effects = r.stats.rank.modifiers; assert(effects.some(m => m.source.includes('class/second') && !m.applied));
});
test('duplicate event IDs with changed payload are rejected', () => {
  const { engine, character } = setup(); const edited = applyEdit(engine, character, [{ kind: 'input', stat: 'insight', value: 2 }], 'same');
  assert.throws(() => applyEdit(engine, edited, [{ kind: 'input', stat: 'insight', value: 3 }], 'same'), /different data/);
});
test('malformed save data and unsafe map keys are rejected at import', () => {
  const { character } = setup(); const bad = JSON.parse(serializeCharacter(character)); bad.resources = { energy: { spent: -1 } };
  assert.throws(() => deserializeCharacter(JSON.stringify(bad)), /Negative/);
  const text = serializeCharacter(character).replace('"bindings": {}', '"bindings": {"__proto__": "bad"}'); assert.throws(() => deserializeCharacter(text), /Unsafe key/);
});
test('maintenance loss disables acquired Feature effects with a diagnostic', () => {
  const source = copy(fixture); source.features.find(f => f.id === 'example:guard').maintenance = { stat: 'insight', minimum: 1 };
  const { engine, character } = setup(1, source); character.inputs.insight = 0; const r = engine.evaluate(character, { guarded: true });
  assert(code(r, 'MAINTENANCE')); assert.equal(r.stats.defense.value, 13);
});
test('integer-use pools reject fractional costs and fractional saved spending', () => {
  const source = copy(fixture); source.features.find(f => f.id === 'example:energy-technique').components[0].costs[0].amount = 0.5;
  const { engine, character } = setup(2, source); assert(code(engine.evaluate(character), 'INVALID_INTEGER'));
  const normal = setup(2); const pool = Object.values(normal.engine.evaluate(normal.character).resources)[0]; normal.character.resources[pool.id] = { spent: 0.5 }; assert(code(normal.engine.evaluate(normal.character), 'INVALID_INTEGER'));
});
test('explicit revision migration preserves spending and never silently upgrades on load', () => {
  const { engine, character } = setup(2), pool = Object.values(engine.evaluate(character).resources)[0]; character.resources[pool.id] = { spent: 2 };
  const source = copy(fixture); source.revision = 2; source.features.find(f => f.id === 'example:guard').revision = 2;
  const nextEngine = new Engine(source), target = cloneForMigration(character, source);
  assert.throws(() => deserializeCharacter(serializeCharacter(character), nextEngine), /revision mismatch/);
  const migrated = migrateCharacter(nextEngine, character, target, 'migration'); assert.equal(nextEngine.evaluate(migrated).status, 'valid'); assert.equal(migrated.resources[pool.id].spent, 2);
});
function cloneForMigration(character, catalogue) {
  const target = copy(character); target.catalogue.revision = catalogue.revision; target.contentRevisions = Object.fromEntries([...catalogue.features, ...catalogue.classes].map(f => [f.id, f.revision])); return target;
}
test('revision migration rejects pending uses rather than dropping reservations', () => {
  const { engine, character } = setup(2), r = engine.evaluate(character);
  const pending = useAbility(engine, character, r.capabilities.find(c => c.definition.name === 'Attempt').id, 'attempt').character;
  assert.throws(() => migrateCharacter(engine, pending, pending, 'migration'), /Settle pending/);
});
test('malformed multi-operation expressions are rejected rather than interpreted ambiguously', () => {
  const source = copy(fixture); source.system.characterLevel = { literal: 1, context: 'totalClassLevels' }; assert.equal(validateCatalogue(source)[0].code, 'SCHEMA');
});
test('negative capacities and invalid action budgets cannot produce usable state', () => {
  const source = copy(fixture), resource = source.features.find(f => f.id === 'example:energy-reserve').components[0]; resource.capacity = -1; resource.minimum = -5;
  const { engine, character } = setup(2, source); assert(code(engine.evaluate(character), 'RESOURCE_CAPACITY'));
  const normal = setup(2), capability = normal.engine.evaluate(normal.character).capabilities[0]; assert.throws(() => useAbility(normal.engine, normal.character, capability.id, 'use', { actions: { action: 1.5 } }), /integer/);
});
