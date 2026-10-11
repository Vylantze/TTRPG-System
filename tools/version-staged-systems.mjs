import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 50_000_000 });
const files = git('diff', '--cached', '--name-only', '--diff-filter=ACM', '-z', '--', 'src/systems/*/system.json').split('\0').filter(Boolean);
for (const file of files) {
  const staged = git('show', `:${file}`), working = readFileSync(file, 'utf8');
  if (staged.replaceAll('\r\n', '\n') !== working.replaceAll('\r\n', '\n')) throw new Error(`Stage the complete System JSON before committing: ${file}`);
  let previous = 0;
  const added = git('diff', '--cached', '--name-only', '--diff-filter=A', '--', file).trim();
  if (!added) previous = JSON.parse(git('show', `HEAD:${file}`)).contentVersion ?? 1;
  const definition = JSON.parse(staged);
  if (definition.contentVersion !== undefined && (!Number.isSafeInteger(definition.contentVersion) || definition.contentVersion < 1)) throw new Error(`Invalid content version in ${file}.`);
  if (!Number.isSafeInteger(previous) || previous < 0 || previous >= Number.MAX_SAFE_INTEGER) throw new Error(`Cannot increment the previous content version in ${file}.`);
  if ((definition.contentVersion ?? 0) > previous) continue;
  definition.contentVersion = previous + 1;
  writeFileSync(file, JSON.stringify(definition, null, 2) + '\n');
  git('add', '--', file);
  console.log(`Incremented ${file} to content version ${definition.contentVersion}.`);
}
