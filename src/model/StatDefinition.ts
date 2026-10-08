import type { Expression } from './Expression.js';
import type { NumericConstraints } from './NumericConstraints.js';

export type StatDefinition = NumericConstraints & { id: string; name: string } & (
  { kind: 'input'; default?: number } | { kind: 'derived'; expression: Expression });
