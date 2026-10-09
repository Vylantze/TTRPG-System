/** A spent roll awaiting an optional application; survives navigation and save/load. */
export interface RolledFeature {
  id: string;
  instance: string;
  feature: string;
  definition: string;
  expression: string;
  casting?: { capability: string; spell: string; slotLevel: number; ritual: boolean };
  total: number;
  breakdown: string;
  /** Undefined means not applied; zero is a completed, fully capped application. */
  applied?: number;
}
