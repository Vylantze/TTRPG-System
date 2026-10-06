import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, applyEdit, finalizeCharacter, useAbility, recoverResources, deserializeCharacter, serializeCharacter, classEntryPath } from '../dist/index.js';
import { catalogue } from '../examples/catalogue.js';
const path=classEntryPath('main',1,'technique');
function setup(){
  const data=structuredClone(catalogue);data.classes[0].levels[1][1].retraining={allowed:false};data.features.find(f=>f.id==='example:energy-reserve').tags=['technique'];
  const engine=new Engine(data);
  const character=engine.createCharacter('hero','Hero',[{id:'main',class:'example:adventurer',level:1}],[],{draft:true});
  return {engine,character};
}
const choose=(engine,character,feature,id)=>applyEdit(engine,character,[{kind:'select',selection:path,picks:[{id:'pick',feature}]}],id);
test('construction drafts permit changing initial choices while normal retraining stays locked after finalization',()=>{
  const {engine,character}=setup();
  const first=choose(engine,character,'example:guard','first');
  const revised=choose(engine,first,'example:lore','revise');
  assert.equal(revised.buildState,'draft');assert.equal(engine.evaluate(revised).status,'valid');
  const finalized=finalizeCharacter(engine,revised,'finish');
  assert.equal(finalized.buildState,'finalized');
  assert.deepEqual(finalizeCharacter(engine,finalized,'finish'),finalized);
  assert.throws(()=>choose(engine,finalized,'example:guard','locked'),e=>e.code==='RETRAINING');
  assert.equal(character.selections[path],undefined);
});
test('incomplete drafts cannot finalize, spend, or recover; draft state survives a save',()=>{
  const {engine,character}=setup();
  assert.throws(()=>finalizeCharacter(engine,character,'finish'),e=>e.code==='INVALID_BUILD');
  assert.throws(()=>useAbility(engine,character,'any','spend'),e=>e.code==='DRAFT');
  assert.throws(()=>recoverResources(engine,character,'rest','recover'),e=>e.code==='DRAFT');
  assert.equal(deserializeCharacter(serializeCharacter(character),engine).buildState,'draft');
  const wrong=structuredClone(character);wrong.buildState='other';assert.throws(()=>deserializeCharacter(JSON.stringify(wrong)));
});
test('draft replacement creates initially full resources, and paged candidates retain engine eligibility',()=>{
  const {engine,character}=setup();
  let draft=choose(engine,character,'example:guard','guard');
  draft=applyEdit(engine,draft,[{kind:'select',selection:path,picks:[{id:'replacement',feature:'example:energy-reserve'}]}],'reserve');
  assert.equal(Object.values(engine.evaluate(draft).resources)[0].spent,0);
  const full=engine.getCandidates(character,path);
  assert.deepEqual(engine.getCandidates(character,path,{}, {features:['example:lore']}),full.filter(c=>c.feature==='example:lore'));
  assert.deepEqual(engine.getCandidates(character,path,{}, {features:['example:agile']}),[]);
});
test('older characters retain the previous retraining behavior without adopting draft mode',()=>{
  const {engine}=setup();let character=engine.createCharacter('old','Old',[{id:'main',class:'example:adventurer',level:1}]);
  character=choose(engine,character,'example:guard','choose');
  assert.equal(character.buildState,undefined);
  assert.throws(()=>choose(engine,character,'example:lore','replace'),e=>e.code==='RETRAINING');
});
test('construction class removal prunes only owned history and choices and is unavailable after finalization',()=>{
  const {engine,character}=setup();
  let draft=choose(engine,character,'example:guard','guard');
  draft=applyEdit(engine,draft,[{kind:'addProgression',progression:{id:'second',class:'example:adventurer',level:1}}],'second');
  const second=classEntryPath('second',1,'technique');
  draft=applyEdit(engine,draft,[{kind:'select',selection:second,picks:[{id:'lore',feature:'example:lore'}]}],'lore');
  const removed=applyEdit(engine,draft,[{kind:'removeProgression',progression:'main'}],'remove');
  assert.equal(removed.progressions.length,1);assert.equal(removed.history.length,1);
  assert.equal(removed.selections[path],undefined);assert.equal(removed.selections[second][0].feature,'example:lore');
  const finalized=finalizeCharacter(engine,removed,'finalize');
  assert.throws(()=>applyEdit(engine,finalized,[{kind:'removeProgression',progression:'second'}],'remove-final'),e=>e.code==='DRAFT');
  assert.equal(draft.progressions.length,2);
});
