import type { Choice, Engine, FeatureDefinition, Grant } from '@/src/index';
import { FeatureLink } from '@/ui/src/features/catalogue/components/FeatureLink';
import { FeatureRules } from '@/ui/src/features/catalogue/components/RulesText';
import { featureName, tagName } from '@/ui/src/features/catalogue/model/display';
import { featureDescription } from '@/ui/src/features/catalogue/model/feature-description';
import { expressionText } from '@/ui/src/features/catalogue/model/feature-requirements';
import { labelFromId } from '@/ui/src/lib/workspace';
import type { TreeNode } from '@/ui/src/types/TreeNode';

/** Options listed under a choice before the rest are summarised. */
const OPTION_LIMIT = 40;

/** First prose sentence of a description, for the one-line summary beside a name. Source text
 * often opens with headings or "Casting Time: 1 action" lines, so those are skipped. */
export function oneLine(text?: string, limit = 120) {
  if (!text) return undefined;
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  // A field line can run straight into the prose ("Duration: 1 minute You bless …"), so drop
  // the "Key: value" part up to the first lowercase-to-capital word break.
  const proseOf = (line: string) => {
    const field = line.match(/^[^.:]{1,30}:\s*/);
    if (!field) return line;
    const rest = line.slice(field[0].length);
    const start = rest.search(/[a-z0-9)] [A-Z]/);
    return start < 0 ? '' : rest.slice(start + 2);
  };
  const prose
    = lines.map(proseOf).find((line) => /[.!?]$/.test(line) && line.length > 24)
      ?? lines.find((line) => line.length > 24)
      ?? lines[0];
  const sentence = prose.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? prose;
  return sentence.length > limit ? `${sentence.slice(0, limit - 1).trimEnd()}…` : sentence;
}

/** The grants and choices a Feature contains, in authored order. */
export const structuralEntries = (feature: FeatureDefinition) =>
  feature.components.filter(
    (component): component is Grant | Choice =>
      component.kind === 'grantFeature' || component.kind === 'chooseFeatures',
  );

export function choiceTitle(choice: Choice, engine: Engine) {
  const minimum = expressionText(choice.minimum, engine),
    maximum = expressionText(choice.maximum, engine);
  const count = minimum === maximum ? maximum : `${minimum}–${maximum}`;
  // The choice's own id names it ("domain", "cantrips"); a tag pool says what it draws from.
  const pool = choice.candidates.tags?.length
    ? ` (${choice.candidates.tags.map((tag) => tagName(engine.catalogue.system, tag)).join(' + ')})`
    : '';
  return `Choose ${count}: ${labelFromId(choice.id)}${pool}`;
}

/** A catalogue Feature and everything it grants or offers, built lazily to any depth. */
export function featureNode(
  engine: Engine,
  feature: FeatureDefinition,
  openFeature: (id: string) => void,
  tag: string | undefined,
  ancestors: string[],
  id = feature.id,
): TreeNode {
  const repeats = ancestors.includes(feature.id);
  let entries = repeats ? [] : structuralEntries(feature);
  // A wrapper that only grants a same-named Feature (a class's copy of a shared spell) would
  // repeat its own name one level down, so show the wrapped Feature's contents instead.
  for (let guard = 0; guard < 4 && entries.length === 1 && entries[0].kind === 'grantFeature'; guard++) {
    const wrapped = engine.getFeature(entries[0].feature);
    if (!wrapped || featureName(wrapped) !== featureName(feature) || ancestors.includes(wrapped.id)) break;
    entries = structuralEntries(wrapped);
  }
  return {
    id,
    tag,
    name: featureName(feature),
    label: featureName(feature),
    description: oneLine(featureDescription(feature, engine)),
    meta: entries.length ? `${entries.length} inside` : undefined,
    state: repeats ? { text: 'Repeats an outer Feature', tone: 'muted' } : undefined,
    detail: () => (
      <>
        <FeatureRules
          feature={feature}
          engine={engine}
          openFeature={openFeature}
        />
        <FeatureLink
          id={feature.id}
          engine={engine}
        >
          Open Feature →
        </FeatureLink>
      </>
    ),
    children: entries.length
      ? () => entryNodes(engine, entries, openFeature, featureName(feature), [...ancestors, feature.id])
      : undefined,
  };
}

/** Grants and choices, such as a Class level's entries or a Feature's components. */
export function entryNodes(
  engine: Engine,
  entries: (Grant | Choice)[],
  openFeature: (id: string) => void,
  tag: string | undefined,
  ancestors: string[],
): TreeNode[] {
  return entries.flatMap((entry, index): TreeNode[] => {
    if (entry.kind === 'grantFeature') {
      const feature = engine.getFeature(entry.feature);
      return feature ? [featureNode(engine, feature, openFeature, tag, ancestors, `${index}:${feature.id}`)] : [];
    }
    const options = engine.getSelectionFeatures(entry);
    return [
      {
        id: `${index}:choice`,
        tag,
        name: choiceTitle(entry, engine),
        label: choiceTitle(entry, engine),
        meta: `${options.length} options`,
        children: () => [
          ...options
            .slice(0, OPTION_LIMIT)
            .map((option) => featureNode(engine, option, openFeature, undefined, ancestors)),
          ...(options.length > OPTION_LIMIT
            ? [
                {
                  id: 'more',
                  leaf: true,
                  label: 'More options',
                  name: `And ${options.length - OPTION_LIMIT} more options, listed under Features.`,
                },
              ]
            : []),
        ],
      },
    ];
  });
}
