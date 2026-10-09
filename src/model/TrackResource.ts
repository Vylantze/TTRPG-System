import type { ComponentBase } from './ComponentBase.js';
import type { Expression } from './Expression.js';

export interface TrackResource extends ComponentBase {
  kind: 'trackResource'; key: string; name: string; units: string; contract?: string;
  minimum?: number; maximum?: Expression; initialAmount: Expression; integer?: boolean;
  recovery: { event: string; amount: Expression | 'full' }[];
}
