import type { Predicate } from '@/src/model.js';
import type { Ability } from '../core.ts';
import type { ClassFeature } from './ClassFeature.ts';
import type { SubclassSpec } from './SubclassSpec.ts';

/** One SRD class: core traits, multiclass subset, features and subclass. */
export interface ClassSpec {
  name: string;
  pages: [number, number];
  die: 6 | 8 | 10 | 12;
  saves: [Ability, Ability];
  skills: { count: number; from: string[] | 'any' };
  weapons: { simple?: boolean; martial?: boolean };
  armor: ('light' | 'medium' | 'heavy' | 'shield')[];
  tools?: { count: number; from: string[] | string };
  multiclass: {
    prerequisites: Predicate;
    armor: ('light' | 'medium' | 'heavy' | 'shield')[];
    martial?: boolean;
    skills?: number;
    tools?: number;
  };
  features: ClassFeature[];
  /** Ability Score Improvement levels; 19 is always the Epic Boon. */
  improvements?: number[];
  subclass: SubclassSpec;
  subclassLevels: number[];
}
