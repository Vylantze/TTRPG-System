import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { exampleCharacter } from '../../examples/dnd2014-character.js';

const server=await createServer({server:{middlewareMode:true},appType:'custom'});
const model=await server.ssrLoadModule('/src/workspace.ts');
const {App}=await server.ssrLoadModule('/src/App.tsx');
const file=JSON.parse(readFileSync(new URL('../../src/systems/dnd5e-2014/system.json',import.meta.url),'utf8'));
function storage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};}
const data=()=>({version:1,systems:[file],characters:[]});
function render(workspace,hash='') {
  globalThis.localStorage=storage();model.writeWorkspace(localStorage,workspace);
  globalThis.window={location:{hash}};
  return renderToStaticMarkup(createElement(App));
}

test('workspace roundtrip preserves loaded rules, character choices and exact catalogue pins',()=>{
  const store=storage(),{character}=exampleCharacter();character.buildState='draft';
  model.writeWorkspace(store,{...data(),characters:[character],active:character.id});
  const restored=model.readWorkspace(store);
  assert.deepEqual(restored.characters[0],character);
  assert.equal(model.createRegistry(restored.systems).engineForCharacter(character).evaluate(character).status,'valid');
});
test('workspace rejects malformed saves and reports storage quota failures',()=>{
  const store=storage();store.setItem(model.STORAGE_KEY,'{"version":9}');assert.throws(()=>model.readWorkspace(store));
  assert.throws(()=>model.writeWorkspace({setItem(){throw new Error('QuotaExceeded');}},data()),/QuotaExceeded/);
  const duplicate={...data(),characters:[exampleCharacter().character,exampleCharacter().character]};store.setItem(model.STORAGE_KEY,JSON.stringify(duplicate));assert.throws(()=>model.readWorkspace(store),/duplicated/);
});
test('React initial screen explains System loading and provides character import',()=>{
  const html=render({version:1,systems:[],characters:[]});
  assert.match(html,/Every adventure starts with a Feature/);assert.match(html,/Load DnD5e 2014/);assert.match(html,/Import character/);
});
test('React Class and Feature browsers render directly from the loaded JSON',()=>{
  const classes=render(data(),'#classes');assert.match(classes,/Explore Class/);assert.match(classes,/Fighter/);assert.match(classes,/Wizard/);
  const features=render(data(),'#features');assert.match(features,/Explore Features/);assert.match(features,/Features found/);
  const detail=render(data(),'#features/dnd5e%3A2014%3Awizard.spellcasting');assert.match(detail,/Building blocks/);assert.match(detail,/chooseFeatures/);
});
test('React character builder exposes nested selections and preserves a construction draft',()=>{
  const {character}=exampleCharacter();character.buildState='draft';
  const html=render({...data(),characters:[character]},`#characters/${character.id}`);
  assert.match(html,/Feature selections/);assert.match(html,/Basic stats/);assert.match(html,/Finalize character/);assert.match(html,/Ready to finalize/);
  assert.match(html,/languages/);assert.match(html,/Second Wind|Fighting style|fighting style/i);
});
test('unloaded Systems keep characters exportable and display an explicit reload requirement',()=>{
  const {character}=exampleCharacter();
  const html=render({version:1,systems:[],characters:[character]},`#characters/${character.id}`);
  assert.match(html,/Export character/);assert.match(html,/Example Hero/);assert.match(html,/must be loaded/);
});
test('bad persisted data is displayed as a recoverable error rather than silently discarded',()=>{
  globalThis.localStorage=storage();localStorage.setItem(model.STORAGE_KEY,'invalid JSON');globalThis.window={location:{hash:''}};
  const html=renderToStaticMarkup(createElement(App));assert.match(html,/role="alert"/);assert.match(html,/Export stored data/);
});

await server.close();
