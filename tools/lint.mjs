import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { lintSource } from './lint-rules.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const excluded = new Set(['node_modules', 'dist', 'coverage']);
function sources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || excluded.has(entry.name)) return [];
    const filename = join(directory, entry.name);
    if (entry.isDirectory()) return sources(filename);
    return /\.(?:[cm]?[jt]s|[jt]sx)$/.test(entry.name) ? [filename] : [];
  });
}
const files = sources(root);
const problems = files.flatMap(file => lintSource(relative(root, file), readFileSync(file, 'utf8')));
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
// Type checking is part of linting for both the engine and React UI.
for (const config of ['tsconfig.json', 'ui/tsconfig.json']) {
  const result = spawnSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '-p', config], { cwd: root, stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`Lint passed (${files.length} source files; engine and UI type checks).`);
