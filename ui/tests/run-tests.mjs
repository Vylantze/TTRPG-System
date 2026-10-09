import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { exampleCharacter } from '@/examples/dnd2014-character.js';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const model = await server.ssrLoadModule('/src/workspace.ts');
const { App } = await server.ssrLoadModule('/src/App.tsx');
const { RulesText, FeatureRules, ReferencePopup } = await server.ssrLoadModule('/src/RulesText.tsx');
const { FeatureRequirements } = await server.ssrLoadModule('/src/FeatureRequirements.tsx');
const { CharacterFeatures } = await server.ssrLoadModule('/src/CharacterFeatures.tsx');
const { ResourceSummary } = await server.ssrLoadModule('/src/ResourceSummary.tsx');
const { SelectionCard } = await server.ssrLoadModule('/src/SelectionCard.tsx');
const { addStarterCharacters } = await server.ssrLoadModule('/src/starter-characters.ts');
const starterSaves = JSON.parse(readFileSync(new URL('../../src/systems/dnd5e-2014/starter-characters.json', import.meta.url), 'utf8'));
const { advancementLabels } = await server.ssrLoadModule('/src/feature-requirements.ts');
const file = JSON.parse(readFileSync(new URL('../../src/systems/dnd5e-2014/system.json', import.meta.url), 'utf8'));
function storage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
const data = () => ({ version: 1, systems: [file], characters: [] });
function render(workspace, hash = '') {
  globalThis.localStorage = storage();
  model.writeWorkspace(localStorage, workspace);
  globalThis.window = { location: { hash } };
  return renderToStaticMarkup(createElement(App));
}

test('workspace roundtrip preserves loaded rules, character choices and exact catalogue pins', () => {
  const store = storage(), { character } = exampleCharacter();
  character.buildState = 'draft';
  model.writeWorkspace(store, { ...data(), characters: [character], active: character.id });
  const restored = model.readWorkspace(store);
  assert.deepEqual(restored.characters[0], character);
  assert.equal(model.createRegistry(restored.systems).engineForCharacter(character).evaluate(character).status, 'valid');
});
test('workspace rejects malformed saves and reports storage quota failures', () => {
  const store = storage();
  store.setItem(model.STORAGE_KEY, '{"version":9}');
  assert.throws(() => model.readWorkspace(store));
  assert.throws(() => model.writeWorkspace({ setItem() {
    throw new Error('QuotaExceeded');
  } }, data()), /QuotaExceeded/);
  const duplicate = { ...data(), characters: [exampleCharacter().character, exampleCharacter().character] };
  store.setItem(model.STORAGE_KEY, JSON.stringify(duplicate));
  assert.throws(() => model.readWorkspace(store), /duplicated/);
});
test('React initial screen explains System loading and provides character import', () => {
  const html = render({ version: 1, systems: [], characters: [] });
  assert.match(html, /Every adventure starts with a Feature/);
  assert.match(html, /Load DnD5e 2014/);
  assert.match(html, /Import character/);
});
test('React Class and Feature browsers render directly from the loaded JSON', () => {
  const classes = render(data(), '#classes');
  assert.match(classes, /Explore Class/);
  assert.match(classes, /Fighter/);
  assert.match(classes, /Wizard/);
  const features = render(data(), '#features');
  assert.match(features, /Explore Features/);
  assert.match(features, /Features found/);
  const detail = render(data(), '#features/dnd5e%3A2014%3Awizard.spellcasting');
  assert.match(detail, /Building blocks/);
  assert.match(detail, /chooseFeatures/);
});
test('Class and Feature detail pages display source rules and shared spell effects', () => {
  const cls = render(data(), '#classes/dnd5e%3A2014%3Afighter');
  assert.match(cls, /Hit Points at 1st Level/);
  assert.match(cls, /martial weapons/);
  assert.match(cls, /SRD 5.1 pp. 24/);
  const secondWind = render(data(), '#features/dnd5e%3A2014%3Afighter.second-wind');
  assert.match(secondWind, /1d10 \+ your fighter level/);
  const spell = render(data(), '#features/dnd5e%3A2014%3Aprepared.fireball');
  assert.match(spell, /8d6 fire damage/);
  assert.match(spell, /At Higher Levels/);
  assert.match(spell, /View Fireball Feature/);
  assert.match(render(data(), '#systems'), /Update bundled descriptions/);
});
test('stored workspaces deduplicate repeated configuration data and read older saves', () => {
  const store = storage(), workspace = { ...data(), characters: [exampleCharacter().character] };
  model.writeWorkspace(store, workspace);
  const packed = store.getItem(model.STORAGE_KEY);
  assert.ok(packed.length < JSON.stringify(workspace).length && packed.length * 2 < 5_000_000, 'System copies should not exhaust browser storage');
  assert.deepEqual(model.readWorkspace(store).systems, workspace.systems);
  assert.deepEqual(model.readWorkspace(store).characters, workspace.characters);
  store.setItem(model.STORAGE_KEY, JSON.stringify(workspace));
  assert.deepEqual(model.readWorkspace(store).systems, workspace.systems);
  const broken = JSON.parse(packed);
  broken.systems[0].configurations[0].classes = 999;
  store.setItem(model.STORAGE_KEY, JSON.stringify(broken));
  assert.throws(() => model.readWorkspace(store), /invalid shared-data reference/);
});
test('description refresh preserves pinned rules and rejects mechanical changes', () => {
  const older = structuredClone(file);
  older.features.forEach((f) => {
    delete f.description;
    delete f.textReferences;
    delete f.textAliases;
    delete f.textLinkContext;
    delete f.source;
    delete f.displayName;
  });
  older.configurations.forEach((c) => {
    delete c.system.tagDisplayNames;
    c.classes.forEach((cls) => {
      delete cls.description;
      delete cls.source;
    });
  });
  assert.deepEqual(model.updateSystemDescriptions(older, file), file);
  const changed = structuredClone(file);
  changed.configurations[0].classes[0].maximumLevel = 19;
  assert.throws(() => model.updateSystemDescriptions(changed, file), /rules differ/);
  assert.equal(changed.configurations[0].classes[0].maximumLevel, 19);
});

