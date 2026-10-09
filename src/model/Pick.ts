import type { Value } from '@/src/model/Value.js';

export interface Pick { id: string; feature: string; parameters?: Record<string, Value> }
