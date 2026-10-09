import { writeFileSync } from 'node:fs';
import { exampleCharacter } from '@/examples/dnd2014-character.js';
import { finalizeCharacter, serializeCharacter } from '@/dist/index.js';

const { engine, character } = exampleCharacter({ classes: [{ class: 'fighter', level: 2 }, { class: 'wizard', level: 3 }], settings: { multiclass: true } });
character.id = 'sample-2014-fighter-wizard';
character.name = 'Arden — Fighter / Wizard';
character.notes = { Sample: 'Custom multiclass testing character, not an official Starter Set pregen. Human Fighter 2 / Wizard 3. Use Edit build to customize.' };
for (const pool of Object.values(engine.evaluate(character).resources)) if (pool.key === 'hit-points') character.resources[pool.id] = { current: pool.capacity, spent: 0 };
const ready = finalizeCharacter(engine, character, 'sample-finalize');
writeFileSync(new URL('../src/systems/dnd5e-2014/multiclass-sample.json', import.meta.url), serializeCharacter(ready) + '\n');
console.log('Generated valid Fighter 2 / Wizard 3 sample.');
