import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../src/systems/dnd5e-2014/system.json', import.meta.url);
const file = JSON.parse(readFileSync(path, 'utf8'));
const parents = file.features.filter((feature) => !feature.roll);
const rolls = [];
const pattern = /\b(?:\d+)?d\d+(?:\s*(?:\+|−|-|plus|minus)\s*(?:(?:your\s+)?(?:strength|dexterity|constitution|intelligence|wisdom|charisma)\s+modifier|(?:your\s+)?(?:fighter|wizard|rogue|cleric)\s+level|\d+(?:d\d+)?))*/gi;
for (const feature of parents) {
  feature.components = feature.components.filter((component) => !component.id.startsWith('roll-feature-'));
  const declarations = feature.rolls ?? [...new Set(feature.description?.match(pattern) ?? [])].map((text, index) => {
    const normalized = text.replace(/\bplus\b/gi, '+').replace(/\bminus\b/gi, '-').replace(/−/g, '-').replace(/\bd(?=\d)/gi, '1d');
    const stat = normalized.match(/\s*\+\s*(?:your )?(strength|dexterity|constitution|intelligence|wisdom|charisma) modifier$/i);
    const cls = normalized.match(/\s*\+\s*(?:your )?(fighter|wizard|rogue|cleric) level$/i);
    const suffix = stat ?? cls;
    return { id: `reference-${index + 1}`, label: `${feature.displayName ?? feature.name}: ${text}`, dice: suffix ? normalized.slice(0, suffix.index) : normalized, ...(stat ? { bonus: { stat: `modifier.${stat[1].toLowerCase()}` } } : cls ? { bonus: { class: `dnd5e:2014:${cls[1].toLowerCase()}` } } : {}) };
  });
  // Retain authored declarations when regenerating an already-converted System.
  const authored = file.features.filter((roll) => roll.roll && roll.id.startsWith(`${feature.id}.roll.`));
  for (const [index, definition] of (authored.length ? authored.map((entry) => entry.roll) : declarations).entries()) {
    const id = `${feature.id}.roll.${definition.id}`;
    rolls.push({ id, revision: 1, name: definition.label, displayName: definition.label, source: feature.source, textReferences: [feature.id], tags: ['roll-feature'], repeat: { maximum: 1, scope: 'parent' }, roll: definition, components: [] });
    feature.components.push({ id: `roll-feature-${index + 1}`, kind: 'grantFeature', feature: id });
  }
  delete feature.rolls;
}
file.features = [...parents, ...rolls];
for (const config of file.configurations) config.system.tagDisplayNames['roll-feature'] = 'Roll Feature';
writeFileSync(path, JSON.stringify(file, null, 2) + '\n');
console.log(`Authored ${rolls.length} separate Roll Features.`);
