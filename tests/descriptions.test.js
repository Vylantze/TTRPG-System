import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Engine, parseSystemFile, validateCatalogue } from '../dist/index.js';
import { catalogue as fixture } from '../examples/catalogue.js';

const file = JSON.parse(readFileSync(new URL('../src/systems/dnd5e-2014/system.json', import.meta.url), 'utf8'));
const feature = (name) => file.features.find((f) => f.id === `dnd5e:2014:${name}`);

test('text link contexts reject malformed metadata', () => {
  for (const context of [{}, { before: [] }, { after: [' '] }, { before: [42] }, { unknown: ['spell'] }]) {
    const catalogue = structuredClone(fixture);
    catalogue.features[0].textLinkContext = context;
    assert.ok(validateCatalogue(catalogue).length);
  }
});

test('2014 JSON ships descriptions for every included Class and Feature', () => {
  parseSystemFile(file);
  for (const f of file.features) {
    assert.ok(f.description?.trim() || f.textReferences?.length, f.id);
    assert.ok(f.displayName?.trim(), f.id);
  }
  for (const config of file.configurations) for (const cls of config.classes) {
    assert.match(cls.description, /Hit Points at 1st Level/);
    assert.match(cls.description, /Equipment/);
    assert.match(cls.source, /SRD 5.1/);
    assert.doesNotMatch(cls.description, /20th \+6/, 'PDF progression tables must not spill into introductory prose');
  }
  assert.match(feature('fighter.second-wind').description, /1d10 \+ your fighter level/);
  assert.match(feature('rogue.thief').description, /Second-Story Work/);
  assert.equal((feature('ability-score-improvement').description.match(/Ability Score Improvement\n/g) ?? []).length, 3);
  assert.doesNotMatch(feature('wizard.overchannel').description, /Your Spellbook/);
  assert.match(feature('wizard.spellcasting').description, /Copying a Spell into the Book/);
  assert.match(file.configurations[0].classes.find((c) => c.name === 'Wizard').description, /Weapons: Daggers, darts, slings/);
  for (const config of file.configurations) for (const f of file.features) for (const tag of f.tags ?? [])assert.ok(config.system.tagDisplayNames[tag]?.trim(), tag);
  assert.equal(feature('skill.animal-handling').displayName, 'Animal Handling Proficiency');
});

