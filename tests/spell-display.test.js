import test from 'node:test';
import assert from 'node:assert/strict';
import { spellGroups, spellSlotPools, useAbility, adjustResource } from '@/dist/index.js';
import { exampleCharacter } from '@/examples/dnd2014-character.js';

test('spells group casting modes at their original level and upcasting spends only the chosen slot', () => {
  const { engine, character } = exampleCharacter({ classes: [{ class: 'wizard', level: 5 }] });
  const result = engine.evaluate(character);
  assert.equal(result.status, 'valid');
  const spells = spellGroups(engine, result);
  const spell = spells.find((entry) => entry.level === 1 && entry.modes.some((mode) => mode.slotLevel === 3 && !mode.ritual));
  assert(spell);
  assert.equal(spells.filter((entry) => entry.id === spell.id).length, 1);
  const mode = spell.modes.find((entry) => entry.slotLevel === 3 && !entry.ritual);
  const slots = spellSlotPools(engine, result);
  const third = slots.find((entry) => entry.level === 3).pool;
  const first = slots.find((entry) => entry.level === 1).pool;
  const used = useAbility(engine, character, mode.capability.id, 'upcast', { actionTracking: 'manual' }).character;
  const after = engine.evaluate(used);
  assert.equal(after.resources[third.id].current, third.current - 1);
  assert.equal(after.resources[first.id].current, first.current);
  assert.equal(spellGroups(engine, after).find((entry) => entry.id === spell.id).level, 1);
  const empty = adjustResource(engine, character, third.id, -third.current, 'empty');
  const unavailable = spellGroups(engine, engine.evaluate(empty)).find((entry) => entry.id === spell.id).modes.find((entry) => entry.capability.id === mode.capability.id);
  assert.equal(unavailable.available, false);
  assert.throws(() => useAbility(engine, empty, mode.capability.id, 'invalid-cast', { actionTracking: 'manual' }), /Insufficient/);
  assert(spells.some((entry) => entry.level === 0 && entry.modes.every((option) => Object.keys(option.capability.costs).length === 0)));
});
