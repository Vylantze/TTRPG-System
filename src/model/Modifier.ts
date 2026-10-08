import type { Expression } from './Expression.js';
import type { StackingPolicy } from './StackingPolicy.js';
import type { ComponentBase } from './ComponentBase.js';

export interface Modifier extends ComponentBase {
  kind: 'modifyStat'; stat: string; operation: 'add' | 'multiply' | 'floor' | 'ceiling' | 'override';
  value: Expression; group?: string; stacking?: StackingPolicy; priority?: number;
}
