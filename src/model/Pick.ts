import type { Value } from './Value.js';

export interface Pick { id: string; feature: string; parameters?: Record<string, Value> }
