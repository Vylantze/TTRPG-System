import type { Predicate } from './Predicate.js';
import type { Grant } from './Grant.js';
import type { Choice } from './Choice.js';

export interface ClassDefinition { id: string; revision: number; name: string; description?: string; source?: string; levels: Record<string, (Grant | Choice)[]>; maximumLevel?: number; multiclassPrerequisites?: Predicate }
