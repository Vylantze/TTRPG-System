import type { Modifier } from '@/src/model/Modifier.js';
import type { Value } from '@/src/model/Value.js';

/** Item-only composition. These definitions never enter character Feature selections. */
export interface ItemFeature {
  id: string;
  name: string;
  features?: string[];
  properties?: Record<string, Value>;
  /** Applied once per equipped inventory entry, regardless of stack quantity. */
  modifiers?: Modifier[];
}
