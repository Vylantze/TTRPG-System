import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Separate test files so expensive progressions do not serialize the entire suite.
// A bounded worker count avoids loading every large rules catalogue at once.
const directory = new URL('./', import.meta.url);
const files = readdirSync(directory).filter((name) => name.endsWith('.test.js')).sort()
  .map((name) => fileURLToPath(new URL(name, directory)));
const result = spawnSync(process.execPath, [
  '--import', new URL('../tools/register-alias.mjs', import.meta.url).href,
  '--test', '--test-concurrency=2', ...process.argv.slice(2), ...files,
], { stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
