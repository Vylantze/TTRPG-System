import type { CapabilityResult } from '@/src/model/CapabilityResult.js';

export interface SpellGroup {
  id: string;
  feature: string;
  name: string;
  level: number;
  castingAbility: string;
  modes: { capability: CapabilityResult; slotLevel: number; ritual: boolean; available: boolean }[];
}
