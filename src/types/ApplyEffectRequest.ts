import type { EffectSource } from '@/src/model/EffectSource.js';
import type { Value } from '@/src/model/Value.js';

export interface ApplyEffectRequest {
  id: string;
  feature: string;
  source: EffectSource;
  parameters?: Record<string, Value>;
}
