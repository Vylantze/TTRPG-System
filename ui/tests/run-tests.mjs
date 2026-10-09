import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { finalizeCharacter, spellGroups, featureRollInstances, rollFeature, applyFeatureRoll } from '@/dist/index.js';
import { exampleCharacter } from '@/examples/dnd2014-character.js';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const model = await server.ssrLoadModule('/src/workspace.ts');
const { App } = await server.ssrLoadModule('/src/App.tsx');
const { RulesText, FeatureRules, ReferencePopup } = await server.ssrLoadModule('/src/RulesText.tsx');
const { FeatureRequirements } = await server.ssrLoadModule('/src/FeatureRequirements.tsx');
const { CharacterFeatures } = await server.ssrLoadModule('/src/CharacterFeatures.tsx');
const { ResourceSummary } = await server.ssrLoadModule('/src/ResourceSummary.tsx');
const { SelectionCard } = await server.ssrLoadModule('/src/SelectionCard.tsx');
const { addStarterCharacters, addStarterInventory, migrateMoney } = await server.ssrLoadModule('/src/starter-characters.ts');
const { CharacterRuleContext } = await server.ssrLoadModule('/src/character-rule-context.ts');
const starterSaves = JSON.parse(readFileSync(new URL('../../src/systems/dnd5e-2014/starter-characters.json', import.meta.url), 'utf8'));
const { featureHref } = await server.ssrLoadModule('/src/feature-description.ts');
const { safeReturn } = await server.ssrLoadModule('/src/feature-origin.ts');
const { orderedSheetTabs, moveSheetTab } = await server.ssrLoadModule('/src/sheet-tabs.ts');
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

test('Items follows Skills by default, puts money first, and saved tab order survives loading', () => {
  const character = { ...starterSaves[0], tabOrder: ['items', 'stats', 'skills'] };
  const tabs = file.configurations[0].system.sheetTabs;
  assert.equal(tabs[tabs.findIndex((tab) => tab.id === 'skills') + 1].id, 'items');
  assert.deepEqual(orderedSheetTabs(tabs, ['retired', 'items']).map((tab) => tab.id), ['items', ...tabs.filter((tab) => tab.id !== 'items').map((tab) => tab.id)]);
  assert.deepEqual(moveSheetTab(['stats', 'skills', 'items'], 'items', -1), ['stats', 'items', 'skills']);
  assert.deepEqual(moveSheetTab(['stats', 'skills'], 'stats', -1), ['stats', 'skills']);
  const store = storage();
  model.writeWorkspace(store, { ...data(), characters: [character] });
  const restored = model.readWorkspace(store);
  assert.deepEqual(restored.characters[0].tabOrder, character.tabOrder);
  const html = render(restored, `#characters/${character.id}?view=items`);
  const nav = html.match(/<nav class="subnav"[^>]*>([\s\S]*?)<\/nav>/)[1];
  assert.ok(nav.indexOf('Items') < nav.indexOf('Character sheet'));
  assert.ok(html.indexOf('Copper (cp)') < html.indexOf('Chain mail'));
  assert.match(html, /Rearrange tabs/);
});

test('Races catalogue and class labels use System terminology', () => {
  const renamed = structuredClone(file);
  for (const configuration of renamed.configurations) configuration.system.terminology = { classSingular: 'Profession', classPlural: 'Professions', creatureSingular: 'Ancestry', creaturePlural: 'Ancestries', creatureTag: 'race' };
  const html = render({ ...data(), systems: [renamed] }, '#races');
  assert.match(html, /Ancestries found/);
  assert.match(html, /Professions/);
  assert.match(html, /Human/);
  assert.doesNotMatch(html, /feature-card-title[^>]*>Second Wind/);
  assert.equal(safeReturn('#races?q=elf&sort=name-desc'), '#races?q=elf&sort=name-desc');
});

