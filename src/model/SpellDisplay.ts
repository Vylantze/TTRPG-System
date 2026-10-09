import type { Scope } from '@/src/model/Scope.js';

export interface SpellDisplay {
  spellKey: string;
  levelKey: string;
  slotLevelKey: string;
  ritualKey: string;
  castingAbilityKey: string;
  slots: { level?: number; levelStat?: string; key: string; scope: Scope }[];
}
