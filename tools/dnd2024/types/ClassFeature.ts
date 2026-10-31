import type { Choice, Component, Grant, ScalingTable } from '@/src/model.js';
import type { Ctx } from './Ctx.ts';

/** One class or subclass feature, named by its SRD "Level N: Name" heading. */
export interface ClassFeature {
  level: number;
  /** The SRD heading after "Level N: ". */
  name: string;
  components?: (ctx: Ctx, owner: string) => Component[];
  tables?: Record<string, ScalingTable>;
  tags?: string[];
  summary?: string[];
  /** Level entry kind; most features are granted, a few are choices made on the class level. */
  entry?: (ctx: Ctx, owner: string) => Grant | Choice;
}
