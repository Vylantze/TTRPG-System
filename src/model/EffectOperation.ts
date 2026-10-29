import type { ApplyEffectOperation } from '@/src/model/ApplyEffectOperation.js';
import type { RemoveEffectsOperation } from '@/src/model/RemoveEffectsOperation.js';

export type EffectOperation = ApplyEffectOperation | RemoveEffectsOperation;
