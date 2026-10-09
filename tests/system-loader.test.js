import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSystemFile, catalogueFromSystemFile, compileBlocks, SystemRegistry, Engine, castSpell, recoverSelectedResources, recoverResources, useAbility, serializeCharacter } from '../dist/index.js';
import { exampleCharacter } from '../examples/dnd2014-character.js';

const text = readFileSync(new URL('../src/systems/dnd5e-2014/system.json', import.meta.url), 'utf8');
const raw = JSON.parse(text);
const fixture = () => {
  const system = { id: 'fixture', revision: 1, name: 'Custom System', allowMultipleClasses: false, characterLevel: 0,
    stats: [{ id: 'budget', name: 'Budget', kind: 'input', default: 2 }],
    commandRules: {
      spellTurn: { castingAbilityKey: 'ability', levelKey: 'tier', timeKey: 'time', ritualKey: 'ritual', bonusTime: 'quick', actionTime: 'normal' },
      selectedRecovery: { capabilityName: 'Recharge', requiredEvent: 'pause', boundaryEvent: 'cycle', budgetStat: 'budget', targets: { energy: { key: 'energy', scope: 'character', weight: 2 } } },
    },
  };
  const pool = (id, capacity) => ({ id, kind: 'defineResource', key: id, scope: 'character', units: 'uses', integer: true, capacity, recovery: [] });
  const capability = (id, metadata, costs) => ({ id, kind: 'grantCapability', name: id === 'recharge' ? 'Recharge' : id, ...(metadata ? { metadata } : {}), ...(costs ? { costs } : {}) });
  const features = [{ id: 'kit', name: 'Kit', revision: 1, components: [pool('energy', 3), pool('charges', 1),
    capability('recharge', {}, [{ key: 'charges', amount: 1 }]), capability('spend', {}, [{ key: 'energy', amount: 1 }]),
    capability('quick', { ability: 'custom', tier: 1, time: 'quick' }), capability('cantrip', { ability: 'custom', tier: 0, time: 'normal' }), capability('slow', { ability: 'custom', tier: 1, time: 'normal' })] }];
  return { format: 'ttrpg-system', version: 1, id: 'fixture', revision: 1, options: {}, features,
    configurations: [{ options: {}, id: 'fixture-catalogue', revision: 1, system, classes: [] }] };
};
const setup = () => {
  const engine = new Engine(catalogueFromSystemFile(fixture()));
  return { engine, character: engine.createCharacter('hero', 'Hero', [], [{ id: 'kit', feature: 'kit', acquiredCharacterLevel: 0 }]) };
};
const cap = (engine, character, name) => engine.evaluate(character).capabilities.find((c) => c.definition.name === name).id;
const spent = (engine, character, key) => Object.values(engine.evaluate(character).resources).find((p) => p.key === key).spent;
const fresh = () => ({ bonusActionSpell: false, otherSpell: false, onlyActionCantrips: true });

