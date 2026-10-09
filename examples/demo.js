import { Engine, applyEdit, classEntryPath, selectionPath, serializeCharacter } from '@/dist/index.js';
import { catalogue } from '@/examples/catalogue.js';
const engine = new Engine(catalogue);
let character = engine.createCharacter('demo', 'Example adventurer', [{ id: 'main', class: 'example:adventurer', level: 3 }]);
character = applyEdit(engine, character, [
  { kind: 'select', selection: classEntryPath('main', 1, 'technique'), picks: [{ id: 'guard', feature: 'example:guard' }] },
  { kind: 'select', selection: selectionPath(classEntryPath('main', 2, 'energy'), 'technique'), picks: [{ id: 'pulse', feature: 'example:energy-technique' }] },
], 'finish-example', { requireValid: true });
const result = engine.evaluate(character, { guarded: true });
console.log(JSON.stringify({ status: result.status, level: result.characterLevel,
  defense: result.stats.defense, resources: result.resources, abilities: result.capabilities.map((c) => c.definition.name) }, null, 2));
console.log(`Save size: ${serializeCharacter(character).length} characters`);
