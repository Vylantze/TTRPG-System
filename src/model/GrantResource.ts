import type { ComponentBase } from './ComponentBase.js';
import type { Expression } from './Expression.js';

export interface GrantResource extends ComponentBase {
  kind: 'grantResource'; key: string; amount: Expression;
}
