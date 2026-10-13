import { FeatureLink } from '@/ui/src/features/catalogue/components/FeatureLink';
import { featureName, tagName } from '@/ui/src/features/catalogue/model/display';
import type { Engine, FeatureDefinition, Grant, Choice } from '@/src/index';
import { labelFromId } from '@/ui/src/lib/workspace';
import { FeatureRules } from '@/ui/src/features/catalogue/components/RulesText';

import { FeatureRequirements } from '@/ui/src/features/catalogue/components/FeatureRequirements';
import { FeatureSelectionContent } from '@/ui/src/features/catalogue/components/FeatureSelectionContent';

export function FeatureDetail({ feature, engine, openFeature }: { feature: FeatureDefinition; engine: Engine; openFeature: (id: string) => void }) {
  const tagLabels = [...new Set([
    ...(feature.tags ?? []).map((tag) => tagName(engine.catalogue.system, tag)),
    ...feature.components.flatMap((component) => component.kind === 'grantCapability' && component.action ? [labelFromId(component.action.kind)] : []),
  ])];
  const grants = feature.components.filter((component): component is Grant => component.kind === 'grantFeature');
  return (
    <article className="feature-detail">
      <header className="feature-reference-header">
        <p className="eyebrow">
          {engine.catalogue.system.name}
          {' '}
          · Feature
        </p>
        <h1>{featureName(feature)}</h1>
        <div className="tags">
          {feature.contentLevel !== undefined && (
            <span className="tag">
              {'Content level '}
              {feature.contentLevel}
            </span>
          )}
          {tagLabels.map((label) => <span className="tag" key={label}>{label}</span>)}
        </div>
      </header>
      <div className="feature-reading-layout">
        <section className="panel">
          <h2>Rules</h2>
          <FeatureRules feature={feature} engine={engine} openFeature={openFeature} />
          {!feature.description && !feature.textReferences?.length && <p className="muted">No source description is available for this Feature.</p>}
        </section>
        <section className="panel feature-content">
          <h2>Feature content</h2>
          <FeatureRequirements feature={feature} engine={engine} />
          {feature.resources?.length ? <p className="notice">Requires a compatible resource provider. This requirement cannot be waived.</p> : null}
          {grants.length > 0 && <h3>Granted Features</h3>}
          {grants.map((component) => {
            const granted = engine.getFeature(component.feature);
            return (
              <section className="feature-content-entry" key={component.id}>
                <h4><FeatureLink className="link" id={component.feature} engine={engine}>{featureName(granted)}</FeatureLink></h4>
                {component.atClassLevel !== undefined && <p className="muted">{`Granted at class level ${component.atClassLevel}`}</p>}
                {granted && !feature.textReferences?.includes(granted.id) && <FeatureRules feature={granted} engine={engine} openFeature={openFeature} />}
                {feature.textReferences?.includes(component.feature) && <p className="muted">Full rules are included above.</p>}
              </section>
            );
          })}
          {feature.components.filter((c): c is Choice => c.kind === 'chooseFeatures').map((component) => (
            <FeatureSelectionContent key={component.id} choice={component} engine={engine} openFeature={openFeature} />
          ))}
        </section>
      </div>
      <details className="panel technical-details">
        <summary>Builder & engine details</summary>
        <p className="muted small">
          {'Revision '}
          {feature.revision}
          {' '}
          {'· '}
          {feature.id}
        </p>
        {feature.prerequisites && (
          <details>
            <summary>Prerequisites</summary>
            <pre>{JSON.stringify(feature.prerequisites, null, 2)}</pre>
          </details>
        )}
        {feature.maintenance && (
          <details>
            <summary>Requirements after acquisition</summary>
            <pre>{JSON.stringify(feature.maintenance, null, 2)}</pre>
          </details>
        )}
        {feature.resources && (
          <details open>
            <summary>Required resources · cannot be waived</summary>
            <pre>{JSON.stringify(feature.resources, null, 2)}</pre>
          </details>
        )}
        <h3>Building blocks</h3>
        {feature.components.map((c) => (
          <section className="component" key={c.id}>
            <div className="row">
              <strong>{labelFromId(c.id)}</strong>
              <span className="tag">{labelFromId(c.kind)}</span>
            </div>
            {c.kind === 'grantFeature'
              ? (
                  <FeatureLink className="link" id={c.feature} engine={engine}>
                    {featureName(engine.catalogue.features.find((f) => f.id === c.feature))}
                    {' '}
                    →
                  </FeatureLink>
                )
              : c.kind === 'grantCapability' ? <p>{c.name}</p> : null}
            <details>
              <summary>Engine definition</summary>
              <pre>{JSON.stringify(c, null, 2)}</pre>
            </details>
          </section>
        ))}
        {feature.parameters && (
          <details>
            <summary>Parameters</summary>
            <pre>{JSON.stringify(feature.parameters, null, 2)}</pre>
          </details>
        )}
        {feature.tables && (
          <details>
            <summary>Scaling tables</summary>
            <pre>{JSON.stringify(feature.tables, null, 2)}</pre>
          </details>
        )}
        <details>
          <summary>Complete JSON definition</summary>
          <pre>{JSON.stringify(feature, null, 2)}</pre>
        </details>
      </details>
    </article>
  );
}
