import type { Character, Engine, EvaluationResult } from '@/src/index.js';

/** Resolve only explicit template tokens. Unknown values stay literal; no code is evaluated. */
export function descriptionTokenValues(text: string, engine: Engine, character: Character, result: EvaluationResult) {
  const values: { start: number; end: number; label: string; value: number }[] = [];
  for (const match of text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
    const token = match[1];
    const stat = token.startsWith('stat:') ? token.slice(5) : engine.catalogue.system.descriptionTokens?.[token];
    const cls = token.startsWith('class:') ? engine.catalogue.classes.find((entry) => entry.id === token.slice(6)) : undefined;
    const value = stat ? result.stats[stat]?.value : cls ? character.progressions.filter((entry) => entry.class === cls.id).reduce((sum, entry) => sum + entry.level, 0) : undefined;
    if (value === undefined || !Number.isFinite(value)) continue;
    const name = stat && engine.catalogue.system.stats.find((entry) => entry.id === stat)?.name;
    const label = stat ? name && name !== stat ? name : stat.replace(/^modifier\.(.+)$/, '$1 modifier').replace(/[._-]/g, ' ').replace(/^./, (letter) => letter.toUpperCase()) : `${cls!.name} level`;
    values.push({ start: match.index, end: match.index + match[0].length, label, value });
  }
  return values;
}
