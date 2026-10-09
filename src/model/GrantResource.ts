import type { ComponentBase } from '@/src/model/ComponentBase.js';
import type { Expression } from '@/src/model/Expression.js';

export interface GrantResource extends ComponentBase {
  kind: 'grantResource'; key: string; amount: Expression;
}
