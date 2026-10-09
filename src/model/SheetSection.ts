/** Declarative presentation; no System-specific rendering code is required. */
export interface SheetSection {
  id: string;
  name: string;
  layout: 'abilities' | 'skills' | 'stats';
  rows: { stat: string; name?: string; secondaryStat?: string; proficiencyStat?: string; ability?: string; feature?: string }[];
}
