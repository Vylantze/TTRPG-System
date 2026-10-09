import type { Catalogue, Character, Instance, Modifier, Value } from '@/src/model.js';
import type { ItemFeature } from '@/src/model/ItemFeature.js';
import { RuleError } from '@/src/expression.js';

export function itemFeatures(catalogue: Catalogue, itemId: string): ItemFeature[] {
  const item = catalogue.items?.find((candidate) => candidate.id === itemId);
  if (!item) throw new RuleError('INVENTORY', `Unknown item ${itemId}.`);
  const result = new Map<string, ItemFeature>(), visiting = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw new RuleError('ITEM_CYCLE', `Item Feature cycle at ${id}.`);
    if (result.has(id)) return;
    const feature = catalogue.itemFeatures?.find((candidate) => candidate.id === id);
    if (!feature) throw new RuleError('ITEM_FEATURE', `Unknown item Feature ${id}.`);
    visiting.add(id);
    feature.features?.forEach(visit);
    visiting.delete(id);
    result.set(id, feature);
  };
  item.features.forEach(visit);
  return [...result.values()];
}

export function itemProperties(catalogue: Catalogue, itemId: string): Record<string, Value> {
  return Object.assign({}, ...itemFeatures(catalogue, itemId).map((feature) => feature.properties ?? {}));
}

export function checkInventory(character: Character, catalogue?: Catalogue): void {
  if (character.inventory === undefined) return;
  if (!Array.isArray(character.inventory) || character.inventory.length > 10000) throw new RuleError('INVENTORY', 'Inventory must be a bounded list.');
  const ids = new Set<string>(), slots = new Set<string>();
  for (const entry of character.inventory) {
    if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) || typeof entry.item !== 'string' || !entry.item || !Number.isSafeInteger(entry.quantity) || entry.quantity < 1 || typeof entry.equipped !== 'boolean') throw new RuleError('INVENTORY', 'Invalid or duplicate inventory entry.');
    ids.add(entry.id);
    if (!catalogue) continue;
    const item = catalogue.items?.find((candidate) => candidate.id === entry.item);
    if (!item) throw new RuleError('INVENTORY', `Unknown item ${entry.item}.`);
    if (entry.equipped && item.slot) {
      if (slots.has(item.slot)) throw new RuleError('INVENTORY', `Only one equipped item may occupy ${item.slot}.`);
      slots.add(item.slot);
    }
  }
}

/** Item effects share stat arithmetic, but never become acquired character Features. */
export function inventoryModifiers(character: Character, catalogue: Catalogue): { instance: Instance; components: Modifier[] }[] {
  checkInventory(character, catalogue);
  return (character.inventory ?? []).filter((entry) => entry.equipped).flatMap((entry) => itemFeatures(catalogue, entry.item).map((feature) => ({
    instance: { id: `item/${encodeURIComponent(entry.id)}/${encodeURIComponent(feature.id)}`, feature: '', parameters: {}, acquiredCharacterLevel: 0, acquiredClassLevel: 0, active: true, eligible: true, waived: false },
    components: feature.modifiers ?? [],
  })));
}
