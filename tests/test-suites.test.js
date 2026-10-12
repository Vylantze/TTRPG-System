import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { availableEngineSuites, engineTestSuites, selectEngineTests } from '@/tools/test-suites.mjs';

const discovered = readdirSync(new URL('./', import.meta.url)).filter((name) => name.endsWith('.test.js')).sort();

test('named engine suites cover every current test file exactly once', () => {
  const suites = availableEngineSuites(discovered);
  const grouped = Object.values(suites).flatMap((suite) => suite.files);
  assert.equal(new Set(grouped).size, grouped.length);
  assert.deepEqual(grouped.sort(), discovered);
  assert.deepEqual(suites.other.files, [], 'Assign current files to named suites');
  assert.deepEqual(selectEngineTests([], discovered), discovered);
});

test('suite selection supports combinations, deduplicates files, and rejects typos', () => {
  assert.deepEqual(selectEngineTests(['artificer'], discovered), ['artificer.test.js']);
  assert.deepEqual(selectEngineTests(['core', 'systems', 'core'], discovered), [...engineTestSuites.core.files, ...engineTestSuites.systems.files].sort());
  assert.throws(() => selectEngineTests(['cor'], discovered), /Unknown test suite/);
  assert.throws(() => selectEngineTests(['all', 'cor'], discovered), /Unknown test suite/);
  assert.throws(() => selectEngineTests(['toString'], discovered), /Unknown test suite/);
  assert.throws(() => availableEngineSuites(discovered.filter((file) => file !== 'engine.test.js')), /missing file/);
});

test('new test files remain in the complete run and the other suite', () => {
  const extended = [...discovered, 'future.test.js'];
  assert.deepEqual(availableEngineSuites(extended).other.files, ['future.test.js']);
  assert.ok(selectEngineTests([], extended).includes('future.test.js'));
  assert.deepEqual(selectEngineTests(['other'], extended), ['future.test.js']);
});
