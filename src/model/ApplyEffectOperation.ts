import type { Value } from '@/src/model/Value.js';

export interface ApplyEffectOperation {
  kind: 'applyEffect';
  feature: string;
  parameters?: Record<string, Value>;
}
