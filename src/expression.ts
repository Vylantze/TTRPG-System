import type { Expression, NumericConstraints, ScalingTable } from './model.js';
import type { Environment } from './types/Environment.js';
import { RuleError } from './types/RuleError.js';
export type { Environment } from './types/Environment.js';
export { RuleError } from './types/RuleError.js';
export function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new RuleError('INVALID_NUMBER', 'Expected a finite number.');
  return value;
}
export function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new RuleError('INVALID_BOOLEAN', 'Expected a boolean.');
  return value;
}
export function constrain(value: number, rules: NumericConstraints, input = false): number {
  number(value);
  if (!input && rules.rounding) value = Math[rules.rounding](value);
  if (rules.integer && !Number.isInteger(value)) throw new RuleError('INVALID_INTEGER', 'Expected an integer.');
  if (!input && rules.clamp) value = Math.min(rules.maximum ?? Infinity, Math.max(rules.minimum ?? -Infinity, value));
  if (value < (rules.minimum ?? -Infinity) || value > (rules.maximum ?? Infinity)) throw new RuleError('OUT_OF_BOUNDS', `Value ${value} is outside its bounds.`);
  return value;
}
function lookup(table: ScalingTable, input: number): number {
  const rows = [...table.rows].sort((a, b) => a.key - b.key);
  const boundary = (policy: ScalingTable['below'], value: number): number => {
    if (policy === 'boundary') return value;
    if (policy === 'error') throw new RuleError('TABLE_RANGE', `Table input ${input} is outside its range.`);
    return policy.fallback;
  };
  if (input < rows[0].key) return boundary(table.below, rows[0].value);
  if (input > rows.at(-1)!.key) return boundary(table.above, rows.at(-1)!.value);
  const row = table.mode === 'exact' ? rows.find((r) => r.key === input) : rows.filter((r) => r.key <= input).at(-1);
  if (row) return row.value;
  if (table.missing && table.missing !== 'error') return table.missing.fallback;
  throw new RuleError('TABLE_KEY', `No exact table row for ${input}.`);
}
export function evaluateExpression(expr: Expression, env: Environment, depth = 0): number | boolean {
  if (depth > 64) throw new RuleError('EXPRESSION_DEPTH', 'Expression nesting exceeds 64.');
  if (typeof expr === 'number') return number(expr);
  if (typeof expr === 'boolean') return expr;
  const read = (e: Expression) => evaluateExpression(e, env, depth + 1);
  if ('literal' in expr) return typeof expr.literal === 'boolean' ? expr.literal : number(expr.literal);
  if ('stat' in expr) return env.stats(expr.stat);
  if ('context' in expr) {
    const v = env.context[expr.context];
    if (typeof v === 'boolean') return v;
    return number(v);
  }
  if ('parameter' in expr) {
    const v = env.parameters[expr.parameter];
    if (typeof v === 'boolean') return v;
    return number(v);
  }
  if ('base' in expr) return number(env.base);
  if ('if' in expr) return read(boolean(read(expr.if)) ? expr.then : expr.else);
  if ('table' in expr) {
    const owner = expr.owner ?? env.owner;
    const table = owner ? env.features.get(owner)?.tables?.[expr.table] : undefined;
    if (!table) throw new RuleError('UNKNOWN_TABLE', `Unknown table ${owner ?? '<no owner>'}/${expr.table}.`);
    return number(lookup(table, number(read(expr.input))));
  }
  if ('call' in expr) {
    const fn = env.functions[expr.call];
    if (!fn || fn.arguments.length !== expr.args.length) throw new RuleError('UNKNOWN_FUNCTION', `Unknown function or wrong arity: ${expr.call}.`);
    const values = expr.args.map(read);
    values.forEach((v, i) => fn.arguments[i] === 'number' ? number(v) : boolean(v));
    const result = fn.invoke(...values);
    return fn.result === 'number' ? number(result) : boolean(result);
  }
  if (expr.op === 'and') return expr.args.every((e) => boolean(read(e)));
  if (expr.op === 'or') return expr.args.some((e) => boolean(read(e)));
  if (expr.op === 'not') return !boolean(read(expr.args[0]));
  const args = expr.args.map((e) => number(read(e)));
  let result: number | boolean;
  switch (expr.op) {
    case 'add': result = args.reduce((a, b) => a + b, 0);
      break;
    case 'subtract': result = args[0] - args[1];
      break;
    case 'multiply': result = args.reduce((a, b) => a * b, 1);
      break;
    case 'divide': if (args[1] === 0) throw new RuleError('DIVISION_BY_ZERO', 'Division by zero.');
      result = args[0] / args[1];
      break;
    case 'min': result = Math.min(...args);
      break;
    case 'max': result = Math.max(...args);
      break;
    case 'floor': result = Math.floor(args[0]);
      break;
    case 'ceil': result = Math.ceil(args[0]);
      break;
    case 'eq': return args[0] === args[1];
    case 'gt': return args[0] > args[1];
    case 'gte': return args[0] >= args[1];
    case 'lt': return args[0] < args[1];
    case 'lte': return args[0] <= args[1];
    default: throw new RuleError('UNKNOWN_OPERATION', 'Unknown expression operation.');
  }
  return number(result);
}
