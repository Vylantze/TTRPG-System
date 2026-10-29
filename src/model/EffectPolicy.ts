import type { EffectDuration } from '@/src/model/EffectDuration.js';

/** Opt-in application policy. Owning this Feature does not create an effect. */
export interface EffectPolicy {
  tags: string[];
  duration?: EffectDuration;
  endOn?: string[];
  stacking?: { key?: string; mode: 'stack' | 'replace' | 'reject' };
  /** Omitted accepts tag-based removal; empty explicitly forbids removal methods. */
  removalMethods?: string[];
}
