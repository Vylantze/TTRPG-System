import type { FeatureDefinition, FunctionRegistry, Value } from '../model.js';

export interface Environment {
  stats: (id: string) => number; context: Record<string, Value>; parameters: Record<string, Value>;
  owner?: string; base?: number; features: Map<string, FeatureDefinition>; functions: FunctionRegistry;
}
