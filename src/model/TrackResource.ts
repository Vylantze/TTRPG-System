import type { ComponentBase } from '@/src/model/ComponentBase.js';
import type { Expression } from '@/src/model/Expression.js';

export interface TrackResource extends ComponentBase {
  kind: 'trackResource'; key: string; name: string; units: string; contract?: string;
  minimum?: number; maximum?: Expression; initialAmount: Expression; integer?: boolean;
  recovery: { event: string; amount: Expression | 'full' }[];
}
