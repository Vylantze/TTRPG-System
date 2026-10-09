import type { Character, Engine, EvaluationResult } from '@/src/index';
import { Tooltip } from '@/ui/src/Tooltip';

export function ruleValues(text: string, engine: Engine, character: Character, result: EvaluationResult) {
  const values: { start: number; end: number; label: string; value: number }[] = [];
  const candidates = [
    ...engine.catalogue.system.stats.filter((stat) => stat.id.startsWith('modifier.')).map((stat) => ({ phrase: `${stat.id.slice(9)} modifier`, value: result.stats[stat.id]?.value })),
    ...engine.catalogue.classes.map((cls) => ({ phrase: `${cls.name} level`, value: character.progressions.filter((p) => p.class === cls.id).reduce((n, p) => n + p.level, 0) })),
    { phrase: 'proficiency bonus', value: result.stats.proficiencyBonus?.value },
  ];
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.value)) continue;
    const escaped = candidate.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const match of text.matchAll(new RegExp(`\\b(?:your )?${escaped}\\b`, 'gi'))) values.push({ start: match.index!, end: match.index! + match[0].length, label: match[0], value: candidate.value! });
  }
  return values.sort((a, b) => a.start - b.start);
}
export function personalizedText(text: string, engine: Engine, character: Character, result: EvaluationResult) {
  let offset = 0;
  const parts = [];
  for (const value of ruleValues(text, engine, character, result)) {
    parts.push(text.slice(offset, value.start), <Tooltip key={value.start} text={value.label}><span className="resolved-value">{value.value}</span></Tooltip>);
    offset = value.end;
  }
  parts.push(text.slice(offset));
  return parts;
}
export function resolvedRuleText(text: string, engine: Engine, character: Character, result: EvaluationResult) {
  for (const value of ruleValues(text, engine, character, result).reverse()) text = text.slice(0, value.start) + value.value + text.slice(value.end);
  return text;
}
