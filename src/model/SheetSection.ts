/** Declarative presentation; no System-specific rendering code is required. */
export interface SheetSection {
  id: string;
  name: string;
  layout: 'abilities' | 'skills' | 'stats';
  modifierFirst?: boolean;
  primaryValueLabel?: string;
  secondaryValueLabel?: string;
  primarySigned?: boolean;
  secondarySigned?: boolean;
  trainingLevels?: { minimum: number; name: string; symbol: string; trained?: boolean }[];
  defaultSort?: 'Training' | 'Name' | 'Ability' | 'Bonus';
  columns?: ('Training' | 'Name' | 'Ability' | 'Bonus')[];
  columnLabels?: Partial<Record<'Training' | 'Name' | 'Ability' | 'Bonus', string>>;
  calculationPlacement?: 'column' | 'belowValue';
  valueAlignment?: 'left' | 'right';
  rows: { stat: string; name?: string; secondaryStat?: string; proficiencyStat?: string; ability?: string; feature?: string; roll?: { dice: string; bonusStat?: string } }[];
}
