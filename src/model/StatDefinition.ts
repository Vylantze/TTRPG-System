import type { Expression } from '@/src/model/Expression.js';
import type { NumericConstraints } from '@/src/model/NumericConstraints.js';

export type StatDefinition = NumericConstraints & { id: string; name: string } & (
  { kind: 'input'; default?: number } | { kind: 'derived'; expression: Expression });
