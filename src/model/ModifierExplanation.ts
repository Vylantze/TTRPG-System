import type { Modifier } from '@/src/model/Modifier.js';

export interface ModifierExplanation { source: string; component: string; operation: Modifier['operation']; amount?: number; applied: boolean; reason: string }
