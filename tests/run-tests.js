import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { availableEngineSuites, selectEngineTests } from '@/tools/test-suites.mjs';

// Separate test files so expensive progressions do not serialize the entire suite.
// A bounded worker count avoids loading every large rules catalogue at once.
const directory = new URL('./', import.meta.url);
const discovered = readdirSync(directory).filter((name) => name.endsWith('.test.js')).sort();
const args = process.argv.slice(2);
try {
  if (args.includes('--list')) {
    for (const [name, suite] of Object.entries(availableEngineSuites(discovered))) console.log(`${name}: ${suite.files.length} files — ${suite.description}`);
  } else {
    const names = args.filter((arg) => arg.startsWith('--suite=')).flatMap((arg) => arg.slice('--suite='.length).split(','));
    const files = selectEngineTests(names, discovered).map((name) => fileURLToPath(new URL(name, directory)));
    if (!files.length) throw new Error('The selected test suites contain no test files.');
    console.log(`Engine suites: ${names.join(', ') || 'all'} (${files.length} files)`);
    const result = spawnSync(process.execPath, [
      '--import', new URL('../tools/register-alias.mjs', import.meta.url).href,
      '--test', '--test-concurrency=2', ...args.filter((arg) => !arg.startsWith('--suite=')), ...files,
    ], { stdio: 'inherit' });
    if (result.error) console.error(result.error.message);
    process.exitCode = result.status ?? 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
