import ts from 'typescript';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
async function rewrite(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await rewrite(file);
      continue;
    }
    if (!/\.(js|ts)$/.test(file)) continue;
    let text = await readFile(file, 'utf8');
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const edits = [];
    function visit(node) {
      const specifier = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier : undefined;
      if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith('@/src/')) {
        let relative = path.relative(directory, path.join(root, specifier.text.slice(6))).replaceAll('\\', '/');
        if (!relative.startsWith('.')) relative = `./${relative}`;
        edits.push({ start: specifier.getStart(source) + 1, end: specifier.end - 1, relative });
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    for (const edit of edits.reverse()) text = text.slice(0, edit.start) + edit.relative + text.slice(edit.end);
    await writeFile(file, text);
  }
}
await rewrite(root);
