import type { Value } from '@/src/model/Value.js';
import type { Expression } from '@/src/model/Expression.js';

export type Predicate = { level: number; kind?: 'character' | 'class' }
  | { feature: string; parameters?: Record<string, Value> } | { tag: string }
  | { stat: string; minimum: number } | { parameter: string; equals: Value }
  | { expression: Expression }
  | { all: Predicate[] } | { any: Predicate[] } | { not: Predicate };
