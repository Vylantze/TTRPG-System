import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../src/systems/dnd5e-2014/system.json', import.meta.url);
const file = JSON.parse(readFileSync(path, 'utf8'));
const parents = file.features.filter((feature) => !feature.roll);
const standalone = file.features.filter((feature) => feature.roll && !parents.some((parent) => feature.id.startsWith(`${parent.id}.roll.`)));
const rolls = [];
const pattern = /\b(?:\d+)?d\d+(?:\s*(?:\+|−|-|plus|minus)\s*(?:(?:your\s+)?(?:strength|dexterity|constitution|intelligence|wisdom|charisma)\s+modifier|(?:your\s+)?(?:barbarian|bard|cleric|druid|fighter|monk|paladin|ranger|rogue|sorcerer|warlock|wizard)\s+level|\d+(?:d\d+)?))*/gi;
for (const feature of parents) {
  feature.components = feature.components.filter((component) => !component.id.startsWith('roll-feature-'));
  const description = feature.tags?.includes('spell') ? feature.description?.split(/\bAt Higher Levels\s*[.:]?/i)[0] : feature.description;
  const declarations = feature.rolls ?? [...new Set(description?.match(pattern) ?? [])].map((text, index) => {
    const normalized = text.replace(/\bplus\b/gi, '+').replace(/\bminus\b/gi, '-').replace(/−/g, '-').replace(/\bd(?=\d)/gi, '1d');
    const bonuses = /\s*([+-])\s*(?:your )?(?:(strength|dexterity|constitution|intelligence|wisdom|charisma) modifier|(barbarian|bard|cleric|druid|fighter|monk|paladin|ranger|rogue|sorcerer|warlock|wizard) level)/gi;
    const terms = [...normalized.matchAll(bonuses)];
    let bonus;
    if (terms.length === 1 && terms[0][1] === '+') bonus = terms[0][2] ? { stat: `modifier.${terms[0][2].toLowerCase()}` } : { class: `dnd5e:2014:${terms[0][3].toLowerCase()}` };
    else if (terms.length) {
      const id = `roll-bonus-${index + 1}`, stat = `roll.${feature.id}.${index + 1}.bonus`;
      const args = terms.map((term) => {
        const value = term[2] ? { stat: `modifier.${term[2].toLowerCase()}` } : { context: `level.dnd5e:2014:${term[3].toLowerCase()}` };
        return term[1] === '-' ? { op: 'multiply', args: [-1, value] } : value;
      });
      feature.components = feature.components.filter((component) => component.id !== id);
      feature.components.push({ id, kind: 'defineStat', stat: { id: stat, name: `${feature.displayName ?? feature.name} roll bonus`, kind: 'derived', expression: { op: 'add', args } } });
      bonus = { stat };
    }
    return { id: `reference-${index + 1}`, label: `${feature.displayName ?? feature.name}: ${text}`, dice: normalized.replace(bonuses, ''), ...(bonus ? { bonus } : {}) };
  });
  // Retain authored declarations when regenerating an already-converted System.
  const authored = file.features.filter((roll) => roll.roll && roll.id.startsWith(`${feature.id}.roll.`));
  for (const [index, definition] of (feature.tags?.includes('spell') ? declarations : authored.length ? authored.map((entry) => entry.roll) : declarations).entries()) {
    const id = `${feature.id}.roll.${definition.id}`;
    if (feature.tags?.includes('spell')) definition.spell = feature.id;
    rolls.push({ id, revision: 1, name: definition.label, displayName: definition.label, source: feature.source, textReferences: [feature.id], tags: ['roll-feature'], repeat: { maximum: 1, scope: 'parent' }, roll: definition, components: [] });
    feature.components.push({ id: `roll-feature-${index + 1}`, kind: 'grantFeature', feature: id });
  }
  delete feature.rolls;
}
file.features = [...parents, ...rolls, ...standalone];
for (const config of file.configurations) config.system.tagDisplayNames['roll-feature'] = 'Roll Feature';
writeFileSync(path, JSON.stringify(file, null, 2) + '\n');
console.log(`Authored ${rolls.length} separate Roll Features.`);
