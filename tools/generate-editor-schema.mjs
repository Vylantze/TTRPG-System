import ts from 'typescript';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

function schema(node) {
  if (!node) return { kind: 'unknown' };
  if (ts.isParenthesizedTypeNode(node)) return schema(node.type);
  if (ts.isArrayTypeNode(node)) return { kind: 'array', item: schema(node.elementType) };
  if (ts.isUnionTypeNode(node)) return { kind: 'union', variants: node.types.map(schema) };
  if (ts.isIntersectionTypeNode(node)) return { kind: 'intersection', variants: node.types.map(schema) };
  if (ts.isLiteralTypeNode(node)) {
    const text = node.literal.getText();
    return { kind: 'literal', value: text === 'true' ? true : text === 'false' ? false : ts.isStringLiteral(node.literal) ? node.literal.text : Number(text) };
  }
  if (ts.isTypeReferenceNode(node)) {
    if (node.typeName.getText() === 'Extract') return { kind: 'extract', base: schema(node.typeArguments[0]), filter: schema(node.typeArguments[1]) };
    if (node.typeName.getText() === 'Partial') {
      const result = schema(node.typeArguments[0]);
      return result.kind === 'object' ? { ...result, fields: Object.fromEntries(Object.entries(result.fields).map(([key, field]) => [key, { ...field, optional: true }])) } : result;
    }
    if (node.typeName.getText() === 'Record') {
      const keys = schema(node.typeArguments[0]);
      const variants = keys.kind === 'union' ? keys.variants : [keys];
      const item = schema(node.typeArguments[1]);
      return variants.every((key) => key.kind === 'literal') ? { kind: 'object', fields: Object.fromEntries(variants.map((key) => [key.value, { schema: item, optional: false }])) } : { kind: 'record', item };
    }
    return { kind: 'ref', name: node.typeName.getText() };
  }
  if (ts.isTypeLiteralNode(node)) return object(node.members);
  return { kind: ({ [ts.SyntaxKind.StringKeyword]: 'string', [ts.SyntaxKind.NumberKeyword]: 'number', [ts.SyntaxKind.BooleanKeyword]: 'boolean' })[node.kind] ?? 'unknown' };
}
function object(members) {
  return { kind: 'object', fields: Object.fromEntries(members.filter(ts.isPropertySignature).map((member) => [member.name.getText().replace(/^['"]|['"]$/g, ''), { schema: schema(member.type), optional: !!member.questionToken }])) };
}
const definitions = {};
for (const filename of readdirSync('src/model').filter((name) => name.endsWith('.ts'))) {
  const source = ts.createSourceFile(filename, readFileSync(`src/model/${filename}`, 'utf8'), ts.ScriptTarget.Latest, true);
  for (const node of source.statements) {
    if (ts.isTypeAliasDeclaration(node)) definitions[node.name.text] = schema(node.type);
    if (ts.isInterfaceDeclaration(node)) {
      const parents = node.heritageClauses?.flatMap((clause) => clause.types.map((type) => ({ kind: 'ref', name: type.expression.getText() }))) ?? [];
      definitions[node.name.text] = parents.length ? { kind: 'intersection', variants: [...parents, object(node.members)] } : object(node.members);
    }
  }
}
const systemFile = ts.createSourceFile('SystemFile.ts', readFileSync('src/types/SystemFile.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const options = systemFile.statements.find(ts.isInterfaceDeclaration).members.find((member) => member.name.getText() === 'options');
definitions.SystemOptions = schema(options.type);
const path = 'ui/src/features/systems/model/authoring-schema.json';
const text = JSON.stringify(definitions, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(path, 'utf8').replaceAll('\r\n', '\n') !== text) throw new Error('Editor schema is stale. Run node tools/generate-editor-schema.mjs.');
} else writeFileSync(path, text);
