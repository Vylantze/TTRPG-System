import type { Predicate } from '@/src/model/Predicate.js';
import type { Grant } from '@/src/model/Grant.js';
import type { Choice } from '@/src/model/Choice.js';

export interface ClassDefinition { id: string; revision: number; name: string; description?: string; source?: string; levels: Record<string, (Grant | Choice)[]>; maximumLevel?: number; multiclassPrerequisites?: Predicate }
