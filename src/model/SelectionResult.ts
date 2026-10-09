import type { Value } from '@/src/model/Value.js';
import type { Choice } from '@/src/model/Choice.js';
import type { Pick } from '@/src/model/Pick.js';

export interface SelectionResult { id: string; owner?: string; definition: Choice; minimum: number; maximum: number; picks: Pick[]; context: Record<string, Value> }
