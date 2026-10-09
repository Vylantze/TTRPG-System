import type { FeatureDefinition } from '@/src/model/FeatureDefinition.js';
import type { ClassDefinition } from '@/src/model/ClassDefinition.js';
import type { SystemDefinition } from '@/src/model/SystemDefinition.js';
import type { BlockDefinition } from '@/src/model/BlockDefinition.js';
import type { ItemDefinition } from '@/src/model/ItemDefinition.js';
import type { ItemFeature } from '@/src/model/ItemFeature.js';

export interface Catalogue { id: string; revision: number; system: SystemDefinition; features: FeatureDefinition[]; classes: ClassDefinition[]; blocks?: BlockDefinition[]; items?: ItemDefinition[]; itemFeatures?: ItemFeature[] }
