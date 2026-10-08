import type { Value } from './Value.js';

export interface ParameterDefinition { kind: 'number' | 'string' | 'boolean'; default?: Value; options?: Value[]; minimum?: number; maximum?: number; integer?: boolean }