test('supporting Features use source passages and spell wrappers only share original spell text', () => {
  for (const f of file.features) {
    if (f.description)assert.match(f.source, /#page=\d+/);
    assert.doesNotMatch(f.description ?? '', /Effects and duration: SRD|require adjudication|proficiency contribution|supplied by another origin|breathWeaponDC/);
  }
  assert.match(feature('skill.acrobatics').description, /Your Dexterity \(Acrobatics\) check covers your attempt/);
  assert.match(feature('skill.sleight-of-hand').description, /coin purse off another person/);
  assert.match(feature('expertise.arcana').description, /At 1st level, choose two of your skill proficiencies/);
  assert.match(feature('fighter.upgrade-11').description, /The number of attacks increases to three/);
  assert.doesNotMatch(feature('fighter.indomitable').description, /r ests/);
  assert.doesNotMatch(feature('rogue.thief').description, /e qual/);
  assert.doesNotMatch(feature('rogue.entry').description, /Thievesʼ Cant/);
  assert.match(feature('race.dragonborn').description, /Breath Weapon\. You can use your action/);
  assert.match(feature('dragon-ancestry.red').description, /Damage Resistance\./);
  assert.doesNotMatch(feature('dragon-ancestry.red').description, /Ability Score Increase/);
  assert.match(feature('tool.smith').description, /Each type of artisan/);
  assert.match(feature('background-replacement.insight').description, /If a character would gain the same proficiency/);
  for (const name of ['prepared.fireball', 'spellbook.fireball', 'mastery.alarm'])assert.equal(feature(name).description, undefined);
  assert.deepEqual(feature('skill.sleight-of-hand').textAliases, ['Sleight of Hand']);
});

test('spell descriptions retain complete effects and share canonical text across wrappers', () => {
  const spells = file.features.filter((f) => f.id.startsWith('dnd5e:2014:spell.'));
  assert.equal(spells.length, 204);
  for (const spell of spells) {
    assert.match(spell.description, /Casting Time:/);
    assert.match(spell.description, /Duration:/);
    assert.match(spell.source, /#page=\d+/);
  }
  assert.match(feature('spell.fireball').description, /8d6 fire damage/);
  assert.match(feature('spell.fireball').description, /At Higher Levels/);
  assert.match(feature('spell.ice-storm').description, /20-foot-radius, 40-foot-high cylinder/);
  assert.match(feature('spell.wish').description, /life drain attack/);
  assert.match(feature('spell.wish').description, /You undo a single recent event/);
  assert.match(feature('spell.wish').description, /33 percent chance/);
  for (const name of ['spellbook.fireball', 'prepared.fireball', 'signature.fireball'])assert.deepEqual(feature(name).textReferences, ['dnd5e:2014:spell.fireball']);
});
test('Class Feature category includes class and subclass abilities without categorizing individual spells or origins', () => {
  for (const name of ['fighter.second-wind', 'fighter.champion', 'fighter.remarkable-athlete', 'rogue.cunning-action', 'rogue.thief', 'wizard.spellcasting', 'wizard.arcane-recovery', 'style.defense', 'expertise.arcana', 'ability-score-improvement'])assert.ok(feature(name).tags.includes('class-feature'), name);
  for (const name of ['race.human', 'background.acolyte', 'spell.fireball', 'prepared.fireball', 'spellbook.fireball', 'feat.grappler'])assert.ok(!feature(name).tags.includes('class-feature'), name);
  for (const config of file.configurations)assert.equal(config.system.tagDisplayNames['class-feature'], 'Class Feature');
});

test('display references do not acquire Features or alter evaluation, including cycles', () => {
  const original = structuredClone(fixture), decorated = structuredClone(fixture);
  decorated.classes[0].description = 'Class narrative';
  decorated.classes[0].source = 'Custom source';
  const first = decorated.features[0], second = decorated.features[1];
  first.description = 'Feature narrative';
  first.displayName = 'Readable narrative';
  decorated.system.tagDisplayNames = { 'custom-tag': 'Readable Tag' };
  first.textReferences = [second.id];
  second.textReferences = [first.id];
  first.textAliases = ['Alternative name'];
  const a = new Engine(original), b = new Engine(decorated), character = a.createCharacter('test', 'Test', [{ id: 'main', class: original.classes[0].id, level: 1 }]);
  assert.deepEqual(b.evaluate(character), a.evaluate(character));
});

test('catalogue validation rejects malformed display text and unresolved references', () => {
  for (const [mutate, code] of [
    [(c) => {
      c.features[0].description = { html: 'invalid' };
    }, 'SCHEMA'],
    [(c) => {
      c.classes[0].description = 12;
    }, 'SCHEMA'],
    [(c) => {
      c.classes[0].source = [];
    }, 'SCHEMA'],
    [(c) => {
      c.features[0].displayName = 12;
    }, 'SCHEMA'],
    [(c) => {
      c.features[0].textAliases = [12];
    }, 'SCHEMA'],
    [(c) => {
      c.features[0].textAliases = [''];
    }, 'SCHEMA'],
    [(c) => {
      c.features[0].textAliases = ['Alias', 'Alias'];
    }, 'DUPLICATE_ID'],
    [(c) => {
      c.system.tagDisplayNames = { tag: 12 };
    }, 'SCHEMA'],
    [(c) => {
      c.features[0].textReferences = ['missing'];
    }, 'UNKNOWN_FEATURE'],
    [(c) => {
      c.features[0].textReferences = [c.features[1].id, c.features[1].id];
    }, 'DUPLICATE_ID'],
  ]) {
    const c = structuredClone(fixture);
    mutate(c);
    assert.ok(validateCatalogue(c).some((d) => d.code === code), code);
  }
});
