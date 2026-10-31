import { readSystem } from '@/tools/read-system.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, parseSystemFile, validateCatalogue } from '@/dist/index.js';
import { catalogue as fixture } from '@/examples/catalogue.js';

const file = readSystem(new URL('../src/systems/dnd5e-2024/system.json', import.meta.url));
const feature = (name) => file.features.find((f) => f.id === `dnd5e:2024:${name}`);

test('text link contexts reject malformed metadata', () => {
  for (const context of [{}, { before: [] }, { after: [' '] }, { before: [42] }, { unknown: ['spell'] }]) {
    const catalogue = structuredClone(fixture);
    catalogue.features[0].textLinkContext = context;
    assert.ok(validateCatalogue(catalogue).length);
  }
});

test('2024 JSON quotes SRD 5.2.1 with page sources and has no paid or third-party content', () => {
  parseSystemFile(file);
  // The only external host is the SRD PDF itself.
  const urls = [...JSON.stringify(file).matchAll(/https?:\/\/[^\s"),]+/g)].map((match) => match[0].split('#')[0]);
  assert.deepEqual([...new Set(urls)], ['https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf']);
  const internal = new Set(['dnd5e:2024:tables', 'dnd5e:2024:resource.pact-slot']);
  for (const f of file.features) {
    if (f.description) assert.match(f.source, /^SRD 5\.2\.1 p\. \d+ \(CC BY 4\.0\).*#page=\d+$/, f.id);
    if (internal.has(f.id)) continue;
    assert.ok(f.description?.trim() || f.textReferences?.length || f.mechanicalSummary?.length || f.components.some((c) => c.kind === 'describe'), f.id);
    assert.ok(f.displayName?.trim(), f.id);
  }
  for (const config of file.configurations) for (const cls of config.classes) {
    assert.match(cls.description, /^Primary Ability: .+\nHit Point Die: D\d+ per /, cls.name);
    assert.match(cls.description, /\nStarting Equipment: Choose /, cls.name);
    assert.match(cls.source, /SRD 5\.2\.1/);
  }
  assert.match(feature('fighter.second-wind').description, /regain Hit Points equal to 1d10 plus your Fighter level/);
  assert.match(feature('rogue.subclass.thief.second-story-work').description, /Climb Speed/);
  assert.match(feature('feat.ability-score-improvement').description, /can’t increase an ability score above 20/);
  for (const config of file.configurations) for (const f of file.features) for (const tag of f.tags ?? []) assert.ok(config.system.tagDisplayNames[tag]?.trim(), tag);
  assert.equal(feature('skill.animal-handling').displayName, 'Animal Handling Proficiency');
});

test('extracted text keeps reading order, paragraphs and small-caps headings', () => {
  // Body lines once sorted below the following heading (p. 48); Acid Splash uses small caps.
  assert.doesNotMatch(feature('fighter.weapon-mastery').description, /^Wind column/);
  assert.match(feature('fighter.second-wind').description, /Fighter level\.\nYou can use this feature twice/);
  assert.match(feature('spell.acid-splash').description, /^Evocation Cantrip \(Sorcerer, Wizard\)/);
  assert.match(feature('species.dragonborn.breath-weapon').description, /^Breath Weapon\. When you take the Attack action/);
  assert.match(feature('tool.smiths-tools').description, /Ability: Strength/);
  assert.match(feature('background.soldier').description, /\nFeat: Savage Attacker/);
  assert.deepEqual(feature('skill.sleight-of-hand').textAliases, ['Sleight of Hand']);
});

test('spell descriptions retain complete effects and class entries share canonical text', () => {
  const spells = file.features.filter((f) => f.id.startsWith('dnd5e:2024:spell.') && !f.roll);
  assert.equal(spells.length, 339);
  for (const spell of spells) {
    assert.match(spell.description, /\nCasting Time: .+\nRange: .+\nComponents: .+\nDuration: /, spell.id);
    assert.match(spell.source, /#page=\d+/);
  }
  assert.match(feature('spell.fireball').description, /8d6 Fire damage/);
  for (const name of ['wizard.spell.fireball', 'sorcerer.spell.fireball']) {
    assert.deepEqual(feature(name).textReferences, ['dnd5e:2024:spell.fireball']);
    assert.equal(feature(name).description, undefined);
  }
});

test('Class Feature category includes class and subclass abilities without categorizing spells or origins', () => {
  for (const name of ['fighter.second-wind', 'fighter.subclass.champion.improved-critical', 'rogue.cunning-action', 'wizard.spellcasting', 'wizard.arcane-recovery', 'fighter.ability-score-improvement'])assert.ok(feature(name).tags.includes('class-feature'), name);
  for (const name of ['species.human', 'background.acolyte', 'spell.fireball', 'wizard.spell.fireball', 'feat.grappler', 'feat.defense'])assert.ok(!feature(name).tags.includes('class-feature'), name);
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
  const before = a.evaluate(character), after = b.evaluate(character);
  // Display names affect source labels, while all rules and contribution amounts remain identical.
  const withoutLabels = (result) => JSON.parse(JSON.stringify(result, (key, value) => key === 'label' ? undefined : value));
  assert.deepEqual(withoutLabels(after), withoutLabels(before));
  assert.ok(Object.values(after.stats).some((stat) => stat.contributions?.some((term) => term.label.includes('Readable narrative'))));
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
