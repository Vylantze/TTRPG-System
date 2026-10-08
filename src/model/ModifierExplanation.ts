import type { Modifier } from './Modifier.js';

export interface ModifierExplanation { source: string; component: string; operation: Modifier['operation']; amount?: number; applied: boolean; reason: string }
