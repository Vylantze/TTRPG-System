import type { Ability } from '../core.ts';

/** How a class casts: ability, caster type, cantrip and prepared-spell counts. */
export interface SpellcastingSpec {
  ability: Ability;
  caster: 'full' | 'half' | 'pact';
  /** Cantrips known, as [class level, count] thresholds. */
  cantrips?: [number, number][];
  /** Prepared spells at class levels 1–20. */
  prepared: number[];
  /** Prepared spells change after a Long Rest (Cleric, Druid, Paladin, Wizard) or on gaining a level. */
  changes: 'long-rest' | 'level';
  level?: number;
  name?: string;
}
