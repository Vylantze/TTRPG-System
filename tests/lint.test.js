import test from 'node:test';
import assert from 'node:assert/strict';
import { lintSource } from '../tools/lint-rules.mjs';

test('one definition with inline object types, imports and re-exports is allowed', () => {
  assert.deepEqual(lintSource('example.ts', "import type { Other } from './Other'; export type { Other }; export interface Example { value: { nested: Other } }"), []);
});
test('multiple definitions, including nested definitions and enums, are rejected', () => {
  for (const text of ['interface A {} type B = string;', 'class A {} class B {}', 'function f() { type A = string; type B = number; }', 'enum A {} interface B {}', 'const A = class {}; type B = number;']) {
    assert.match(lintSource('example.ts', text).join('\n'), /at most one/);
  }
});
test('syntax errors, debugger statements and var declarations are rejected', () => {
  for (const text of ['type A = ;', 'debugger;', 'var value = 1;']) assert.ok(lintSource('example.ts', text).length);
});
test('React syntax and ordinary functions do not count as definitions', () => {
  assert.deepEqual(lintSource('example.tsx', 'type Props = { name: string }; function App({ name }: Props) { return <p>{name}</p>; }'), []);
});
