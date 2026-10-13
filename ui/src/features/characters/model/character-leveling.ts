import { applyEdit, reopenCharacter, type Character, type Engine } from '@/src/index';

export function setCharacterLevel(
  engine: Engine,
  character: Character,
  progression: string,
  level: number,
): Character {
  const editable
    = character.buildState === 'draft'
      ? character
      : reopenCharacter(engine, character, crypto.randomUUID());
  return applyEdit(engine, editable, [{ kind: 'level', progression, level }], crypto.randomUUID());
}
