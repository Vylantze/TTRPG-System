import type { StatResult } from '../model.js';

export interface StatView { results: Record<string, StatResult>; get: (id: string) => number }