test('saved System description updates preserve character edits and never restore unloaded or replaced Systems', () => {
  const old = structuredClone(file);
  old.features[0].description = 'Old summary';
  const character = exampleCharacter().character;
  const workspace = { version: 1, systems: [old], characters: [character], active: character.id };
  const updated = model.updateSystemDescriptions(old, file);
  const refreshed = model.applyDescriptionUpdate(workspace, old, updated);
  assert.deepEqual(refreshed.systems, [file]);
  assert.equal(refreshed.characters, workspace.characters);
  assert.equal(refreshed.active, workspace.active);
  const store = storage();
  model.writeWorkspace(store, refreshed);
  assert.deepEqual(model.readWorkspace(store).systems, [file]);
  assert.equal(model.applyDescriptionUpdate(refreshed, updated, structuredClone(updated)), refreshed, 'Current text does not cause another workspace write');
  const unloaded = { ...workspace, systems: [] };
  assert.equal(model.applyDescriptionUpdate(unloaded, old, updated), unloaded);
  const replaced = { ...workspace, systems: [structuredClone(old)] };
  assert.equal(model.applyDescriptionUpdate(replaced, old, updated), replaced);
});
test('bundled category refresh accepts the Class Feature tag but preserves tags used by rules', () => {
  const old = structuredClone(file);
  old.features.forEach((f) => {
    if (f.tags?.includes('class-feature')) {
      f.tags = f.tags.filter((t) => t !== 'class-feature');
      if (!f.tags.length) delete f.tags;
    }
  });
  old.configurations.forEach((c) => {
    delete c.system.tagDisplayNames['class-feature'];
  });
  assert.deepEqual(model.updateSystemDescriptions(old, file), file);
  const changed = structuredClone(file);
  changed.features.find((f) => f.id.endsWith(':prepared.fireball')).tags = [];
  assert.throws(() => model.updateSystemDescriptions(changed, file), /rules differ/);
  const prerequisite = structuredClone(file);
  prerequisite.features.find((f) => f.id.endsWith(':fighter.second-wind')).maintenance = { tag: 'class-feature' };
  const changedPrerequisite = structuredClone(prerequisite);
  changedPrerequisite.features.find((f) => f.id.endsWith(':fighter.second-wind')).tags = [];
  assert.throws(() => model.updateSystemDescriptions(changedPrerequisite, prerequisite), /rules differ/);
  const roots = structuredClone(file);
  roots.configurations.forEach((c) => {
    c.system.rootCandidates = { tags: ['class-feature'] };
  });
  const changedRoots = structuredClone(roots);
  changedRoots.features.find((f) => f.id.endsWith(':fighter.second-wind')).tags = [];
  assert.throws(() => model.updateSystemDescriptions(changedRoots, roots), /rules differ/);
  const html = render(data(), '#features');
  assert.match(html, /value="class-feature">Class Feature/);
  assert.match(render(data(), '#features/dnd5e%3A2014%3Afighter.second-wind'), /class="tag">Class Feature/);
});
test('Feature pages show Class progression timing and preserve readable prerequisite logic', () => {
  const engine = model.createRegistry([file]).createEngine(file.id, file.revision);
  const find = (name) => engine.catalogue.features.find((f) => f.id === `dnd5e:2014:${name}`);
  const surge = render(data(), '#features/dnd5e%3A2014%3Afighter.action-surge');
  assert.match(surge, /Levels &amp; requirements/);
  assert.match(surge, /Fighter level 2/);
  assert.deepEqual(advancementLabels(find('fighter.remarkable-athlete'), engine), ['Fighter level 7']);
  const athlete = render(data(), '#features/dnd5e%3A2014%3Afighter.remarkable-athlete');
  assert.match(athlete, /Requires Champion/);
  const spell = renderToStaticMarkup(createElement(FeatureRequirements, { feature: find('spellbook.fireball'), engine }));
  assert.match(spell, /Content level:<\/strong> 3/);
  assert.match(spell, /Wizard Spellcasting/);
  assert.match(spell, /3 or higher/);
  assert.doesNotMatch(spell, /Character level 3|Wizard level 1/);
  const alternate = { id: 'fixture', revision: 1, name: 'Alternate', components: [], prerequisites: { any: [{ level: 4 }, { all: [{ level: 2, kind: 'class' }, { feature: 'dnd5e:2014:fighter.champion' }] }] }, maintenance: { not: { level: 10 } } };
  const text = renderToStaticMarkup(createElement(FeatureRequirements, { feature: alternate, engine }));
  assert.match(text, /Character level 4 or higher/);
  assert.match(text, /Class level 2 or higher/);
  assert.match(text, / OR /);
  assert.match(text, / AND /);
  assert.match(text, /NOT \(Character level 10 or higher\)/);
});
test('React uses Feature and tag display names while retaining internal filter identities', () => {
  const custom = structuredClone(file), feature = custom.features.find((f) => f.id.endsWith(':skill.acrobatics'));
  feature.name = 'internal_feature_name';
  feature.displayName = 'Graceful Movement';
  feature.description = 'A readable custom description.';
  custom.configurations.forEach((c) => {
    c.system.tagDisplayNames['skill-proficiency'] = 'Trained Skill';
  });
  const workspace = { version: 1, systems: [custom], characters: [] };
  const browse = render(workspace, '#features');
  assert.match(browse, /Graceful Movement/);
  assert.match(browse, /value="skill-proficiency">Trained Skill/);
  assert.doesNotMatch(browse, /internal_feature_name/);
  const detail = render(workspace, '#features/dnd5e%3A2014%3Askill.acrobatics');
  assert.match(detail, /<h1>Graceful Movement<\/h1>/);
  assert.match(detail, /class="tag">Trained Skill/);
  const legacy = structuredClone(file);
  delete legacy.features[1].displayName;
  legacy.configurations.forEach((c) => {
    delete c.system.tagDisplayNames;
  });
  assert.match(render({ version: 1, systems: [legacy], characters: [] }, '#features'), /Proficiency: acrobatics/);
});
test('imported descriptions render as text and shared references do not recurse', () => {
  const html = renderToStaticMarkup(createElement(RulesText, { text: '<script>alert(1)</script>\n\nSecond paragraph', source: 'javascript:alert(1)' }));
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<p>Second paragraph<\/p>/);
  assert.doesNotMatch(html, /<a/);
  const feature = { id: 'loop', name: 'Loop', revision: 1, description: 'Shared text', textReferences: ['loop'], components: [] };
  const shared = renderToStaticMarkup(createElement(FeatureRules, { feature, engine: { catalogue: { id: 'fixture', system: { id: 'fixture', revision: 1 }, features: [feature] } }, openFeature() {} }));
  assert.equal((shared.match(/Shared text/g) ?? []).length, 2);
});

