import type { BoundaryPolicy } from '@/src/model/BoundaryPolicy.js';

export interface ScalingTable {
  mode: 'exact' | 'threshold'; rows: { key: number; value: number }[];
  below: BoundaryPolicy; above: BoundaryPolicy; missing?: 'error' | { fallback: number };
}
