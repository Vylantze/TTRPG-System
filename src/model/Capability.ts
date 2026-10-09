import type { Value } from '@/src/model/Value.js';
import type { Expression } from '@/src/model/Expression.js';
import type { Predicate } from '@/src/model/Predicate.js';
import type { ComponentBase } from '@/src/model/ComponentBase.js';

export interface Capability extends ComponentBase {
  kind: 'grantCapability'; name: string; description?: string; action?: { kind: string; amount: number };
  requirements?: Predicate; costs?: { key: string; amount: Expression; requirement?: string }[];
  /** Outcomes that consume a reserved use. Other outcomes release it. */
  spendOnOutcomes?: string[]; metadata?: Record<string, Value>;
}
