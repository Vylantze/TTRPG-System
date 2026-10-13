import type { FeatureDefinition, Instance } from '@/src/model.js';

export function featureChoiceDisplayName(id: string): string {
  return decodeURIComponent(id.split('/').at(-1)!).split(/[.:]/).at(-1)!.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Character-context labels; Class choice names may identify calculation sources. */
export function featureInstanceDisplayName(instance: Instance, instances: Instance[], feature: (id: string) => FeatureDefinition | undefined, includeClassChoice = false): string {
  const definition = feature(instance.feature);
  const name = definition?.displayName ?? definition?.name ?? 'Unavailable Feature';
  const parent = instances.find((entry) => entry.id === instance.parent);
  const owner = parent && feature(parent.feature);
  const choice = includeClassChoice && instance.selection?.startsWith('class/') ? featureChoiceDisplayName(instance.selection) : undefined;
  const prefix = owner?.displayName ?? owner?.name ?? choice;
  return prefix && prefix !== name && !name.startsWith(`${prefix}:`) ? `${prefix}: ${name}` : name;
}
