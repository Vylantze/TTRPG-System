import type { Value } from './Value.js';
import type { ComponentBase } from './ComponentBase.js';

export interface Grant extends ComponentBase { kind: 'grantFeature'; feature: string; parameters?: Record<string, Value>; ignorePrerequisites?: boolean }
