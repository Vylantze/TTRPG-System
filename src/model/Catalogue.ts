import type { FeatureDefinition } from './FeatureDefinition.js';
import type { ClassDefinition } from './ClassDefinition.js';
import type { SystemDefinition } from './SystemDefinition.js';

export interface Catalogue { id: string; revision: number; system: SystemDefinition; features: FeatureDefinition[]; classes: ClassDefinition[] }
