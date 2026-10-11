import ts from 'typescript';
import { bumpVersion, classifyReleaseChange, compareVersions, isReleaseVersion } from '@/src/version-policy.js';

export function classifyUiChange(path, previous, next) {
  if (previous === next) return 'none';
  if (next === undefined) return 'major';
  if (previous === undefined) return 'minor';
  if (path === 'ui/package.json' || path === 'ui/package-lock.json') {
    const before = JSON.parse(previous), after = JSON.parse(next);
    delete before.version;
    delete after.version;
    if (before.packages?.['']) delete before.packages[''].version;
    if (after.packages?.['']) delete after.packages[''].version;
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
      for (const [name, requirement] of Object.entries(before[section] ?? {})) {
        const oldMajor = String(requirement).match(/\d+/)?.[0];
        const newMajor = String(after[section]?.[name] ?? '').match(/\d+/)?.[0];
        if (oldMajor !== undefined && newMajor !== undefined && oldMajor !== newMajor) return 'major';
      }
    }
    return classifyReleaseChange(before, after);
  }
  if (/\.(css|svg|png|jpg|jpeg|webp|ico|woff2?)$/.test(path)) return 'patch';
  if (!/\.[cm]?[jt]sx?$/.test(path)) return 'minor';
  const parse = (text) => ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const before = parse(previous), after = parse(next);
  const exports = (source) => source.statements.filter((node) => node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)).map((node) => node.name?.getText(source) ?? node.getText(source).split('{')[0].trim());
  if (exports(before).some((name) => !exports(after).includes(name))) return 'major';
  const contracts = (source) => new Map(source.statements.filter((node) => node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) && node.name).map((node) => [node.name.getText(source), ts.isFunctionDeclaration(node) ? node.parameters.map((parameter) => parameter.getText(source)).join(',') + ':' + (node.type?.getText(source) ?? '') : ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) ? node.getText(source) : undefined]));
  const oldContracts = contracts(before), newContracts = contracts(after);
  if ([...oldContracts].some(([name, signature]) => signature !== undefined && newContracts.get(name) !== signature)) return 'major';
  // Ignore trivia and visible JSX copy; retain literals used by program logic.
  const structure = (source) => {
    const parts = [];
    function visit(node) {
      if (ts.isJsxText(node)) return;
      if (ts.isJsxAttribute(node) && ['title', 'aria-label', 'placeholder'].includes(node.name.getText(source))) return;
      if (node.getChildCount(source) === 0) parts.push(node.kind + ':' + node.getText(source));
      else ts.forEachChild(node, visit);
    }
    visit(source);
    return parts.join('|');
  };
  if (structure(before) === structure(after)) return previous.trim() === next.trim() ? 'none' : 'patch';
  return 'minor';
}

export function isUiReleaseFile(path) {
  return /^ui\/(src\/|public\/|index\.html$|vite\.config\.[cm]?[jt]s$|tsconfig\.json$|package(?:-lock)?\.json$)/.test(path);
}

export function nextUiVersion(previous, authored, classification) {
  if (!isReleaseVersion(previous) || !isReleaseVersion(authored)) throw new Error('UI versions must use major.minor.patch.');
  const minimum = bumpVersion(previous, classification);
  return compareVersions(authored, minimum) >= 0 ? authored : minimum;
}
