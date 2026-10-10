import type { Character, Catalogue, Instance, Value } from '@/src/model.js';
import type { EquipmentAssignment } from '@/src/model/EquipmentAssignment.js';
import type { Engine } from '@/src/engine.js';
import { itemProperties, itemFeatures } from '@/src/items.js';
import type { EquipmentEffect } from '@/src/model/EquipmentEffect.js';
import { RuleError } from '@/src/expression.js';
import { useAbility } from '@/src/commands.js';
const companionModes = new WeakMap<Catalogue, string[]>();
const emptyContexts = new WeakMap<Catalogue, Record<string, Value>>();
export function requiresEquipmentAttunement(effect: EquipmentEffect, instance: Instance): boolean {
  return !!effect.attunement || (!!effect.attunementParameter && instance.parameters[effect.attunementParameter] === true);
}
function effectFeatures(catalogue: Catalogue, effect: EquipmentEffect) {
  return itemFeatures({ ...catalogue, items: [{ id: '__effect', revision: 1, name: 'Effect', category: 'Effect', features: effect.itemFeatures ?? [] }] }, '__effect');
}

/** Display item-exclusive output properties without granting character Features. */
export function infusedItemProperties(character: Character, catalogue: Catalogue, inventoryId: string, instances: Instance[]): Record<string, Value> {
  const assignment = character.equipmentAssignments?.find((entry) => entry.inventory === inventoryId);
  const featureId = assignment && instances.find((instance) => instance.id === assignment.instance && instance.active && instance.eligible)?.feature;
  const effect = catalogue.features.find((feature) => feature.id === featureId)?.equipmentEffect;
  return Object.assign({}, ...(effect ? effectFeatures(catalogue, effect) : []).map((feature) => feature.properties ?? {}));
}

export function checkEquipmentState(character: Character): void {
  const assignments = character.equipmentAssignments ?? [];
  if (!Array.isArray(assignments) || assignments.length > 1000 || new Set(assignments.map((entry) => entry?.instance)).size !== assignments.length) throw new RuleError('EQUIPMENT_EFFECT', 'Invalid or duplicate assignments.');
  for (const entry of assignments) if (!entry || typeof entry.instance !== 'string' || !entry.instance || typeof entry.attuned !== 'boolean' || (entry.inventory !== undefined ? typeof entry.inventory !== 'string' || !entry.inventory || entry.recipient !== undefined || entry.item !== undefined : typeof entry.recipient !== 'string' || !entry.recipient.trim() || typeof entry.item !== 'string' || !entry.item)) throw new RuleError('EQUIPMENT_EFFECT', 'Choose an inventory item or an external recipient and item template.');
  const deployed = character.deployedCompanions ?? [];
  if (character.companionModes !== undefined && (!character.companionModes || typeof character.companionModes !== 'object' || Array.isArray(character.companionModes) || Object.values(character.companionModes).some((mode) => typeof mode !== 'string'))) throw new RuleError('COMPANION', 'Invalid companion modes.');
  if (!Array.isArray(deployed) || deployed.length > 100 || deployed.some((id) => typeof id !== 'string' || !id) || new Set(deployed).size !== deployed.length) throw new RuleError('COMPANION', 'Invalid deployed companions.');
}

export function equipmentContext(character: Character, instance?: Instance, catalogue?: Catalogue): Record<string, Value> {
  if (catalogue && !character.equipmentAssignments?.length && !character.deployedCompanions?.length && !character.inventory?.some((entry) => entry.attuned)) {
    let empty = emptyContexts.get(catalogue);
    if (!empty) {
      empty = { attunedItemCount: 0, equipmentAssigned: false, equipmentEquipped: false, equipmentAttuned: false, equipmentUserAttuned: false, companionDeployed: false, ...Object.fromEntries(catalogue.features.flatMap((feature) => feature.companion?.modes ?? []).map((name) => [`companionMode.${name}`, false])) };
      emptyContexts.set(catalogue, empty);
    }
    return empty;
  }
  const assignment = character.equipmentAssignments?.find((entry) => instance?.id === entry.instance || instance?.id.startsWith(`${entry.instance}/`));
  const equipped = !!assignment?.inventory && !!character.inventory?.some((entry) => entry.id === assignment.inventory && entry.equipped);
  const mode = Object.entries(character.companionModes ?? {}).find(([id]) => instance?.id === id || instance?.id.startsWith(`${id}/`))?.[1];
  let names = catalogue && companionModes.get(catalogue);
  if (catalogue && !names) {
    names = [...new Set(catalogue.features.flatMap((feature) => feature.companion?.modes ?? []))];
    companionModes.set(catalogue, names);
  }
  const modes = Object.fromEntries((names ?? []).map((name) => [`companionMode.${name}`, name === mode]));
  const attunedItems = new Set([...(character.equipmentAssignments ?? []).filter((entry) => entry.inventory && entry.attuned).map((entry) => entry.inventory), ...(character.inventory ?? []).filter((entry) => entry.attuned).map((entry) => entry.id)]);
  return { ...modes, attunedItemCount: attunedItems.size, equipmentAssigned: !!assignment, equipmentEquipped: equipped, equipmentAttuned: equipped && !!assignment?.attuned, equipmentUserAttuned: !!assignment?.attuned,
    companionDeployed: !!character.deployedCompanions?.some((id) => instance?.id === id || instance?.id.startsWith(`${id}/`)) };
}

