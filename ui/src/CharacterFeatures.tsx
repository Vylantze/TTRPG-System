import { useMemo, useState } from 'react';
import type { Character, Engine, EvaluationResult } from '../../src/index';
import { FeatureRules } from './RulesText';
import { FeatureRequirements } from './FeatureRequirements';
import { featureName, tagName } from './display';

export function CharacterFeatures ({engine,character,result,openFeature}:{engine:Engine;character:Character;result:EvaluationResult;openFeature:(id:string)=>void}) {
  const [query,setQuery] = useState(''),[origin,setOrigin] = useState('all'),[showInactive,setShowInactive] = useState(false);
  const instances = useMemo(()=>result.instances.filter(instance=>{
    const feature = engine.getFeature(instance.feature);
    return (showInactive || instance.active) && (origin === 'all' || (origin === 'other' ? !instance.progression : instance.progression === origin))
      && `${featureName(feature)} ${feature?.tags?.map(tag=>tagName(engine.catalogue.system,tag)).join(' ') ?? ''}`.toLowerCase().includes(query.toLowerCase());
  }),[engine,result,origin,query,showInactive]);
  return <section><p className="eyebrow">Your character's rules reference</p><h2>Features & traits</h2><div className="feature-library-toolbar"><label>Search acquired Features<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Name or tag…" /></label><label>Acquired from<select value={origin} onChange={event=>setOrigin(event.target.value)}><option value="all">All sources</option>{character.progressions.map(progression=><option key={progression.id} value={progression.id}>{engine.catalogue.classes.find(cls=>cls.id === progression.class)?.name ?? 'Class'} · level {progression.level}</option>)}<option value="other">Origins & additional Features</option></select></label><label className="checkbox-label"><input type="checkbox" checked={showInactive} onChange={event=>setShowInactive(event.target.checked)} />Show inactive Features</label></div><p className="muted small" role="status">{instances.length} acquired Feature instances</p><div className="acquired-library">{instances.map(instance=>{
    const feature = engine.getFeature(instance.feature);
    if(!feature)return null;
    const progression = character.progressions.find(item=>item.id === instance.progression);
    const cls = engine.catalogue.classes.find(item=>item.id === progression?.class);
    const parent = result.instances.find(item=>item.id === instance.parent);
    return <details className="acquired-feature panel" key={instance.id}><summary><span>{featureName(feature)}<small>{cls ? `${cls.name} · class level ${instance.acquiredClassLevel}` : `Character level ${instance.acquiredCharacterLevel}`}{parent ? ` · via ${featureName(engine.getFeature(parent.feature))}` : ''}</small></span><span className={`badge ${!instance.active ? 'incomplete' : instance.eligible ? 'valid' : 'invalid'}`}>{!instance.active ? 'Inactive' : instance.eligible ? 'Active' : 'Unmet requirements'}</span></summary><FeatureRequirements feature={feature} engine={engine} /><FeatureRules feature={feature} engine={engine} openFeature={openFeature} /><button className="link" onClick={()=>openFeature(feature.id)}>View Feature →</button></details>;
  })}</div>{!instances.length && <p className="panel">No acquired Features match these filters.</p>}</section>;
}
