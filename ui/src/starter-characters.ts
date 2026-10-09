import { convertCurrencyItems, getCurrency, deserializeCharacter, parseSystemFile, type Character } from '@/src/index';
import { createRegistry, systemKey, type Workspace } from '@/ui/src/workspace';

/** Validate the entire party before returning a new workspace; never replace pinned rules or existing saves. */
export function addStarterCharacters(workspace: Workspace, system: unknown, saves: unknown): Workspace {
  const incoming = parseSystemFile(system);
  const existing = workspace.systems.find((file) => systemKey(file) === systemKey(incoming));
  const systems = existing ? workspace.systems : [...workspace.systems, incoming];
  const registry = createRegistry(systems);
  if (!Array.isArray(saves) || saves.length !== 5) throw new Error('The Starter Set party must contain five characters.');
  const characters = saves.map((save) => {
    const character = deserializeCharacter(JSON.stringify(save));
    const result = registry.engineForCharacter(character).evaluate(character);
    if (result.status !== 'valid') throw new Error('The loaded DnD5e 2014 System cannot validate these templates. Export your characters, then unload the old System and load the updated bundled System.');
    return character;
  });
  if (new Set(characters.map((c) => c.id)).size !== 5) throw new Error('The Starter Set party contains duplicate IDs.');
  const additions = characters.filter((c) => !workspace.characters.some((saved) => saved.id === c.id));
  return { ...workspace, systems, characters: [...workspace.characters, ...additions] };
}

/** Upgrade only the old, unedited armor setup; never overwrite an existing inventory. */
export function addStarterInventory(workspace: Workspace, saves: unknown): Workspace {
  if (!Array.isArray(saves)) return workspace;
  const templates = saves.map((save) => deserializeCharacter(JSON.stringify(save)));
  const registry = createRegistry(workspace.systems);
  const characters = workspace.characters.map((character): Character => {
    const template = templates.find((candidate) => candidate.id === character.id);
    if (!template?.inventory || character.system.id !== template.system.id || character.catalogue.id !== template.catalogue.id || character.inventory || !character.notes?.Equipment) return character;
    const oldArmor = character.id.includes('noble') || character.id.includes('cleric') ? 10 : character.id.includes('wizard') ? 0 : 2;
    const oldShield = character.id.includes('cleric') ? 1 : 0;
    if (character.inputs.armorIndex !== oldArmor || character.inputs.shield !== oldShield) return character;
    const notes = { ...character.notes };
    notes['Original equipment notes'] = notes.Equipment;
    delete notes.Equipment;
    if (notes['Starting money']) notes['Original money note'] = notes['Starting money'];
    delete notes['Starting money'];
    const next = { ...character, notes, inventory: structuredClone(template.inventory), inputs: { ...character.inputs, armorIndex: 0, shield: 0 } };
    try {
      const engine = registry.engineForCharacter(next);
      const before = engine.evaluate(character), after = engine.evaluate(next);
      if (after.status !== 'valid' || Object.entries(before.stats).some(([id, stat]) => after.stats[id]?.value !== stat.value)) return character;
      return next;
    } catch {
      return character;
    }
  });
  return characters.some((character, index) => character !== workspace.characters[index]) ? { ...workspace, characters } : workspace;
}

/** Move legacy coins into the dedicated balance; note text never adds money twice. */
export function migrateMoney(workspace: Workspace): Workspace {
  const registry = createRegistry(workspace.systems);
  const characters = workspace.characters.map((character) => {
    try {
      const system = registry.engineForCharacter(character).catalogue.system;
      let next = convertCurrencyItems(character, system);
      const notes = { ...next.notes };
      const text = notes['Starting money'] ?? notes['Original money note'];
      if (text) {
        const match = text.trim().match(/^(\d+)\s+([a-z]+)\.?$/i);
        const unit = getCurrency(system).denominations.find((entry) => entry.id === match?.[2]);
        if (unit && match) {
          if (!next.money) next = { ...next, money: { [unit.id]: Number(match[1]) } };
          delete notes['Starting money'];
          delete notes['Original money note'];
          next = { ...next, notes };
        }
      }
      return next;
    } catch {
      return character;
    }
  });
  return characters.some((character, index) => character !== workspace.characters[index]) ? { ...workspace, characters } : workspace;
}
