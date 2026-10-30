import { readSystem } from '@/tools/read-system.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup, renderToPipeableStream } from 'react-dom/server';
import { PassThrough } from 'node:stream';
import { Engine, finalizeCharacter, spellGroups, featureRollInstances, rollFeature, applyFeatureRoll, applyEdit } from '@/dist/index.js';
import { exampleCharacter } from '@/examples/dnd2014-character.js';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const model = await server.ssrLoadModule('/src/lib/workspace.ts');
const { App } = await server.ssrLoadModule('/src/app/App.tsx');
const { RulesText, FeatureRules, ReferencePopup } = await server.ssrLoadModule('/src/features/catalogue/components/RulesText.tsx');
const { FeatureRequirements } = await server.ssrLoadModule('/src/features/catalogue/components/FeatureRequirements.tsx');
const { CharacterFeatures } = await server.ssrLoadModule('/src/features/characters/components/CharacterFeatures.tsx');
const { ResourceSummary } = await server.ssrLoadModule('/src/features/characters/components/ResourceSummary.tsx');
const { CompanionPanels } = await server.ssrLoadModule('/src/features/characters/components/CompanionPanels.tsx');
const { EquipmentEffects } = await server.ssrLoadModule('/src/features/characters/components/EquipmentEffects.tsx');
const { SelectionCard } = await server.ssrLoadModule('/src/features/characters/components/SelectionCard.tsx');
const { addStarterCharacters, addStarterInventory, migrateMoney } = await server.ssrLoadModule('/src/features/characters/model/starter-characters.ts');
const { CharacterRuleContext } = await server.ssrLoadModule('/src/features/characters/model/character-rule-context.ts');
const starterSaves = JSON.parse(readFileSync(new URL('../../src/systems/dnd5e-2014/starter-characters.json', import.meta.url), 'utf8')).data;
const { featureHref } = await server.ssrLoadModule('/src/features/catalogue/model/feature-description.ts');
const { safeReturn } = await server.ssrLoadModule('/src/features/catalogue/model/feature-origin.ts');
const { orderedSheetTabs, moveSheetTab } = await server.ssrLoadModule('/src/features/characters/model/sheet-tabs.ts');
const { advancementLabels } = await server.ssrLoadModule('/src/features/catalogue/model/feature-requirements.ts');
const file = model.decodeWorkspace({ version: 1, systems: [readSystem(new URL('../../src/systems/dnd5e-2014/system.json', import.meta.url))], characters: [] }).systems[0];

test('calculation display renders signed contributions and their reasons instead of inactive inputs', async () => {
  const { StatCalculation } = await server.ssrLoadModule('/src/features/characters/components/StatCalculation.tsx');
  const engine = { getStatDefinition: () => ({ name: 'Defense' }) };
  const result = { stats: { defense: { value: 15, base: 10, modifiers: [], contributions: [{ amount: 16, label: 'Chain mail' }, { amount: 2, label: 'Shield' }, { amount: -3, label: 'Penalty' }, { amount: 0, label: 'Unused' }] } } };
  const html = renderToStaticMarkup(createElement(StatCalculation, { id: 'defense', engine, result, character: {} }));
  assert.match(html, /16 \(Chain mail\)/);
  assert.match(html, /\+ 2 \(Shield\)/);
  assert.match(html, /− 3 \(Penalty\)/);
  assert.doesNotMatch(html, /Base:|Applied|Inactive|Unused/);
  const empty = { stats: { defense: { value: 0, base: 0, modifiers: [], contributions: [] } } };
  assert.match(renderToStaticMarkup(createElement(StatCalculation, { id: 'defense', engine, result: empty, character: {} })), /0 \(Base, Defense\)/);
  const canceled = { stats: { defense: { value: 0, base: 10, modifiers: [], contributions: [{ amount: 10, label: 'Armor' }, { amount: -10, label: 'Penalty' }] } } };
  const canceledHtml = renderToStaticMarkup(createElement(StatCalculation, { id: 'defense', engine, result: canceled, character: {} }));
  assert.doesNotMatch(canceledHtml, /Base, Defense/);
  assert.match(canceledHtml, /− 10 \(Penalty\)/);
});

test('existing sample characters display evaluated equipment and race sources without formulas', async () => {
  const { StatCalculation } = await server.ssrLoadModule('/src/features/characters/components/StatCalculation.tsx');
  const registry = model.createRegistry([file]);
  for (const character of starterSaves) {
    const engine = registry.engineForCharacter(character), result = engine.evaluate(character);
    for (const id of Object.keys(result.stats)) {
      const html = renderToStaticMarkup(createElement(StatCalculation, { id, engine, result, character }));
      assert.doesNotMatch(html, /Base:|then |otherwise|table at|×|÷|minimum \d|maximum \d/);
    }
  }
  const cleric = starterSaves[1];
  const html = await render({ ...data(), characters: [cleric] }, `#characters/${cleric.id}?view=stats`);
  assert.match(html, /16 \(Chain mail\)/);
  assert.match(html, /\+ 2 \(Shield\)/);
  assert.match(html, /25 \(Hill Dwarf: Walking Speed\)/);
  assert.doesNotMatch(html, /Armor Base table|Worn armor index:|Base:/);
});

test('HP defaults to a compact card and saved preferences restore expanded controls', async () => {
  const { HitPoints } = await server.ssrLoadModule('/src/features/characters/components/HitPoints.tsx');
  const character = starterSaves[1], engine = model.createRegistry([file]).engineForCharacter(character), result = engine.evaluate(character);
  const props = { character, engine, result, update: () => {}, report: () => {} };
  const compact = renderToStaticMarkup(createElement(HitPoints, props));
  assert.match(compact, /health-compact-card/);
  assert.match(compact, /Expand Hit points/);
  assert.match(compact, /11 \/ 11/);
  assert.doesNotMatch(compact, /Damage or healing amount|Temporary HP/);
  const expanded = renderToStaticMarkup(createElement(HitPoints, { ...props, character: { ...character, displayPreferences: { healthExpanded: true } } }));
  assert.match(expanded, /Collapse Hit points/);
  assert.match(expanded, /Damage or healing amount/);
  assert.match(expanded, /aria-label="Current Hit points"[^>]*type="number"[^>]*min="0"[^>]*max="11"/);
  assert.doesNotMatch(expanded, /Decrease Hit Points|Increase Hit Points/);
});

test('subfeatures and Class choices include their Feature or choice name without a Class parent tag', async () => {
  const { instanceFeatureName } = await server.ssrLoadModule('/src/features/catalogue/model/feature-instance-name.ts');
  const character = starterSaves[0], engine = model.createRegistry([file]).engineForCharacter(character), result = engine.evaluate(character);
  const defense = result.instances.find((instance) => instance.feature === 'dnd5e:2014:style.defense');
  assert.ok(defense);
  assert.equal(instanceFeatureName(defense, engine, result), 'Fighting Style: Defense');
  const parent = result.instances.find((instance) => instance.feature === 'dnd5e:2014:fighter.second-wind');
  assert.equal(instanceFeatureName({ ...defense, parent: parent.id }, engine, result), 'Second Wind: Defense');
  assert.equal(engine.getFeature(defense.feature).displayName, 'Defense');
});
function storage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
const data = () => ({ version: 1, systems: [file], characters: [] });
function render(workspace, hash = '') {
  globalThis.localStorage = storage();
  globalThis.window = { location: { hash } };
  return new Promise((resolve, reject) => {
    const output = new PassThrough();
    let html = '';
    output.on('data', (chunk) => {
      html += chunk.toString();
    });
    output.on('end', () => resolve(html.replace(/<!--[\s\S]*?-->/g, '')));
    output.on('error', reject);
    const stream = renderToPipeableStream(createElement(App, { initialWorkspace: workspace, persist: async () => {} }), {
      onAllReady() { stream.pipe(output); },
      onError: reject,
    });
  });
}

