import test from 'node:test';
import assert from 'node:assert/strict';
import { createDnd2014Engine } from '@/dist/systems/dnd5e-2014/index.js';
import { classEntryPath, Engine, migrateCharacterStructure, featureRollExpression } from '@/dist/index.js';

const engine = createDnd2014Engine();
const prefix = 'dnd5e:2014:';
const choiceFor = (cls) => Object.entries(cls.levels).flatMap(([level, entries]) => entries.filter((entry) => entry.kind === 'chooseFeatures' && ['subclass', 'domain', 'specialist'].includes(entry.id)).map((entry) => ({ level: Number(level), entry })))[0];

test('all 124 accessible subclasses are selectable only through their owning class', () => {
  let count = 0;
  for (const cls of engine.catalogue.classes) {
    const choice = choiceFor(cls);
    assert.ok(choice, cls.name);
    count += choice.entry.candidates.ids.length;
    for (const id of choice.entry.candidates.ids) {
      const character = engine.createCharacter('subclass-test', cls.name, [{ id: 'main', class: cls.id, level: 20 }]);
      character.selections[classEntryPath('main', choice.level, choice.entry.id)] = [{ id: 'selected', feature: id }];
      const result = engine.evaluate(character);
      const selected = result.instances.find((instance) => instance.feature === id && instance.active);
      assert.ok(selected, id);
      for (const other of choice.entry.candidates.ids.filter((other) => other !== id)) assert.ok(!result.instances.some((instance) => instance.feature === other && instance.active), `${id} also granted ${other}`);
      for (const component of engine.getFeature(id).components.filter((entry) => entry.kind === 'grantFeature')) assert.ok(result.instances.some((instance) => instance.feature === component.feature && instance.parent === selected.id && instance.active), `${id}: ${component.feature}`);
      assert.ok(!result.diagnostics.some((diagnostic) => ['UNKNOWN_FEATURE', 'STAT_CONFLICT', 'UNKNOWN_STAT', 'RESOURCE_CONTRACT'].includes(diagnostic.code)), JSON.stringify(result.diagnostics));
    }
  }
  assert.equal(count, 124);
});

test('subclass progression gates later abilities and does not grant Champion benefits to Samurai', () => {
  const cls = engine.catalogue.classes.find((cls) => cls.id === prefix + 'fighter');
  const choice = choiceFor(cls);
  const id = choice.entry.candidates.ids.find((id) => engine.getFeature(id).name === 'Samurai');
  const character = engine.createCharacter('samurai', 'Samurai', [{ id: 'main', class: cls.id, level: 3 }]);
  character.selections[classEntryPath('main', 3, 'subclass')] = [{ id: 'selected', feature: id }];
  const result = engine.evaluate(character);
  assert.ok(result.instances.some((instance) => instance.active && engine.getFeature(instance.feature).name === 'Fighting Spirit'));
  assert.ok(!result.instances.some((instance) => instance.active && engine.getFeature(instance.feature).name === 'Strength before Death'));
  assert.equal(result.stats.criticalThreshold.value, 20);
  assert.equal(Object.values(result.resources).find((pool) => pool.name === 'Fighting Spirit').capacity, 3);
});

test('third-casters use their own slots and contribute rounded-down levels when multiclassing', () => {
  const multiclass = createDnd2014Engine({ multiclass: true });
  for (const [levels, expected] of [[[{ class: 'fighter', level: 7 }], [4, 2]], [[{ class: 'fighter', level: 7 }, { class: 'wizard', level: 1 }], [4, 2]]]) {
    const c = multiclass.createCharacter('caster', 'Caster', levels.map((p, i) => ({ id: String(i), class: prefix + p.class, level: p.level })));
    c.selections[classEntryPath('0', 3, 'subclass')] = [{ id: 'selected', feature: prefix + 'subclass.fighter.eldritch-knight' }];
    const result = multiclass.evaluate(c);
    assert.deepEqual([result.stats['spellSlots.1'].value, result.stats['spellSlots.2'].value], expected);
  }
});

test('scaling Roll Features resolve named dice stats and reject unavailable values', () => {
  const roll = { id: 'die', label: 'Die', dice: { count: 1, sides: { stat: 'die' } }, bonus: 2 };
  assert.equal(featureRollExpression(roll, {}, { stats: { die: { value: 10 } } }), '1d10 + 2');
  assert.throws(() => featureRollExpression(roll, {}, { stats: {} }), /dice stat/);
  assert.throws(() => featureRollExpression(roll, {}, { stats: { die: { value: 2.5 } } }), /dice stat/);
});

test('structural migration preserves a formerly granted option and its nested choice', () => {
  const child = { id: 'selected-skill', revision: 1, name: 'Skill', components: [] };
  const tracker = { id: 'tracker', revision: 1, name: 'Tracker', components: [{ id: 'pool', kind: 'trackResource', key: 'meter', name: 'Meter', units: 'uses', integer: true, maximum: 10, initialAmount: 0, recovery: [] }] };
  const root = { id: 'subclass', revision: 1, name: 'Subclass', components: [{ id: 'skill', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { ids: [child.id] } }, { id: 'meter', kind: 'grantFeature', feature: tracker.id }, { id: 'load', kind: 'grantResource', key: 'meter', amount: 5 }] };
  const catalogue = { id: 'migration', revision: 1, system: { id: 'migration', revision: 1, name: 'Migration', allowMultipleClasses: false, characterLevel: { context: 'totalClassLevels' }, stats: [] }, classes: [{ id: 'class', revision: 1, name: 'Class', levels: { 1: [{ id: 'subclass', kind: 'grantFeature', feature: root.id }] } }], features: [root, child, tracker] };
  const before = new Engine(catalogue);
  const afterData = structuredClone(catalogue);
  afterData.classes[0].levels[1] = [{ id: 'subclass', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { ids: [root.id] } }];
  const after = new Engine(afterData);
  const character = before.createCharacter('saved', 'Saved', [{ id: 'main', class: 'class', level: 1 }]);
  character.selections['class/main/1/subclass/choice/skill'] = [{ id: 'old-pick', feature: child.id }];
  character.resources['pool/character/character/meter'] = { spent: 8, current: 2, grants: [JSON.stringify(['class/main/1/subclass', 'load'])] };
  const migrated = migrateCharacterStructure(character, before, after);
  assert.equal(after.evaluate(migrated).status, 'valid');
  assert.equal(migrated.selections['class/main/1/subclass'][0].feature, root.id);
  assert.equal(migrated.selections['class/main/1/subclass/pick/retained/choice/skill'][0].id, 'old-pick');
  assert.ok(character.selections['class/main/1/subclass/choice/skill']);
  assert.equal(after.evaluate(migrated).resources['pool/character/character/meter'].current, 2);
});
