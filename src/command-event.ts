import type { Character } from '@/src/model/Character.js';
import { RuleError } from '@/src/expression.js';

export function canonical(value: unknown): string {
  const order = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(order);
    if (v && typeof v === 'object')
      return Object.fromEntries(
        Object.entries(v)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, x]) => [k, order(x)]),
      );
    return v;
  };
  return JSON.stringify(order(value));
}
export function stamp(character: Character, id: string, payload: unknown): boolean {
  if (!id) throw new RuleError('EVENT_ID', 'An event ID is required.');
  const fingerprint = canonical(payload);
  const prior = character.events.find((e) => e.id === id);
  if (prior) {
    if (prior.fingerprint !== fingerprint)
      throw new RuleError('EVENT_CONFLICT', 'Event ID was reused with different data.');
    return false;
  }
  character.events.push({ id, fingerprint });
  return true;
}