test('Items follows Skills by default, puts money first, and saved tab order survives loading', async () => {
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
  const html = await render(restored, `#characters/${character.id}?view=items`);
  const nav = html.match(/<nav class="subnav"[^>]*>([\s\S]*?)<\/nav>/)[1];
  assert.ok(nav.indexOf('Items') < nav.indexOf('Character sheet'));
  const itemPanel = html.slice(html.indexOf('id="character-tab-panel"'));
  assert.ok(itemPanel.indexOf('Copper (cp)') >= 0);
  assert.ok(itemPanel.indexOf('Copper (cp)') < itemPanel.indexOf('Chain mail'));
  assert.match(html, /Rearrange tabs/);
});

test('System-defined overview, health workflow, roll controls, spells, and resource actions render on sample sheets', async () => {
  const character = { ...starterSaves[0], displayPreferences: { ...starterSaves[0].displayPreferences, healthExpanded: true } };
  const workspace = { ...data(), characters: [character] };
  const sheet = await render(workspace, `#characters/${character.id}?view=stats`);
  assert.match(sheet, /Damage or healing amount/);
  assert.match(sheet, /Temporary HP/);
  assert.match(sheet, /Roll Initiative/);
  assert.match(sheet, /Roll Strength check/);
  assert.match(sheet, /role="tablist"/);
  assert.match(sheet, /role="tabpanel"/);
  assert.match(sheet, /Roll history/);
  assert.doesNotMatch(sheet, />Death save failures</);
  assert.ok(sheet.indexOf('sheet-overview') < sheet.indexOf('class="subnav"'));
  const actions = await render(workspace, `#characters/${character.id}?view=resources`);
  assert.match(actions, /Ability action cost/);
  assert.doesNotMatch(actions, /id="tab-actions"/);
  assert.match(actions, /Second Wind/);
  assert.doesNotMatch(actions, /Arcane Recovery/);
  assert.match(actions, /Equipped weapons/);
  const inventory = await render(workspace, `#characters/${character.id}?view=items`);
  assert.match(inventory, /Search inventory/);
  assert.match(inventory, /All categories/);
  const wizard = starterSaves.find((entry) => entry.progressions.some((progression) => progression.class.includes('wizard')));
  const spells = await render({ ...data(), characters: [wizard] }, `#characters/${wizard.id}?view=spells`);
  assert.match(spells, /Search spells/);
  assert.match(spells, /Casting time/);
  assert.match(spells, /spell attack/);
  assert.match(spells, /save DC/);
});

test('Races catalogue and class labels use System terminology', async () => {
  const renamed = structuredClone(file);
  for (const configuration of renamed.configurations) configuration.system.terminology = { classSingular: 'Profession', classPlural: 'Professions', creatureSingular: 'Ancestry', creaturePlural: 'Ancestries', creatureTag: 'race' };
  const html = await render({ ...data(), systems: [renamed] }, '#races');
  assert.match(html, /[0-9]+ of [0-9]+ ancestries/);
  assert.match(html, /Professions/);
  assert.match(html, /Human/);
  assert.doesNotMatch(html, /feature-card-title[^>]*>Second Wind/);
  assert.equal(safeReturn('#races?q=elf&sort=name-desc'), '#races?q=elf&sort=name-desc');
});

test('System tabs partition skills and notes, persist ability preferences, and lead with HP', async () => {
  const character = { ...starterSaves[0], displayPreferences: { 'modifierFirst:abilities': true }, notes: { ...starterSaves[0].notes, 'Note 1': 'A long custom note\n'.repeat(1000) } };
  const workspace = { ...data(), characters: [character] };
  const sheet = await render(workspace, `#characters/${character.id}?view=stats`);
  assert.match(sheet, /Show scores first/);
  assert.match(sheet, /Roll Strength check/);
  assert.ok(sheet.indexOf('sheet-hit-points') < sheet.indexOf('Character details'));
  assert.doesNotMatch(sheet, /id="build-summary"/);
  assert.doesNotMatch(sheet, /Calculation for Athletics|A long custom note/);
  const notes = await render(workspace, `#characters/${character.id}?view=notes`);
  assert.match(notes, /A long custom note/);
  assert.match(notes, /Add note/);
  const resources = await render(workspace, `#characters/${character.id}?view=resources`);
  assert.ok(resources.indexOf('>Long rest</button>') < resources.indexOf('sheet-hit-points'));
  const store = storage();
  model.writeWorkspace(store, workspace);
  assert.deepEqual(model.readWorkspace(store).characters[0].displayPreferences, character.displayPreferences);
  assert.equal(model.readWorkspace(store).characters[0].notes['Note 1'], character.notes['Note 1']);
  const custom = structuredClone(file);
  custom.configurations.forEach((config) => config.system.sheetTabs.push({ id: 'explore', name: 'Exploration', content: 'sections', sections: ['combat'] }));
  assert.match(await render({ ...workspace, systems: [custom] }, `#characters/${character.id}?view=explore`), /Combat &amp; exploration/);
});

