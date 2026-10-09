import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, classEntryPath } from '../dist/index.js';
import { catalogue } from '../examples/catalogue.js';

test('catalogue lookups return frozen definitions and independent sorted progression arrays', () => {
  const engine = new Engine(catalogue);
  assert.equal(engine.getFeature('missing'), undefined);
  assert.equal(engine.getFeature('example:guard').name, 'Guard');
  assert.ok(Object.isFrozen(engine.getFeature('example:guard')));
  assert.deepEqual(engine.getClassLevels('missing'), []);
  const rows = engine.getClassLevels('example:adventurer');
  assert.deepEqual(rows.map(row => row.level), [1, 2, 3]);
  rows[0].entries.pop();
  assert.equal(engine.getClassLevels('example:adventurer')[0].entries.length, 3);
});

test('selection pools intersect ids and tags while eligibility still checks level limits', () => {
  const engine = new Engine(catalogue);
  const choice = engine.getClassLevels('example:adventurer')[0].entries[1];
  assert.ok(engine.getSelectionFeatures(choice).some(feature => feature.id === 'example:advanced'));
  assert.deepEqual(engine.getSelectionFeatures({...choice, candidates:{ids:['example:guard','example:agile'],tags:['technique']}}).map(feature => feature.id), ['example:guard']);
  const character = engine.createCharacter('hero', 'Hero', [{id:'main',class:'example:adventurer',level:1}], [], {draft:true});
  const advanced = engine.getCandidates(character,classEntryPath('main',1,'technique')).find(item => item.feature === 'example:advanced');
  assert.equal(advanced.status, 'invalid');
});

test('advancement lookup includes tag-based selections and handles missing Features', () => {
  const engine = new Engine(catalogue);
  assert.deepEqual(engine.getFeatureAdvancement('example:guard'), [{classId:'example:adventurer',className:'Adventurer',levels:[1]}]);
  assert.deepEqual(engine.getFeatureAdvancement('example:expert')[0].levels, [3]);
  assert.deepEqual(engine.getFeatureAdvancement('missing'), []);
});
