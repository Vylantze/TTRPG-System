import { deserializeCharacter, parseSystemFile } from '@/src/index';
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
