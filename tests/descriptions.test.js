import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Engine, parseSystemFile, validateCatalogue } from '../dist/index.js';
import { catalogue as fixture } from '../examples/catalogue.js';

const file=JSON.parse(readFileSync(new URL('../src/systems/dnd5e-2014/system.json',import.meta.url),'utf8'));
const feature=name=>file.features.find(f=>f.id===`dnd5e:2014:${name}`);

test('2014 JSON ships descriptions for every included Class and Feature',()=>{
  parseSystemFile(file);
  for(const f of file.features){assert.ok(f.description?.trim(),f.id);assert.ok(f.displayName?.trim(),f.id);}
  for(const config of file.configurations)for(const cls of config.classes){
    assert.match(cls.description,/Hit Points at 1st Level/);assert.match(cls.description,/Equipment/);assert.match(cls.source,/SRD 5.1/);
    assert.doesNotMatch(cls.description,/20th \+6/,'PDF progression tables must not spill into introductory prose');
  }
  assert.match(feature('fighter.second-wind').description,/1d10 \+ your fighter level/);
  assert.match(feature('rogue.thief').description,/Second-Story Work/);
  for(const name of ['Fighter','Rogue','Wizard'])assert.match(feature('ability-score-improvement').description,new RegExp(`${name}: Ability Score Improvement`));
  assert.doesNotMatch(feature('wizard.overchannel').description,/Your Spellbook/);
  assert.match(feature('wizard.spellcasting').description,/Copying a Spell into the Book/);
  assert.match(file.configurations[0].classes.find(c=>c.name==='Wizard').description,/Weapons: Daggers, darts, slings/);
  for(const config of file.configurations)for(const f of file.features)for(const tag of f.tags??[])assert.ok(config.system.tagDisplayNames[tag]?.trim(),tag);
  assert.equal(feature('skill.animal-handling').displayName,'Animal Handling Proficiency');
});

test('spell descriptions retain complete effects and share canonical text across wrappers',()=>{
  const spells=file.features.filter(f=>f.id.startsWith('dnd5e:2014:spell.'));
  assert.equal(spells.length,204);
  for(const spell of spells){assert.match(spell.description,/Casting Time:/);assert.match(spell.description,/Duration:/);assert.match(spell.source,/#page=\d+/);}
  assert.match(feature('spell.fireball').description,/8d6 fire damage/);
  assert.match(feature('spell.fireball').description,/At Higher Levels/);
  assert.match(feature('spell.wish').description,/life drain attack/);
  assert.match(feature('spell.wish').description,/You undo a single recent event/);
  assert.match(feature('spell.wish').description,/33 percent chance/);
  for(const name of ['spellbook.fireball','prepared.fireball','signature.fireball'])assert.deepEqual(feature(name).textReferences,['dnd5e:2014:spell.fireball']);
});

test('display references do not acquire Features or alter evaluation, including cycles',()=>{
  const original=structuredClone(fixture),decorated=structuredClone(fixture);
  decorated.classes[0].description='Class narrative';decorated.classes[0].source='Custom source';
  const first=decorated.features[0],second=decorated.features[1];
  first.description='Feature narrative';first.displayName='Readable narrative';decorated.system.tagDisplayNames={'custom-tag':'Readable Tag'};first.textReferences=[second.id];second.textReferences=[first.id];
  const a=new Engine(original),b=new Engine(decorated),character=a.createCharacter('test','Test',[{id:'main',class:original.classes[0].id,level:1}]);
  assert.deepEqual(b.evaluate(character),a.evaluate(character));
});

test('catalogue validation rejects malformed display text and unresolved references',()=>{
  for(const [mutate,code] of [
    [c=>{c.features[0].description={html:'invalid'};},'SCHEMA'],
    [c=>{c.classes[0].description=12;},'SCHEMA'],
    [c=>{c.classes[0].source=[];},'SCHEMA'],
    [c=>{c.features[0].displayName=12;},'SCHEMA'],
    [c=>{c.system.tagDisplayNames={tag:12};},'SCHEMA'],
    [c=>{c.features[0].textReferences=['missing'];},'UNKNOWN_FEATURE'],
    [c=>{c.features[0].textReferences=[c.features[1].id,c.features[1].id];},'DUPLICATE_ID'],
  ]){const c=structuredClone(fixture);mutate(c);assert.ok(validateCatalogue(c).some(d=>d.code===code),code);}
});
