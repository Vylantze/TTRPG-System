import type { EffectTagFilter } from '@/src/model/EffectTagFilter.js';

export interface RemoveEffectsOperation {
  kind: 'removeEffects';
  tags: EffectTagFilter;
  maximum?: number;
  method?: string;
}
