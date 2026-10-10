import test from 'node:test';
import assert from 'node:assert/strict';
import { createDnd2014Engine } from '@/dist/systems/dnd5e-2014/index.js';
import { pickPath, assignEquipment, deployCompanion, finalizeCharacter, rollFeature, adjustResource } from '@/dist/index.js';

const prefix = 'dnd5e:2014:';
const engine = createDnd2014Engine();
function complete(cls, level, specialist = 'alchemist') {
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
    const features = engine.getSelectionFeatures(slot.definition).filter((feature) => (feature.repeat?.maximum ?? 1) > 1 || !acquired.has(feature.id)).sort((a, b) => Number(b.id === `${prefix}race.human` || b.id === `${prefix}artificer.${specialist}`) - Number(a.id === `${prefix}race.human` || a.id === `${prefix}artificer.${specialist}`));
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

for (const specialist of ['alchemist', 'armorer', 'artillerist', 'battle-smith']) {
  for (const level of [3, 9, 20]) test(`Artificer ${specialist} completes at ${level}`, () => {
    const { character, result } = complete('artificer', level, specialist);
    assert.equal(result.stats.infusionsKnown.value, level === 3 ? 4 : level === 9 ? 6 : 12);
    assert.equal(result.stats.infusionsActive.value, level === 3 ? 2 : level === 9 ? 3 : 6);
    assert.equal(result.stats.srdCasterLevel.value, Math.ceil(level / 2));
    assert.equal(result.stats['resource.capacity.hit-dice.d8'].value, level);
    assert.ok(!result.instances.some((instance) => instance.active && instance.feature.startsWith(`${prefix}artificer.${specialist === 'alchemist' ? 'battle-smith' : 'alchemist'}.`)));
    assert.equal(character.deployedCompanions, undefined);
  });
}

test('Infusions reject incompatible items, support external recipients, and do not refresh charges on reassignment', () => {
  let { character, result } = complete('artificer', 3);
  character = finalizeCharacter(engine, character, 'finish');
  const technique = result.instances.find((instance) => instance.feature === `${prefix}artificer.infusion.armor-of-magical-strength` && instance.active);
  assert.ok(technique);
  const item = engine.catalogue.items.find((item) => item.category === 'Armor');
  character = assignEquipment(engine, character, technique.id, { recipient: 'Ally armor', item: item.id, attuned: true });
  result = engine.evaluate(character);
  const resource = Object.values(result.resources).find((pool) => pool.key === 'infusion-magical-strength');
  assert.equal(resource.capacity, 6);
  character = adjustResource(engine, character, resource.id, -2, 'spend');
  character = assignEquipment(engine, character, technique.id);
  character = assignEquipment(engine, character, technique.id, { recipient: 'Other ally armor', item: item.id, attuned: true });
  assert.equal(engine.evaluate(character).resources[resource.id].current, 4);
  assert.throws(() => assignEquipment(engine, character, technique.id, { recipient: 'Ally', item: 'artificer-material.ring', attuned: true }), /incompatible/);
});

test('Steel Defender panel resources exist only while deployed and repair spends a use on roll', () => {
  let { character, result } = complete('artificer', 3, 'battle-smith');
  character = finalizeCharacter(engine, character, 'finish');
  const instance = result.instances.find((instance) => instance.feature === `${prefix}artificer.battle-smith.steel-defender` && instance.active);
  assert.ok(!Object.values(result.resources).some((pool) => pool.key === 'companion-steel-defender-hp'));
  character = deployCompanion(engine, character, instance.id, true, 'deploy');
  result = engine.evaluate(character);
  assert.ok(Object.values(result.resources).some((pool) => pool.key === 'companion-steel-defender-hp'));
  const roll = result.instances.find((instance) => instance.feature === `${prefix}artificer.battle-smith.steel-defender.roll.repair` && instance.active);
  const rolled = rollFeature(engine, character, roll.id, 'repair', () => 0);
  const pool = Object.values(engine.evaluate(rolled.character).resources).find((pool) => pool.key === 'steel-defender-repair');
  assert.equal(pool.current, 2);
});

test('Artificer multiclass spell slots round only Artificer levels up', () => {
  const multi = createDnd2014Engine({ multiclass: true });
  const character = multi.createCharacter('multi', 'Multi', [{ id: 'artificer', class: prefix + 'artificer', level: 3 }, { id: 'paladin', class: prefix + 'paladin', level: 3 }]);
  for (const ability of ['intelligence', 'strength', 'charisma']) character.inputs['base.' + ability] = 14;
  const result = multi.evaluate(character);
  assert.equal(result.stats.srdCasterLevel.value, 3);
  assert.equal(result.stats['spellSlots.1'].value, 4);
  assert.equal(result.stats['spellSlots.2'].value, 2);
});

test('Two high-level cannons have separate HP, share creation uses, and expose only their chosen mode', () => {
  let { character, result } = complete('artificer', 20, 'artillerist');
  character = finalizeCharacter(engine, character, 'finish');
  const cannons = result.instances.filter((instance) => instance.active && engine.getFeature(instance.feature)?.companion?.kind === 'object');
  assert.equal(cannons.length, 2);
  character = deployCompanion(engine, character, cannons[0].id, true, 'create-first', undefined, 'Force Ballista');
  assert.throws(() => deployCompanion(engine, character, cannons[1].id, true, 'create-second', undefined, 'Protector'), /resource|available|insufficient/i);
  result = engine.evaluate(character);
  const paid = result.capabilities.find((capability) => capability.source === cannons[1].id && capability.definition.name === 'Create cannon (slot 1)');
  character = deployCompanion(engine, character, cannons[1].id, true, 'create-second', paid.id, 'Protector');
  result = engine.evaluate(character);
  assert.equal(Object.values(result.resources).filter((pool) => /^companion-(second-)?cannon-hp$/.test(pool.key)).length, 2);
  assert.ok(result.capabilities.some((capability) => capability.source === cannons[0].id && capability.definition.name === 'Improved Force Ballista'));
  assert.ok(!result.capabilities.some((capability) => capability.source === cannons[0].id && capability.definition.name.includes('Flamethrower')));
});
