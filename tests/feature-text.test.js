import test from 'node:test';
import assert from 'node:assert/strict';
import { FeatureTextIndex } from '@/dist/index.js';
import { readFileSync } from 'node:fs';
const definition = (id, name, extra = {}) => ({ id, name, revision: 1, components: [], ...extra });

test('ambiguous spell names require spell context without changing source wording', () => {
  const file = JSON.parse(readFileSync(new URL('../src/systems/dnd5e-2014/system.json', import.meta.url), 'utf8'));
  const index = new FeatureTextIndex(file.features);
  assert.deepEqual(index.resolve('You start with a shield and light crossbow. Bright light, darkness, fear, and sleep.'), []);
  const text = 'Cast SHIELD, the light spell, and casting\n the darkness. Fireball';
  assert.deepEqual(index.resolve(text).map((span) => span.features), [
    ['dnd5e:2014:spell.shield'], ['dnd5e:2014:spell.light'], ['dnd5e:2014:spell.darkness'], ['dnd5e:2014:spell.fireball'],
  ]);
  for (const span of index.resolve(text)) assert.equal(text.slice(span.start, span.end), span.text);
  assert.deepEqual(index.resolve('forecast light; light spellbook; Shield'), []);
  assert.deepEqual(index.resolve('cast shield', ['dnd5e:2014:spell.shield']), []);
});

test('shared description wrappers cannot bypass the canonical target context', () => {
  const index = new FeatureTextIndex([
    definition('spell', 'Light', { textLinkContext: { after: ['spell'] } }),
    definition('wrapper', 'Light', { textReferences: ['spell'] }),
  ]);
  assert.deepEqual(index.resolve('light crossbow'), []);
  assert.deepEqual(index.resolve('light spell').map((span) => span.features), [['spell']]);
});

test('automatic references preserve source text and resolve longest whole names with typography variants', () => {
  const index = new FeatureTextIndex([
    definition('skill', 'Sleight of Hand Proficiency', { textAliases: ['Sleight of Hand'] }),
    definition('action', 'Cunning Action'), definition('short', 'Action'), definition('cant', 'Thieves’ Cant'),
  ]);
  const text = '🙂 CUNNING ACTION, Sleight\n of Hand, thieves\' cant. Reaction and Cunning Actions are unrelated.';
  const spans = index.resolve(text);
  assert.deepEqual(spans.map((s) => s.features), [['action'], ['skill'], ['cant']]);
  assert.deepEqual(spans.map((s) => s.text), ['CUNNING ACTION', 'Sleight\n of Hand', 'thieves\' cant']);
  let reconstructed = '', offset = 0;
  for (const s of spans) {
    reconstructed += text.slice(offset, s.start) + s.text;
    offset = s.end;
  }
  reconstructed += text.slice(offset);
  assert.equal(reconstructed, text);
  assert.equal(index.resolve(text, ['action', 'skill', 'cant', 'short']).length, 0);
  assert.equal(index.resolve('Cunning Action', ['action']).length, 0, 'Excluding a full name must not link only its shorter suffix');
});

test('identically named wrappers resolve to their shared source, while genuine ambiguity retains all targets', () => {
  const index = new FeatureTextIndex([definition('spell', 'Fireball'), definition('prepared', 'Fireball', { textReferences: ['spell'] }), definition('first', 'Expertise'), definition('second', 'Expertise')]);
  assert.deepEqual(index.resolve('Fireball and Expertise').map((s) => s.features), [['spell'], ['first', 'second']]);
  assert.equal(index.resolve('Fireball', ['spell']).length, 0);
  assert.equal(index.resolve('<script>missing()</script>').length, 0);
});
