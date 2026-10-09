import type { ParameterDefinition } from '@/src/model/ParameterDefinition.js';

/** JSON templates use exact { argument: name } nodes; never executable strings. */
export interface BlockDefinition {
  id: string; parameters?: Record<string, ParameterDefinition>;
  components: Record<string, unknown>[];
}
