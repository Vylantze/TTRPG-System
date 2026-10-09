import test from 'node:test';
import assert from 'node:assert/strict';
import { descriptionTokenValues, validateCatalogue } from '@/dist/index.js';
import { exampleCharacter } from '@/examples/dnd2014-character.js';

test('explicit description tokens resolve aliases, named stats and class levels only', () => {
  const { engine, character } = exampleCharacter({ classes: [{ class: 'wizard', level: 3 }] });
  const result = engine.evaluate(character);
  const text = 'Constitution modifier {{CON}} {{stat:constitution}} {{class:dnd5e:2014:wizard}} {{UNKNOWN}} {{stat:absent}} {{1+2}} {{ CON }}';
  const values = descriptionTokenValues(text, engine, character, result);
  assert.deepEqual(values.map((value) => value.value), [result.stats['modifier.constitution'].value, result.stats.constitution.value, 3, result.stats['modifier.constitution'].value]);
  assert.deepEqual(values.map((value) => text.slice(value.start, value.end)), ['{{CON}}', '{{stat:constitution}}', '{{class:dnd5e:2014:wizard}}', '{{ CON }}']);
  assert.match(values[0].label, /Constitution modifier/i);
  const unavailable = { ...result, stats: { ...result.stats, constitution: undefined } };
  assert.deepEqual(descriptionTokenValues('{{stat:constitution}}', engine, character, unavailable), []);
});

test('description controls validate their types and token aliases without changing rules', () => {
  const { engine } = exampleCharacter();
  for (const extra of [{ processDescription: 'false' }, { descriptionOverride: 42 }]) {
    const catalogue = structuredClone(engine.catalogue);
    Object.assign(catalogue.features[0], extra);
    assert.equal(validateCatalogue(catalogue)[0].code, 'SCHEMA');
  }
  const catalogue = structuredClone(engine.catalogue);
  catalogue.system.descriptionTokens = { 'bad alias': 'constitution' };
  assert.equal(validateCatalogue(catalogue)[0].code, 'SCHEMA');
});
