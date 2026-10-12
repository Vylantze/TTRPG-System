import type { ModifierExplanation } from '@/src/model/ModifierExplanation.js';
import type { StatContribution } from '@/src/model/StatContribution.js';

export interface StatResult { value: number; base: number; modifiers: ModifierExplanation[]; contributions?: StatContribution[] }
