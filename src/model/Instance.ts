import type { Value } from './Value.js';

export interface Instance {
  id: string; feature: string; parent?: string; progression?: string;
  parameters: Record<string, Value>; acquiredCharacterLevel: number; acquiredClassLevel: number;
  acquiredEvent?: number;
  active: boolean; eligible: boolean; waived: boolean; selection?: string;
}
