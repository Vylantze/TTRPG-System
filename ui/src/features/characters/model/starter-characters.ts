import {
  convertCurrencyItems,
  getCurrency,
  deserializeCharacter,
  parseSystemFile,
} from '@/src/index';
import { bundledSystem } from '@/ui/src/features/systems/model/bundled-system';
import { createRegistry, systemKey, type Workspace } from '@/ui/src/lib/workspace';

/** Validate the entire party before returning a new workspace; never replace pinned rules or existing saves. */
export function addStarterCharacters(
  workspace: Workspace,
  system: unknown,
  saves: unknown,
): Workspace {
  const incoming = parseSystemFile(system);
  const existing = workspace.systems.find((file) => systemKey(file) === systemKey(incoming));
  const systems = existing ? workspace.systems : [...workspace.systems, incoming];
  const registry = createRegistry(systems);
  if (!Array.isArray(saves) || saves.length !== 12)
    throw new Error('The sample party must contain twelve characters.');
  const characters = saves.map((save) => {
    const character = deserializeCharacter(JSON.stringify(save));
    const result = registry.engineForCharacter(character).evaluate(character);
    if (result.status !== 'valid')
      throw new Error(
        `The loaded ${bundledSystem.name} System cannot validate these samples. Export your characters, then unload the old System and load the updated bundled System.`,
      );
    return character;
  });
  if (new Set(characters.map((c) => c.id)).size !== 12)
    throw new Error('The sample party contains duplicate IDs.');
  const additions = characters.filter(
    (c) => !workspace.characters.some((saved) => saved.id === c.id),
  );
  return { ...workspace, systems, characters: [...workspace.characters, ...additions] };
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
  return characters.some((character, index) => character !== workspace.characters[index])
    ? { ...workspace, characters }
    : workspace;
}
