import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classEntryPath, selectionPath, pickPath, childPath } from '@/dist/index.js';
import { createDnd2024Engine } from '@/dist/systems/dnd5e-2024/index.js';

const read = (name) => JSON.parse(readFileSync(new URL(`../src/systems/dnd5e-2024/${name}`, import.meta.url), 'utf8'));
const P = 'dnd5e:2024:';

test('DnD5e 2024 builds all twelve SRD 5.2.1 classes, 339 spells and one shared definition', () => {
  const engine = createDnd2024Engine();
  assert.equal(engine.catalogue.classes.length, 12);
  assert.equal(engine.catalogue.features.filter((feature) => feature.tags?.includes('spell') && feature.id.startsWith(`${P}spell.`)).length, 339);
  const manifest = read('system.json');
  assert.equal(manifest.configurations.length, 6);
  for (const configuration of manifest.configurations) assert.deepEqual(configuration.system.stats, { $ref: 'definitions.json#/stats' });
});

test('every 2024 sample character is valid with its expected sheet numbers', () => {
  const engine = createDnd2024Engine();
  const samples = read('starter-characters.json').data;
  assert.equal(samples.length, 12);
  const sheet = {};
  for (const character of samples) {
    const result = engine.evaluate(character);
    assert.equal(result.status, 'valid', character.name);
    sheet[character.name] = { hp: result.stats.hitPoints.value, ac: result.stats.armorClass.value, speed: result.stats.speed.value };
  }
  // Chain Mail 16 + Defense; Chain Mail + Shield; Unarmored Defense 10 + Dex + Wis.
  assert.deepEqual(sheet['Brakka Stonewatch'], { hp: 12, ac: 17, speed: 35 });
  assert.deepEqual(sheet['Torbin Oathhammer'], { hp: 12, ac: 18, speed: 30 });
  assert.deepEqual(sheet['Jory Stillwater'], { hp: 10, ac: 15, speed: 30 });
  assert.equal(sheet['Ilyra Moonquill'].hp, 8);
  const multiclass = read('multiclass-sample.json').data;
  const result = createDnd2024Engine({ multiclass: true }).evaluate(multiclass);
  assert.equal(result.status, 'valid');
  // Fighter 3 / Wizard 2: only the Wizard levels count toward caster level.
  assert.equal(result.stats.casterLevel.value, 2);
});

test('a level 5 Goliath Champion has 2024 Fighter resources, masteries and background scores', () => {
  const engine = createDnd2024Engine();
  const character = engine.createCharacter('hero', 'Hero', [{ id: 'main', class: `${P}fighter`, level: 5 }]);
  const select = (path, features, parameters) => {
    character.selections[path] = features.map((feature, index) => ({ id: `pick-${index}`, feature: P + feature, ...(parameters?.[index] ? { parameters: parameters[index] } : {}) }));
    return features.map((_, index) => pickPath(path, `pick-${index}`));
  };
  const [species] = select('advancement/0/species', ['species.goliath']);
  select(selectionPath(childPath(species, 'giant-ancestry'), 'boon'), ['species.goliath.giant-ancestry.stone-giant']);
  const [background] = select('advancement/0/background', ['background.soldier']);
  select(selectionPath(background, 'ability-scores'), ['background.soldier.ability-scores'], [{ strength: 2, dexterity: 0, constitution: 1 }]);
  select(selectionPath('advancement/0/languages', 'standard'), ['language.giant', 'language.dwarvish']);
  select(selectionPath(classEntryPath('main', 1, 'core-traits'), 'skills'), ['skill.perception', 'skill.survival']);
  select(selectionPath(classEntryPath('main', 1, 'fighting-style'), 'style'), ['feat.defense']);
  select(selectionPath(classEntryPath('main', 1, 'weapon-mastery'), 'masteries'), ['mastery.greatsword', 'mastery.longbow', 'mastery.javelin', 'mastery.handaxe']);
  select(selectionPath(classEntryPath('main', 3, 'subclass'), 'subclass'), ['fighter.subclass.champion']);
  select(selectionPath(classEntryPath('main', 4, 'improvement'), 'feat'), ['feat.ability-score-improvement'], [{ strength: 1, dexterity: 0, constitution: 1, intelligence: 0, wisdom: 0, charisma: 0 }]);
  const result = engine.evaluate(character);
  assert.equal(result.status, 'valid', JSON.stringify(result.diagnostics));
  const stat = (id) => result.stats[id].value;
  // 10 + 2 at level 1, then 4 × (6 + 2); Strength 15 + 2 (Soldier) + 1 (ASI).
  assert.deepEqual([stat('hitPoints'), stat('strength'), stat('speed'), stat('attacksPerAction'), stat('criticalThreshold')], [44, 18, 35, 2, 19]);
  const capacity = (key) => Object.values(result.resources).find((pool) => pool.key === key).capacity;
  assert.deepEqual([capacity('second-wind'), capacity('action-surge'), capacity('giant-ancestry'), capacity('large-form'), capacity('hit-dice.d10')], [3, 1, 3, 1, 5]);
});

