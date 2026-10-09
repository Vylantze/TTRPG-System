import test from 'node:test';
import assert from 'node:assert/strict';
import { createDnd2014Engine } from '@/dist/systems/dnd5e-2014/index.js';
import { pickPath, spellSlotPools, finalizeCharacter, adjustResource, rollFeature, applyFeatureRoll, recoverResources, serializeCharacter, deserializeCharacter } from '@/dist/index.js';
import { exampleCharacter } from '@/examples/dnd2014-character.js';

const prefix = 'dnd5e:2014:';
const engine = createDnd2014Engine();
function complete(cls, level) {
  const character = engine.createCharacter(`test-${cls}-${level}`, cls, [{ id: 'primary', class: prefix + cls, level }]);
  for (let iteration = 0; iteration < 150; iteration++) {
    const result = engine.evaluate(character);
    const slot = [...result.selections].sort((a, b) => Number(!a.id.startsWith('advancement/')) - Number(!b.id.startsWith('advancement/'))).find((entry) => entry.picks.length < entry.minimum);
    if (!slot) {
      assert.equal(result.status, 'valid', JSON.stringify(result.diagnostics));
      return { character, result };
    }
    let chosen;
    const acquired = new Set(result.instances.filter((instance) => instance.active && instance.eligible).map((instance) => instance.feature));
    const features = engine.getSelectionFeatures(slot.definition).filter((feature) => (feature.repeat?.maximum ?? 1) > 1 || !acquired.has(feature.id)).sort((a, b) => Number(b.id === `${prefix}race.human`) - Number(a.id === `${prefix}race.human`));
    for (const feature of features) {
      const parameters = {};
      if (feature.id === `${prefix}ability-score-improvement`) {
        const ability = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].find((ability) => result.stats[ability].value <= 18);
        if (!ability) continue;
        for (const key of Object.keys(feature.parameters)) parameters[key] = key === ability ? 2 : 0;
      }
      const candidate = engine.getCandidates(character, slot.id, parameters, { features: [feature.id] })[0];
      if (!candidate || candidate.status === 'invalid') continue;
      chosen = { id: `pick-${slot.picks.length}`, feature: feature.id, parameters };
      break;
    }
    assert.ok(chosen, `No valid choice for ${cls} ${level}: ${slot.id}`);
    character.selections[slot.id] = [...(character.selections[slot.id] ?? []), chosen];
    assert.ok(pickPath(slot.id, chosen.id));
  }
  assert.fail('Selection expansion did not finish');
}

for (const [cls, die] of Object.entries({ barbarian: 12, bard: 8, cleric: 8, druid: 8, monk: 8, paladin: 10, ranger: 10, sorcerer: 6, warlock: 8 })) {
  for (const level of [1, 5, 20]) test(`${cls} has a completable SRD progression at level ${level}`, () => {
    const { result } = complete(cls, level);
    assert.equal(result.characterLevel, level);
    const dice = Object.values(result.resources).find((pool) => pool.key === `hit-dice.d${die}`);
    assert.equal(dice.capacity, level);
    assert.equal(dice.current, level);
    assert.equal(result.stats.proficiencyBonus.value, 2 + Math.floor((level - 1) / 4));
    if (cls === 'bard') assert.ok(!engine.catalogue.features.find((feature) => feature.id === `${prefix}bard.expertise`).components[0].candidates.ids.includes(`${prefix}expertise.thieves-tools`));
    if (cls === 'monk' && level > 1) assert.equal(result.stats.walkingSpeed.value, level === 5 ? 40 : 60);
    if (cls === 'warlock') {
      const pact = spellSlotPools(engine, result).find(({ pool }) => pool.key === 'pact-slot');
      assert.equal(pact.level, Math.min(5, Math.ceil(level / 2)));
      assert.equal(pact.pool.capacity, level === 1 ? 1 : level === 5 ? 2 : 4);
    }
  });
}

test('Hit Dice spend on roll, heal only on application, and share a long-rest recovery budget', () => {
  const { engine: multi, character } = exampleCharacter({ classes: [{ class: 'fighter', level: 2 }, { class: 'wizard', level: 3 }], settings: { multiclass: true } });
  let ready = finalizeCharacter(multi, character, 'finish');
  const initial = multi.evaluate(ready);
  const hp = Object.values(initial.resources).find((pool) => pool.key === 'hit-points');
  const fighterDice = Object.values(initial.resources).find((pool) => pool.key === 'hit-dice.d10');
  const wizardDice = Object.values(initial.resources).find((pool) => pool.key === 'hit-dice.d6');
  const die = initial.instances.find((instance) => instance.feature === `${prefix}hit-dice.d10.roll`);
  ready = adjustResource(multi, ready, hp.id, -20, 'damage');
  const rolled = rollFeature(multi, ready, die.id, 'die', () => 0.4);
  assert.equal(multi.evaluate(rolled.character).resources[fighterDice.id].current, 1);
  assert.equal(multi.evaluate(rolled.character).resources[hp.id].current, hp.current - 20);
  const applied = applyFeatureRoll(multi, rolled.character, 'die', 'apply');
  assert.equal(multi.evaluate(applied.character).resources[hp.id].current, hp.current - 20 + rolled.outcome.total);
  ready = adjustResource(multi, applied.character, wizardDice.id, -3, 'spend-wizard');
  assert.throws(() => recoverResources(multi, ready, 'long-rest', 'too-many', { 'hit-dice.d6': 3 }), /budget/);
  assert.throws(() => recoverResources(multi, ready, 'long-rest', 'unknown', { unknown: 1 }), /Unknown/);
  const rested = recoverResources(multi, ready, 'long-rest', 'rest', { 'hit-dice.d6': 1, 'hit-dice.d10': 1 });
  const result = multi.evaluate(rested);
  assert.equal(result.resources[hp.id].current, hp.capacity);
  assert.equal(result.resources[fighterDice.id].current, 2);
  assert.equal(result.resources[wizardDice.id].current, 1);
  assert.deepEqual(recoverResources(multi, rested, 'long-rest', 'rest', { 'hit-dice.d6': 1, 'hit-dice.d10': 1 }), rested);
  assert.deepEqual(deserializeCharacter(serializeCharacter({ ...rested, tabOrder: ['items', 'stats'] })).tabOrder, ['items', 'stats']);
});
