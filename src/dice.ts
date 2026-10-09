import { RuleError } from '@/src/expression.js';

/** Bounded additive dice notation; no eval or executable source text. */
export function rollDice(expression: string, random: () => number = Math.random) {
  const normalized = expression.replace(/\s+/g, '').replace(/\+-/g, '-');
  if (!/^[+-]?(?:\d+d\d+|\d+)(?:[+-](?:\d+d\d+|\d+))*$/i.test(normalized)) throw new RuleError('ROLL', 'Unsupported dice expression.');
  let total = 0, count = 0;
  const breakdown: string[] = [];
  for (const token of normalized.match(/[+-]?[^+-]+/g)!) {
    const sign = token.startsWith('-') ? -1 : 1;
    const term = token.replace(/^[+-]/, '');
    const dice = term.match(/^(\d+)d(\d+)$/i);
    let value: number;
    if (dice) {
      const n = Number(dice[1]), sides = Number(dice[2]);
      count += n;
      if (n < 1 || count > 100 || sides < 2 || sides > 10000) throw new RuleError('ROLL', 'Dice limits exceeded.');
      const rolls = Array.from({ length: n }, () => {
        const sample = random();
        if (!(sample >= 0 && sample < 1)) throw new RuleError('ROLL', 'Invalid random sample.');
        return Math.floor(sample * sides) + 1;
      });
      value = rolls.reduce((a, b) => a + b, 0);
      breakdown.push(`${sign < 0 ? '- ' : breakdown.length ? '+ ' : ''}${rolls.join(' + ')} (${term})`);
    } else {
      value = Number(term);
      if (!Number.isSafeInteger(value)) throw new RuleError('ROLL', 'Invalid roll constant.');
      breakdown.push(`${sign < 0 ? '- ' : breakdown.length ? '+ ' : ''}${value}`);
    }
    total += sign * value;
  }
  return { total, breakdown: breakdown.join(' ') };
}