test('2024 caster levels round half casters up and Pact Magic follows the Warlock table', () => {
  const engine = createDnd2024Engine({ multiclass: true });
  const slots = (progressions) => {
    const result = engine.evaluate(engine.createCharacter('caster', 'Caster', progressions));
    return [1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => result.stats[`spellSlots.${level}`].value).join('/') + ` pact ${result.stats.pactSlotCount.value}@${result.stats.pactSlotLevel.value}`;
  };
  assert.equal(slots([{ id: 'a', class: `${P}wizard`, level: 20 }]), '4/3/3/3/3/2/2/1/1 pact 0@0');
  // Paladin 5: half of 5 rounded up is caster level 3 (SRD 5.2.1 p. 25).
  assert.equal(slots([{ id: 'a', class: `${P}paladin`, level: 5 }]), '4/2/0/0/0/0/0/0/0 pact 0@0');
  assert.equal(slots([{ id: 'a', class: `${P}warlock`, level: 11 }]), '0/0/0/0/0/0/0/0/0 pact 3@5');
  assert.equal(slots([{ id: 'a', class: `${P}paladin`, level: 3 }, { id: 'b', class: `${P}ranger`, level: 3 }]), '4/3/0/0/0/0/0/0/0 pact 0@0');
});

test('weapon items carry the SRD mastery that the Weapon Mastery options use', () => {
  const items = read('items.json').data;
  const itemFeatures = read('item-features.json').data;
  const features = read('features.json').data;
  const weapons = items.filter((item) => item.category === 'Weapons');
  assert.equal(weapons.length, 38);
  for (const weapon of weapons) {
    const property = itemFeatures.find((feature) => feature.id === weapon.features[0]).properties.Mastery;
    const mastery = features.find((feature) => feature.id === weapon.id.replace('item.', 'mastery.'));
    assert.match(mastery.displayName, new RegExp(`\\(${property}\\)$`), weapon.name);
  }
});

test('Eldritch Invocation prerequisites use the current Warlock level', () => {
  const engine = createDnd2024Engine();
  const status = (level, invocation) => {
    const character = engine.createCharacter('warlock', 'Warlock', [{ id: 'main', class: `${P}warlock`, level }]);
    const candidates = engine.getCandidates(character, 'class/main/1/eldritch-invocations/choice/invocations');
    return candidates.find((candidate) => candidate.feature === `${P}warlock.eldritch-invocations.${invocation}`).status;
  };
  assert.equal(status(2, 'ascendant-step'), 'invalid');
  assert.notEqual(status(5, 'ascendant-step'), 'invalid');
  // Thirsting Blade also needs Pact of the Blade.
  assert.equal(status(11, 'thirsting-blade'), 'invalid');
});

test('spell advancement shows the first class level whose spell slots reach the spell', () => {
  const engine = createDnd2024Engine();
  const levels = (id) => engine.getFeatureAdvancement(`${P}${id}`).map((row) => `${row.className} ${row.levels.join(',')}`);
  assert.deepEqual(levels('wizard.spell.fireball'), ['Wizard 5']);
  // Half casters reach level 2 spells at class level 5; Pact Magic reaches level 3 at Warlock 5.
  assert.deepEqual(levels('paladin.spell.aid'), ['Paladin 5']);
  assert.deepEqual(levels('warlock.spell.counterspell'), ['Warlock 5']);
  assert.deepEqual(levels('wizard.spell.fire-bolt'), ['Wizard 1']);
});
