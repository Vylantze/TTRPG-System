import type { ComponentBase } from './ComponentBase.js';
import type { StatDefinition } from './StatDefinition.js';

export interface DefineStat extends ComponentBase {
  kind: 'defineStat';
  stat: Extract<StatDefinition, { kind: 'derived' }>;
}
