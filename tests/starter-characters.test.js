import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deserializeCharacter, serializeCharacter, useAbility, recoverResources } from '@/dist/index.js';
import { createDnd2014Engine } from '@/dist/systems/dnd5e-2014/index.js';

const characters = JSON.parse(readFileSync(new URL('../src/systems/dnd5e-2014/starter-characters.json', import.meta.url), 'utf8'));
const engine = createDnd2014Engine();
const expected = [
  { abilities: [16, 9, 15, 11, 13, 14], hp: 12, ac: 17, speed: 30, skills: { athletics: 5, history: 2, perception: 3, persuasion: 4 } },
  { abilities: [14, 8, 15, 10, 16, 12], hp: 11, ac: 18, speed: 25, skills: { athletics: 4, intimidation: 3, medicine: 5, religion: 2 } },
  { abilities: [8, 16, 12, 13, 10, 16], hp: 9, ac: 14, speed: 25, skills: { 'acrobatics': 5, 'deception': 5, 'investigation': 3, 'performance': 5, 'sleight-of-hand': 5, 'stealth': 7 } },
  { abilities: [10, 15, 14, 16, 12, 8], hp: 8, ac: 12, speed: 30, skills: { arcana: 5, history: 5, insight: 3, perception: 3, religion: 5 } },
  { abilities: [14, 16, 15, 11, 13, 9], hp: 12, ac: 14, speed: 30, skills: { 'animal-handling': 3, 'history': 2, 'perception': 3, 'survival': 3 } },
];

test('all five Starter Set builds reproduce printed level-one ability scores, HP, AC, speed and trained skills', () => {
  assert.equal(characters.length, 5);
  characters.forEach((character, index) => {
    const result = engine.evaluate(character), target = expected[index];
    assert.equal(result.status, 'valid', JSON.stringify(result.diagnostics));
    const value = (id) => result.stats[id]?.value;
    assert.deepEqual(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map(value), target.abilities);
    assert.equal(value('hitPoints'), target.hp);
    assert.equal(value('armorClass'), target.ac);
    assert.equal(value('walkingSpeed'), target.speed);
    for (const [skill, expectedValue] of Object.entries(target.skills)) assert.equal(value(`skill.${skill}`), expectedValue, `${character.name}: ${skill}`);
    assert.equal(result.selections.filter((slot) => slot.definition.id === 'hit-points').length, 0);
    assert.equal(Boolean(result.stats.clericSpellDC), index === 1);
    assert.deepEqual(deserializeCharacter(serializeCharacter(character), engine), character);
  });
});

test('Cleric spell slots are shared, spendable and recoverable, and Cleric progression now continues past level one', () => {
  const cleric = characters[1], result = engine.evaluate(cleric);
  assert.equal(result.stats.clericSpellDC.value, 13);
  assert.equal(result.stats.clericSpellAttack.value, 5);
  const pool = Object.values(result.resources).find((p) => p.key === 'spell-slot.1');
  assert.equal(pool.capacity, 2);
  assert.equal(pool.current, 2);
  const spell = result.capabilities.find((c) => c.definition.name === 'Bless');
  const { character: spent } = useAbility(engine, cleric, spell.id, 'cast-bless', { actions: { action: 1 }, context: { spellComponentsAvailable: true } });
  assert.equal(engine.evaluate(spent).resources[pool.id].current, 1);
  assert.equal(engine.evaluate(recoverResources(engine, spent, 'long-rest', 'rest')).resources[pool.id].current, 2);
  const advanced = structuredClone(cleric);
  advanced.progressions[0].level = 2;
  advanced.history.push({ progression: 'class-0', level: 2 });
  assert.equal(engine.evaluate(advanced).status, 'valid', JSON.stringify(engine.evaluate(advanced).diagnostics));
  const invalid = { ...cleric, notes: { Equipment: 42 } };
  assert.throws(() => serializeCharacter(invalid), /notes must be text/);
});
