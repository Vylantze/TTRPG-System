import type { Catalogue, Value } from '@/src/model.js';

export interface SystemFile {
  format: 'ttrpg-system'; version: 1; id: string; revision: number;
  options: Record<string, { default: Value; values: Value[] }>;
  features: Catalogue['features'];
  blocks?: Catalogue['blocks'];
  items?: Catalogue['items'];
  itemFeatures?: Catalogue['itemFeatures'];
  configurations: { options: Record<string, Value>; id: string; revision: number;
    system: Catalogue['system']; classes: Catalogue['classes']; }[];
}
