import type { Diagnostic } from './Diagnostic.js';
import type { Instance } from './Instance.js';
import type { StatResult } from './StatResult.js';
import type { PoolResult } from './PoolResult.js';
import type { CapabilityResult } from './CapabilityResult.js';
import type { SelectionResult } from './SelectionResult.js';

export interface EvaluationResult {
  status: 'valid' | 'incomplete' | 'invalid'; provisional: boolean; characterLevel: number;
  instances: Instance[]; selections: SelectionResult[]; stats: Record<string, StatResult>;
  resources: Record<string, PoolResult>; capabilities: CapabilityResult[]; bindings: Record<string, string>;
  diagnostics: Diagnostic[];
}
