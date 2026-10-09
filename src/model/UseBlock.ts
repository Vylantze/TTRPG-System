import type { Value } from './Value.js';

export interface UseBlock {
  condition?: never;
  kind: 'useBlock'; id: string; block: string; arguments?: Record<string, Value>;
}
