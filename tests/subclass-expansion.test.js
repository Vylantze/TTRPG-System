import test from 'node:test';
import assert from 'node:assert/strict';
import { createDnd2014Engine } from '@/dist/systems/dnd5e-2014/index.js';
import { classEntryPath, Engine, migrateCharacterStructure, featureRollExpression, spellGroups, finalizeCharacter, rollFeature, applyFeatureRoll, adjustResource } from '@/dist/index.js';

const engine = createDnd2014Engine();
const prefix = 'dnd5e:2014:';
const choiceFor = (cls) => Object.entries(cls.levels).flatMap(([level, entries]) => entries.filter((entry) => entry.kind === 'chooseFeatures' && ['subclass', 'domain', 'specialist'].includes(entry.id)).map((entry) => ({ level: Number(level), entry })))[0];

function subclassCharacter(cls, level, name, rules = engine, other = []) {
  const character = rules.createCharacter('subclass-boundary', name, [{ id: 'main', class: prefix + cls, level }, ...other]);
  const choice = choiceFor(rules.catalogue.classes.find((entry) => entry.id === prefix + cls));
  const feature = choice.entry.candidates.ids.find((id) => rules.getFeature(id).name === name);
  assert.ok(feature, name);
  character.selections[classEntryPath('main', choice.level, choice.entry.id)] = [{ id: 'selected', feature }];
  return character;
}

test('named subclass choices respect their source level boundaries', () => {
  const arcana = engine.evaluate(subclassCharacter('cleric', 1, 'Arcana Domain'));
  const cantrips = arcana.selections.find((slot) => slot.definition.id === 'wizard-cantrips');
  assert.equal(cantrips.minimum, 2);
  assert.ok(spellGroups(engine, arcana).some((spell) => spell.name === 'Magic Missile' && spell.castingAbility === 'wisdom'));
  const swords = engine.evaluate(subclassCharacter('bard', 3, 'College of Swords'));
  assert.deepEqual(swords.selections.find((slot) => slot.definition.id === 'style').definition.candidates.ids, [prefix + 'style.dueling', prefix + 'style.two-weapon-fighting']);
  for (const [level, count, uses] of [[3, 2, 1], [7, 3, 1], [10, 4, 1], [15, 5, 2]]) {
    const character = subclassCharacter('fighter', level, 'Rune Knight');
    const slot = engine.evaluate(character).selections.find((entry) => entry.definition.id === 'runes');
    assert.equal(slot.minimum, count);
    const hill = slot.definition.candidates.ids.find((id) => engine.getFeature(id).name === 'Hill Rune');
    assert.equal(engine.getCandidates(character, slot.id, {}, { features: [hill] })[0].status === 'invalid', level < 7);
    character.selections[slot.id] = slot.definition.candidates.ids.slice(0, count).map((feature, index) => ({ id: String(index), feature }));
    const result = engine.evaluate(character);
    const pools = Object.values(result.resources).filter((pool) => pool.key.startsWith('rune-knight-'));
    assert.equal(pools.length, count);
    assert.ok(pools.every((pool) => pool.capacity === uses));
  }
});

test('Perfected Guardian is unavailable under the Infiltrator armor model', () => {
  for (const model of ['guardian', 'infiltrator']) {
    const character = subclassCharacter('artificer', 15, 'Armorer');
    const slot = engine.evaluate(character).selections.find((entry) => entry.definition.candidates.ids?.includes(prefix + 'artificer.armorer.guardian'));
    assert.ok(slot);
    character.selections[slot.id] = [{ id: 'model', feature: prefix + 'artificer.armorer.' + model }];
    const result = engine.evaluate(character);
    assert.equal(Object.values(result.resources).some((pool) => pool.key === 'perfected-guardian'), model === 'guardian');
    assert.equal(result.capabilities.some((cap) => cap.definition.name.includes('Perfected Guardian')), model === 'guardian');
  }
});

