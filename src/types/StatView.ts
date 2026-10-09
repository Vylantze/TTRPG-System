import type { StatResult } from '@/src/model.js';

export interface StatView { results: Record<string, StatResult>; get: (id: string) => number }
