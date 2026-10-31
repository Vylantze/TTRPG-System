import type { FeatureDefinition } from '@/src/model.js';

/** Build context for one class. */
export interface Ctx {
  /** Class ID slug, e.g. "fighter". */
  key: string;
  name: string;
  pages: [number, number];
  /** Features the class definition needs beyond its own entries (pools, rolls). */
  extra: FeatureDefinition[];
}
