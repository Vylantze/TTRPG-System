import type { Scope } from './Scope.js';

export interface ResourceRequirement { id: string; key: string; scope?: Scope; units?: string; contract?: string; minimumCapacity?: number }
