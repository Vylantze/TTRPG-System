import { exampleCharacter } from '@/examples/dnd2014-character.js';
const { engine, character, evaluation } = exampleCharacter({ classes: [{ class: 'fighter', level: 3 }, { class: 'rogue', level: 2 }], settings: { multiclass: true } });
if (evaluation.status !== 'valid') throw new Error(JSON.stringify(evaluation.diagnostics));
console.log(`${engine.catalogue.system.name}: Fighter 3 / Rogue 2`);
console.log(JSON.stringify({ status: evaluation.status, level: evaluation.characterLevel, proficiencyBonus: evaluation.stats.proficiencyBonus.value, hitPoints: evaluation.stats.hitPoints.value, untrainedWisdomSave: evaluation.stats['save.wisdom'].value, trainedAthletics: evaluation.stats['skill.athletics'].value, resources: Object.values(evaluation.resources).map((p) => ({ key: p.key, capacity: p.capacity, available: p.available })), selectedFeatures: evaluation.instances.filter((i) => i.active && i.eligible).length, savedCharacterId: character.id }, null, 2));
