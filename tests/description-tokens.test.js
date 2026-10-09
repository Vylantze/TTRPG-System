import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDescriptionOverrides, descriptionTokenValues, validateCatalogue } from '@/dist/index.js';
import { exampleCharacter } from '@/examples/dnd2014-character.js';

test('explicit description tokens resolve named stats and class levels only', () => {
  const { engine, character } = exampleCharacter({ classes: [{ class: 'wizard', level: 3 }] });
  const result = engine.evaluate(character);
  const text = 'Constitution modifier {{stat:modifier.constitution}} {{stat:constitution}} {{class:dnd5e:2014:wizard}} {{UNKNOWN}} {{stat:absent}} {{1+2}} {{ stat:modifier.constitution }}';
  const values = descriptionTokenValues(text, engine, character, result);
  assert.deepEqual(values.map((value) => value.value), [result.stats['modifier.constitution'].value, result.stats.constitution.value, 3, result.stats['modifier.constitution'].value]);
  assert.deepEqual(values.map((value) => text.slice(value.start, value.end)), ['{{stat:modifier.constitution}}', '{{stat:constitution}}', '{{class:dnd5e:2014:wizard}}', '{{ stat:modifier.constitution }}']);
  assert.match(values[0].label, /Constitution modifier/i);
  const unavailable = { ...result, stats: { ...result.stats, constitution: undefined } };
  assert.deepEqual(descriptionTokenValues('{{stat:constitution}}', engine, character, unavailable), []);
});

test('description controls validate their types and override pairs without changing rules', () => {
  const { engine } = exampleCharacter();
  for (const extra of [{ processDescriptionAutomatically: 'false' }, { descriptionOverride: 42 }, { descriptionOverride: 'old string' }, { descriptionOverride: [{ originalString: '', overrideString: 'x' }] }, { descriptionOverride: [{ originalString: 'x', overrideString: 1 }] }]) {
    const catalogue = structuredClone(engine.catalogue);
    Object.assign(catalogue.features[0], extra);
    assert.equal(validateCatalogue(catalogue)[0].code, 'SCHEMA');
  }
});

test('override pairs replace exact matches without cascading, and preserve explicit ranges', () => {
  const value = applyDescriptionOverrides('CON CON con end', [{ originalString: 'CON', overrideString: '{{stat:modifier.constitution}}' }, { originalString: 'end', overrideString: '' }]);
  assert.equal(value.text, '{{stat:modifier.constitution}} {{stat:modifier.constitution}} con ');
  assert.equal(value.ranges.length, 3);
  assert.equal(applyDescriptionOverrides('AB A', [{ originalString: 'AB', overrideString: 'A' }, { originalString: 'A', overrideString: 'Z' }]).text, 'A Z');
  assert.equal(applyDescriptionOverrides('AB', [{ originalString: 'A', overrideString: 'first' }, { originalString: 'AB', overrideString: 'second' }]).text, 'firstB');
  assert.equal(applyDescriptionOverrides('a\nb', [{ originalString: 'a\nb', overrideString: 'one\n\ntwo' }]).text, 'one\n\ntwo');
});
