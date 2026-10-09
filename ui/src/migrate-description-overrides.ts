/** Upgrade the previous prototype's saved display fields without changing character data. */
export function migrateDescriptionOverrides(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  const file = structuredClone(input) as Record<string, unknown>;
  if (!Array.isArray(file.features)) return file;
  const aliases: Record<string, string> = {};
  for (const config of Array.isArray(file.configurations) ? file.configurations : []) {
    for (const [name, stat] of Object.entries(config?.system?.descriptionTokens ?? {})) if (typeof stat === 'string') aliases[name] = stat;
  }
  for (const feature of file.features) {
    if (typeof feature?.processDescription === 'boolean' && feature.processDescriptionAutomatically === undefined) feature.processDescriptionAutomatically = feature.processDescription;
    delete feature.processDescription;
    if (typeof feature?.descriptionOverride !== 'string') continue;
    const override = feature.descriptionOverride.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (token: string, name: string) => Object.hasOwn(aliases, name) ? `{{stat:${aliases[name]}}}` : token);
    feature.descriptionOverride = typeof feature.description === 'string' && feature.description.length ? [{ originalString: feature.description, overrideString: override }] : [];
  }
  return file;
}