test('2014 System JSON contains all twelve option configurations and matches bundled content', () => {
  const file = parseSystemFile(text);
  assert.equal(file.configurations.length, 12);
  const registry = new SystemRegistry();
  registry.load(file);
  for (const c of file.configurations) {
    const engine = registry.createEngine(file.id, file.revision, c.options);
    assert.deepEqual(engine.catalogue, compileBlocks({ id: c.id, revision: c.revision, system: c.system, classes: c.classes, features: file.features, blocks: file.blocks }));
  }
});
test('registry loads independent Systems, isolates input and list data, and rejects duplicates', () => {
  const registry = new SystemRegistry(), input = fixture();
  registry.load(input);
  input.features[0].name = 'Mutated';
  registry.load(raw);
  assert.equal(registry.list().length, 2);
  assert.equal(registry.createEngine('fixture', 1).catalogue.features[0].name, 'Kit');
  const listing = registry.list();
  listing[1].options.feats.default = true;
  assert.equal(registry.list()[1].options.feats.default, false);
  assert.throws(() => registry.load(fixture()), (e) => e.code === 'SYSTEM_LOADED');
});
test('unloading preserves saves, disables lookup, and exact reload restores evaluation', () => {
  const { character, engine } = exampleCharacter({ classes: [{ class: 'fighter', level: 2 }] });
  const saved = serializeCharacter(character), registry = new SystemRegistry();
  registry.load(raw);
  assert.deepEqual(registry.engineForCharacter(character).evaluate(character), engine.evaluate(character));
  assert.equal(registry.unload(character.system.id, character.system.revision), true);
  assert.throws(() => registry.engineForCharacter(character), (e) => e.code === 'SYSTEM_UNAVAILABLE');
  assert.equal(serializeCharacter(character), saved);
  registry.load(raw);
  assert.equal(registry.engineForCharacter(character).evaluate(character).status, 'valid');
  const wrong = structuredClone(character);
  wrong.catalogue.revision++;
  assert.throws(() => registry.engineForCharacter(wrong), (e) => e.code === 'SYSTEM_UNAVAILABLE');
});
test('invalid hidden configurations fail atomically before registry publication', () => {
  const broken = structuredClone(raw);
  broken.configurations.at(-1).classes[0].levels['1'].find((c) => c.kind === 'grantFeature').feature = 'missing';
  const registry = new SystemRegistry();
  registry.load(fixture());
  assert.throws(() => registry.load(broken));
  assert.equal(registry.list().length, 1);
});
test('JSON loader rejects malformed versions, unsafe keys, non-JSON values, and incomplete options', () => {
  assert.throws(() => parseSystemFile('{'));
  assert.throws(() => parseSystemFile('{"__proto__":{}}'));
  const wrong = fixture();
  wrong.version = 2;
  assert.throws(() => parseSystemFile(wrong));
  const executable = fixture();
  executable.function = () => 1;
  assert.throws(() => parseSystemFile(executable));
  const missing = structuredClone(raw);
  missing.configurations.pop();
  assert.throws(() => parseSystemFile(missing), (e) => e.code === 'SYSTEM_OPTIONS');
  assert.throws(() => catalogueFromSystemFile(fixture(), { unknown: true }), (e) => e.code === 'SYSTEM_OPTIONS');
  assert.throws(() => catalogueFromSystemFile(raw, { feats: null }), (e) => e.code === 'SYSTEM_OPTIONS');
});
test('loaded revisions are explicit and catalogue identities cannot collide across Systems', () => {
  const registry = new SystemRegistry();
  registry.load(fixture());
  const next = fixture();
  next.revision = 2;
  next.configurations[0].system.revision = 2;
  next.configurations[0].revision = 2;
  registry.load(next);
  assert.equal(registry.list().length, 2);
  const conflicting = fixture();
  conflicting.id = 'other';
  conflicting.configurations[0].system.id = 'other';
  assert.throws(() => registry.load(conflicting), (e) => e.code === 'CATALOGUE_CONFLICT');
  assert.equal(registry.unload('fixture', 1), true);
  assert.equal(registry.createEngine('fixture', 2).catalogue.system.revision, 2);
});
test('engine spell command uses JSON metadata policy for an unrelated System', () => {
  const { engine, character } = setup();
  const quick = castSpell(engine, character, cap(engine, character, 'quick'), 'quick', fresh());
  assert.throws(() => castSpell(engine, quick.character, cap(engine, character, 'slow'), 'slow', quick.turn), (e) => e.code === 'BONUS_ACTION_SPELL');
  const cantrip = castSpell(engine, quick.character, cap(engine, character, 'cantrip'), 'cantrip', quick.turn);
  assert.equal(cantrip.turn.bonusActionSpell, true);
  const slow = castSpell(engine, character, cap(engine, character, 'slow'), 'slow-first', fresh());
  assert.throws(() => castSpell(engine, slow.character, cap(engine, character, 'quick'), 'quick-second', slow.turn));
});
test('engine selected recovery uses JSON targets, weighted budget and event boundaries atomically', () => {
  const { engine, character } = setup();
  const used = useAbility(engine, character, cap(engine, character, 'spend'), 'spend').character;
  const rested = recoverResources(engine, used, 'pause', 'pause');
  const restored = recoverSelectedResources(engine, rested, { energy: 1 }, 'pause', 'restore');
  assert.equal(spent(engine, restored, 'energy'), 0);
  assert.equal(spent(engine, restored, 'charges'), 1);
  assert.deepEqual(recoverSelectedResources(engine, restored, { energy: 1 }, 'pause', 'restore'), restored);
  assert.throws(() => recoverSelectedResources(engine, restored, { energy: 2 }, 'pause', 'restore'), (e) => e.code === 'EVENT_CONFLICT');
  const saved = serializeCharacter(rested);
  assert.throws(() => recoverSelectedResources(engine, rested, { energy: 2 }, 'pause', 'too-many'));
  assert.throws(() => recoverSelectedResources(engine, rested, { unknown: 1 }, 'pause', 'unknown'));
  assert.equal(serializeCharacter(rested), saved);
  const cycle = recoverResources(engine, rested, 'cycle', 'cycle');
  assert.throws(() => recoverSelectedResources(engine, cycle, { energy: 1 }, 'pause', 'stale'));
});
test('duplicate recovery target aliases and unknown command policies fail validation', () => {
  const aliases = fixture();
  aliases.configurations[0].system.commandRules.selectedRecovery.targets.alias = { key: 'energy', scope: 'character', weight: 1 };
  assert.throws(() => parseSystemFile(aliases), (e) => e.code === 'DUPLICATE_ID');
  const unknown = fixture();
  unknown.configurations[0].system.commandRules.script = 'return true';
  assert.throws(() => parseSystemFile(unknown), (e) => e.code === 'SCHEMA');
});
test('selected recovery preserves costs charged against the recovered resource itself', () => {
  const file = fixture();
  file.features[0].components.find((c) => c.id === 'recharge').costs.push({ key: 'energy', amount: 1 });
  const engine = new Engine(catalogueFromSystemFile(file));
  const character = engine.createCharacter('hero', 'Hero', [], [{ id: 'kit', feature: 'kit', acquiredCharacterLevel: 0 }]);
  const used = useAbility(engine, character, cap(engine, character, 'spend'), 'spend').character;
  const rested = recoverResources(engine, used, 'pause', 'pause');
  const restored = recoverSelectedResources(engine, rested, { energy: 1 }, 'pause', 'restore');
  assert.equal(spent(engine, restored, 'energy'), 1);
  assert.equal(spent(engine, restored, 'charges'), 1);
});
