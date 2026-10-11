import type { Catalogue } from '@/src/model.js';
import { RuleError } from '@/src/expression.js';
import { rollDice } from '@/src/dice.js';

/** Validate cross-references as part of the same all-or-nothing System import. */
export function validateSheetDisplay(catalogue: Catalogue): void {
  const system = catalogue.system;
  const fail = (message: string): never => {
    throw new RuleError('PRESENTATION', message);
  };
  const object = (value: unknown): void => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Expected a sheet configuration object.');
  };
  const text = (value: unknown): void => {
    if (typeof value !== 'string' || !value.trim()) fail('Expected a sheet configuration label.');
  };
  const list = (value: unknown): void => {
    if (!Array.isArray(value) || value.length > 10000) fail('Expected a sheet configuration list.');
  };
  const boolean = (value: unknown): void => {
    if (value !== undefined && typeof value !== 'boolean') fail('Expected a sheet configuration boolean.');
  };
  const stats = new Set([...system.stats.map((stat) => stat.id), ...catalogue.features.flatMap((feature) => feature.components.flatMap((component) => component.kind === 'defineStat' ? [component.stat.id] : []))]);
  const resources = new Set(catalogue.features.flatMap((feature) => feature.components.flatMap((component) => ['trackResource', 'defineResource'].includes(component.kind) && 'key' in component ? [component.key] : [])));
  const stat = (id: string) => {
    if (!stats.has(id)) fail(`Unknown sheet stat ${id}.`);
  };
  const resource = (key: string) => {
    if (!resources.has(key)) fail(`Unknown sheet resource ${key}.`);
  };
  const roll = (value: { dice: string; bonusStat?: string } | undefined) => {
    if (value === undefined) return;
    object(value);
    rollDice(value.dice, () => 0);
    if (value.bonusStat !== undefined) stat(value.bonusStat);
  };
  for (const section of system.sheetSections ?? []) {
    boolean(section.modifierFirst);
    if (section.defaultSort !== undefined && !['Name', 'Training', 'Ability', 'Bonus'].includes(section.defaultSort)) fail('Invalid default sheet sort.');
    if (section.columns !== undefined) {
      list(section.columns);
      if (new Set(section.columns).size !== section.columns.length || !section.columns.includes('Name') || !section.columns.includes('Bonus') || section.columns.some((column) => !['Name', 'Training', 'Ability', 'Bonus'].includes(column))) fail('Invalid stat table columns.');
    }
    if (section.columnLabels !== undefined) {
      object(section.columnLabels);
      for (const [key, label] of Object.entries(section.columnLabels)) {
        if (!['Name', 'Training', 'Ability', 'Bonus'].includes(key)) fail('Unknown stat table column label.');
        text(label);
      }
    }
    for (const row of section.rows) roll(row.roll);
  }
  if (system.healthRules !== undefined) {
    object(system.healthRules);
    resource(system.healthRules.resourceKey);
    if (system.healthRules.temporaryResourceKey !== undefined) {
      resource(system.healthRules.temporaryResourceKey);
      if (system.healthRules.resourceKey === system.healthRules.temporaryResourceKey) fail('Health and temporary health must use different pools.');
    }
    if (system.healthRules.resetResourceKeysOnHealing !== undefined) {
      list(system.healthRules.resetResourceKeysOnHealing);
      system.healthRules.resetResourceKeysOnHealing.forEach(resource);
      if (system.healthRules.resetResourceKeysOnHealing.some((key) => key === system.healthRules!.resourceKey || key === system.healthRules!.temporaryResourceKey)) fail('Healing cannot reset a health pool.');
    }
    if (system.healthRules.clearOnReset !== undefined) {
      object(system.healthRules.clearOnReset);
      for (const [event, keys] of Object.entries(system.healthRules.clearOnReset)) {
        if (!system.resetConditions?.some((condition) => condition.id === event) && !system.recoveryEvents?.includes(event)) fail(`Unknown health reset ${event}.`);
        list(keys);
        keys.forEach(resource);
      }
    }
  }
  const display = system.sheetDisplay;
  if (display === undefined) return;
  object(display);
  for (const key of ['restPreview', 'rollHistory', 'showAllStats', 'detailsDrawer', 'sidebarCollapsed'] as const) boolean(display[key]);
  if (display.overview !== undefined) {
    list(display.overview);
    for (const row of display.overview) {
      object(row);
      stat(row.stat);
      for (const label of [row.name, row.unit].filter((label) => label !== undefined)) text(label);
      boolean(row.signed);
      roll(row.roll);
    }
    if (new Set(display.overview.map((row) => row.stat)).size !== display.overview.length) fail('Duplicate overview stat.');
  }
  if (display.health) {
    object(display.health);
    if (display.health.name !== undefined) text(display.health.name);
    boolean(display.health.showHealingFeatures);
    boolean(display.health.showDeathSavesAtZero);
    if (display.health.counters !== undefined) {
      list(display.health.counters);
      display.health.counters.forEach(resource);
    }
  }
  for (const settings of [display.resources, display.inventory, display.spells]) if (settings) {
    object(settings);
    for (const [key, value] of Object.entries(settings)) if (!['columns', 'castingStats'].includes(key)) boolean(value);
  }
  if (display.spells?.columns !== undefined) {
    list(display.spells.columns);
    for (const column of display.spells.columns) {
      object(column);
      text(column.name);
      text(column.metadataKey);
    }
  }
  if (display.spells?.castingStats !== undefined) {
    list(display.spells.castingStats);
    for (const source of display.spells.castingStats) {
      object(source);
      text(source.ability);
      stat(source.attackStat);
      stat(source.saveStat);
    }
  }
  if (display.actions) {
    object(display.actions);
    if (display.actions.itemCategories !== undefined) {
      list(display.actions.itemCategories);
      display.actions.itemCategories.forEach(text);
    }
    if (display.actions.categories !== undefined) {
      list(display.actions.categories);
      for (const category of display.actions.categories) {
        object(category);
        text(category.id);
        text(category.name);
        list(category.kinds);
        category.kinds.forEach(text);
      }
      if (new Set(display.actions.categories.map((category) => category.id)).size !== display.actions.categories.length) fail('Duplicate action filter.');
    }
    if (display.actions.columns !== undefined) {
      list(display.actions.columns);
      for (const column of display.actions.columns) {
        object(column);
        text(column.name);
        text(column.metadataKey);
      }
    }
  }
  if (display.statuses !== undefined) {
    list(display.statuses);
    for (const status of display.statuses) {
      object(status);
      text(status.name);
      list(status.tags);
      status.tags.forEach(text);
    }
  }
}
