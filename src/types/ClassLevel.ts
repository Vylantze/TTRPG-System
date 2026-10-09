import type { Choice, Grant } from '@/src/model.js';

export interface ClassLevel { level: number; entries: (Grant | Choice)[] }
