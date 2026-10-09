import type { ScalingTable } from './ScalingTable.js';
import type { Predicate } from './Predicate.js';
import type { ParameterDefinition } from './ParameterDefinition.js';
import type { ResourceRequirement } from './ResourceRequirement.js';
import type { Component } from './Component.js';

export interface FeatureDefinition {
  id: string; revision: number; name: string; displayName?: string; description?: string; source?: string; tags?: string[]; contentLevel?: number;
  /** Display-only references to shared Feature descriptions; these grant no rules or ownership. */
  textReferences?: string[];
  /** Alternate source names for automatic prose links; never grants rules. */
  textAliases?: string[];
  /** Ambiguous prose names require an adjacent phrase; display-only, case-insensitive. */
  textLinkContext?: { before?: string[]; after?: string[] };
  prerequisites?: Predicate; maintenance?: Predicate; resources?: ResourceRequirement[];
  repeat?: { maximum: number; scope: 'character' | 'progression' | 'parent'; uniqueBy?: string[] };
  parameters?: Record<string, ParameterDefinition>; tables?: Record<string, ScalingTable>; components: Component[];
}
