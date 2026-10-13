import type { SystemFile } from '@/src/index';
import { formDefault, formSchema } from '@/ui/src/features/systems/model/authoring-form';

export const editorCategories = [
  { id: 'classes', label: 'Classes', singular: 'Class', schema: 'ClassDefinition' },
  { id: 'features', label: 'Features', singular: 'Feature', schema: 'FeatureDefinition' },
  { id: 'spells', label: 'Spells', singular: 'Spell', schema: 'FeatureDefinition' },
  { id: 'items', label: 'Items', singular: 'Item', schema: 'ItemDefinition' },
  { id: 'itemFeatures', label: 'Item Features', singular: 'Item Feature', schema: 'ItemFeature' },
  { id: 'blocks', label: 'Building blocks', singular: 'Building block', schema: 'BlockDefinition' },
  {
    id: 'settings',
    label: 'System settings',
    singular: 'System settings',
    schema: 'SystemDefinition',
  },
  { id: 'options', label: 'System options', singular: 'System options', schema: 'SystemOptions' },
];
export function editorRecords(file: SystemFile, category: string, configuration: number) {
  if (category === 'options')
    return [{ id: file.id, label: 'System options', value: file.options }];
  const config = file.configurations[configuration];
  const values
    = category === 'settings'
      ? [config.system]
      : category === 'classes'
        ? config.classes
        : category === 'features' || category === 'spells'
          ? file.features.filter((feature) =>
              category === 'spells'
                ? feature.tags?.includes('spell')
                : !feature.tags?.includes('spell'),
            )
          : (file[category as 'items' | 'itemFeatures' | 'blocks'] ?? []);
  return values
    .map((value) => ({
      id: value.id,
      label:
        'displayName' in value && value.displayName
          ? value.displayName
          : 'name' in value
            ? value.name
            : value.id,
      value,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
export function editSystemRecord(
  file: SystemFile,
  category: string,
  configuration: number,
  id: string,
  value: unknown,
): SystemFile {
  if (category === 'options') return { ...file, options: value } as SystemFile;
  if (category === 'settings' || category === 'classes') {
    const configurations = file.configurations.map((config, index) => {
      if (index !== configuration) return config;
      if (category === 'settings') return { ...config, system: value };
      const newId
        = value && typeof value === 'object' && 'id' in value ? String(value.id) : undefined;
      const allowed = config.system.classes;
      const classes = allowed?.flatMap((old) => (old === id ? (newId ? [newId] : []) : [old]));
      if (classes && newId && !classes.includes(newId)) classes.push(newId);
      return {
        ...config,
        classes: replace(config.classes, id, value),
        system: classes ? { ...config.system, classes } : config.system,
      };
    });
    return { ...file, configurations } as SystemFile;
  }
  const key
    = category === 'spells'
      ? 'features'
      : (category as 'features' | 'items' | 'itemFeatures' | 'blocks');
  return { ...file, [key]: replace(file[key] ?? [], id, value) };
}
function replace(entries: { id: string }[], id: string, value: unknown): unknown[] {
  if (value === undefined) return entries.filter((entry) => entry.id !== id);
  return entries.some((entry) => entry.id === id)
    ? entries.map((entry) => (entry.id === id ? value : entry))
    : [...entries, value];
}
export function newSystemRecord(file: SystemFile, category: string, configuration: number) {
  const definition = editorCategories.find((entry) => entry.id === category)!;
  const used = new Set(
    [
      ...file.features,
      ...file.configurations[configuration].classes,
      ...(file.items ?? []),
      ...(file.itemFeatures ?? []),
      ...(file.blocks ?? []),
    ].map((entry) => entry.id),
  );
  let number = 1;
  while (used.has(`custom:${category}:${number}`)) number++;
  const id = `custom:${category}:${number}`;
  const value = {
    ...(formDefault(formSchema(definition.schema)) as object),
    id,
    name: `New ${definition.singular}`,
    revision: 1,
    ...(category === 'spells' ? { tags: ['spell'], contentLevel: 0 } : {}),
  };
  return { id, file: editSystemRecord(file, category, configuration, id, value) };
}
