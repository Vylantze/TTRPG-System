import ts from 'typescript';

/** Named declarations count even when nested; inline object types are allowed. */
export function lintSource(filename, text) {
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
  const problems = [];
  const report = (node, message) => {
    const location = source.getLineAndCharacterOfPosition(node.getStart(source));
    problems.push(`${filename}:${location.line + 1}:${location.character + 1}: ${message}`);
  };
  const declarations = [];
  const visit = (node) => {
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)
      || ts.isClassDeclaration(node) || ts.isClassExpression(node)) declarations.push(node);
    if (ts.isDebuggerStatement(node)) report(node, 'Remove debugger statements.');
    if (ts.isVariableDeclarationList(node) && !(node.flags & ts.NodeFlags.BlockScoped)) report(node, 'Use const or let instead of var.');
    ts.forEachChild(node, visit);
  };
  visit(source);
  for (const declaration of declarations.slice(1)) report(declaration, 'Keep at most one class, interface, type alias, or enum definition per file.');
  for (const diagnostic of source.parseDiagnostics) {
    const location = source.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    problems.push(`${filename}:${location.line + 1}:${location.character + 1}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
  }
  return problems;
}
