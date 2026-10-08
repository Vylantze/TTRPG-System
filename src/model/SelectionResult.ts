import type { Value } from './Value.js';
import type { Choice } from './Choice.js';
import type { Pick } from './Pick.js';

export interface SelectionResult { id: string; owner?: string; definition: Choice; minimum: number; maximum: number; picks: Pick[]; context: Record<string, Value> }
