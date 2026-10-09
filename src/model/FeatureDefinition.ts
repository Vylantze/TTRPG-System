import type { FeatureRoll } from '@/src/model/FeatureRoll.js';
import type { ScalingTable } from '@/src/model/ScalingTable.js';
import type { Predicate } from '@/src/model/Predicate.js';
import type { ParameterDefinition } from '@/src/model/ParameterDefinition.js';
import type { ResourceRequirement } from '@/src/model/ResourceRequirement.js';
import type { Component } from '@/src/model/Component.js';

export interface FeatureDefinition {
  /** A Roll Feature owns one roll; other Features grant it as a child. */
  roll?: FeatureRoll;
  id: string; revision: number; name: string; displayName?: string; description?: string; source?: string; tags?: string[]; contentLevel?: number;
  /** Display-only references to shared Feature descriptions; these grant no rules or ownership. */
  textReferences?: string[];
  /** Alternate source names for automatic prose links; never grants rules. */
  textAliases?: string[];
  /** Whether source prose receives automatic character-value replacements; defaults to true. */
  processDescriptionAutomatically?: boolean;
  /** Exact source-text replacements. Replacement text resolves explicit tokens only. */
  descriptionOverride?: { originalString: string; overrideString: string }[];
  /** Ambiguous prose names require an adjacent phrase; display-only, case-insensitive. */
  textLinkContext?: { before?: string[]; after?: string[] };
  prerequisites?: Predicate; maintenance?: Predicate; resources?: ResourceRequirement[];
  repeat?: { maximum: number; scope: 'character' | 'progression' | 'parent'; uniqueBy?: string[] };
  parameters?: Record<string, ParameterDefinition>; tables?: Record<string, ScalingTable>; components: Component[];
}
