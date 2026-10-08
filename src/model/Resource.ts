import type { Expression } from './Expression.js';
import type { NumericConstraints } from './NumericConstraints.js';
import type { ComponentBase } from './ComponentBase.js';
import type { Scope } from './Scope.js';

export interface Resource extends ComponentBase, NumericConstraints {
  kind: 'defineResource'; key: string; scope: Scope; units: string; contract?: string;
  capacity: Expression; combine?: 'sum' | 'highest'; initial?: 'full' | 'empty';
  recovery: { event: string; amount: Expression | 'full' }[];
}
