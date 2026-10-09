import type { Expression } from '@/src/model/Expression.js';
import type { ComponentBase } from '@/src/model/ComponentBase.js';

export interface Choice extends ComponentBase {
  kind: 'chooseFeatures'; minimum: Expression; maximum: Expression;
  candidates: { ids?: string[]; tags?: string[]; maximumLevel?: Expression };
  ignorePrerequisites?: boolean; allowDuplicates?: boolean;
  /** Daily preparation can check current ownership rather than historical acquisition. */
  eligibility?: 'acquisition' | 'current';
  retraining?: { allowed: boolean; events?: string[] };
}
