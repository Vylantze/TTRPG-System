/** A learned technique that creates an item effect, without turning items into Features. */
export interface EquipmentEffect {
  categories: string[];
  itemFeatures?: string[];
  attunement?: boolean;
  attunementParameter?: string;
  group: string;
  capacityStat: string;
  requiredProperties?: string[];
  bonusCapacity?: { stat: string; itemProperty: string };
}
