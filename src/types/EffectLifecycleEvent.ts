/** Explicit game events; source narrows expiry to a casting/application group. */
export type EffectLifecycleEvent = ({ clock: string; amount: number } | { event: string }) & {
  source?: { character?: string; origin?: string; application: string };
};
