import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 50_000_000 });
const changed = git('diff', '--cached', '--name-only', '--no-renames', '-z').split('\0');
const files = [...new Set(changed.filter((path) => /^src\/systems\/[^/]+\/.+\.json$/.test(path)).map((path) => path.split('/').slice(0, 3).join('/') + '/system.json'))].filter(existsSync);
for (const file of files) {
  const staged = git('show', `:${file}`), working = readFileSync(file, 'utf8');
  if (staged.replaceAll('\r\n', '\n') !== working.replaceAll('\r\n', '\n')) throw new Error(`Stage the complete System JSON before committing: ${file}`);
  let previous = 0;
  const added = git('diff', '--cached', '--name-only', '--diff-filter=A', '--', file).trim();
  if (!added) previous = JSON.parse(git('show', `HEAD:${file}`)).contentVersion ?? 1;
  const definition = JSON.parse(staged);
  for (const [name, expected] of Object.entries(definition.assetVersions ?? {})) {
    if (!/^[\w.-]+(?:\/[\w.-]+)*\.json$/.test(name) || name.split('/').some((part) => part === '.' || part === '..')) throw new Error(`Invalid asset path: ${name}`);
    const path = file.slice(0, -'system.json'.length) + name;
    const assetText = git('show', `:${path}`);
    const asset = JSON.parse(assetText);
    if (!Number.isSafeInteger(asset.assetVersion) || asset.assetVersion < 1 || !Object.hasOwn(asset, 'data')) throw new Error(`Invalid versioned asset: ${path}`);
    if (changed.includes(path)) {
      if (assetText.replaceAll('\r\n', '\n') !== readFileSync(path, 'utf8').replaceAll('\r\n', '\n')) throw new Error(`Stage the complete asset before committing: ${path}`);
      let oldVersion = 0;
      if (!git('diff', '--cached', '--name-only', '--diff-filter=A', '--', path).trim()) oldVersion = JSON.parse(git('show', `HEAD:${path}`)).assetVersion ?? 0;
      if (!Number.isSafeInteger(oldVersion) || oldVersion < 0 || oldVersion >= Number.MAX_SAFE_INTEGER) throw new Error(`Cannot increment asset version: ${path}`);
      asset.assetVersion = Math.max(asset.assetVersion, oldVersion + 1);
      writeFileSync(path, JSON.stringify(asset, null, 2) + '\n');
      git('add', '--', path);
      definition.assetVersions[name] = asset.assetVersion;
    } else if (expected !== asset.assetVersion) throw new Error(`Manifest version differs from unchanged asset: ${path}`);
  }
  if (definition.contentVersion !== undefined && (!Number.isSafeInteger(definition.contentVersion) || definition.contentVersion < 1)) throw new Error(`Invalid content version in ${file}.`);
  if (!Number.isSafeInteger(previous) || previous < 0 || previous >= Number.MAX_SAFE_INTEGER) throw new Error(`Cannot increment the previous content version in ${file}.`);
  definition.contentVersion = Math.max(definition.contentVersion ?? 0, previous + 1);
  writeFileSync(file, JSON.stringify(definition, null, 2) + '\n');
  git('add', '--', file);
  console.log(`Incremented ${file} to content version ${definition.contentVersion}.`);
}
