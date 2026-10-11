import { readFileSync, writeFileSync } from 'node:fs';

const root = 'src/systems/dnd5e-2014/';
const definitions = JSON.parse(readFileSync(root + 'definitions.json', 'utf8'));
const features = JSON.parse(readFileSync(root + 'features.json', 'utf8'));
const counters = ['death-save.successes', 'death-save.failures'];
for (const [key, name, maximum] of [['temporary-hit-points', 'Temporary HP', undefined], [counters[0], 'Death save successes', 3], [counters[1], 'Death save failures', 3]]) {
  const id = `dnd5e:2014:resource.${key}`;
  if (!features.data.some((feature) => feature.id === id)) features.data.push({ id, revision: 1, name, displayName: name, tags: ['resource-tracker'], components: [{ id: 'tracker', kind: 'trackResource', key, name, units: key === 'temporary-hit-points' ? 'HP' : 'saves', integer: true, initialAmount: 0, ...(maximum === undefined ? {} : { maximum }), recovery: [] }] });
}
for (const system of Object.values(definitions.data)) {
  for (const stat of system.stats.filter((stat) => stat.id.startsWith('modifier.'))) stat.name = `${stat.id.slice(9).replace(/^./, (letter) => letter.toUpperCase())} modifier`;
  if (system.spellDisplay) system.spellDisplay.castingBonusStats = Object.fromEntries(system.stats.filter((stat) => stat.id.startsWith('modifier.')).map((stat) => [stat.id.slice(9), stat.id]));
  system.healthRules = { resourceKey: 'hit-points', temporaryResourceKey: 'temporary-hit-points', resetResourceKeysOnHealing: counters, clearOnReset: { 'long-rest': ['temporary-hit-points', ...counters] } };
  system.sheetDisplay = {
    overview: [
      { stat: 'armorClass', name: 'Armor class' },
      { stat: 'initiative', name: 'Initiative', signed: true, roll: { dice: '1d20' } },
      { stat: 'speed', name: 'Speed', unit: 'ft' },
      { stat: 'proficiencyBonus', name: 'Proficiency', signed: true },
      { stat: 'passivePerception', name: 'Passive perception' },
    ],
    health: { name: 'Hit points', showHealingFeatures: true, countersVisibleAtOrBelow: 0, counters },
    descriptionProcessing: { classLevelPhrases: true, statPhrases: [...system.stats.filter((stat) => stat.id.startsWith('modifier.')).map((stat) => ({ phrase: `${stat.id.slice(9)} modifier`, stat: stat.id })), { phrase: 'proficiency bonus', stat: 'proficiencyBonus' }] },
    resources: { compact: true, showDetailsByDefault: false },
    inventory: { search: true, categoryFilter: true },
    spells: { compact: true, search: true, levelFilter: true, zeroLevelName: 'Cantrip', zeroLevelHeading: 'Cantrips', slotPipLimit: 12, columns: [{ name: 'Casting time', metadataKey: 'castingTime' }, { name: 'Range', metadataKey: 'range' }], castingStats: [] },
    restPreview: true,
    rollHistory: true,
    showAllStats: false,
    detailsDrawer: true,
    sidebarCollapsed: false,
    actions: { categories: [{ id: 'action', name: 'Actions', kinds: ['action'] }, { id: 'bonus', name: 'Bonus actions', kinds: ['bonus-action'] }, { id: 'reaction', name: 'Reactions', kinds: ['reaction'] }], itemCategories: ['Weapons'], columns: [{ name: 'Casting time', metadataKey: 'castingTime' }, { name: 'Range', metadataKey: 'range' }] },
    statuses: [{ name: 'Defenses & conditions', tags: ['resistance', 'immunity', 'condition'] }],
  };
  for (const ability of ['intelligence', 'wisdom', 'charisma']) {
    const attackStat = `casting.${ability}.attack`, saveStat = `casting.${ability}.dc`;
    for (const definition of [
      { id: attackStat, name: `${ability} spell attack`, kind: 'derived', expression: { op: 'add', args: [{ stat: 'proficiencyBonus' }, { stat: `modifier.${ability}` }] } },
      { id: saveStat, name: `${ability} spell save DC`, kind: 'derived', expression: { op: 'add', args: [8, { stat: attackStat }] } },
    ]) if (!system.stats.some((stat) => stat.id === definition.id)) system.stats.push(definition);
    system.sheetDisplay.spells.castingStats.push({ ability, attackStat, saveStat });
  }
  for (const key of ['temporary-hit-points', ...counters]) {
    if (!system.advancement['0'].some((grant) => grant.id === key)) system.advancement['0'].push({ id: key, kind: 'grantFeature', feature: `dnd5e:2014:resource.${key}` });
  }
  for (const section of system.sheetSections) {
    if (section.layout === 'skills') {
      section.defaultSort = 'Name';
      section.primarySigned = true;
      section.trainingLevels = [{ minimum: 0, name: 'Not proficient', symbol: '○', trained: false }, { minimum: 1, name: 'Proficient', symbol: '●', trained: true }, { minimum: 2, name: 'Expertise', symbol: '◆', trained: true }];
    }
    if (section.id === 'saves') section.columns = ['Training', 'Name', 'Bonus'];
    if (section.layout === 'abilities') {
      section.name = 'Abilities';
      section.modifierFirst = true;
      section.primaryValueLabel = 'score';
      section.secondaryValueLabel = 'modifier';
      section.secondarySigned = true;
    }
    for (const row of section.rows) if (section.layout === 'abilities' || section.layout === 'skills') row.roll = { dice: '1d20', ...(section.layout === 'abilities' ? { bonusStat: row.secondaryStat } : {}) };
  }
  const combat = system.sheetSections.find((section) => section.id === 'combat');
  if (combat) combat.rows = combat.rows.filter((row) => !['hitPoints', ...system.sheetDisplay.overview.map((row) => row.stat)].includes(row.stat));
  if (!system.sheetTabs.some((tab) => tab.content === 'actions')) system.sheetTabs.splice(system.sheetTabs.findIndex((tab) => tab.id === 'features'), 0, { id: 'actions', name: 'Actions', content: 'actions' });
  if (!system.sheetTabs.some((tab) => tab.content === 'spells')) system.sheetTabs.splice(system.sheetTabs.findIndex((tab) => tab.id === 'resources') + 1, 0, { id: 'spells', name: 'Spells', content: 'spells' });
}
for (const [name, value] of [['definitions.json', definitions], ['features.json', features]]) writeFileSync(root + name, JSON.stringify(value, null, 2) + '\n');
