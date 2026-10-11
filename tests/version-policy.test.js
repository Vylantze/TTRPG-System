import test from 'node:test';
import assert from 'node:assert/strict';
import { assetData, parseSystemFile, releaseVersion, isReleaseVersion, compareVersions, bumpVersion, versionChange, classifyReleaseChange } from '@/dist/index.js';

test('semantic releases compare numerically, reset lower components, and migrate old counters', () => {
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
  assert.equal(bumpVersion('1.2.9', 'patch'), '1.2.10');
  assert.equal(bumpVersion('1.2.9', 'minor'), '1.3.0');
  assert.equal(bumpVersion('1.2.9', 'major'), '2.0.0');
  assert.equal(releaseVersion(5), '1.0.4');
  assert.equal(releaseVersion(undefined), '1.0.0');
  for (const value of ['01.2.3', '1.2', '1.2.3-beta', '-1.0.0', '1.0.9007199254740992', null, 0, 1.5]) {
    assert.equal(isReleaseVersion(value), false);
    assert.throws(() => releaseVersion(value), /version/);
  }
  assert.equal(versionChange('1.2.0', '1.2.1'), 'patch');
  assert.equal(versionChange('1.2.0', '1.3.0'), 'minor');
  assert.equal(versionChange('1.2.0', '2.0.0'), 'major');
  assert.equal(versionChange('1.2.0', '1.1.0'), 'none');
});

test('release classification separates presentation fixes, mechanics, and removed definitions', () => {
  const before = { contentVersion: '1.0.0', features: [{ id: 'wind', revision: 1, description: 'Old', components: [{ id: 'uses', kind: 'trackResource', maximum: 1 }] }] };
  const change = (edit) => {
    const next = structuredClone(before);
    edit(next);
    return classifyReleaseChange(before, next);
  };
  assert.equal(change((next) => {
    next.contentVersion = '1.0.1';
  }), 'none');
  assert.equal(change((next) => {
    next.features[0].description = 'Corrected';
  }), 'patch');
  assert.equal(change((next) => {
    next.features[0].components[0].maximum = 2;
  }), 'minor');
  assert.equal(change((next) => {
    next.features.push({ id: 'new', revision: 1, components: [] });
  }), 'minor');
  assert.equal(change((next) => {
    next.features = [];
  }), 'major');
  assert.equal(change((next) => {
    delete next.features[0].components[0].maximum;
  }), 'major');
  assert.equal(change((next) => {
    next.features[0].revision = 2;
  }), 'major');
  assert.equal(classifyReleaseChange({ sheetTabs: [] }, { sheetTabs: [{ id: 'notes', content: 'notes' }] }), 'minor');
  assert.equal(classifyReleaseChange({ options: { choice: { values: ['a', 'b'] } } }, { options: { choice: { values: ['a'] } } }), 'major');
  assert.equal(classifyReleaseChange({ values: ['a', 'b'] }, { values: ['a', 'c'] }), 'major');
  assert.equal(classifyReleaseChange({ kind: 'grantCapability', name: 'Recovery' }, { kind: 'grantCapability', name: 'Different recovery' }), 'minor');
});

test('legacy System releases normalize without changing revision pins and auxiliary envelopes validate', () => {
  const input = { format: 'ttrpg-system', version: 1, id: 'sample', revision: 1, contentVersion: 5, assetVersions: { 'a.json': 2 }, options: {}, features: [], configurations: [{ id: 'sample', revision: 1, options: {}, system: { id: 'sample', revision: 1, name: 'Sample', allowMultipleClasses: false, characterLevel: 0, stats: [] }, classes: [] }] };
  const file = parseSystemFile(input);
  assert.equal(file.contentVersion, '1.0.4');
  assert.equal(file.assetVersions['a.json'], '1.0.1');
  assert.equal(file.revision, 1);
  assert.equal(input.contentVersion, 5);
  assert.deepEqual(assetData({ assetVersion: '1.0.0', data: ['save'] }), ['save']);
  assert.throws(() => assetData({ assetVersion: 'bad', data: [] }), /version/);
  assert.throws(() => assetData({ assetVersion: '1.0.0' }), /missing data/);
});