test('Profane Soul uses its own table and shares the combined Warlock Pact progression', () => {
  for (const [level, slots, slotLevel, known] of [[3, 1, 1, 2], [6, 2, 1, 3], [7, 2, 2, 4], [13, 2, 3, 7], [19, 2, 4, 10], [20, 2, 4, 11]]) {
    const result = engine.evaluate(subclassCharacter('blood-hunter', level, 'Order of the Profane Soul'));
    assert.equal(result.stats.pactSlotCount.value, slots);
    assert.equal(result.stats.pactSlotLevel.value, slotLevel);
    assert.equal(result.selections.find((slot) => slot.definition.id === 'known').minimum, known);
  }
  const rules = createDnd2014Engine({ multiclass: true });
  const character = subclassCharacter('blood-hunter', 9, 'Order of the Profane Soul', rules, [{ id: 'warlock', class: prefix + 'warlock', level: 1 }]);
  const result = rules.evaluate(character);
  assert.equal(result.stats.pactSlotCount.value, 2);
  assert.equal(result.stats.pactSlotLevel.value, 2);
  assert.equal(result.selections.filter((slot) => slot.definition.id === 'cantrips').reduce((total, slot) => total + slot.minimum, 0), 3);
  assert.equal(Object.values(result.resources).filter((pool) => pool.key === 'pact-slot').length, 1);
});

test('Cleric and Paladin share one Channel Divinity allowance', () => {
  const rules = createDnd2014Engine({ multiclass: true });
  const character = rules.createCharacter('channel', 'Channel', [{ id: 'cleric', class: prefix + 'cleric', level: 6 }, { id: 'paladin', class: prefix + 'paladin', level: 3 }]);
  const pools = Object.values(rules.evaluate(character).resources).filter((pool) => pool.key.includes('channel-divinity'));
  assert.equal(pools.length, 1);
  assert.equal(pools[0].capacity, 2);
});

test('Celestial grants bonus cantrips and Healing Light spends dice before applying healing', () => {
  let character = subclassCharacter('warlock', 1, 'The Celestial');
  for (let iteration = 0; iteration < 40; iteration++) {
    const result = engine.evaluate(character);
    const slot = result.selections.find((entry) => entry.picks.length < entry.minimum);
    if (!slot) break;
    const features = engine.getSelectionFeatures(slot.definition).filter((feature) => !result.instances.some((instance) => instance.active && instance.feature === feature.id));
    const chosen = features.find((feature) => engine.getCandidates(character, slot.id, {}, { features: [feature.id] })[0]?.status !== 'invalid');
    assert.ok(chosen, slot.id);
    character.selections[slot.id] = [...slot.picks, { id: String(slot.picks.length), feature: chosen.id }];
  }
  assert.equal(engine.evaluate(character).status, 'valid', JSON.stringify(engine.evaluate(character).diagnostics));
  character = finalizeCharacter(engine, character, 'finalize');
  let result = engine.evaluate(character);
  for (const name of ['Light', 'Sacred Flame']) assert.ok(spellGroups(engine, result).some((spell) => spell.name === name && spell.castingAbility === 'charisma'));
  const hp = Object.values(result.resources).find((pool) => pool.key === 'hit-points');
  const healing = Object.values(result.resources).find((pool) => pool.key === 'celestial-healing-light');
  assert.equal(healing.capacity, 2);
  character = adjustResource(engine, character, hp.id, -5, 'damage');
  const instance = result.instances.find((entry) => engine.getFeature(entry.feature).roll?.label === 'Healing Light (1d6)');
  const rolled = rollFeature(engine, character, instance.id, 'heal-roll', () => 0);
  result = engine.evaluate(rolled.character);
  assert.equal(result.resources[healing.id].available, 1);
  assert.equal(result.resources[hp.id].current, hp.current - 5);
  const applied = applyFeatureRoll(engine, rolled.character, 'heal-roll', 'apply');
  assert.equal(engine.evaluate(applied.character).resources[hp.id].current, hp.current - 4);
  assert.equal(engine.evaluate(applied.character).resources[healing.id].available, 1);
});

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
