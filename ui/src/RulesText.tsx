import { useMemo, useState, type ReactNode } from 'react';
import { FeatureTextIndex, type Engine, type FeatureDefinition } from '../../src/index';
import { featureName } from './display';
import { Modal } from './Modal';

type Preview = { ids:string[]; text:string };
type References = { engine?:Engine; openFeature?:(id:string)=>void; exclude?:string[]; onPreview?:(reference:Preview)=>void };
const indexes=new WeakMap<Engine,FeatureTextIndex>();
function textIndex(engine:Engine) {let index=indexes.get(engine);if(!index){index=new FeatureTextIndex(engine.catalogue.features);indexes.set(engine,index);}return index;}
export function featureHref(id:string,engine:Engine) {
  return `#features/${encodeURIComponent(id)}?${new URLSearchParams({system:engine.catalogue.system.id,revision:String(engine.catalogue.system.revision),catalogue:engine.catalogue.id})}`;
}

/** Link matching preserves source characters; imported HTML/Markdown stays inert. */
export function RulesText({text,source,engine,openFeature,exclude=[],onPreview}:{text?:string;source?:string}&References) {
  const [preview,setPreview]=useState<Preview>();
  const index=useMemo(()=>engine?textIndex(engine):undefined,[engine]);
  if (!text) return null;
  const paragraphs=text.split(/\n\s*\n/).filter(Boolean).map((paragraph,key)=>{
    const children:ReactNode[]=[];let offset=0;
    for(const span of index?.resolve(paragraph,exclude)??[]){
      children.push(paragraph.slice(offset,span.start));
      const href=span.features.length===1?featureHref(span.features[0],engine!):featureHref('',engine!).replace('#features/','#features');
      children.push(<a className="feature-mention" key={span.start} href={href} aria-haspopup="dialog" title={`Read ${span.text}`} onClick={event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();(onPreview??setPreview)({ids:span.features,text:span.text});}}>{span.text}</a>);
      offset=span.end;
    }
    children.push(paragraph.slice(offset));return <p key={key}>{children}</p>;
  });
  return <div className="rules-text">{paragraphs}{source&&<p className="muted small source">Source: {source}</p>}{preview&&engine&&<ReferencePopup reference={preview} engine={engine} openFeature={openFeature} onClose={()=>setPreview(undefined)} />}</div>;
}

export function ReferencePopup({reference,engine,openFeature,onClose}:{reference:Preview;engine:Engine;openFeature?:(id:string)=>void;onClose:()=>void}) {
  const [current,setCurrent]=useState(reference);
  const feature=current.ids.length===1?engine.catalogue.features.find(feature=>feature.id===current.ids[0]):undefined;
  return <Modal title={feature?featureName(feature):`Features named ${current.text}`} onClose={onClose}>
    {feature?<><FeatureRules feature={feature} engine={engine} openFeature={openFeature} onPreview={setCurrent} /><a className="button quiet" href={featureHref(feature.id,engine)} onClick={()=>{onClose();openFeature?.(feature.id);}}>Open {featureName(feature)} Feature →</a></>:<><p>Choose the Feature you want to read.</p><ul className="reference-options">{current.ids.map(id=>{const candidate=engine.catalogue.features.find(feature=>feature.id===id)!;return <li key={id}><button className="link" onClick={()=>setCurrent({ids:[id],text:featureName(candidate)})}>{featureName(candidate)}</button></li>;})}</ul></>}
    {current!==reference&&<button className="quiet" onClick={()=>setCurrent(reference)}>Back to {reference.text}</button>}
  </Modal>;
}

export function FeatureRules({feature,engine,openFeature,onPreview}:{feature:FeatureDefinition;engine:Engine;openFeature?:(id:string)=>void;onPreview?:(reference:Preview)=>void}) {
  return <><RulesText text={feature.description} source={feature.source} engine={engine} openFeature={openFeature} exclude={[feature.id]} onPreview={onPreview} />{feature.textReferences?.map(id=>{
    const reference=engine.catalogue.features.find(f=>f.id===id);
    return reference?<section className="shared-rules" key={id}><h3>{featureName(reference)}</h3><RulesText text={reference.description} source={reference.source} engine={engine} openFeature={openFeature} exclude={[feature.id,id]} onPreview={onPreview} /><a className="link" href={featureHref(id,engine)} onClick={()=>openFeature?.(id)}>View {featureName(reference)} Feature →</a></section>:null;
  })}</>;
}

export const featureDescription=(feature:FeatureDefinition,engine:Engine)=>feature.description??feature.textReferences?.map(id=>engine.catalogue.features.find(f=>f.id===id)?.description??'').filter(Boolean).join('\n\n');
export const descriptionPreview=(text?:string)=>text?text.replace(/\s+/g,' ').slice(0,160)+(text.length>160?'…':''):undefined;
