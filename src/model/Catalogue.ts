import type { FeatureDefinition } from './FeatureDefinition.js';
import type { ClassDefinition } from './ClassDefinition.js';
import type { SystemDefinition } from './SystemDefinition.js';
import type { BlockDefinition } from './BlockDefinition.js';

export interface Catalogue { id: string; revision: number; system: SystemDefinition; features: FeatureDefinition[]; classes: ClassDefinition[]; blocks?: BlockDefinition[] }
