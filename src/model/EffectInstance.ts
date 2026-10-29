import type { Value } from '@/src/model/Value.js';
import type { EffectDuration } from '@/src/model/EffectDuration.js';
import type { EffectSource } from '@/src/model/EffectSource.js';

export interface EffectInstance {
  id: string;
  feature: string;
  revision: number;
  source: EffectSource;
  parameters?: Record<string, Value>;
  remaining?: EffectDuration;
}
