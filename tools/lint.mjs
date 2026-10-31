import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { lintSource } from '@/tools/lint-rules.mjs';
import { lintCssColours } from '@/tools/lint-css-colours.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const schemaCheck = spawnSync(process.execPath, ['tools/generate-editor-schema.mjs', '--check'], { cwd: root, stdio: 'inherit' });
if (schemaCheck.status !== 0) process.exit(schemaCheck.status ?? 1);
const excluded = new Set(['node_modules', 'dist', 'coverage', 'local-archive']);
function sources(directory, pattern = /\.(?:[cm]?[jt]s|[jt]sx)$/) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.') || excluded.has(entry.name)) return [];
    const filename = join(directory, entry.name);
    if (entry.isDirectory()) return sources(filename, pattern);
    return pattern.test(entry.name) ? [filename] : [];
  });
}
const files = sources(root);
const stylesheets = sources(join(root, 'ui/src'), /\.css$/);
const problems = [
  ...files.flatMap((file) => lintSource(relative(root, file), readFileSync(file, 'utf8'))),
  ...stylesheets.flatMap((file) => lintCssColours(relative(root, file), readFileSync(file, 'utf8'))),
];
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
// Type checking is part of linting for both the engine and React UI.
for (const config of ['tsconfig.json', 'tests/tsconfig.json', 'tools/tsconfig.json', 'ui/tsconfig.json']) {
  const result = spawnSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '-p', config], { cwd: root, stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`Lint passed (${files.length} source files; engine and UI type checks).`);
