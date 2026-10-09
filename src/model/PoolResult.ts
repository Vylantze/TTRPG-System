import type { Scope } from './Scope.js';
import type { Resource } from './Resource.js';

export interface PoolResult { id: string; key: string; scope: Scope; units: string; contract?: string; integer: boolean; capacity: number; spent: number; reserved: number; available: number; providers: string[]; recovery: Resource['recovery']; initial: 'full' | 'empty'; tracking?: boolean; name?: string; minimum?: number; current?: number; grants?: string[] }
