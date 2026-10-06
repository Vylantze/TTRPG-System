import type { Engine, FeatureDefinition } from '../../src/index';
import { labelFromId } from './workspace';

export function FeatureDetail({feature,engine,openFeature}:{feature:FeatureDefinition;engine:Engine;openFeature:(id:string)=>void}) {
  return <article className="feature-detail">
    <p className="eyebrow">Feature · revision {feature.revision}</p><h2>{feature.name}</h2>
    {feature.description && <p>{feature.description}</p>}
    <div className="tags">{feature.tags?.map(t=><span className="tag" key={t}>{t}</span>)}</div>
    {feature.source && <p className="muted source">Source: {feature.source}</p>}
    {feature.prerequisites && <details><summary>Prerequisites</summary><pre>{JSON.stringify(feature.prerequisites,null,2)}</pre></details>}
    {feature.maintenance && <details><summary>Requirements after acquisition</summary><pre>{JSON.stringify(feature.maintenance,null,2)}</pre></details>}
    {feature.resources && <details open><summary>Required resources · cannot be waived</summary><pre>{JSON.stringify(feature.resources,null,2)}</pre></details>}
    <h3>Building blocks</h3>
    {feature.components.map(c=><section className="component" key={c.id}>
      <div className="row"><strong>{labelFromId(c.id)}</strong><span className="tag">{c.kind}</span></div>
      {c.kind==='describe' ? <p>{c.text}</p> : c.kind==='grantFeature' ? <button className="link" onClick={()=>openFeature(c.feature)}>{engine.catalogue.features.find(f=>f.id===c.feature)?.name??c.feature} →</button> : c.kind==='grantCapability' ? <><p>{c.name}</p>{c.description&&<p>{c.description}</p>}<p className="muted">Availability and costs are calculated. Resolve effects and triggers at the table.</p></> : null}
      {c.kind!=='describe' && <details><summary>Definition</summary><pre>{JSON.stringify(c,null,2)}</pre></details>}
    </section>)}
    {feature.parameters && <details><summary>Parameters</summary><pre>{JSON.stringify(feature.parameters,null,2)}</pre></details>}
    {feature.tables && <details><summary>Scaling tables</summary><pre>{JSON.stringify(feature.tables,null,2)}</pre></details>}
    <details><summary>Complete JSON definition</summary><pre>{JSON.stringify(feature,null,2)}</pre></details>
  </article>;
}
