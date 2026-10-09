import type { ComponentBase } from '@/src/model/ComponentBase.js';
import type { StatDefinition } from '@/src/model/StatDefinition.js';

export interface DefineStat extends ComponentBase {
  kind: 'defineStat';
  stat: Extract<StatDefinition, { kind: 'derived' }>;
}
