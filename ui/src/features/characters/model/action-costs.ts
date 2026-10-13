import type { Capability } from '@/src/model/Capability';

export const actionCostKind = (action: Capability['action']) =>
  action && action.amount > 0 ? action.kind : 'special';
