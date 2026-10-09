import type { Diagnostic } from '@/src/model/Diagnostic.js';
import type { Instance } from '@/src/model/Instance.js';
import type { StatResult } from '@/src/model/StatResult.js';
import type { PoolResult } from '@/src/model/PoolResult.js';
import type { CapabilityResult } from '@/src/model/CapabilityResult.js';
import type { SelectionResult } from '@/src/model/SelectionResult.js';

export interface EvaluationResult {
  status: 'valid' | 'incomplete' | 'invalid'; provisional: boolean; characterLevel: number;
  instances: Instance[]; selections: SelectionResult[]; stats: Record<string, StatResult>;
  resources: Record<string, PoolResult>; capabilities: CapabilityResult[]; bindings: Record<string, string>;
  diagnostics: Diagnostic[];
}