test('source mentions link skills and abilities within their System and popup retains original rules', () => {
  const engine = model.createRegistry([file]).createEngine(file.id, file.revision, {});
  const thief = file.features.find((f) => f.id === 'dnd5e:2014:rogue.thief');
  const html = renderToStaticMarkup(createElement(FeatureRules, { feature: thief, engine }));
  assert.match(html, /aria-haspopup="dialog"[^>]*>Cunning Action<\/a>/);
  assert.match(html, /href="#features\/dnd5e%3A2014%3Askill.sleight-of-hand\?system=/);
  assert.match(html, />Sleight of Hand<\/a>/);
  const popup = renderToStaticMarkup(createElement(ReferencePopup, { reference: { ids: ['dnd5e:2014:rogue.cunning-action'], text: 'Cunning Action' }, engine, onClose() {} }));
  assert.match(popup, /<dialog[^>]*aria-label="Cunning Action"/);
  assert.match(popup, /This action can be used only to take the Dash/);
  assert.match(popup, /Open Cunning Action Feature/);
  const ambiguous = renderToStaticMarkup(createElement(ReferencePopup, { reference: { ids: ['dnd5e:2014:expertise.arcana', 'dnd5e:2014:expertise.athletics'], text: 'Expertise' }, engine, onClose() {} }));
  assert.match(ambiguous, /Choose the Feature/);
  assert.match(ambiguous, /Arcana Expertise/);
  assert.match(ambiguous, /Athletics Expertise/);
  const prepared = file.features.find((f) => f.id === 'dnd5e:2014:prepared.fireball');
  const spell = renderToStaticMarkup(createElement(FeatureRules, { feature: prepared, engine }));
  assert.match(spell, /8d6 fire damage/);
  assert.doesNotMatch(spell, /require adjudication/);
});
test('React character builder exposes nested selections and preserves a construction draft', () => {
  const { character } = exampleCharacter();
  character.buildState = 'draft';
  const html = render({ ...data(), characters: [character] }, `#characters/${character.id}`);
  assert.match(html, /Feature selections/);
  assert.match(html, /Basic stats/);
  assert.match(html, /Finalize character/);
  assert.match(html, /Ready to finalize/);
  assert.match(html, /languages/);
  assert.match(html, /Second Wind|Fighting style|fighting style/i);
  assert.match(html, /Read Fighter Class rules/);
  assert.match(html, /Read Feature rules/);
  assert.match(html, /While you are wearing armor, you gain a \+1 bonus to AC/);
});
test('unloaded Systems keep characters exportable and display an explicit reload requirement', () => {
  const { character } = exampleCharacter();
  const html = render({ version: 1, systems: [], characters: [character] }, `#characters/${character.id}`);
  assert.match(html, /Export character/);
  assert.match(html, /Example Hero/);
  assert.match(html, /must be loaded/);
});
test('bad persisted data is displayed as a recoverable error rather than silently discarded', () => {
  globalThis.localStorage = storage();
  localStorage.setItem(model.STORAGE_KEY, 'invalid JSON');
  globalThis.window = { location: { hash: '' } };
  const html = renderToStaticMarkup(createElement(App));
  assert.match(html, /role="alert"/);
  assert.match(html, /Export stored data/);
});

test('class guide has a progression table, jump controls, and expanded source descriptions', () => {
  const html = render(data(), '#classes/dnd5e%3A2014%3Afighter');
  assert.match(html, /aria-label="Fighter contents"/);
  assert.match(html, /<caption>Fighter Features by level<\/caption>/);
  assert.match(html, /Jump to level 20/);
  assert.match(html, /1d10 \+ your fighter level/);
  assert.match(html, /class="level-row reference-section"/);
});

test('Feature pages put rules first and keep authoring details collapsed', () => {
  const html = render(data(), '#features/dnd5e%3A2014%3Afighter.second-wind');
  assert.match(html, /<h2>Rules<\/h2>/);
  assert.match(html, /<h2>At a glance<\/h2>/);
  assert.match(html, /<details class="panel technical-details"><summary>Builder &amp; engine details/);
});

test('acquired Feature library exposes search, origins and acquisition levels', () => {
  const { engine, character } = exampleCharacter({ classes: [{ class: 'fighter', level: 3 }, { class: 'rogue', level: 2 }], settings: { multiclass: true } });
  const result = engine.evaluate(character);
  const html = renderToStaticMarkup(createElement(CharacterFeatures, { engine, character, result, openFeature: () => {} }));
  assert.match(html, /Search acquired Features/);
  assert.match(html, /Acquired from/);
  assert.match(html, /Fighter · class level/);
  assert.match(html, /Rogue · class level/);
  assert.match(html, /Show inactive Features/);
  assert.match(html, /View Feature/);
});

test('resource summaries expose actual balance, maximum, recovery and shared providers', () => {
  const { engine, character } = exampleCharacter();
  const result = engine.evaluate(character);
  const pool = Object.values(result.resources).find((p) => p.key === 'second-wind');
  assert.equal(pool.tracking, true);
  const html = renderToStaticMarkup(createElement(ResourceSummary, { engine, result, pool: { ...pool, current: 0, available: 0 } }));
  assert.match(html, /Current \/ maximum/);
  assert.match(html, /0 \/ 1/);
  assert.match(html, /Short Rest: restore to maximum/i);
  assert.match(html, /Provided by: Second Wind Resource/);
  const unlimited = renderToStaticMarkup(createElement(ResourceSummary, { engine, result, pool: { ...pool, capacity: Infinity, recovery: [{ event: 'turn', amount: 2 }] } }));
  assert.match(unlimited, /No maximum/);
  assert.match(unlimited, /Turn: recover 2/);
});

test('prototype reset discards the old workspace before loading the new storage key', () => {
  const removed = [];
  const fresh = model.readWorkspace({ removeItem: (key) => removed.push(key), getItem: (key) => {
    assert.equal(key, model.STORAGE_KEY);
    return null;
  } });
  assert.deepEqual(removed, ['ttrpg-feature-forge:v1']);
  assert.deepEqual(fresh, { version: 1, systems: [], characters: [] });
});

test('Feature selections default to a dropdown with a list toggle and no HP choices', () => {
  const { engine, character } = exampleCharacter();
  const result = engine.evaluate(character);
  assert(!result.selections.some((slot) => slot.definition.id === 'hit-points'));
  const slot = result.selections.find((slot) => engine.getSelectionFeatures(slot.definition).length > 1);
  const html = renderToStaticMarkup(createElement(SelectionCard, { engine, character, slot, edit() {}, openFeature() {} }));
  assert.match(html, /<select aria-label="Feature for /);
  assert.match(html, /aria-pressed="false">Use list/);
  assert.match(html, /Choose a Feature/);
  assert.doesNotMatch(html, /class="row pagination"/);
});

test('Starter Set party loads its System, saves all five characters, and preserves edited copies on repeated imports', () => {
  const workspace = addStarterCharacters({ version: 1, systems: [], characters: [] }, file, starterSaves);
  assert.equal(workspace.characters.length, 5);
  assert.equal(workspace.systems.length, 1);
  workspace.characters[0].name = 'My renamed fighter';
  const repeated = addStarterCharacters(workspace, file, starterSaves);
  assert.equal(repeated.characters.length, 5);
  assert.equal(repeated.characters[0].name, 'My renamed fighter');
  const store = storage();
  model.writeWorkspace(store, repeated);
  assert.deepEqual(model.readWorkspace(store).characters, repeated.characters);
  const html = render(repeated, `#characters/${repeated.characters[1].id}`);
  assert.match(html, /Character details/);
  assert.match(html, /View original character sheet/);
  assert.match(html, /Calculated stats/);
  assert.match(render(workspace), /Add 2014 Starter Set party/);
});

test('Starter Set import fails atomically for invalid characters or incompatible loaded rules', () => {
  const empty = { version: 1, systems: [], characters: [] };
  const invalid = structuredClone(starterSaves);
  invalid[1].inputs['base.wisdom'] = 99;
  assert.throws(() => addStarterCharacters(empty, file, invalid));
  assert.equal(empty.characters.length, 0);
  const old = structuredClone(file);
  old.configurations.forEach((config) => config.classes = config.classes.filter((cls) => cls.id !== 'dnd5e:2014:cleric'));
  assert.throws(() => addStarterCharacters({ ...empty, systems: [old] }, file, starterSaves));
});

await server.close();
