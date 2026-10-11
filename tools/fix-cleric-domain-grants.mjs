import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/systems/dnd5e-2014/class-features.json';
const file = JSON.parse(readFileSync(path, 'utf8'));
const spells = JSON.parse(readFileSync('src/systems/dnd5e-2014/spells.json', 'utf8')).data;
for (const feature of file.data.filter((feature) => feature.id.includes(':cleric.'))) {
  feature.components = feature.components.flatMap((component) => {
    if (component.kind !== 'chooseFeatures' || component.id !== 'domain-spells') return [component];
    return component.candidates.ids.map((id) => {
      const spell = spells.find((entry) => entry.id === id);
      if (!spell?.contentLevel) throw new Error(`Missing domain spell level: ${id}`);
      return { id: `domain-${id.split('.').at(-1)}`, kind: 'grantFeature', feature: id, atClassLevel: 2 * spell.contentLevel - 1 };
    });
  });
}
writeFileSync(path, JSON.stringify(file, null, 2) + '\n');
