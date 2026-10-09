import type { Value } from '@/src/model/Value.js';
import type { ComponentBase } from '@/src/model/ComponentBase.js';

export interface Grant extends ComponentBase { kind: 'grantFeature'; feature: string; parameters?: Record<string, Value>; ignorePrerequisites?: boolean }
