import { featureName, tagName } from './display';
import type { Engine, FeatureDefinition } from '../../src/index';
import { labelFromId } from './workspace';
import { FeatureRules } from './RulesText';
import { FeatureRequirements } from './FeatureRequirements';

export function FeatureDetail({feature,engine,openFeature}:{feature:FeatureDefinition;engine:Engine;openFeature:(id:string)=>void}) {
  return <article className="feature-detail">
    <p className="eyebrow">Feature · revision {feature.revision}</p><h2>{featureName(feature)}</h2>
    <FeatureRequirements feature={feature} engine={engine} />
    <FeatureRules feature={feature} engine={engine} openFeature={openFeature} />
    <div className="tags">{feature.tags?.map(t=><span className="tag" key={t}>{tagName(engine.catalogue.system,t)}</span>)}</div>
    {!feature.description && feature.source && <p className="muted source">Source: {feature.source}</p>}
    {feature.prerequisites && <details><summary>Prerequisites</summary><pre>{JSON.stringify(feature.prerequisites,null,2)}</pre></details>}
    {feature.maintenance && <details><summary>Requirements after acquisition</summary><pre>{JSON.stringify(feature.maintenance,null,2)}</pre></details>}
    {feature.resources && <details open><summary>Required resources · cannot be waived</summary><pre>{JSON.stringify(feature.resources,null,2)}</pre></details>}
    <h3>Building blocks</h3>
    {feature.components.map(c=><section className="component" key={c.id}>
      <div className="row"><strong>{labelFromId(c.id)}</strong><span className="tag">{labelFromId(c.kind)}</span></div>
      {c.kind==='grantFeature' ? <button className="link" onClick={()=>openFeature(c.feature)}>{featureName(engine.catalogue.features.find(f=>f.id===c.feature))} →</button> : c.kind==='grantCapability' ? <p>{c.name}</p> : null}
      <details><summary>Engine definition</summary><pre>{JSON.stringify(c,null,2)}</pre></details>
    </section>)}
    {feature.parameters && <details><summary>Parameters</summary><pre>{JSON.stringify(feature.parameters,null,2)}</pre></details>}
    {feature.tables && <details><summary>Scaling tables</summary><pre>{JSON.stringify(feature.tables,null,2)}</pre></details>}
    <details><summary>Complete JSON definition</summary><pre>{JSON.stringify(feature,null,2)}</pre></details>
  </article>;
}
