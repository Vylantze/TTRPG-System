import type { FeatureDefinition } from '@/src/model/FeatureDefinition.js';

/** Match the original source once. Earliest match wins; array order breaks ties. Never cascade. */
export function applyDescriptionOverrides(source: string, overrides: FeatureDefinition['descriptionOverride'] = []) {
  let text = '', offset = 0;
  const ranges: { start: number; end: number }[] = [];
  while (offset < source.length) {
    let next: { index: number; entry: NonNullable<FeatureDefinition['descriptionOverride']>[number] } | undefined;
    for (const entry of overrides) {
      if (!entry.originalString) continue;
      const index = source.indexOf(entry.originalString, offset);
      if (index >= 0 && (!next || index < next.index)) next = { index, entry };
    }
    if (!next) {
      text += source.slice(offset);
      break;
    }
    text += source.slice(offset, next.index);
    const start = text.length;
    text += next.entry.overrideString;
    ranges.push({ start, end: text.length });
    offset = next.index + next.entry.originalString.length;
  }
  return { text, ranges };
}
