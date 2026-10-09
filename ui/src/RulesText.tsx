import { CharacterRuleContext } from '@/ui/src/character-rule-context';
import { personalizedText } from '@/ui/src/personalized-rules';
import { FeatureRolls } from '@/ui/src/FeatureRolls';
import { descriptionBlocks } from '@/ui/src/description-blocks';
import { FeatureOrigin } from '@/ui/src/feature-origin';
import { FeatureLink } from '@/ui/src/FeatureLink';
import { featureHref, descriptionBody } from '@/ui/src/feature-description';
import { Fragment, useContext, useMemo, useState, type ReactNode } from 'react';
import { FeatureTextIndex, type Engine, type FeatureDefinition } from '@/src/index';
import { Modal } from '@/ui/src/Modal';
import { featureName } from '@/ui/src/display';
import type { Preview } from '@/ui/src/types/Preview';
import type { References } from '@/ui/src/types/References';
const indexes = new WeakMap<Engine, FeatureTextIndex>();
function textIndex(engine: Engine) {
  let index = indexes.get(engine);
  if (!index) {
    index = new FeatureTextIndex(engine.catalogue.features);
    indexes.set(engine, index);
  }
  return index;
}
/** Link matching preserves source characters; imported HTML/Markdown stays inert. */
export function RulesText({ text, source, engine, openFeature, exclude = [], onPreview, processDescription = true, descriptionOverride }: { text?: string; source?: string; processDescription?: boolean; descriptionOverride?: string } & References) {
  const [preview, setPreview] = useState<Preview>();
  const origin = useContext(FeatureOrigin);
  const characterContext = useContext(CharacterRuleContext);
  const explicit = Boolean(characterContext && descriptionOverride !== undefined);
  const displayedText = explicit ? descriptionOverride : text;
  const prose = (value: string) => engine && characterContext && (explicit || processDescription) ? personalizedText(value, engine, characterContext.character, characterContext.result, explicit) : value;
  const index = useMemo(() => engine ? textIndex(engine) : undefined, [engine]);
  if (!displayedText) return null;
  const linkedProse = (paragraph: string) => {
    const children: ReactNode[] = [];
    let offset = 0;
    for (const span of index?.resolve(paragraph, exclude) ?? []) {
      children.push(prose(paragraph.slice(offset, span.start)));
      const href = span.features.length === 1 ? featureHref(span.features[0], engine!, origin) : featureHref('', engine!, origin).replace('#features/', '#features');
      children.push(
        <a
          className="feature-mention"
          key={span.start}
          href={href}
          aria-haspopup="dialog"
          title={`Read ${span.text}`}
          onClick={(event) => {
            if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            (onPreview ?? setPreview)({ ids: span.features, text: span.text });
          }}
        >
          {span.text}
        </a>,
      );
      offset = span.end;
    }
    children.push(prose(paragraph.slice(offset)));
    return children;
  };
  const linked = (paragraph: string) => explicit ? paragraph.split(/(\{\{[^{}]*\}\})/g).map((part, index) => <Fragment key={index}>{part.startsWith('{{') ? prose(part) : linkedProse(part)}</Fragment>) : linkedProse(paragraph);
  const paragraphs = descriptionBlocks(displayedText).map((block, key) => block.kind === 'paragraph' ? <p key={key}>{linked(block.lines.join('\n'))}</p> : block.kind === 'ul' ? <ul key={key}>{block.lines.map((line, index) => <li key={index}>{linked(line)}</li>)}</ul> : <ol start={block.start} key={key}>{block.lines.map((line, index) => <li key={index}>{linked(line)}</li>)}</ol>);
  return (
    <div className="rules-text">
      {paragraphs}
      {source && (
        <p className="muted small source">
          {'Source: '}
          {source.split(/(https?:\/\/[^\s,]+)/).map((part, i) => /^https?:\/\//.test(part) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a> : part)}
        </p>
      )}
      {preview && engine && <ReferencePopup reference={preview} engine={engine} openFeature={openFeature} onClose={() => setPreview(undefined)} />}
    </div>
  );
}

export function ReferencePopup({ reference, engine, openFeature, onClose }: { reference: Preview; engine: Engine; openFeature?: (id: string) => void; onClose: () => void }) {
  const [current, setCurrent] = useState(reference);
  const feature = current.ids.length === 1 ? engine.catalogue.features.find((feature) => feature.id === current.ids[0]) : undefined;
  return (
    <Modal title={feature ? featureName(feature) : `Features named ${current.text}`} onClose={onClose}>
      {feature
        ? (
            <>
              <FeatureRules feature={feature} engine={engine} openFeature={openFeature} onPreview={setCurrent} />
              <FeatureLink className="button quiet" id={feature.id} engine={engine}>
                {'Open '}
                {featureName(feature)}
                {' '}
                Feature →
              </FeatureLink>
            </>
          )
        : (
            <>
              <p>Choose the Feature you want to read.</p>
              <ul className="reference-options">
                {current.ids.map((id) => {
                  const candidate = engine.catalogue.features.find((feature) => feature.id === id)!;
                  return <li key={id}><button className="link" onClick={() => setCurrent({ ids: [id], text: featureName(candidate) })}>{featureName(candidate)}</button></li>;
                })}
              </ul>
            </>
          )}
      {current !== reference && (
        <button className="quiet" onClick={() => setCurrent(reference)}>
          {'Back to '}
          {reference.text}
        </button>
      )}
    </Modal>
  );
}

export function FeatureRules({ feature, engine, openFeature, onPreview, instanceId, showRolls = true }: { feature: FeatureDefinition; engine: Engine; instanceId?: string; showRolls?: boolean; openFeature?: (id: string) => void; onPreview?: (reference: Preview) => void }) {
  return (
    <>
      <RulesText processDescription={feature.processDescription} descriptionOverride={feature.descriptionOverride} text={descriptionBody(feature)} source={feature.source} engine={engine} openFeature={openFeature} exclude={[feature.id]} onPreview={onPreview} />
      {showRolls && <FeatureRolls feature={feature} engine={engine} instanceId={instanceId} />}
      {feature.textReferences?.map((id) => {
        const reference = engine.catalogue.features.find((f) => f.id === id);
        return reference
          ? (
              <section className="shared-rules" key={id}>
                <h3>{featureName(reference)}</h3>
                <RulesText processDescription={reference.processDescription} descriptionOverride={reference.descriptionOverride} text={descriptionBody(reference)} source={reference.source} engine={engine} openFeature={openFeature} exclude={[feature.id, id]} onPreview={onPreview} />
                {showRolls && !feature.roll && <FeatureRolls feature={reference} engine={engine} />}
                <FeatureLink id={id} engine={engine}>
                  {'View '}
                  {featureName(reference)}
                  {' '}
                  Feature →
                </FeatureLink>
              </section>
            )
          : null;
      })}
    </>
  );
}