export function equipmentModifiers(character: Character, catalogue: Catalogue, instances: Instance[]) {
  return (character.equipmentAssignments ?? []).flatMap((assignment) => {
    const instance = instances.find((entry) => entry.id === assignment.instance && entry.active && entry.eligible);
    const effect = instance && catalogue.features.find((feature) => feature.id === instance.feature)?.equipmentEffect;
    if (!instance || !effect || !assignment.inventory || !character.inventory?.some((entry) => entry.id === assignment.inventory && entry.equipped) || (requiresEquipmentAttunement(effect, instance) && !assignment.attuned)) return [];
    return effectFeatures(catalogue, effect).map((feature) => ({ instance, components: feature.modifiers ?? [] }));
  });
}

export function validateEquipment(character: Character, catalogue: Catalogue, instances: Instance[], stat: (id: string) => number): void {
  checkEquipmentState(character);
  const occupied = new Set<string>(), groups = new Map<string, number>(), bonusItems = new Map<string, number>();
  const attunedKinds = new Set<string>();
  const uniqueAttunement = (key: string) => {
    if (catalogue.system.equipmentRules?.preventDuplicateAttunement && attunedKinds.has(key)) throw new RuleError('EQUIPMENT_EFFECT', 'Cannot attune to multiple copies of the same item.');
    attunedKinds.add(key);
  };
  for (const entry of character.inventory ?? []) if (entry.attuned) uniqueAttunement(entry.item);
  let attuned = (character.inventory ?? []).filter((entry) => entry.attuned).length;
  for (const assignment of character.equipmentAssignments ?? []) {
    const instance = instances.find((entry) => entry.id === assignment.instance && entry.active && entry.eligible);
    const effect = instance && catalogue.features.find((feature) => feature.id === instance.feature)?.equipmentEffect;
    if (!effect) throw new RuleError('EQUIPMENT_EFFECT', 'An assigned item requires an active learned technique.');
    if (assignment.attuned && !requiresEquipmentAttunement(effect, instance!)) throw new RuleError('EQUIPMENT_EFFECT', 'This infusion does not permit attunement.');
    const entry = character.inventory?.find((value) => value.id === assignment.inventory);
    const item = catalogue.items?.find((value) => value.id === (assignment.inventory ? entry?.item : assignment.item));
    if (!item || !effect.categories.includes(item.category) || (effect.requiredProperties ?? []).some((key) => !itemProperties(catalogue, item.id)[key])) throw new RuleError('EQUIPMENT_EFFECT', 'This item is incompatible with the technique.');
    if (itemProperties(catalogue, item.id).magical) throw new RuleError('EQUIPMENT_EFFECT', 'This technique requires a nonmagical item.');
    if (assignment.inventory) {
      if (occupied.has(assignment.inventory) || entry?.quantity !== 1) throw new RuleError('EQUIPMENT_EFFECT', 'Assign one technique to an individual item, not a stack.');
      occupied.add(assignment.inventory);
      if (assignment.attuned && !entry.attuned) {
        attuned++;
        uniqueAttunement(JSON.stringify([effect.itemFeatures, instance!.parameters]));
      }
    } else {
      const identity = JSON.stringify([assignment.recipient, assignment.item]);
      if (occupied.has(identity)) throw new RuleError('EQUIPMENT_EFFECT', 'This external item already has an infusion.');
      occupied.add(identity);
    }
    const count = (groups.get(effect.group) ?? 0) + 1;
    groups.set(effect.group, count);
    const eligible = !!effect.bonusCapacity && !!itemProperties(catalogue, item.id)[effect.bonusCapacity.itemProperty];
    const bonusCount = (bonusItems.get(effect.group) ?? 0) + Number(eligible);
    bonusItems.set(effect.group, bonusCount);
    const bonus = effect.bonusCapacity ? Math.min(stat(effect.bonusCapacity.stat), bonusCount) : 0;
    if (count > stat(effect.capacityStat) + bonus) throw new RuleError('EQUIPMENT_EFFECT', 'Too many active item effects. Remove an assignment first.');
  }
  const limit = catalogue.system.equipmentRules?.attunementLimitStat ? stat(catalogue.system.equipmentRules.attunementLimitStat) : Infinity;
  if (attuned > limit) throw new RuleError('EQUIPMENT_EFFECT', 'Too many attuned infused items.');
  for (const id of character.deployedCompanions ?? []) {
    const instance = instances.find((entry) => entry.id === id && entry.active && entry.eligible);
    const feature = instance && catalogue.features.find((entry) => entry.id === instance.feature);
    if (!feature?.companion || (feature.equipmentEffect && !character.equipmentAssignments?.some((entry) => entry.instance === id))) throw new RuleError('COMPANION', 'A deployed companion requires its active Feature and any required infusion assignment.');
    if (feature.companion.modes && !feature.companion.modes.includes(character.companionModes?.[id] ?? '')) throw new RuleError('COMPANION', 'Choose a valid companion mode.');
  }
}

