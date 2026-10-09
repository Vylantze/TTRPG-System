import test from 'node:test';
import assert from 'node:assert/strict';
import { lintSource } from '../tools/lint-rules.mjs';
import { ESLint } from 'eslint';

test('shared standard checks JavaScript formatting and Node globals', async () => {
  const eslint = new ESLint();
  const [format] = await eslint.lintText('export const label = "Label"\n', { filePath: 'tools/lint-probe.mjs' });
  assert.ok(format.messages.some((message) => message.ruleId === '@stylistic/quotes'));
  assert.ok(format.messages.some((message) => message.ruleId === '@stylistic/semi'));
  const [node] = await eslint.lintText('console.log(process.version);\n', { filePath: 'tools/lint-probe.mjs' });
  assert.deepEqual(node.messages, []);
  const [browserLeak] = await eslint.lintText('document.title = \'Wrong environment\';\n', { filePath: 'tools/lint-probe.mjs' });
  assert.ok(browserLeak.messages.some((message) => message.ruleId === 'no-undef'));
});

test('React hook rules apply to the UI, not engine commands named useAbility', async () => {
  const eslint = new ESLint({ fix: true });
  const [engine] = await eslint.lintText('import { useAbility } from \'./commands.js\';\nexport function activate() {\n  return useAbility();\n}\n', { filePath: 'src/lint-probe.ts' });
  assert.deepEqual(engine.messages, []);
  const [ui] = await eslint.lintText('import { useState } from \'react\';\nexport function Broken () { if (Math.random()) { useState(0); } return null; }\n', { filePath: 'ui/src/LintProbe.tsx' });
  assert.ok(ui.messages.some((message) => message.ruleId === 'react-hooks/rules-of-hooks'));
});

test('ESLint ignores generated output and permits deliberate rest-property omission', async () => {
  const eslint = new ESLint({ fix: true });
  for (const file of ['dist/index.js', 'ui/dist/assets/index.js', '.reference-cache/probe.ts']) assert.equal(await eslint.isPathIgnored(file), true);
  const [result] = await eslint.lintText('export function strip (value: { description?: string; id: string }) { const { description, ...rules } = value;\nreturn rules; }\n', { filePath: 'ui/src/lint-probe.ts' });
  assert.deepEqual(result.messages, []);
});

test('one definition with inline object types, imports and re-exports is allowed', () => {
  assert.deepEqual(lintSource('example.ts', 'import type { Other } from \'./Other\'; export type { Other }; export interface Example { value: { nested: Other } }'), []);
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
