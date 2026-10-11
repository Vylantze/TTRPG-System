import test from 'node:test';
import assert from 'node:assert/strict';
import { createDnd2014Engine } from '@/dist/systems/dnd5e-2014/index.js';

for (const level of [1, 3, 5, 7, 9]) {
  test(`Life Domain automatically grants every eligible domain spell at Cleric level ${level}`, () => {
    const engine = createDnd2014Engine();
    const character = engine.createCharacter('domain-test', 'Cleric', [{ id: 'main', class: 'dnd5e:2014:cleric', level }]);
    const life = engine.getFeature('dnd5e:2014:cleric.life');
    const slot = engine.evaluate(character).selections.find((slot) => slot.definition.id === 'domain');
    assert.ok(slot, JSON.stringify(engine.evaluate(character).selections.map((slot) => ({ id: slot.id, definition: slot.definition.id }))));
    character.selections[slot.id] = [{ id: 'life-domain', feature: life.id }];
    const evaluation = engine.evaluate(character);
    assert.ok(evaluation.instances.some((instance) => instance.feature === life.id && instance.active));
    assert.ok(!evaluation.selections.some((slot) => slot.definition.id === 'domain-spells'));
    const grants = life.components.filter((component) => component.kind === 'grantFeature' && component.feature.includes('cleric.prepared.'));
    assert.equal(grants.length, 10);
    for (const grant of grants) {
      const active = evaluation.instances.some((instance) => instance.feature === grant.feature && instance.active && instance.eligible);
      assert.equal(active, (grant.atClassLevel ?? 1) <= level, grant.feature);
    }
    assert.ok(evaluation.selections.some((slot) => slot.definition.id === 'prepared'), 'Ordinary prepared spells still require choices');
  });
}
