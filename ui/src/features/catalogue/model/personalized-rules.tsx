import {
  descriptionTokenValues,
  type Character,
  type Engine,
  type EvaluationResult,
} from '@/src/index';
import { Tooltip } from '@/ui/src/components/Tooltip';

export function ruleValues(
  text: string,
  engine: Engine,
  character: Character,
  result: EvaluationResult,
  explicit = false,
) {
  if (explicit) return descriptionTokenValues(text, engine, character, result);
  const values: { start: number; end: number; label: string; value: number }[] = [];
  const processing = engine.catalogue.system.sheetDisplay?.descriptionProcessing;
  const candidates = [
    ...(processing?.statPhrases?.map(({ phrase, stat }) => ({
      phrase,
      value: result.stats[stat]?.value,
    })) ?? []),
    ...(processing?.classLevelPhrases
      ? engine.catalogue.classes.map((cls) => ({
          phrase: `${cls.name} level`,
          value: character.progressions
            .filter((p) => p.class === cls.id)
            .reduce((n, p) => n + p.level, 0),
        }))
      : []),
  ];
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.value)) continue;
    const escaped = candidate.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const match of text.matchAll(new RegExp(`\\b(?:your )?${escaped}\\b`, 'gi')))
      values.push({
        start: match.index!,
        end: match.index! + match[0].length,
        label: match[0],
        value: candidate.value!,
      });
  }
  const matches: typeof values = [];
  for (const value of values.sort((a, b) => a.start - b.start || b.end - a.end))
    if (!matches.length || value.start >= matches.at(-1)!.end) matches.push(value);
  return matches;
}
export function personalizedText(
  text: string,
  engine: Engine,
  character: Character,
  result: EvaluationResult,
  explicit = false,
) {
  let offset = 0;
  const parts = [];
  for (const value of ruleValues(text, engine, character, result, explicit)) {
    parts.push(
      text.slice(offset, value.start),
      <Tooltip
        key={value.start}
        text={value.label}
      >
        <span className="resolved-value">{value.value}</span>
      </Tooltip>,
    );
    offset = value.end;
  }
  parts.push(text.slice(offset));
  return parts;
}
export function resolvedRuleText(
  text: string,
  engine: Engine,
  character: Character,
  result: EvaluationResult,
  explicit = false,
) {
  for (const value of ruleValues(text, engine, character, result, explicit).reverse())
    text = text.slice(0, value.start) + value.value + text.slice(value.end);
  return text;
}
