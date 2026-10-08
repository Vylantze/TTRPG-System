import type { Value } from './Value.js';
import type { Expression } from './Expression.js';
import type { Predicate } from './Predicate.js';
import type { ComponentBase } from './ComponentBase.js';

export interface Capability extends ComponentBase {
  kind: 'grantCapability'; name: string; description?: string; action?: { kind: string; amount: number };
  requirements?: Predicate; costs?: { key: string; amount: Expression; requirement?: string }[];
  /** Outcomes that consume a reserved use. Other outcomes release it. */
  spendOnOutcomes?: string[]; metadata?: Record<string, Value>;
}
