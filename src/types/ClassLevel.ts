import type { Choice, Grant } from '../model.js';

export interface ClassLevel { level: number; entries: (Grant | Choice)[] }
