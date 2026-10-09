import { featureName, tagName } from './display';
import type { Engine, FeatureDefinition, Grant, Choice } from '../../src/index';
import { labelFromId } from './workspace';
import { FeatureRules } from './RulesText';

import { FeatureRequirements } from './FeatureRequirements';

export function FeatureDetail({ feature, engine, openFeature }: { feature: FeatureDefinition; engine: Engine; openFeature: (id: string) => void }) {
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
          {feature.tags?.map((t) => <span className="tag" key={t}>{tagName(engine.catalogue.system, t)}</span>)}
          {feature.components.flatMap((component) => component.kind === 'grantCapability' && component.action ? [<span className="tag" key={`action:${component.id}`}>{labelFromId(component.action.kind)}</span>] : [])}
        </div>
      </header>
      <div className="feature-reading-layout">
        <section className="panel">
          <h2>Rules</h2>
          <FeatureRules feature={feature} engine={engine} openFeature={openFeature} />
          {!feature.description && !feature.textReferences?.length && <p className="muted">No source description is available for this Feature.</p>}
        </section>
        <aside className="panel feature-facts">
          <h2>At a glance</h2>
          <FeatureRequirements feature={feature} engine={engine} />
          {feature.source && <p className="muted small">{feature.source}</p>}
          {feature.resources?.length ? <p className="notice">Requires a compatible resource provider. This requirement cannot be waived.</p> : null}
          {feature.components.filter((c): c is Grant => c.kind === 'grantFeature').map((component) => (
            <p key={component.id}>
              {'Grants '}
              <button className="link" onClick={() => openFeature(component.feature)}>{featureName(engine.getFeature(component.feature))}</button>
            </p>
          ))}
          {feature.components.filter((c): c is Choice => c.kind === 'chooseFeatures').map((component) => (
            <div key={component.id}>
              <h3>{labelFromId(component.id)}</h3>
              <p className="muted small">
                {engine.getSelectionFeatures(component).length}
                {' '}
                options in this selection pool. Character requirements still apply.
              </p>
            </div>
          ))}
        </aside>
      </div>
      {!feature.description && feature.source && (
        <p className="muted source">
          {'Source: '}
          {feature.source}
        </p>
      )}
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
                  <button className="link" onClick={() => openFeature(c.feature)}>
                    {featureName(engine.catalogue.features.find((f) => f.id === c.feature))}
                    {' '}
                    →
                  </button>
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
