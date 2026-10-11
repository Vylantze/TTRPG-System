import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { classifyUiChange, isUiReleaseFile, nextUiVersion } from '@/tools/ui-release-policy.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 50_000_000, stdio: ['pipe', 'pipe', 'pipe'] });
function contents(ref, path) {
  try {
    return git('show', `${ref}:${path}`);
  } catch { return undefined; }
}
const changed = git('diff', '--cached', '--name-only', '--no-renames', '-z').split('\0').filter(isUiReleaseFile);
const ranks = { none: 0, patch: 1, minor: 2, major: 3 };
let classification = 'none';
for (const path of changed) {
  const kind = classifyUiChange(path, contents('HEAD', path), contents('', path));
  if (ranks[kind] > ranks[classification]) classification = kind;
}
const override = process.env.UI_RELEASE_TYPE;
if (override && !['patch', 'minor', 'major'].includes(override)) throw new Error('UI_RELEASE_TYPE must be patch, minor, or major.');
if (classification !== 'none') {
  classification = override ?? classification;
  const paths = ['ui/package.json', 'ui/package-lock.json'];
  const documents = paths.map((path) => {
    const staged = contents('', path);
    if (staged === undefined || staged.replaceAll('\r\n', '\n') !== readFileSync(path, 'utf8').replaceAll('\r\n', '\n')) throw new Error(`Stage the complete file before automatic UI versioning: ${path}`);
    return JSON.parse(staged);
  });
  const previous = JSON.parse(contents('HEAD', paths[0]) ?? '{"version":"0.0.0"}').version;
  const version = nextUiVersion(previous, documents[0].version, classification);
  documents[0].version = version;
  documents[1].version = version;
  documents[1].packages[''].version = version;
  paths.forEach((path, index) => writeFileSync(path, JSON.stringify(documents[index], null, 2) + '\n'));
  git('add', '--', ...paths);
  console.log(`UI: ${classification} → ${version}`);
}
