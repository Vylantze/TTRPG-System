import type { Expression } from '@/src/model/Expression.js';
import type { StackingPolicy } from '@/src/model/StackingPolicy.js';
import type { ComponentBase } from '@/src/model/ComponentBase.js';

export interface Modifier extends ComponentBase {
  kind: 'modifyStat'; stat: string; operation: 'add' | 'multiply' | 'floor' | 'ceiling' | 'override';
  value: Expression; group?: string; stacking?: StackingPolicy; priority?: number;
}
