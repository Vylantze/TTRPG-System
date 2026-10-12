import type { Expression } from '@/src/model/Expression.js';
import type { StatContribution } from '@/src/model/StatContribution.js';
import type { Environment } from '@/src/types/Environment.js';
import { boolean, evaluateExpression, number } from '@/src/expression.js';

/** Follow selected branches; keep non-additive calculations as one evaluated term. */
export function expressionContributions(expression: Expression, env: Environment, label: string, stat: (id: string) => StatContribution[]): StatContribution[] {
  const read = (value: Expression) => number(evaluateExpression(value, env));
  const walk = (value: Expression): StatContribution[] => expressionContributions(value, env, label, stat);
  if (typeof expression === 'object') {
    if ('stat' in expression) return [...stat(expression.stat)];
    if ('if' in expression) {
      const selected = boolean(evaluateExpression(expression.if, env)) ? expression.then : expression.else;
      const condition = (value: Expression): string => {
        if (typeof value !== 'object') return String(value);
        if ('stat' in value) return value.stat;
        if ('table' in value) return `${value.table} (${condition(value.input)})`;
        if ('op' in value) {
          const symbols: Record<string, string> = { lt: '<', lte: '≤', gt: '>', gte: '≥', eq: '=', and: 'and', or: 'or' };
          return value.args.map(condition).join(` ${symbols[value.op] ?? value.op} `);
        }
        return label;
      };
      return expressionContributions(selected, env, `${label}: ${condition(expression.if)}`, stat);
    }
    if ('op' in expression) {
      if (expression.op === 'add') return expression.args.flatMap(walk);
      if (expression.op === 'subtract') return [...walk(expression.args[0]), ...walk(expression.args[1]).map((term) => ({ ...term, amount: -term.amount }))];
      if (expression.op === 'min' || expression.op === 'max') {
        const amount = read(expression);
        return walk(expression.args.find((arg) => read(arg) === amount)!);
      }
    }
    const labels = (value: Expression): string[] => {
      if (typeof value !== 'object') return [];
      if ('stat' in value) return stat(value.stat).map((term) => term.label);
      if ('table' in value) return labels(value.input);
      if ('args' in value) return value.args.flatMap(labels);
      return [];
    };
    const names = [...new Set(labels(expression))];
    if (names.length && ('table' in expression || ('op' in expression && expression.op === 'multiply'))) label = names.join(', ');
  }
  return [{ amount: read(expression), label }];
}
