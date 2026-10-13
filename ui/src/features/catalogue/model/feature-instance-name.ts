import type { Engine, EvaluationResult, FeatureDefinition, Instance } from '@/src/index';
import { featureInstanceDisplayName } from '@/src/index';
import { featureName } from '@/ui/src/features/catalogue/model/display';

export function scopedFeatureName(feature: FeatureDefinition | undefined, owner?: string): string {
  const name = featureName(feature);
  return owner && owner !== name && !name.startsWith(`${owner}:`) ? `${owner}: ${name}` : name;
}

export function instanceFeatureName(instance: Instance, engine: Engine, result: EvaluationResult): string {
  return featureInstanceDisplayName(instance, result.instances, (id) => engine.getFeature(id), true);
}
