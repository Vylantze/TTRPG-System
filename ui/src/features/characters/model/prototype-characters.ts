import { evaluateForSheet } from '@/ui/src/features/characters/model/sheet-evaluation';
import {
  deserializeCharacter,
  migrateCharacterStructure,
  serializeCharacter,
  type Character,
  type SystemFile,
} from '@/src/index';
import { createRegistry, systemKey, type Workspace } from '@/ui/src/lib/workspace';
import type { PrototypeCleanup } from '@/ui/src/types/PrototypeCleanup';

/** Temporary prototype policy: retain compatible edits; rebuild samples and discard incompatible saves. */
export function reconcilePrototypeCharacters(
  workspace: Workspace,
  templates: Character[],
  replacement?: SystemFile,
): PrototypeCleanup {
  const systems = replacement
    ? workspace.systems.map((file) =>
        systemKey(file) === systemKey(replacement) ? replacement : file,
      )
    : workspace.systems;
  const before = createRegistry(workspace.systems),
    after = createRegistry(systems);
  const removed: string[] = [],
    rebuilt: string[] = [];
  const compatible = (character: Character) => {
    const engine = after.engineForCharacter(character);
    deserializeCharacter(serializeCharacter(character), engine);
    const result = evaluateForSheet(engine, character);
    // Unfinished choices are expected in a draft. Structural damage is not.
    if (
      result.status !== 'valid'
      && (character.buildState !== 'draft'
        || result.diagnostics.some((d) =>
          [
            'UNKNOWN_FEATURE',
            'UNKNOWN_CLASS',
            'HISTORY',
            'SCHEMA',
            'CONTENT_REVISION',
            'CANDIDATE',
            'ROOT_FEATURE',
          ].includes(d.code),
        ))
    )
      throw new Error('Character is incompatible with the loaded System.');
    return character;
  };
  const characters = workspace.characters.flatMap((character) => {
    if (!systems.some((file) => systemKey(file) === systemKey(character.system)))
      return [character];
    try {
      const next
        = replacement && systemKey(character.system) === systemKey(replacement)
          ? migrateCharacterStructure(
              character,
              before.engineForCharacter(character),
              after.engineForCharacter(character),
            )
          : character;
      return [compatible(next)];
    } catch {
      const template = templates.find(
        (sample) =>
          sample.id === character.id && systemKey(sample.system) === systemKey(character.system),
      );
      if (template) {
        try {
          const fresh = compatible(structuredClone(template));
          rebuilt.push(character.name);
          return [fresh];
        } catch {
          /* A template for another bundle cannot replace this saved character. */
        }
      }
      removed.push(character.name);
      return [];
    }
  });
  const changed = replacement || removed.length || rebuilt.length;
  return {
    workspace: changed
      ? {
          ...workspace,
          systems,
          characters,
          active: characters.some((c) => c.id === workspace.active) ? workspace.active : undefined,
        }
      : workspace,
    removed,
    rebuilt,
  };
}