/** Reassignment does not reset charges or create new resource identities. */
export function assignEquipment(engine: Engine, character: Character, instance: string, assignment?: Omit<EquipmentAssignment, 'instance'>): Character {
  const next = structuredClone(character);
  next.equipmentAssignments = (next.equipmentAssignments ?? []).filter((entry) => entry.instance !== instance);
  if (assignment) next.equipmentAssignments.push({ ...assignment, instance });
  else next.deployedCompanions = next.deployedCompanions?.filter((id) => id !== instance && !id.startsWith(`${instance}/`));
  checkEquipmentState(next);
  if (!assignment) return next;
  const problem = engine.evaluate(next).diagnostics.find((entry) => ['EQUIPMENT_EFFECT', 'INVENTORY', 'SCHEMA', 'REVISION'].includes(entry.code));
  if (problem) throw new RuleError(problem.code, problem.message);
  return next;
}

export function deployCompanion(engine: Engine, character: Character, instanceId: string, deployed: boolean, eventId: string, capabilityId?: string, mode?: string): Character {
  checkEquipmentState(character);
  if (!deployed) return { ...character, deployedCompanions: character.deployedCompanions?.filter((id) => id !== instanceId) ?? [] };
  const result = engine.evaluate(character);
  const instance = result.instances.find((entry) => entry.id === instanceId && entry.active && entry.eligible);
  const companion = instance && engine.getFeature(instance.feature)?.companion;
  if (!companion) throw new RuleError('COMPANION', 'Companion Feature is unavailable.');
  if (engine.getFeature(instance!.feature)?.equipmentEffect && !character.equipmentAssignments?.some((entry) => entry.instance === instanceId) && deployed) throw new RuleError('COMPANION', 'Assign this infusion before creating its companion.');
  let next = structuredClone(character);
  const creating = deployed && !character.deployedCompanions?.includes(instanceId);
  if (creating) {
    if (!eventId || character.events.some((event) => event.id === eventId)) throw new RuleError('COMPANION', 'Creation event was already used or is missing.');
    if (companion.modes) {
      const selected = mode ?? companion.modes[0];
      if (!companion.modes.includes(selected)) throw new RuleError('COMPANION', 'Unknown companion mode.');
      next.companionModes = { ...next.companionModes, [instanceId]: selected };
    }
    if (character.buildState === 'draft' || result.status !== 'valid') throw new RuleError('COMPANION', 'Finalize a valid character first.');
    if (companion.creationCapability) {
      const capability = result.capabilities.find((entry) => entry.source === instanceId && entry.definition.name.startsWith(companion.creationCapability!) && (!capabilityId || entry.id === capabilityId));
      if (!capability) throw new RuleError('COMPANION', 'Choose an available creation method.');
      const use = useAbility(engine, next, capability.id, eventId, { actionTracking: 'manual' });
      if (use.pending) throw new RuleError('COMPANION', 'Creation requires an immediately spent use.');
      next = use.character;
    } else {
      next.events.push({ id: eventId, fingerprint: JSON.stringify({ kind: 'createCompanion', instanceId, mode }) });
    }
  }
  next.deployedCompanions = [...(next.deployedCompanions ?? []).filter((id) => id !== instanceId), ...(deployed ? [instanceId] : [])];
  if (creating && companion.resetOnCreation?.length) for (const pool of Object.values(engine.evaluate(next).resources)) {
    if (!companion.resetOnCreation.includes(pool.key) || !Number.isFinite(pool.capacity)) continue;
    next.resources[pool.id] = { spent: 0, ...(pool.tracking ? { current: pool.capacity, grants: pool.grants } : {}) };
  }
  return next;
}
