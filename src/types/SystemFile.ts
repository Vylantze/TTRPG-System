import type { Catalogue, Value } from '../model.js';

export interface SystemFile {
  format: 'ttrpg-system'; version: 1; id: string; revision: number;
  options: Record<string, { default: Value; values: Value[] }>;
  features: Catalogue['features'];
  configurations: { options: Record<string, Value>; id: string; revision: number;
    system: Catalogue['system']; classes: Catalogue['classes']; }[];
}
