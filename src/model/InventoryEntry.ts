export interface InventoryEntry {
  id: string;
  item: string;
  quantity: number;
  equipped: boolean;
  /** Ordinary magic items; infused items use their assignment's attunement state. */
  attuned?: boolean;
}
