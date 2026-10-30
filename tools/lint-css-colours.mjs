const colourLiteral = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|(?<![\w-])(?:white|black)(?![\w-])/i;

/** Colours may only be written as custom properties inside `:root` blocks (the design tokens). */
export function lintCssColours(filename, text) {
  const problems = [];
  const stack = [];
  let line = 1;
  let statement = '';
  let statementLine = 1;
  const check = () => {
    const declaration = statement.trim();
    statement = '';
    if (!colourLiteral.test(declaration.replace(/\/\*[\s\S]*?\*\//g, ''))) return;
    if (/^--[\w-]+\s*:/.test(declaration) && stack.at(-1) === ':root') return;
    problems.push(`${filename}:${statementLine}: colour literal outside the :root design tokens: ${declaration.split('\n')[0]}`);
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '/' && text[index + 1] === '*') {
      const end = text.indexOf('*/', index + 2);
      const comment = text.slice(index, end < 0 ? text.length : end + 2);
      line += comment.split('\n').length - 1;
      index += comment.length - 1;
      continue;
    }
    if (char === '\n') line++;
    if (!statement.trim() && !/\s/.test(char)) statementLine = line;
    if (char === '{') {
      stack.push(statement.trim());
      statement = '';
    } else if (char === '}') {
      check();
      stack.pop();
    } else if (char === ';') {
      check();
    } else {
      statement += char;
    }
  }
  return problems;
}