test('workspace roundtrip preserves loaded rules, character choices and exact catalogue pins', async () => {
  const store = storage(), { character } = exampleCharacter();
  character.buildState = 'draft';
  model.writeWorkspace(store, { ...data(), characters: [character], active: character.id });
  const restored = model.readWorkspace(store);
  assert.deepEqual(restored.characters[0], character);
  assert.equal(model.createRegistry(restored.systems).engineForCharacter(character).evaluate(character).status, 'valid');
});
test('workspace rejects malformed saves and reports storage quota failures', async () => {
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
test('React initial screen explains System loading and provides character import', async () => {
  const html = await render({ version: 1, systems: [], characters: [] });
  assert.match(html, /Every adventure starts with a Feature/);
  assert.match(html, /Load DnD5e 2014/);
  assert.match(html, /Import character/);
});
test('React Class and Feature browsers render directly from the loaded JSON', async () => {
  const classes = await render(data(), '#classes');
  assert.match(classes, /<table class="data-table" aria-label="Classes">/);
  assert.match(classes, /Fighter/);
  assert.match(classes, /Wizard/);
  const features = await render(data(), '#features');
  assert.match(features, /Explore Features/);
  assert.match(features, /[0-9]+ of [0-9]+ Features/);
  const detail = await render(data(), '#features/dnd5e%3A2014%3Awizard.spellcasting');
  assert.match(detail, /Building blocks/);
  assert.match(detail, /chooseFeatures/);
});
test('Class and Feature detail pages display source rules and shared spell effects', async () => {
  const cls = await render(data(), '#classes/dnd5e%3A2014%3Afighter');
  assert.match(cls.replace(/<[^>]+>/g, ''), /Hit Points at 1st Level/);
  assert.match(cls, /martial weapons/);
  assert.match(cls, /SRD 5.1 pp. 24/);
  const secondWind = await render(data(), '#features/dnd5e%3A2014%3Afighter.second-wind');
  assert.match(secondWind, /1d10 \+ your fighter level/);
  const spell = await render(data(), '#features/dnd5e%3A2014%3Aprepared.fireball');
  assert.match(spell, /8d6 fire damage/);
  assert.match(spell, /At Higher Levels/);
  assert.match(spell, /View Fireball Feature/);
  assert.match(await render(data(), '#systems'), /Reload System/);
});
test('stored workspaces deduplicate repeated configuration data and read older saves', async () => {
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
test('description refresh preserves pinned rules and rejects mechanical changes', async () => {
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

test('saved System description updates preserve character edits and never restore unloaded or replaced Systems', async () => {
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
test('bundled category refresh accepts the Class Feature tag but preserves tags used by rules', async () => {
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
  const html = await render(data(), '#features');
  assert.match(html, /aria-pressed="false">Class Feature<span class="chip-count">/);
  assert.match(await render(data(), '#features/dnd5e%3A2014%3Afighter.second-wind'), /class="tag">Class Feature/);
});
test('Feature pages show Class progression timing and preserve readable prerequisite logic', async () => {
  const engine = model.createRegistry([file]).createEngine(file.id, file.revision);
  const find = (name) => engine.catalogue.features.find((f) => f.id === `dnd5e:2014:${name}`);
  const surge = await render(data(), '#features/dnd5e%3A2014%3Afighter.action-surge');
  assert.match(surge, /Levels &amp; requirements/);
  assert.match(surge, /Fighter level 2/);
  assert.deepEqual(advancementLabels(find('fighter.remarkable-athlete'), engine), ['Fighter level 7']);
  const athlete = await render(data(), '#features/dnd5e%3A2014%3Afighter.remarkable-athlete');
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
test('React uses Feature and tag display names while retaining internal filter identities', async () => {
  const custom = structuredClone(file), feature = custom.features.find((f) => f.id.endsWith(':skill.acrobatics'));
  feature.name = 'internal_feature_name';
  feature.displayName = 'Graceful Movement';
  feature.description = 'A readable custom description.';
  custom.configurations.forEach((c) => {
    c.system.tagDisplayNames['skill-proficiency'] = 'Trained Skill';
  });
  const workspace = { version: 1, systems: [custom], characters: [] };
  const browse = await render(workspace, '#features?q=Graceful');
  assert.match(browse, /Graceful Movement/);
  assert.match(browse, /aria-pressed="false">Trained Skill<span class="chip-count">/);
  assert.doesNotMatch(browse, /internal_feature_name/);
  const detail = await render(workspace, '#features/dnd5e%3A2014%3Askill.acrobatics');
  assert.match(detail, /<h1>Graceful Movement<\/h1>/);
  assert.match(detail, /class="tag">Trained Skill/);
  const legacy = structuredClone(file);
  delete legacy.features.find((feature) => feature.id.endsWith(':skill.acrobatics')).displayName;
  legacy.configurations.forEach((c) => {
    delete c.system.tagDisplayNames;
    delete c.system.descriptionTokens;
  });
  assert.match(await render({ version: 1, systems: [legacy], characters: [] }, '#features?q=acrobatics'), /Proficiency: acrobatics/);
});
test('imported descriptions render as text and shared references do not recurse', async () => {
  const html = renderToStaticMarkup(createElement(RulesText, { text: '<script>alert(1)</script>\n\nSecond paragraph', source: 'javascript:alert(1)' }));
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<p>Second paragraph<\/p>/);
  assert.doesNotMatch(html, /<a/);
  const feature = { id: 'loop', name: 'Loop', revision: 1, description: 'Shared text', textReferences: ['loop'], components: [] };
  const shared = renderToStaticMarkup(createElement(FeatureRules, { feature, engine: { catalogue: { id: 'fixture', system: { id: 'fixture', revision: 1 }, features: [feature] } }, openFeature() {} }));
  assert.equal((shared.match(/Shared text/g) ?? []).length, 2);
});

test('source mentions link skills and abilities within their System and popup retains original rules', async () => {
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
test('React character builder exposes nested selections and preserves a construction draft', async () => {
  const { character } = exampleCharacter();
  character.buildState = 'draft';
  const html = await render({ ...data(), characters: [character] }, `#characters/${character.id}`);
  assert.match(html, /Build Features &amp; choices/);
  assert.match(html, /Basic stats/);
  assert.match(html, /Finalize character/);
  assert.match(html, /Ready to finalize/);
  assert.match(html, /languages/);
  assert.match(html, /Second Wind|Fighting style|fighting style/i);
  assert.match(html, /Read Fighter Class rules/);
  assert.match(html, /Read Feature rules/);
  assert.match(html, /While you are wearing armor, you gain a \+1 bonus to AC/);
});
test('unloaded Systems keep characters exportable and display an explicit reload requirement', async () => {
  const { character } = exampleCharacter();
  const html = await render({ version: 1, systems: [], characters: [character] }, `#characters/${character.id}`);
  assert.match(html, /Export character/);
  assert.match(html, /Example Hero/);
  assert.match(html, /must be loaded/);
});
test('malformed legacy data remains available for recovery when migration rejects it', async () => {
  const store = storage();
  store.setItem(model.STORAGE_KEY, 'invalid JSON');
  assert.throws(() => model.readWorkspace(store));
  assert.equal(store.getItem(model.STORAGE_KEY), 'invalid JSON');
});

test('class guide has a progression table, jump controls, and expanded source descriptions', async () => {
  const html = await render(data(), '#classes/dnd5e%3A2014%3Afighter');
  assert.match(html, /aria-label="Fighter contents"/);
  assert.match(html, /<caption>Fighter Features by level<\/caption>/);
  assert.match(html, /Jump to level 20/);
  assert.match(html, /1d10 \+ your fighter level/);
  assert.match(html, /class="level-row reference-section"/);
});

test('sheet controls show dice, separate skill calculations and configured action filters', async () => {
  const sample = starterSaves.find((entry) => entry.id === 'starter-2014-human-fighter-noble');
  const character = { ...sample, displayPreferences: { ...sample.displayPreferences, healthExpanded: true } };
  const workspace = { ...data(), characters: [character] };
  const skills = await render(workspace, `#characters/${character.id}?view=skills`);
  assert.match(skills, /hit-dice-icons/);
  assert.match(skills, /dice remaining/);
  assert.match(skills, /<th>Calculation<\/th>/);
  assert.match(skills, /class="skill-calculation"/);
  assert.doesNotMatch(skills, /Level up Fighter/);
  const choices = await render(workspace, `#characters/${character.id}?view=choices`);
  assert.match(choices, /Level up Fighter/);
  assert.match(choices, /Automatically granted Features/);
  assert.match(choices, /Second Wind/);
  assert.match(choices, />Fighting Style: Defense<\/a>/);
  const sheet = await render(workspace, `#characters/${character.id}?view=stats`);
  const saves = sheet.match(/<table class="sheet-table skill-list table-values-left[^"]*">[\s\S]*?<\/table>/)?.[0];
  assert.ok(saves, 'Saving throws use left-aligned values');
  assert.doesNotMatch(saves, /<th>Calculation<\/th>|class="skill-calculation"/);
  assert.match(saves, /class="table-stat-value"[\s\S]*?<strong>[\s\S]*?<\/strong>[\s\S]*?class="value-calculation"/);
  assert.match(saves, /aria-label="Calculation for Strength"/);
  const resources = await render(workspace, `#characters/${character.id}?view=resources`);
  assert.match(resources, /Ability action cost/);
  assert.match(resources, /ability-cost-group/);
  assert.match(resources, /Bonus actions/);
  assert.doesNotMatch(resources, /id="tab-actions"/);
  const wizard = starterSaves.find((entry) => entry.progressions.some((p) => p.class.endsWith(':wizard')));
  const spells = await render({ ...data(), characters: [wizard] }, `#characters/${wizard.id}?view=spells`);
  assert.match(spells, /Spell action cost/);
  const { HitDiceIcons } = await server.ssrLoadModule('/src/features/characters/components/HitDiceIcons.tsx');
  const icons = renderToStaticMarkup(createElement(HitDiceIcons, { pool: { name: 'Hit dice', available: 2, capacity: 3 } }));
  assert.equal((icons.match(/class="available"/g) ?? []).length, 2);
  assert.equal((icons.match(/class="spent"/g) ?? []).length, 1);
});

test('leveling a sample preserves edits and keeps unfinished choices in a recoverable draft', async () => {
  const { setCharacterLevel } = await server.ssrLoadModule('/src/features/characters/model/character-leveling.ts');
  const { reconcilePrototypeCharacters } = await server.ssrLoadModule('/src/features/characters/model/prototype-characters.ts');
  const character = structuredClone(starterSaves.find((entry) => entry.id === 'starter-2014-human-fighter-noble'));
  character.name = 'Edited sample';
  const workspace = { ...data(), characters: [character] };
  const engine = model.createRegistry(workspace.systems).engineForCharacter(character);
  const updated = setCharacterLevel(engine, character, character.progressions[0].id, 4);
  assert.equal(updated.buildState, 'draft');
  assert.equal(updated.progressions[0].level, 4);
  assert.equal(updated.name, character.name);
  assert.deepEqual(updated.inventory, character.inventory);
  assert.deepEqual(updated.selections, character.selections);
  assert.equal(character.progressions[0].level, 1);
  assert.ok(engine.evaluate(updated).selections.some((slot) => slot.minimum > slot.picks.length));
  const cleaned = reconcilePrototypeCharacters({ ...workspace, characters: [updated] }, starterSaves);
  assert.deepEqual(cleaned.rebuilt, []);
  assert.equal(cleaned.workspace.characters[0].progressions[0].level, 4);
});

test('Feature pages put rules first and keep authoring details collapsed', async () => {
  const html = await render(data(), '#features/dnd5e%3A2014%3Afighter.second-wind');
  assert.match(html, /<h2>Rules<\/h2>/);
  assert.match(html, /<h2>Feature content<\/h2>/);
  assert.doesNotMatch(html, /At a glance|<aside class="panel feature-facts"/);
  assert.match(html, /<details class="panel technical-details"><summary>Builder &amp; engine details/);
});

test('Feature content includes granted rules and selection options, with unique header tags', async () => {
  const { FeatureDetail } = await server.ssrLoadModule('/src/features/catalogue/components/FeatureDetail.tsx');
  const { engine } = exampleCharacter();
  const secondWind = engine.getFeature('dnd5e:2014:fighter.second-wind');
  const feature = {
    ...secondWind,
    id: 'test:full-content',
    description: 'Parent rules.',
    textReferences: [],
    tags: ['action', 'action'],
    components: [
      { id: 'grant', kind: 'grantFeature', feature: secondWind.id, atClassLevel: 2 },
      { id: 'choice', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { ids: [secondWind.id] } },
      { id: 'action-one', kind: 'grantCapability', name: 'First', action: { kind: 'action', amount: 1 } },
      { id: 'action-two', kind: 'grantCapability', name: 'Second', action: { kind: 'action', amount: 1 } },
    ],
  };
  const html = renderToStaticMarkup(createElement(FeatureDetail, { feature, engine, openFeature() {} }));
  const header = html.slice(0, html.indexOf('</header>'));
  assert.equal((header.match(/>Action<\/span>/g) ?? []).length, 1);
  assert.match(html, /Granted at class level 2/);
  assert.match(html, /1d10 \+ your fighter level/);
  assert.match(html, /1 options/);
  assert.match(html, /feature-content-entry/);
  const spell = await render(data(), '#features/dnd5e%3A2014%3Aartificer.prepared.absorb-elements');
  const spellHeader = spell.match(/<header class="feature-reference-header">[\s\S]*?<\/header>/)?.[0];
  assert.ok(spellHeader);
  assert.equal((spellHeader.match(/>Action<\/span>/g) ?? []).length, 1);
});

test('acquired Feature library exposes search, origins and acquisition levels', async () => {
  const { engine, character } = exampleCharacter({ classes: [{ class: 'fighter', level: 3 }, { class: 'rogue', level: 2 }], settings: { multiclass: true } });
  const result = engine.evaluate(character);
  const html = renderToStaticMarkup(createElement(CharacterFeatures, { engine, character, result, openFeature: () => {} }));
  assert.match(html, /Search acquired Features/);
  assert.match(html, /Acquired from/);
  assert.match(html, /Fighter/);
  assert.match(html, /Rogue/);
  assert.match(html, /Show inactive Features/);
  assert.match(html, /[0-9]+ inside/);
  assert.match(html, /class="feature-tree"/);
});

test('resource summaries expose actual balance, maximum, recovery and shared providers', async () => {
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

test('prototype reset discards the old workspace before loading the new storage key', async () => {
  const removed = [];
  const fresh = model.readWorkspace({ removeItem: (key) => removed.push(key), getItem: (key) => {
    assert.equal(key, model.STORAGE_KEY);
    return null;
  } });
  assert.deepEqual(removed, ['ttrpg-feature-forge:v1']);
  assert.deepEqual(fresh, { version: 1, systems: [], characters: [] });
});

test('Feature selections default to a dropdown with a list toggle and no HP choices', async () => {
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

test('Starter Set party loads its System, saves all five characters, and preserves edited copies on repeated imports', async () => {
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
  const html = await render(repeated, `#characters/${repeated.characters[1].id}`);
  assert.match(html, /Character details/);
  assert.doesNotMatch(html, /Original character sheet/);
  assert.match(await render(repeated, `#characters/${repeated.characters[1].id}?view=notes`), /Original character sheet/);
  assert.doesNotMatch(html, /All calculated stats/);
  assert.match(html, /Character overview/);
  assert.match(await render(workspace), /Add 2014 Starter Set party/);
});

test('Starter Set import fails atomically for invalid characters or incompatible loaded rules', async () => {
  const empty = { version: 1, systems: [], characters: [] };
  const invalid = structuredClone(starterSaves);
  invalid[1].inputs['base.wisdom'] = 99;
  assert.throws(() => addStarterCharacters(empty, file, invalid));
  assert.equal(empty.characters.length, 0);
  const old = structuredClone(file);
  old.configurations.forEach((config) => config.classes = config.classes.filter((cls) => cls.id !== 'dnd5e:2014:cleric'));
  assert.throws(() => addStarterCharacters({ ...empty, systems: [old] }, file, starterSaves));
});

test('Feature links preserve list filters and class anchors in native anchor URLs', async () => {
  const engine = model.createRegistry([file]).createEngine(file.id, file.revision);
  const origin = '#features?q=wind&tag=class-feature&sort=name-desc&page=2';
  const link = featureHref('dnd5e:2014:fighter.second-wind', engine, origin);
  const back = new URLSearchParams(link.split('?')[1]).get('returnTo');
  assert(back.includes('q=wind&tag=class-feature&sort=name-desc&page=2'));
  assert.equal(safeReturn('https://example.com'), undefined);
  assert.equal(safeReturn('#classes/x?section=level-3'), '#classes/x?section=level-3');
  const html = await render(data(), '#classes/dnd5e%3A2014%3Afighter');
  assert.match(html, /returnTo=.*section%3Dclass-/);
  assert.match(html, /<a class="link" href="#features\/dnd5e%3A2014%3Afighter.second-wind/);
  const filtered = await render(data(), '#features?q=Second%20Wind&sort=name-desc&tag=class-feature');
  assert.match(filtered, /value="Second Wind"/);
  assert.match(filtered, /<th aria-sort="descending"><button class="sort-button">Feature/);
  assert.match(filtered, /aria-pressed="true">Class Feature/);
});

test('Fighter resource UI omits Arcane Recovery, while Wizard recovery and adjustment controls remain', async () => {
  const workspace = { ...data(), characters: starterSaves };
  const fighter = await render(workspace, `#characters/${starterSaves[0].id}?view=resources`);
  assert.doesNotMatch(fighter, /Arcane Recovery/);
  assert.match(fighter, /Decrease Second Wind/);
  assert.match(fighter, /Increase Second Wind/);
  const wizard = await render(workspace, `#characters/${starterSaves[3].id}?view=resources`);
  assert.match(wizard, /Arcane Recovery/);
  const sheet = await render(workspace, `#characters/${starterSaves[0].id}`);
  assert.match(sheet, /<h2>Abilities<\/h2>/);
  assert.match(sheet, /Armor class/);
  assert.match(sheet, /class="sheet-table skill-list table-values-left\s*"/);
  assert.doesNotMatch(sheet, /<h2>Inventory<\/h2>/);
  assert.match(await render(workspace, `#characters/${starterSaves[0].id}?view=items`), /Chain mail/);
  assert.match(sheet, /class="character-facts"/);
});

test('additive item and layout updates preserve rules and safely migrate original Starter equipment', async () => {
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

test('sheet controls expose inline editing, five coin balances, sortable columns and number labels', async () => {
  const html = await render({ ...data(), characters: [starterSaves[0]] }, `#characters/${starterSaves[0].id}?view=stats`);
  assert.match(html, /Edit Alignment/);
  assert.doesNotMatch(html, /Edit character details/);
  const items = await render({ ...data(), characters: [starterSaves[0]] }, `#characters/${starterSaves[0].id}?view=items`);
  for (const coin of ['Copper', 'Silver', 'Electrum', 'Gold', 'Platinum']) assert.match(items, new RegExp(`${coin} balance`));
  assert.match(items, /25 gp total/);
  assert.match(html, /aria-sort="ascending"/);
  assert.doesNotMatch(html, /Calculation for Athletics/);
  assert.match(await render({ ...data(), characters: [starterSaves[0]] }, `#characters/${starterSaves[0].id}?view=skills`), /Calculation for Athletics/);
  assert.match(html, /Show scores first/);
  assert.match(html, /role="tooltip"[^>]*>Strength score/);
  assert.match(html, /role="tooltip"[^>]*>Strength modifier/);
  const resources = await render({ ...data(), characters: [starterSaves[0]] }, `#characters/${starterSaves[0].id}?view=resources`);
  assert.doesNotMatch(resources, /Turn budget|Start new turn/);
  assert.match(resources, /ability-row[\s\S]*resource-card[\s\S]*Roll 1d10/);
});

test('money migration removes coins and old starting-money notes without double counting', async () => {
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

test('Systems offer a dropdown and an accessible refresh control', async () => {
  const html = await render(data(), '#systems');
  assert.match(html, /System to load/);
  assert.match(html, /Other System from JSON/);
  assert.match(html, /aria-label="Reload DnD5e 2014"/);
  assert.match(html, /<svg aria-hidden="true"/);
});

test('System reload is atomic and preserves characters while rejecting incompatible replacements', async () => {
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

test('rules descriptions render lists and paragraphs while preserving automatic links and escaping HTML', async () => {
  const engine = model.createRegistry([file]).engineForCharacter(starterSaves[0]);
  const html = renderToStaticMarkup(createElement(RulesText, { engine, text: 'First paragraph.\n\n• Second Wind • Another point\n\nNext paragraph.\n\n1. First step\n2. <script>unsafe</script>' }));
  assert.match(html, /<ul><li><a[^>]*>Second Wind<\/a><\/li><li>Another point<\/li><\/ul>/);
  assert.match(html, /<p>Next paragraph.<\/p>/);
  assert.match(html, /<ol start="1">/);
  assert.doesNotMatch(html, /<script>/);
});

test('Wizard spells are separate from slots and empty slot levels are initially hidden', async () => {
  const html = await render({ ...data(), characters: [starterSaves[3]] }, `#characters/${starterSaves[3].id}?view=resources`);
  assert.match(html, /Show all spell slots/);
  assert.match(html, /Cantrips/);
  assert.match(html, /Level 1 spells/);
  assert.match(html, /Use Spell/);
  assert.match(html, /Decrease Spell Slot 1/);
  assert.doesNotMatch(html, /Decrease Spell Slot 2/);
  assert.match(html, /ability-row[\s\S]*Arcane Recovery/);
});

test('multiclass sheet names race and both class levels and exposes build editing', async () => {
  const sample = JSON.parse(readFileSync(new URL('../../src/systems/dnd5e-2014/multiclass-sample.json', import.meta.url), 'utf8')).data;
  const html = await render({ ...data(), characters: [sample] }, `#characters/${sample.id}`);
  assert.doesNotMatch(html, /Classes &amp; levels/);
  assert.match(html, /Fighter 2 \/ Wizard 3/);
  assert.match(html, /Human · Fighter 2 \/ Wizard 3/);
  assert.match(html, /aria-label="Character name"/);
  assert.match(html, /Edit build/);
});
test('character rule text resolves Fighter level and offers the declared healing roll', async () => {
  const { engine, character } = exampleCharacter({ classes: [{ class: 'fighter', level: 2 }] });
  const result = engine.evaluate(character);
  const html = renderToStaticMarkup(createElement(CharacterRuleContext.Provider, { value: { character, result, update: () => {}, report: () => {} } }, createElement(FeatureRules, { engine, feature: engine.getFeature('dnd5e:2014:fighter.second-wind') })));
  assert.match(html, /resolved-value">2/);
  assert.match(html, /your fighter level<\/span>/);
  assert.match(html, /Roll 1d10 \+ 2/);
});

test('explicit reload accepts additive definitions and preserves character choices and balances', async () => {
  const { character } = exampleCharacter();
  const incoming = structuredClone(file);
  incoming.features.push({ id: 'test:additive', revision: 1, name: 'Additive', components: [] });
  const next = model.reloadSystem({ ...data(), characters: [character] }, file, incoming);
  assert.equal(next.characters[0].contentRevisions['test:additive'], 1);
  assert.deepEqual(next.characters[0].selections, character.selections);
  assert.deepEqual(next.characters[0].resources, character.resources);
  assert.equal(model.createRegistry(next.systems).engineForCharacter(next.characters[0]).evaluate(next.characters[0]).status, 'valid');
});

test('spell results expose separate application and casting level after spending the slot', async () => {
  const { engine, character } = exampleCharacter({ classes: [{ class: 'wizard', level: 5 }] });
  const ready = finalizeCharacter(engine, character, 'finalize');
  const result = engine.evaluate(ready);
  const spell = spellGroups(engine, result).find((entry) => entry.level === 1 && featureRollInstances(engine, result, entry.feature).length && entry.modes.some((mode) => mode.slotLevel === 3));
  const mode = spell.modes.find((entry) => entry.slotLevel === 3);
  const instance = featureRollInstances(engine, result, spell.feature)[0];
  const rolled = rollFeature(engine, ready, instance.id, 'spell-roll', () => 0, mode.capability.id).character;
  const show = async (saved) => await render({ ...data(), characters: [saved] }, `#characters/${saved.id}?view=resources`);
  const pending = await show(rolled);
  assert.match(pending, /Level 3 slot spent/);
  assert.match(pending, /Mark applied/);
  assert.match(pending, /Clear rolls/);
  assert.match(pending, /Clear all rolls/);
  assert.doesNotMatch(pending, /Reroll/);
  const applied = await show(applyFeatureRoll(engine, rolled, 'spell-roll', 'apply').character);
  assert.match(applied, /disabled="">Applied/);
  assert.doesNotMatch(applied, />Mark applied</);
});

test('sheet display keeps Hit Point class levels literal and resolves modifiers', async () => {
  const { engine, character } = exampleCharacter({ classes: [{ class: 'wizard', level: 3 }] });
  const result = engine.evaluate(character);
  const html = renderToStaticMarkup(createElement(CharacterRuleContext.Provider, { value: { character, result, update: () => {}, report: () => {} } }, createElement(FeatureRules, { engine, feature: engine.getFeature('dnd5e:2014:wizard.hit-points') })));
  assert.match(html, /per wizard level/);
  assert.doesNotMatch(html, /text-tooltip[^>]*>wizard level/);
  assert.match(html, /resolved-value/);
});

test('spell levels collapse and free utility spells have no use control', async () => {
  const html = await render({ ...data(), characters: [starterSaves[3]] }, `#characters/${starterSaves[3].id}?view=resources`);
  assert.match(html, /<details class="spell-level" open=""><summary>Cantrips/);
  const cards = [...html.matchAll(/<tr>(<td><span class="row-head">[\s\S]*?)<\/tr>/g)].map((match) => match[1]);
  const utility = cards.find((card) => card.includes('Mage Hand'));
  assert.ok(utility);
  assert.doesNotMatch(utility, /Use Spell/);
  const fire = cards.find((card) => card.includes('Ray of Frost'));
  assert.match(fire, />Use Spell<\/button>/);
  assert.doesNotMatch(html, /Rolling spends the ability use and saves the result/);
  assert.ok(html.indexOf('>Long rest</button>') < html.indexOf('<h2>Abilities</h2>'));
  const sheet = await render({ ...data(), characters: [starterSaves[3]] }, `#characters/${starterSaves[3].id}?view=items`);
  assert.match(sheet, /Copper \(cp\)/);
  assert.doesNotMatch(sheet, /<span>cp<\/span>/);
});

test('description flags and replacement arrays separate automatic prose from explicit exceptions', async () => {
  const { engine, character } = exampleCharacter({ classes: [{ class: 'wizard', level: 3 }] });
  const result = engine.evaluate(character);
  const show = (feature, contextual = true) => {
    const rules = createElement(FeatureRules, { engine, feature });
    return renderToStaticMarkup(contextual ? createElement(CharacterRuleContext.Provider, { value: { character, result, update: () => {}, report: () => {} } }, rules) : rules);
  };
  const feature = { id: 'example', revision: 1, name: 'Example', components: [], description: 'your Constitution modifier per wizard level. EXTRA', processDescriptionAutomatically: false };
  assert.doesNotMatch(await show(feature), /resolved-value/);
  const override = { ...feature, descriptionOverride: [
    { originalString: 'your Constitution modifier', overrideString: '{{stat:modifier.constitution}} Constitution modifier' },
    { originalString: 'EXTRA', overrideString: '{{stat:constitution}} {{UNKNOWN}} <script>bad</script>' },
  ] };
  const html = await show(override);
  assert.equal((html.match(/resolved-value/g) ?? []).length, 2);
  assert.match(html, /Constitution modifier/);
  assert.match(html, /per wizard level/);
  assert.match(html, /{{UNKNOWN}}/);
  assert.doesNotMatch(html, /<script>/);
  assert.equal((await show({ ...override, processDescriptionAutomatically: true }).match(/resolved-value/g) ?? []).length, 3);
  assert.match(await show(override, false), /your Constitution modifier per wizard level/);
  assert.doesNotMatch(await show({ ...feature, descriptionOverride: [{ originalString: feature.description, overrideString: '' }] }), /wizard level/);
  assert.match(await show({ ...feature, description: 'Example\nOriginal', descriptionOverride: [{ originalString: 'Example\nOriginal', overrideString: 'Whole source replaced' }] }), /Whole source replaced/);
  const lists = await show({ ...feature, descriptionOverride: [{ originalString: feature.description, overrideString: 'First\n\n- {{stat:constitution}}\n- Constitution modifier' }] });
  assert.match(lists, /<ul>/);
  assert.equal((lists.match(/resolved-value/g) ?? []).length, 1);
});

test('saved full-string overrides migrate to arrays without losing characters', async () => {
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

test('System reload safely retires generated Roll Features while retaining character balances', async () => {
  const old = structuredClone(file);
  old.features.push({ id: 'test:retired-roll', revision: 1, name: 'Old roll', roll: { id: 'old', label: 'Old roll', dice: '1d6' }, components: [] });
  const { character } = exampleCharacter();
  const saved = { ...character, contentRevisions: { ...character.contentRevisions, 'test:retired-roll': 1 } };
  const next = model.reloadSystem({ ...data(), systems: [old], characters: [saved] }, old, file);
  assert.equal(next.characters[0].contentRevisions['test:retired-roll'], undefined);
  assert.deepEqual(next.characters[0].resources, saved.resources);
});

test('Companion panels appear only for owned Features and show stats only when deployed', async () => {
  const feature = { id: 'companion', name: 'Test Defender', components: [], companion: { kind: 'creature', stats: ['companion.ac'], resources: [] }, source: 'https://www.dndbeyond.com/sources/dnd/tcoe/artificer#SteelDefender' };
  const engine = { getFeature: (id) => id === feature.id ? feature : undefined, getStatDefinition: () => ({ name: 'Armor Class' }), catalogue: { features: [feature], system: {}, items: [], itemFeatures: [] } };
  const result = { status: 'valid', instances: [], capabilities: [], resources: {}, stats: { 'companion.ac': { value: 15 } } };
  const character = { buildState: 'finalized' };
  const props = { engine, result, character, update: () => {}, report: () => {} };
  assert.equal(renderToStaticMarkup(createElement(CompanionPanels, props)), '');
  result.instances.push({ id: 'owned', feature: 'companion', active: true, eligible: true });
  let html = renderToStaticMarkup(createElement(CompanionPanels, props));
  assert.match(html, /Create \/ summon/);
  assert.doesNotMatch(html, /companion-stats/);
  character.deployedCompanions = ['owned'];
  html = renderToStaticMarkup(createElement(CompanionPanels, props));
  assert.match(html, /companion-stats/);
  assert.match(html, /<dd>15<\/dd>/);
  assert.match(html, /<dt>Armor Class<\/dt>/);
  assert.match(html, /Dismiss/);
  assert.match(html, /href="https:\/\/www.dndbeyond.com\/sources\/dnd\/tcoe\/artificer#SteelDefender"/);
});

test('Infusion assignment UI offers owned items and external recipients, with source-only links', async () => {
  const feature = { id: 'infusion', name: 'Enhanced Defense', source: 'https://www.dndbeyond.com/sources/dnd/tcoe/artificer#EnhancedDefense', equipmentEffect: { categories: ['Armor'], capacityStat: 'limit', group: 'infusions' }, components: [] };
  const engine = { getFeature: () => feature, catalogue: { features: [feature], system: {}, items: [{ id: 'armor', name: 'Armor', category: 'Armor', features: [] }], itemFeatures: [] } };
  const character = { inventory: [{ id: 'owned-armor', item: 'armor', quantity: 1, equipped: true }] };
  const result = { instances: [{ id: 'known', feature: 'infusion', active: true, eligible: true }], stats: { limit: { value: 2 } } };
  const html = renderToStaticMarkup(createElement(EquipmentEffects, { engine, character, result, update: () => {}, report: () => {} }));
  assert.match(html, /value="inventory:owned-armor"/);
  assert.match(html, /External: Armor/);
  assert.match(html, /2 active item limit/);
  assert.match(html, /target="_blank"/);
});

test('Generic sheet settings control value captions, training thresholds, phrases and health roles', async () => {
  const { SheetSectionView } = await server.ssrLoadModule('/src/features/characters/components/SheetSectionView.tsx');
  const { HitPoints } = await server.ssrLoadModule('/src/features/characters/components/HitPoints.tsx');
  const { SheetOverview } = await server.ssrLoadModule('/src/features/characters/components/SheetOverview.tsx');
  const { resolvedRuleText } = await server.ssrLoadModule('/src/features/catalogue/model/personalized-rules.tsx');
  const section = { id: 'custom', name: 'Ranks', layout: 'skills', trainingLevels: [{ minimum: 0, name: 'Novice', symbol: 'N' }, { minimum: 5, name: 'Master', symbol: 'M' }], rows: [{ stat: 'fortune', proficiencyStat: 'training' }] };
  const catalogue = { id: 'custom', revision: 1, classes: [], features: [{ id: 'health', revision: 1, name: 'Energy', components: [{ id: 'energy', kind: 'trackResource', key: 'hit-points', name: 'Energy', units: 'energy', initialAmount: 10, maximum: 10, recovery: [] }] }], system: { id: 'custom', revision: 1, name: 'Custom', allowMultipleClasses: false, characterLevel: 0, stats: [{ id: 'fortune', name: 'Fortune', kind: 'derived', expression: 7 }, { id: 'training', name: 'Training', kind: 'derived', expression: 6 }], sheetSections: [section], sheetDisplay: { descriptionProcessing: { statPhrases: [{ phrase: 'fortune modifier', stat: 'fortune' }] } }, advancement: { 0: [{ id: 'health', kind: 'grantFeature', feature: 'health' }] } } };
  const engine = new Engine(catalogue);
  const character = engine.createCharacter('custom', 'Custom');
  const result = engine.evaluate(character);
  const props = { engine, character, result, update: () => {}, report: () => {} };
  const skills = renderToStaticMarkup(createElement(SheetSectionView, { ...props, section }));
  assert.match(skills, /aria-label="Master"/);
  assert.doesNotMatch(skills, /Expertise|Proficient/);
  const ranks = renderToStaticMarkup(createElement(SheetSectionView, { ...props, section: { ...section, layout: 'abilities', modifierFirst: true, primaryValueLabel: 'rank', secondaryValueLabel: 'adjustment', rows: [{ stat: 'fortune', secondaryStat: 'training' }] } }));
  assert.match(ranks, /Show ranks first/);
  assert.match(ranks, /Fortune adjustment/);
  assert.doesNotMatch(ranks, /Fortune score|Fortune modifier/);
  assert.equal(resolvedRuleText('fortune modifier + proficiency bonus', engine, character, result), '7 + proficiency bonus');
  assert.equal(resolvedRuleText('{{stat:fortune}}', engine, character, result, true), '7');
  assert.doesNotMatch(renderToStaticMarkup(createElement(HitPoints, props)), /Energy|Damage or healing amount/);
  assert.match(renderToStaticMarkup(createElement(SheetOverview, props)), /without-health/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(SheetOverview, props)), /sheet-hit-points/);
});

test('System-authored zero-level spell names replace Cantrip in spell summaries and casting controls', async () => {
  const custom = structuredClone(file);
  for (const config of custom.configurations) {
    config.system.sheetDisplay.spells.zeroLevelName = 'Minor spell';
    config.system.sheetDisplay.spells.zeroLevelHeading = 'Minor spells';
  }
  const wizard = starterSaves[3];
  const html = await render({ ...data(), systems: [custom], characters: [wizard] }, `#characters/${wizard.id}?view=spells`);
  assert.match(html, /Minor spells/);
  assert.doesNotMatch(html, /Cantrips/);
});

test('Missing casting bonus mappings disable affected rolls without crashing the character sheet', async () => {
  const old = structuredClone(file);
  for (const config of old.configurations) delete config.system.spellDisplay.castingBonusStats;
  const cleric = starterSaves[1];
  const html = await render({ ...data(), systems: [old], characters: [cleric] }, `#characters/${cleric.id}?view=resources`);
  assert.match(html, /Character overview/);
  // Casting controls are now opened from a spell dialog rather than shown on an Actions tab.
  const engine = model.createRegistry([old]).engineForCharacter(cleric), result = engine.evaluate(cleric);
  const roll = result.instances.map((instance) => engine.getFeature(instance.feature)?.roll).find((roll) => roll?.bonus && typeof roll.bonus === 'object' && 'castingAbility' in roll.bonus);
  assert.ok(roll?.spell);
  const { FeatureRolls } = await server.ssrLoadModule('/src/features/catalogue/components/FeatureRolls.tsx');
  const controls = renderToStaticMarkup(createElement(CharacterRuleContext.Provider, { value: { character: cleric, result, update: () => {}, report: () => {} } }, createElement(FeatureRolls, { engine, feature: engine.getFeature(roll.spell) })));
  assert.match(controls, /requires an unavailable stat/);
  assert.match(controls, /disabled="">Roll/);
});

test('Build choices sort numerically and highlight missing or invalid selections', async () => {
  const { sortBuildSelections, selectionIssues } = await server.ssrLoadModule('/src/features/characters/model/build-selections.ts');
  const { engine, character, evaluation } = exampleCharacter();
  const original = evaluation.selections[0];
  const slots = [10, 2, 3].map((level) => ({ ...original, id: `class/test/${level}/choice`, context: { acquiredClassLevel: level } }));
  assert.deepEqual(sortBuildSelections(slots).map((slot) => slot.context.acquiredClassLevel), [2, 3, 10]);
  assert.equal(slots[0].context.acquiredClassLevel, 10);
  const issues = selectionIssues(original, [{ path: `${original.id}/pick/parameter`, message: 'Parameter out of range' }, { path: 'other', message: 'Unrelated' }]);
  assert.deepEqual(issues, ['Parameter out of range']);
  const props = { engine, character, slot: original, edit: () => {}, openFeature: () => {} };
  assert.match(renderToStaticMarkup(createElement(SelectionCard, { ...props, issues })), /selection-error/);
  assert.match(renderToStaticMarkup(createElement(SelectionCard, { ...props, character: { ...character, selections: {} } })), /selection-error/);
  const leveled = applyEdit(engine, character, [{ kind: 'level', progression: 'class-0', level: 4 }], 'level-up-warning');
  const improvement = engine.evaluate(leveled).selections.find((slot) => slot.definition.id === 'improvement');
  assert.ok(improvement);
  assert.match(renderToStaticMarkup(createElement(SelectionCard, { ...props, character: leveled, slot: improvement })), /Needs attention/);
});

test('System data editor supports immutable record edits, versioning, and safe rejection', async () => {
  const { prepareSystemDataEdit } = await server.ssrLoadModule('/src/features/systems/model/system-data.ts');
  const feature = file.features[0];
  const updated = prepareSystemDataEdit(file, 'features', JSON.stringify({ ...feature, name: 'Edited display name' }), '0');
  assert.equal(updated.features[0].name, 'Edited display name');
  assert.notEqual(file.features[0].name, 'Edited display name');
  assert.equal(updated.features[1], file.features[1]);
  assert.equal(updated.contentVersion, file.contentVersion.split('.').map((part, index) => index === 2 ? Number(part) + 1 : part).join('.'));
  assert.equal(updated.assetVersions, undefined);
  const workspace = { ...data(), characters: [starterSaves[0]] };
  const saved = model.reloadSystem(workspace, file, updated);
  assert.equal(saved.characters[0].id, starterSaves[0].id);
  assert.equal(saved.systems[0].features[0].name, 'Edited display name');
  assert.throws(() => prepareSystemDataEdit(file, 'features', '{bad JSON', '0'));
  assert.throws(() => prepareSystemDataEdit(file, 'features', '{}', '999999'), /no longer available/);
  assert.throws(() => model.reloadSystem(workspace, file, { ...updated, features: [] }));
  assert.equal(workspace.systems[0], file);
  const html = await render(data(), '#system-data');
  assert.match(html, /System to edit/);
  assert.match(html, /Find record/);
  assert.match(html, /System editor categories/);
  assert.match(html, /Rules configuration/);
  assert.match(html, /System settings/);
  assert.doesNotMatch(html, /System JSON data/);
  assert.match(html, /System options/);
  assert.match(html, /Validate and save/);
});

test('Structured System forms create, edit, and delete records without mutating loaded data', async () => {
  const { editorRecords, newSystemRecord, editSystemRecord } = await server.ssrLoadModule('/src/features/systems/model/system-editor-records.ts');
  const { formSchema, formDefault, matchesFormSchema, switchFormVariant } = await server.ssrLoadModule('/src/features/systems/model/authoring-form.ts');
  const { AuthoringField } = await server.ssrLoadModule('/src/features/systems/components/AuthoringField.tsx');
  for (const category of ['classes', 'features', 'spells', 'items', 'itemFeatures', 'blocks', 'settings']) {
    const records = editorRecords(file, category, 0);
    assert.ok(records.length, category);
    if (category === 'settings') continue;
    const created = newSystemRecord(file, category, 0);
    const record = editorRecords(created.file, category, 0).find((entry) => entry.id === created.id);
    assert.ok(record);
    assert.ok(!editorRecords(file, category, 0).some((entry) => entry.id === created.id));
    const edited = editSystemRecord(created.file, category, 0, created.id, { ...record.value, name: 'My custom record' });
    assert.equal(editorRecords(edited, category, 0).find((entry) => entry.id === created.id).label, 'My custom record');
    assert.ok(!editorRecords(editSystemRecord(edited, category, 0, created.id, undefined), category, 0).some((entry) => entry.id === created.id));
    assert.notEqual(newSystemRecord(created.file, category, 0).id, created.id);
  }
  const cls = file.configurations[0].classes[0];
  assert.deepEqual(editorRecords(file, 'options', 0)[0].value, file.options);
  assert.ok(matchesFormSchema(formSchema('SystemOptions'), file.options));
  assert.equal(editSystemRecord(file, 'options', 0, file.id, { ...file.options }).features, file.features);
  const edited = editSystemRecord(file, 'classes', 0, cls.id, { ...cls, name: 'Custom class' });
  assert.equal(edited.configurations[1], file.configurations[1]);
  assert.equal(file.configurations[0].classes[0], cls);
  for (const name of ['FeatureDefinition', 'ClassDefinition', 'ItemDefinition', 'SystemDefinition']) assert.ok(matchesFormSchema(formSchema(name), formDefault(formSchema(name))), name);
  const component = { id: 'grant', kind: 'grantFeature', feature: file.features[0].id };
  assert.equal(formDefault(formSchema('DefineStat')).stat.kind, 'derived');
  const derived = switchFormVariant(formSchema('DefineStat'), { id: 'existing-component', kind: 'describe', text: 'Old prose' });
  assert.equal(derived.id, 'existing-component');
  assert.equal(derived.kind, 'defineStat');
  assert.equal(derived.text, undefined);
  const withClass = newSystemRecord(file, 'classes', 0);
  if (file.configurations[0].system.classes) assert.ok(withClass.file.configurations[0].system.classes.includes(withClass.id));
  assert.ok(matchesFormSchema(formSchema('Component'), component));
  const html = renderToStaticMarkup(createElement(AuthoringField, { schema: formSchema('Component'), value: component, label: 'Component', change: () => {} }));
  assert.match(html, /grantFeature/);
  assert.match(html, /Value type/);
  assert.match(html, /authoring-references/);
  assert.doesNotMatch(html, /textarea/);
});

test.after(() => server.close());

test('sample sheets use proficiency markers, hide empty spells, and expose item pages and roll history', async () => {
  const rogue = starterSaves.find((entry) => entry.progressions.some((progression) => progression.class.includes('rogue')));
  const fighter = starterSaves[0];
  const workspace = { ...data(), characters: [rogue, fighter] };
  const skills = await render(workspace, `#characters/${rogue.id}?view=skills`);
  assert.match(skills, /Proficiency/);
  assert.match(skills, /aria-label="Expertise"[^>]*>◉/);
  assert.doesNotMatch(skills, /id="tab-spells"/);
  assert.match(skills, /id="tab-rolls"/);
  assert.doesNotMatch(skills, /Clear all rolls/);
  const inventory = await render(workspace, `#characters/${fighter.id}?view=items`);
  assert.match(inventory, /<details class="inventory-item-details">/);
  assert.match(inventory, /href="#items\//);
  assert.match(inventory, /View item/);
  const history = await render(workspace, `#characters/${fighter.id}?view=rolls`);
  assert.match(history, /Clear all rolls/);
  const registry = model.createRegistry([file]);
  const engine = registry.createEngine(rogue.system.id, rogue.system.revision, rogue.system.options);
  const { StatCalculation } = await server.ssrLoadModule('/src/features/characters/components/StatCalculation.tsx');
  const calculation = renderToStaticMarkup(createElement(StatCalculation, { id: 'skill.survival', engine, character: rogue, result: engine.evaluate(rogue) }));
  assert.match(calculation, /0 \(Wisdom modifier\)/);
  assert.doesNotMatch(calculation, /Base/);
  const item = fighter.inventory[0].item;
  const itemPage = await render(workspace, `#items/${encodeURIComponent(item)}?system=${encodeURIComponent(fighter.system.id)}&revision=1&catalogue=${encodeURIComponent(engine.catalogue.id)}`);
  assert.match(itemPage, /Item components/);
});
