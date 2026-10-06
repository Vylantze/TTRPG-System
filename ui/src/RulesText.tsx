import { featureName } from './display';
import type { Engine, FeatureDefinition } from '../../src/index';

/** Imported text is rendered as text, never interpreted as HTML or executable Markdown. */
export function RulesText({text,source}:{text?:string;source?:string}) {
  if (!text) return null;
  return <div className="rules-text">{text.split(/\n\s*\n/).filter(Boolean).map((paragraph,index)=><p key={index}>{paragraph}</p>)}{source&&<p className="muted small source">Source: {source}</p>}</div>;
}

export function FeatureRules({feature,engine,openFeature}:{feature:FeatureDefinition;engine:Engine;openFeature:(id:string)=>void}) {
  return <><RulesText text={feature.description} source={feature.source} />{feature.textReferences?.map(id=>{
    const reference=engine.catalogue.features.find(f=>f.id===id);
    return reference?<section className="shared-rules" key={id}><h3>{featureName(reference)}</h3><RulesText text={reference.description} source={reference.source} /><button className="link" onClick={()=>openFeature(id)}>View {featureName(reference)} Feature →</button></section>:null;
  })}</>;
}

export const descriptionPreview=(text?:string)=>text?text.replace(/\s+/g,' ').slice(0,160)+(text.length>160?'…':''):undefined;
