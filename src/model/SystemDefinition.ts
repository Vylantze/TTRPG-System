import type { Value } from './Value.js';
import type { Expression } from './Expression.js';
import type { Predicate } from './Predicate.js';
import type { StatDefinition } from './StatDefinition.js';
import type { Grant } from './Grant.js';
import type { Choice } from './Choice.js';
import type { Scope } from './Scope.js';

export interface SystemDefinition {
  id: string; revision: number; name: string; stats: StatDefinition[]; classes?: string[];
  /** Tag identities remain stable; Systems supply their user-facing labels separately. */
  tagDisplayNames?: Record<string, string>;
  allowMultipleClasses: boolean; characterLevel: Expression;
  allowDuplicateClasses?: boolean;
  /** Restrict additional root acquisitions without restricting nested or class Features. */
  rootCandidates?: { ids?: string[]; tags?: string[] };
  validation?: { id: string; requirement: Predicate; message: string }[];
  contextDefaults?: Record<string, Value>; advancement?: Record<string, (Grant | Choice)[]>;
  /** Explicit alternative base calculations, selected by character input. */
  alternatives?: Record<string, { id: string; expression: Expression; requirements?: Predicate }[]>;
  /** Engine command policies, authored as data rather than System-specific code. */
  commandRules?: {
    spellTurn?: { castingAbilityKey: string; levelKey: string; timeKey: string; ritualKey: string; bonusTime: string; actionTime: string };
    selectedRecovery?: { eventKind?: string; capabilityName: string; requiredEvent: string; boundaryEvent?: string; budgetStat: string;
      targets: Record<string, { key: string; scope: Scope; weight: number }>; };
  };
}
