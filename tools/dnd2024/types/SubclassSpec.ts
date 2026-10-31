import type { ClassFeature } from './ClassFeature.ts';

/** A subclass and its features. */
export interface SubclassSpec {
  name: string;
  features: ClassFeature[];
}
