/** Declarative presentation; no System-specific rendering code is required. */
export interface SheetSection {
  id: string;
  name: string;
  layout: 'abilities' | 'skills' | 'stats';
  modifierFirst?: boolean;
  defaultSort?: 'Training' | 'Name' | 'Ability' | 'Bonus';
  columns?: ('Training' | 'Name' | 'Ability' | 'Bonus')[];
  columnLabels?: Partial<Record<'Training' | 'Name' | 'Ability' | 'Bonus', string>>;
  rows: { stat: string; name?: string; secondaryStat?: string; proficiencyStat?: string; ability?: string; feature?: string; roll?: { dice: string; bonusStat?: string } }[];
}
