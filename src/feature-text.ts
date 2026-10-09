import type { FeatureDefinition } from './model.js';
import type { FeatureTextSpan } from './types/FeatureTextSpan.js';
import type { Node } from './types/Node.js';
export type { FeatureTextSpan } from './types/FeatureTextSpan.js';
const node = (): Node => ({ children: new Map(), ids: new Set() });
const word = (value: string | undefined) => !!value && /[\p{L}\p{N}_]/u.test(value);

/** Normalize matching only. Offsets always refer to the untouched source text. */
function normalized(text: string) {
  let value = '', offset = 0;
  const starts: number[] = [], ends: number[] = [];
  for (const character of text) {
    const next = offset + character.length;
    const replacement = character.normalize('NFKC').toLowerCase().replace(/[’‘ʼ]/g, '\'').replace(/[‐‑–—]/g, '-').replace(/\s/g, ' ');
    for (const unit of replacement.split('')) {
      if (unit === ' ' && value.endsWith(' ')) {
        ends[ends.length - 1] = next;
        continue;
      }
      value += unit;
      starts.push(offset);
      ends.push(next);
    }
    offset = next;
  }
  return { value, starts, ends };
}

/** A reusable, System-independent index. Ambiguous names retain every target. */
export class FeatureTextIndex {
  private readonly root = node();
  constructor(features: readonly FeatureDefinition[]) {
    const definitions = new Map(features.map((feature) => [feature.id, feature]));
    for (const feature of features) for (const name of [feature.displayName ?? feature.name, ...(feature.textAliases ?? [])]) {
      const label = normalized(name).value.trim();
      if (!label) continue;
      // Identically named spell/ability wrappers point to their shared source.
      const references = (feature.textReferences ?? []).map((id) => definitions.get(id)).filter((reference): reference is FeatureDefinition => !!reference && normalized(reference.displayName ?? reference.name).value.trim() === label);
      const targets = references.length ? references.map((reference) => reference.id) : [feature.id];
      let current = this.root;
      for (const character of label.split('')) {
        if (!current.children.has(character)) current.children.set(character, node());
        current = current.children.get(character)!;
      }
      targets.forEach((id) => current.ids.add(id));
    }
  }

  resolve(text: string, exclude: readonly string[] = []): FeatureTextSpan[] {
    const { value, starts, ends } = normalized(text), ignored = new Set(exclude), spans: FeatureTextSpan[] = [];
    for (let start = 0; start < value.length; start++) {
      if (word(value[start - 1])) continue;
      let current = this.root, match: { end: number; ids: string[] } | undefined;
      for (let end = start; end < value.length; end++) {
        const next = current.children.get(value[end]);
        if (!next) break;
        current = next;
        const ids = [...current.ids].filter((id) => !ignored.has(id)).sort();
        if (current.ids.size && !word(value[end + 1])) match = { end, ids };
      }
      if (match) {
        const from = starts[start], to = ends[match.end];
        if (match.ids.length) spans.push({ text: text.slice(from, to), start: from, end: to, features: match.ids });
        start = match.end;
      }
    }
    return spans;
  }
}
