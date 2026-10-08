import type { BoundaryPolicy } from './BoundaryPolicy.js';

export interface ScalingTable {
  mode: 'exact' | 'threshold'; rows: { key: number; value: number }[];
  below: BoundaryPolicy; above: BoundaryPolicy; missing?: 'error' | { fallback: number };
}