test('System tabs partition skills and notes, persist ability preferences, and lead with HP', () => {
  const character = { ...starterSaves[0], displayPreferences: { 'modifierFirst:abilities': true }, notes: { ...starterSaves[0].notes, 'Note 1': 'A long custom note\n'.repeat(1000) } };
  const workspace = { ...data(), characters: [character] };
  const sheet = render(workspace, `#characters/${character.id}?view=stats`);
  assert.match(sheet, /Show scores first/);
  assert.match(sheet, /Roll Strength check/);
  assert.ok(sheet.indexOf('sheet-hit-points') < sheet.indexOf('Character details'));
  assert.doesNotMatch(sheet, /id="build-summary"/);
  assert.doesNotMatch(sheet, /Calculation for Athletics|A long custom note/);
  const notes = render(workspace, `#characters/${character.id}?view=notes`);
  assert.match(notes, /A long custom note/);
  assert.match(notes, /Add note/);
  const resources = render(workspace, `#characters/${character.id}?view=resources`);
  assert.ok(resources.indexOf('sheet-hit-points') < resources.indexOf('>Long rest</button>'));
  const store = storage();
  model.writeWorkspace(store, workspace);
  assert.deepEqual(model.readWorkspace(store).characters[0].displayPreferences, character.displayPreferences);
  assert.equal(model.readWorkspace(store).characters[0].notes['Note 1'], character.notes['Note 1']);
  const custom = structuredClone(file);
  custom.configurations.forEach((config) => config.system.sheetTabs.push({ id: 'explore', name: 'Exploration', content: 'sections', sections: ['combat'] }));
  assert.match(render({ ...workspace, systems: [custom] }, `#characters/${character.id}?view=explore`), /Combat &amp; exploration/);
});

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
  assert.match(cls.replace(/<[^>]+>/g, ''), /Hit Points at 1st Level/);
  assert.match(cls, /martial weapons/);
  assert.match(cls, /SRD 5.1 pp. 24/);
  const secondWind = render(data(), '#features/dnd5e%3A2014%3Afighter.second-wind');
  assert.match(secondWind, /1d10 \+ your fighter level/);
  const spell = render(data(), '#features/dnd5e%3A2014%3Aprepared.fireball');
  assert.match(spell, /8d6 fire damage/);
  assert.match(spell, /At Higher Levels/);
  assert.match(spell, /View Fireball Feature/);
  assert.match(render(data(), '#systems'), /Reload System/);
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
  broken.systems[0] = null;
  store.setItem(model.STORAGE_KEY, JSON.stringify(broken));
  assert.throws(() => model.readWorkspace(store), /Compressed System data is malformed/);
});
test('description refresh preserves pinned rules and rejects mechanical changes', () => {
  const older = structuredClone(file);
  older.features.forEach((f) => {
    delete f.description;
    delete f.textReferences;
    delete f.textAliases;
    delete f.processDescriptionAutomatically;
    delete f.descriptionOverride;
    delete f.textLinkContext;
    delete f.source;
    delete f.displayName;
  });
  older.configurations.forEach((c) => {
    delete c.system.tagDisplayNames;
    delete c.system.descriptionTokens;
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
  const browse = render(workspace, '#features?q=Graceful');
  assert.match(browse, /Graceful Movement/);
  assert.match(browse, /value="skill-proficiency">Trained Skill/);
  assert.doesNotMatch(browse, /internal_feature_name/);
  const detail = render(workspace, '#features/dnd5e%3A2014%3Askill.acrobatics');
  assert.match(detail, /<h1>Graceful Movement<\/h1>/);
  assert.match(detail, /class="tag">Trained Skill/);
  const legacy = structuredClone(file);
  delete legacy.features.find((feature) => feature.id.endsWith(':skill.acrobatics')).displayName;
  legacy.configurations.forEach((c) => {
    delete c.system.tagDisplayNames;
    delete c.system.descriptionTokens;
  });
  assert.match(render({ version: 1, systems: [legacy], characters: [] }, '#features?q=acrobatics'), /Proficiency: acrobatics/);
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
  assert.match(html, /Fighter/);
  assert.match(html, /Rogue/);
  assert.match(html, /Show inactive Features/);
  assert.match(html, /included Features/);
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
  assert.doesNotMatch(html, /Original character sheet/);
  assert.match(render(repeated, `#characters/${repeated.characters[1].id}?view=notes`), /Original character sheet/);
  assert.match(html, /All calculated stats/);
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

test('Feature links preserve list filters and class anchors in native anchor URLs', () => {
  const engine = model.createRegistry([file]).createEngine(file.id, file.revision);
  const origin = '#features?q=wind&tag=class-feature&sort=name-desc&page=2';
  const link = featureHref('dnd5e:2014:fighter.second-wind', engine, origin);
  const back = new URLSearchParams(link.split('?')[1]).get('returnTo');
  assert(back.includes('q=wind&tag=class-feature&sort=name-desc&page=2'));
  assert.equal(safeReturn('https://example.com'), undefined);
  assert.equal(safeReturn('#classes/x?section=level-3'), '#classes/x?section=level-3');
  const html = render(data(), '#classes/dnd5e%3A2014%3Afighter');
  assert.match(html, /returnTo=.*section%3Dclass-/);
  assert.match(html, /<a class="link" href="#features\/dnd5e%3A2014%3Afighter.second-wind/);
  const filtered = render(data(), '#features?q=Second%20Wind&sort=name-desc&tag=class-feature');
  assert.match(filtered, /value="Second Wind"/);
  assert.match(filtered, /value="name-desc" selected/);
});

test('Fighter resource UI omits Arcane Recovery, while Wizard recovery and adjustment controls remain', () => {
  const workspace = { ...data(), characters: starterSaves };
  const fighter = render(workspace, `#characters/${starterSaves[0].id}?view=resources`);
  assert.doesNotMatch(fighter, /Arcane Recovery/);
  assert.match(fighter, /Decrease Second Wind/);
  assert.match(fighter, /Increase Second Wind/);
  const wizard = render(workspace, `#characters/${starterSaves[3].id}?view=resources`);
  assert.match(wizard, /Arcane Recovery/);
  const sheet = render(workspace, `#characters/${starterSaves[0].id}`);
  assert.match(sheet, /<h2>Abilities<\/h2>/);
  assert.match(sheet, /Combat &amp; exploration/);
  assert.match(sheet, /class="sheet-table skill-list\s*"/);
  assert.doesNotMatch(sheet, /<h2>Inventory<\/h2>/);
  assert.match(render(workspace, `#characters/${starterSaves[0].id}?view=items`), /Chain mail/);
  assert.match(sheet, /class="character-facts"/);
});

test('additive item and layout updates preserve rules and safely migrate original Starter equipment', () => {
  const old = structuredClone(file);
  delete old.items;
  delete old.itemFeatures;
  old.configurations.forEach((config) => {
    delete config.system.sheetSections;
    delete config.system.sheetTabs;
    delete config.system.featureCategories;
  });
  const updated = model.updateSystemDescriptions(old, file);
  assert(updated.items.length > 0);
  const saved = structuredClone(starterSaves[0]);
  delete saved.inventory;
  saved.inputs.armorIndex = 10;
  saved.notes.Equipment = 'Original equipment';
  saved.notes['Starting money'] = '25 gp';
  saved.name = 'Custom name';
  const workspace = { ...data(), characters: [saved] };
  const migrated = addStarterInventory(workspace, starterSaves);
  assert.equal(migrated.characters[0].name, 'Custom name');
  assert.equal(migrated.characters[0].inputs.armorIndex, 0);
  assert.equal(migrated.characters[0].inventory.length, starterSaves[0].inventory.length);
  assert(!migrated.characters[0].notes.Equipment);
  assert.equal(addStarterInventory(migrated, starterSaves), migrated);
  saved.inputs.armorIndex = 3;
  assert.equal(addStarterInventory(workspace, starterSaves), workspace);
  const changed = structuredClone(file);
  changed.itemFeatures.find((feature) => feature.modifiers).modifiers[0].value++;
  assert.throws(() => model.updateSystemDescriptions(file, changed), /rules differ/);
});

test('sheet controls expose inline editing, five coin balances, sortable columns and number labels', () => {
  const html = render({ ...data(), characters: [starterSaves[0]] }, `#characters/${starterSaves[0].id}?view=stats`);
  assert.match(html, /Edit Alignment/);
  assert.doesNotMatch(html, /Edit character details/);
  const items = render({ ...data(), characters: [starterSaves[0]] }, `#characters/${starterSaves[0].id}?view=items`);
  for (const coin of ['Copper', 'Silver', 'Electrum', 'Gold', 'Platinum']) assert.match(items, new RegExp(`${coin} balance`));
  assert.match(items, /25 gp total/);
  assert.match(html, /aria-sort="ascending"/);
  assert.doesNotMatch(html, /Calculation for Athletics/);
  assert.match(render({ ...data(), characters: [starterSaves[0]] }, `#characters/${starterSaves[0].id}?view=skills`), /Calculation for Athletics/);
  assert.match(html, /Show modifiers first/);
  assert.match(html, /role="tooltip"[^>]*>Strength score/);
  assert.match(html, /role="tooltip"[^>]*>Strength modifier/);
  const resources = render({ ...data(), characters: [starterSaves[0]] }, `#characters/${starterSaves[0].id}?view=resources`);
  assert.doesNotMatch(resources, /Turn budget|Start new turn/);
  assert.match(resources, /ability-row[\s\S]*resource-card[\s\S]*Roll 1d10/);
});

test('money migration removes coins and old starting-money notes without double counting', () => {
  const old = structuredClone(starterSaves[0]);
  delete old.money;
  old.inventory.push({ id: 'coins', item: 'dnd5e:2014:item.gold-piece', quantity: 25, equipped: false });
  old.notes['Starting money'] = '25 gp';
  const migrated = migrateMoney({ ...data(), characters: [old] });
  assert.deepEqual(migrated.characters[0].money, { gp: 25 });
  assert.equal(migrated.characters[0].notes['Starting money'], undefined);
  assert.equal(migrateMoney(migrated), migrated);
  const oldSystem = structuredClone(file);
  oldSystem.configurations.forEach((config) => delete config.system.currency);
  assert(model.updateSystemDescriptions(oldSystem, file).configurations[0].system.currency);
  const changed = structuredClone(file);
  changed.configurations[0].system.currency.denominations[0].value = 2;
  assert.throws(() => model.updateSystemDescriptions(file, changed), /rules differ/);
});

test('Systems offer a dropdown and an accessible refresh control', () => {
  const html = render(data(), '#systems');
  assert.match(html, /System to load/);
  assert.match(html, /Other System from JSON/);
  assert.match(html, /aria-label="Reload DnD5e 2014"/);
  assert.match(html, /<svg aria-hidden="true"/);
});

test('System reload is atomic and preserves characters while rejecting incompatible replacements', () => {
  const workspace = { ...data(), characters: [starterSaves[0]] };
  const refreshed = structuredClone(file);
  refreshed.configurations[0].system.name = 'Refreshed DnD5e 2014';
  const next = model.reloadSystem(workspace, file, refreshed);
  assert.equal(next.characters, workspace.characters);
  assert.equal(next.systems[0].configurations[0].system.name, 'Refreshed DnD5e 2014');
  assert.equal(workspace.systems[0], file);
  assert.throws(() => model.reloadSystem(next, file, refreshed), /changed or was unloaded/);
  const wrong = structuredClone(file);
  wrong.revision++;
  wrong.configurations.forEach((config) => config.system.revision++);
  assert.throws(() => model.reloadSystem(workspace, file, wrong), /same System ID and revision/);
  const incompatible = structuredClone(file);
  incompatible.features[0].revision++;
  assert.throws(() => model.reloadSystem(workspace, file, incompatible), /revision/i);
});

test('rules descriptions render lists and paragraphs while preserving automatic links and escaping HTML', () => {
  const engine = model.createRegistry([file]).engineForCharacter(starterSaves[0]);
  const html = renderToStaticMarkup(createElement(RulesText, { engine, text: 'First paragraph.\n\n• Second Wind • Another point\n\nNext paragraph.\n\n1. First step\n2. <script>unsafe</script>' }));
  assert.match(html, /<ul><li><a[^>]*>Second Wind<\/a><\/li><li>Another point<\/li><\/ul>/);
  assert.match(html, /<p>Next paragraph.<\/p>/);
  assert.match(html, /<ol start="1">/);
  assert.doesNotMatch(html, /<script>/);
});

test('Wizard spells are separate from slots and empty slot levels are initially hidden', () => {
  const html = render({ ...data(), characters: [starterSaves[3]] }, `#characters/${starterSaves[3].id}?view=resources`);
  assert.match(html, /Show all spell slots/);
  assert.match(html, /Cantrips/);
  assert.match(html, /Level 1 spells/);
  assert.match(html, /Use Spell/);
  assert.match(html, /Decrease Spell Slot 1/);
  assert.doesNotMatch(html, /Decrease Spell Slot 2/);
  assert.match(html, /ability-row[\s\S]*Arcane Recovery/);
});

test('multiclass sheet names race and both class levels and exposes build editing', () => {
  const sample = JSON.parse(readFileSync(new URL('../../src/systems/dnd5e-2014/multiclass-sample.json', import.meta.url), 'utf8'));
  const html = render({ ...data(), characters: [sample] }, `#characters/${sample.id}`);
  assert.match(html, /Classes &amp; levels/);
  assert.match(html, /Fighter 2 \/ Wizard 3/);
  assert.match(html, /<dt>Race<\/dt><dd>Human/);
  assert.match(html, /Edit Name/);
  assert.match(html, /Edit build/);
});
test('character rule text resolves Fighter level and offers the declared healing roll', () => {
  const { engine, character } = exampleCharacter({ classes: [{ class: 'fighter', level: 2 }] });
  const result = engine.evaluate(character);
  const html = renderToStaticMarkup(createElement(CharacterRuleContext.Provider, { value: { character, result, update: () => {}, report: () => {} } }, createElement(FeatureRules, { engine, feature: engine.getFeature('dnd5e:2014:fighter.second-wind') })));
  assert.match(html, /resolved-value">2/);
  assert.match(html, /your fighter level<\/span>/);
  assert.match(html, /Roll 1d10 \+ 2/);
});

test('explicit reload accepts additive definitions and preserves character choices and balances', () => {
  const { character } = exampleCharacter();
  const incoming = structuredClone(file);
  incoming.features.push({ id: 'test:additive', revision: 1, name: 'Additive', components: [] });
  const next = model.reloadSystem({ ...data(), characters: [character] }, file, incoming);
  assert.equal(next.characters[0].contentRevisions['test:additive'], 1);
  assert.deepEqual(next.characters[0].selections, character.selections);
  assert.deepEqual(next.characters[0].resources, character.resources);
  assert.equal(model.createRegistry(next.systems).engineForCharacter(next.characters[0]).evaluate(next.characters[0]).status, 'valid');
});

test('spell results expose separate application and casting level after spending the slot', () => {
  const { engine, character } = exampleCharacter({ classes: [{ class: 'wizard', level: 5 }] });
  const ready = finalizeCharacter(engine, character, 'finalize');
  const result = engine.evaluate(ready);
  const spell = spellGroups(engine, result).find((entry) => entry.level === 1 && featureRollInstances(engine, result, entry.feature).length && entry.modes.some((mode) => mode.slotLevel === 3));
  const mode = spell.modes.find((entry) => entry.slotLevel === 3);
  const instance = featureRollInstances(engine, result, spell.feature)[0];
  const rolled = rollFeature(engine, ready, instance.id, 'spell-roll', () => 0, mode.capability.id).character;
  const show = (saved) => render({ ...data(), characters: [saved] }, `#characters/${saved.id}?view=resources`);
  const pending = show(rolled);
  assert.match(pending, /Level 3 slot spent/);
  assert.match(pending, /Mark applied/);
  assert.match(pending, /Clear rolls/);
  assert.match(pending, /Clear all rolls/);
  assert.doesNotMatch(pending, /Reroll/);
  const applied = show(applyFeatureRoll(engine, rolled, 'spell-roll', 'apply').character);
  assert.match(applied, /disabled="">Applied/);
  assert.doesNotMatch(applied, />Mark applied</);
});

test('sheet display keeps Hit Point class levels literal and resolves modifiers', () => {
  const { engine, character } = exampleCharacter({ classes: [{ class: 'wizard', level: 3 }] });
  const result = engine.evaluate(character);
  const html = renderToStaticMarkup(createElement(CharacterRuleContext.Provider, { value: { character, result, update: () => {}, report: () => {} } }, createElement(FeatureRules, { engine, feature: engine.getFeature('dnd5e:2014:wizard.hit-points') })));
  assert.match(html, /per wizard level/);
  assert.doesNotMatch(html, /text-tooltip[^>]*>wizard level/);
  assert.match(html, /resolved-value/);
});

test('spell levels collapse and free utility spells have no use control', () => {
  const html = render({ ...data(), characters: [starterSaves[3]] }, `#characters/${starterSaves[3].id}?view=resources`);
  assert.match(html, /<details class="spell-level" open=""><summary>Cantrips/);
  const cards = [...html.matchAll(/<article class="panel spell-row">([\s\S]*?)<\/article>/g)].map((match) => match[1]);
  const utility = cards.find((card) => card.includes('Mage Hand'));
  assert.ok(utility);
  assert.doesNotMatch(utility, /Use Spell/);
  const fire = cards.find((card) => card.includes('Ray of Frost'));
  assert.match(fire, />Use Spell<\/button>/);
  assert.doesNotMatch(html, /Rolling spends the ability use and saves the result/);
  assert.ok(html.indexOf('>Long rest</button>') < html.indexOf('<h2>Abilities</h2>'));
  const sheet = render({ ...data(), characters: [starterSaves[3]] }, `#characters/${starterSaves[3].id}?view=items`);
  assert.match(sheet, /Copper \(cp\)/);
  assert.doesNotMatch(sheet, /<span>cp<\/span>/);
});

test('description flags and replacement arrays separate automatic prose from explicit exceptions', () => {
  const { engine, character } = exampleCharacter({ classes: [{ class: 'wizard', level: 3 }] });
  const result = engine.evaluate(character);
  const show = (feature, contextual = true) => {
    const rules = createElement(FeatureRules, { engine, feature });
    return renderToStaticMarkup(contextual ? createElement(CharacterRuleContext.Provider, { value: { character, result, update: () => {}, report: () => {} } }, rules) : rules);
  };
  const feature = { id: 'example', revision: 1, name: 'Example', components: [], description: 'your Constitution modifier per wizard level. EXTRA', processDescriptionAutomatically: false };
  assert.doesNotMatch(show(feature), /resolved-value/);
  const override = { ...feature, descriptionOverride: [
    { originalString: 'your Constitution modifier', overrideString: '{{stat:modifier.constitution}} Constitution modifier' },
    { originalString: 'EXTRA', overrideString: '{{stat:constitution}} {{UNKNOWN}} <script>bad</script>' },
  ] };
  const html = show(override);
  assert.equal((html.match(/resolved-value/g) ?? []).length, 2);
  assert.match(html, /Constitution modifier/);
  assert.match(html, /per wizard level/);
  assert.match(html, /{{UNKNOWN}}/);
  assert.doesNotMatch(html, /<script>/);
  assert.equal((show({ ...override, processDescriptionAutomatically: true }).match(/resolved-value/g) ?? []).length, 3);
  assert.match(show(override, false), /your Constitution modifier per wizard level/);
  assert.doesNotMatch(show({ ...feature, descriptionOverride: [{ originalString: feature.description, overrideString: '' }] }), /wizard level/);
  assert.match(show({ ...feature, description: 'Example\nOriginal', descriptionOverride: [{ originalString: 'Example\nOriginal', overrideString: 'Whole source replaced' }] }), /Whole source replaced/);
  const lists = show({ ...feature, descriptionOverride: [{ originalString: feature.description, overrideString: 'First\n\n- {{stat:constitution}}\n- Constitution modifier' }] });
  assert.match(lists, /<ul>/);
  assert.equal((lists.match(/resolved-value/g) ?? []).length, 1);
});

test('saved full-string overrides migrate to arrays without losing characters', () => {
  const legacy = structuredClone(file);
  const hp = legacy.features.find((feature) => feature.id === 'dnd5e:2014:wizard.hit-points');
  hp.descriptionOverride = hp.description.replace('your Constitution modifier', '{{CON}}');
  for (const configuration of legacy.configurations) configuration.system.descriptionTokens = { CON: 'modifier.constitution' };
  const store = storage();
  store.setItem(model.STORAGE_KEY, JSON.stringify({ version: 1, systems: [legacy], characters: [starterSaves[3]] }));
  const upgraded = model.readWorkspace(store);
  assert.deepEqual(upgraded.characters[0], starterSaves[3]);
  const converted = upgraded.systems[0].features.find((feature) => feature.id === hp.id).descriptionOverride;
  assert.equal(converted[0].originalString, hp.description);
  assert.match(converted[0].overrideString, /{{stat:modifier.constitution}}/);
});

test('System reload safely retires generated Roll Features while retaining character balances', () => {
  const old = structuredClone(file);
  old.features.push({ id: 'test:retired-roll', revision: 1, name: 'Old roll', roll: { id: 'old', label: 'Old roll', dice: '1d6' }, components: [] });
  const { character } = exampleCharacter();
  const saved = { ...character, contentRevisions: { ...character.contentRevisions, 'test:retired-roll': 1 } };
  const next = model.reloadSystem({ ...data(), systems: [old], characters: [saved] }, old, file);
  assert.equal(next.characters[0].contentRevisions['test:retired-roll'], undefined);
  assert.deepEqual(next.characters[0].resources, saved.resources);
});

await server.close();
