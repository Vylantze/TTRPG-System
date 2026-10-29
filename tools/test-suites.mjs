export const engineTestSuites = {
  core: { description: 'Engine evaluation, building blocks, effects, drafts, queries, and caching', files: ['engine.test.js', 'building-blocks.test.js', 'effects.test.ts', 'drafts.test.js', 'catalogue-queries.test.js', 'loading-performance.test.js'] },
  systems: { description: 'System loading, asset packages, and version policies', files: ['system-loader.test.js', 'system-package.test.js', 'version-policy.test.js'] },
  content: { description: 'Descriptions, automatic links, tokens, and spell display', files: ['descriptions.test.js', 'feature-text.test.js', 'description-tokens.test.js', 'spell-display.test.js'] },
  characters: { description: 'Character sheets, inventory, resources, currency, and play', files: ['starter-characters.test.js', 'inventory-resources.test.js', 'currency.test.js', 'character-play.test.js', 'equipment-effects.test.js', 'sheet-display.test.js'] },
  classes: { description: '2014 class progressions, subclasses, domain spells, and audit regressions', files: ['dnd2014.test.js', 'expanded-classes.test.js', 'subclass-expansion.test.js', 'audit-regressions.test.js', 'domain-spells.test.js'] },
  artificer: { description: 'Artificer progression, infusions, and companions', files: ['artificer.test.js'] },
  tooling: { description: 'Lint rules, UI release policy, and test-suite selection', files: ['lint.test.js', 'ui-release.test.js', 'test-suites.test.js'] },
};

export function availableEngineSuites(discovered) {
  const assigned = new Set();
  for (const suite of Object.values(engineTestSuites)) for (const file of suite.files) {
    if (!discovered.includes(file)) throw new Error(`Test suite references a missing file: ${file}`);
    if (assigned.has(file)) throw new Error(`Test file belongs to multiple suites: ${file}`);
    assigned.add(file);
  }
  return { ...engineTestSuites, other: { description: 'Automatically discovered tests awaiting categorization', files: discovered.filter((file) => !assigned.has(file)) } };
}

export function selectEngineTests(names, discovered) {
  const suites = availableEngineSuites(discovered);
  const selected = names.length ? names : ['all'];
  for (const name of selected) if (name !== 'all' && !Object.hasOwn(suites, name)) throw new Error(`Unknown test suite "${name}". Use --list to see available suites.`);
  return [...new Set(selected.flatMap((name) => name === 'all' ? discovered : suites[name].files))].sort();
}
