import { classEntryPath, selectionPath, clone, type Engine } from '@/src/engine.js';
import type { Character, Instance } from '@/src/model.js';

/** Preserve saved ownership when a System nests existing Features under a choice.
 * Only unambiguous identities are moved. The caller must validate the result and
 * retain the old System if migration cannot produce an acceptable character.
 */
export function migrateCharacterStructure(character: Character, before: Engine, after: Engine): Character {
  const updated = clone(character);
  updated.contentRevisions = Object.fromEntries([...after.catalogue.features, ...after.catalogue.classes].map((f) => [f.id, f.revision]));
  const oldInstances = before.evaluate(character).instances;
  const convertedSlots = new Set<string>();
  for (const progression of character.progressions) {
    const oldClass = before.catalogue.classes.find((c) => c.id === progression.class);
    const newClass = after.catalogue.classes.find((c) => c.id === progression.class);
    for (const [level, entries] of Object.entries(oldClass?.levels ?? {})) {
      if (!character.history.some((event) => event.progression === progression.id && event.level === Number(level))) continue;
      for (const entry of entries) {
        const replacement = newClass?.levels[level]?.find((e) => e.id === entry.id);
        const path = classEntryPath(progression.id, Number(level), entry.id);
        if (entry.kind === 'grantFeature' && replacement?.kind === 'chooseFeatures' && replacement.minimum === 1 && replacement.maximum === 1 && replacement.candidates.ids?.includes(entry.feature) && !updated.selections[path]) {
          updated.selections[path] = [{ id: 'retained', feature: entry.feature, parameters: entry.parameters }];
          convertedSlots.add(path);
        }
      }
    }
  }
  const paths = new Map<string, string>();
  const retainedSelections = Object.fromEntries([...convertedSlots].map((path) => [path, updated.selections[path]]));
  const same = (a: Instance, b: Instance) => a.feature === b.feature && a.progression === b.progression && a.acquiredClassLevel === b.acquiredClassLevel && JSON.stringify(a.parameters) === JSON.stringify(b.parameters);
  const remap = (value: string): string => {
    if (value.startsWith('pool/feature/')) {
      const parts = value.split('/');
      parts[2] = encodeURIComponent(remap(decodeURIComponent(parts[2])));
      return parts.join('/');
    }
    const match = [...paths.keys()].sort((a, b) => b.length - a.length).find((path) => value === path || value.startsWith(path + '/'));
    return match ? paths.get(match)! + value.slice(match.length) : value;
  };
  for (let pass = 0; pass <= oldInstances.length; pass++) {
    const instances = after.evaluate(updated).instances;
    let changed = false;
    for (const old of oldInstances) {
      if (instances.some((instance) => instance.id === old.id) || paths.has(old.id)) continue;
      const matches = instances.filter((instance) => same(old, instance));
      if (matches.length === 1 && oldInstances.filter((instance) => same(old, instance)).length === 1) {
        paths.set(old.id, matches[0].id);
        changed = true;
      }
    }
    // A direct class choice can also become a choice inside a newly nested
    // Feature (for example, an extra fighting style belonging to a subclass).
    for (const progression of character.progressions) {
      const cls = before.catalogue.classes.find((c) => c.id === progression.class);
      for (const [level, entries] of Object.entries(cls?.levels ?? {})) for (const entry of entries) {
        if (entry.kind !== 'chooseFeatures') continue;
        const oldPath = classEntryPath(progression.id, Number(level), entry.id);
        if (!character.selections[oldPath] || paths.has(oldPath)) continue;
        const candidates = instances.filter((instance) => instance.progression === progression.id && instance.acquiredClassLevel === Number(level)).flatMap((instance) => after.getFeature(instance.feature)?.components.filter((component) => component.kind === 'chooseFeatures' && component.id === entry.id && JSON.stringify(component.candidates) === JSON.stringify(entry.candidates)).map((component) => selectionPath(instance.id, component.id)) ?? []);
        if (candidates.length === 1) {
          paths.set(oldPath, candidates[0]);
          changed = true;
        }
      }
    }
    if (!changed) break;
    const selections: Character['selections'] = { ...retainedSelections };
    for (const [path, picks] of Object.entries(character.selections)) {
      const target = remap(path);
      if (selections[target]) throw new Error('System migration found conflicting saved selections.');
      selections[target] = picks;
    }
    updated.selections = selections;
  }
  if (!paths.size) return updated;
  if (Object.keys(character.pending).length) throw new Error('Finish pending ability uses before reloading a System with moved Features.');
  updated.bindings = Object.fromEntries(Object.entries(updated.bindings).map(([key, value]) => [remap(key), remap(value)]));
  const remapGrant = (token: string) => {
    try {
      const value: unknown = JSON.parse(token);
      if (Array.isArray(value) && value.length === 2 && value.every((part) => typeof part === 'string')) return JSON.stringify([remap(value[0]), value[1]]);
    } catch { /* Preserve unknown legacy tokens without granting them again. */ }
    return token;
  };
  updated.resources = Object.fromEntries(Object.entries(updated.resources).map(([key, value]) => [remap(key), { ...value, ...(value.grants ? { grants: value.grants.map(remapGrant) } : {}) }]));
  updated.rollResults = updated.rollResults?.map((roll) => ({ ...roll, instance: remap(roll.instance), ...(roll.casting ? { casting: { ...roll.casting, capability: remap(roll.casting.capability) } } : {}) }));
  updated.equipmentAssignments = updated.equipmentAssignments?.map((assignment) => ({ ...assignment, instance: remap(assignment.instance) }));
  updated.deployedCompanions = updated.deployedCompanions?.map(remap);
  updated.companionModes = updated.companionModes && Object.fromEntries(Object.entries(updated.companionModes).map(([key, value]) => [remap(key), value]));
  return updated;
}
