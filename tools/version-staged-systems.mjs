import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { bumpVersion, classifyReleaseChange, compareVersions, isReleaseVersion, releaseVersion, versionChange } from '@/src/version-policy.js';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 50_000_000 });
const changed = git('diff', '--cached', '--name-only', '--no-renames', '-z').split('\0');
const files = [...new Set(changed.filter((path) => /^src\/systems\/[^/]+\/.+\.json$/.test(path)).map((path) => path.split('/').slice(0, 3).join('/') + '/system.json'))].filter(existsSync);
function stagedJson(path) {
  const staged = git('show', `:${path}`), working = readFileSync(path, 'utf8');
  if (staged.replaceAll('\r\n', '\n') !== working.replaceAll('\r\n', '\n')) throw new Error(`Stage the complete JSON before committing: ${path}`);
  return JSON.parse(staged);
}
function oldJson(path) {
  try {
    return JSON.parse(git('show', `HEAD:${path}`));
  } catch { return undefined; }
}
function save(path, value) {
  const text = JSON.stringify(value, null, 2) + '\n';
  if (readFileSync(path, 'utf8').replaceAll('\r\n', '\n') !== text) writeFileSync(path, text);
  git('add', '--', path);
}
const ranks = { none: 0, patch: 1, minor: 2, major: 3 };
function chooseVersion(authored, previous, change) {
  if (previous === undefined) return authored ?? '1.0.0';
  const base = releaseVersion(previous);
  const minimum = change === 'none' ? base : bumpVersion(base, change);
  if (authored !== undefined && !isReleaseVersion(authored)) throw new Error('Author release versions as major.minor.patch.');
  return authored && compareVersions(authored, minimum) >= 0 ? authored : minimum;
}
for (const file of files) {
  const definition = stagedJson(file), previous = oldJson(file);
  let change = previous ? classifyReleaseChange(previous, definition) : 'minor';
  for (const [name, expected] of Object.entries(definition.assetVersions ?? {})) {
    if (!/^[\w.-]+(?:\/[\w.-]+)*\.json$/.test(name) || name.split('/').some((part) => part === '.' || part === '..')) throw new Error(`Invalid asset path: ${name}`);
    const path = file.slice(0, -'system.json'.length) + name;
    const asset = changed.includes(path) ? stagedJson(path) : JSON.parse(git('show', `:${path}`));
    if (!isReleaseVersion(asset.assetVersion) || !Object.hasOwn(asset, 'data')) throw new Error(`Invalid versioned asset: ${path}`);
    if (changed.includes(path)) {
      const old = oldJson(path);
      const kind = old ? classifyReleaseChange(old.data ?? old, asset.data) : 'minor';
      asset.assetVersion = chooseVersion(asset.assetVersion, old?.assetVersion, kind);
      save(path, asset);
      definition.assetVersions[name] = asset.assetVersion;
      if (ranks[kind] > ranks[change]) change = kind;
      const authoredKind = versionChange(old?.assetVersion, asset.assetVersion);
      if (ranks[authoredKind] > ranks[change]) change = authoredKind;
      console.log(`${path}: ${kind} → ${asset.assetVersion}`);
    } else if (expected !== asset.assetVersion) throw new Error(`Manifest version differs from unchanged asset: ${path}`);
  }
  // Version all auxiliary JSON assets too, without forcing the engine to load sample saves.
  const prefix = file.slice(0, -'system.json'.length);
  if (changed.some((path) => path.startsWith(prefix) && path.endsWith('.json') && path !== file && !existsSync(path))) change = 'major';
  for (const path of changed.filter((path) => path.startsWith(prefix) && path.endsWith('.json') && path !== file && !Object.hasOwn(definition.assetVersions ?? {}, path.slice(prefix.length)) && existsSync(path))) {
    const asset = stagedJson(path), old = oldJson(path);
    if (!isReleaseVersion(asset.assetVersion) || !Object.hasOwn(asset, 'data')) throw new Error(`Auxiliary JSON needs an assetVersion/data envelope: ${path}`);
    const kind = old ? classifyReleaseChange(old.data ?? old, asset.data) : 'minor';
    asset.assetVersion = chooseVersion(asset.assetVersion, old?.assetVersion, kind);
    save(path, asset);
    if (ranks[kind] > ranks[change]) change = kind;
    const authoredKind = versionChange(old?.assetVersion, asset.assetVersion);
    if (ranks[authoredKind] > ranks[change]) change = authoredKind;
    console.log(`${path}: ${kind} → ${asset.assetVersion}`);
  }
  definition.contentVersion = chooseVersion(definition.contentVersion, previous?.contentVersion, change);
  save(file, definition);
  console.log(`${file}: ${change} → ${definition.contentVersion}`);
}
