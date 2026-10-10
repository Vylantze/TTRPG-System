import type { Expression } from '@/src/model/Expression.js';
import type { NumericConstraints } from '@/src/model/NumericConstraints.js';
import type { ComponentBase } from '@/src/model/ComponentBase.js';
import type { Scope } from '@/src/model/Scope.js';

export interface Resource extends ComponentBase, NumericConstraints {
  kind: 'defineResource'; key: string; scope: Scope; units: string; contract?: string;
  capacity: Expression; combine?: 'sum' | 'highest'; initial?: 'full' | 'empty';
  recovery: { event: string; amount: Expression | 'full'; dice?: string }[];
}
