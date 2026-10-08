import type { Progression } from './Progression.js';
import type { Pick } from './Pick.js';
import type { RootAcquisition } from './RootAcquisition.js';
import type { PendingUse } from './PendingUse.js';

export interface Character {
  /** Omitted on older saves: normal retraining rules apply. Construction drafts cannot spend resources. */
  buildState?: 'draft' | 'finalized';
  version: 1; id: string; name: string; system: { id: string; revision: number };
  catalogue: { id: string; revision: number }; contentRevisions: Record<string, number>;
  inputs: Record<string, number>; progressions: Progression[];
  history: { progression: string; level: number }[]; roots: RootAcquisition[];
  selections: Record<string, Pick[]>; bindings: Record<string, string>;
  alternatives: Record<string, string>; resources: Record<string, { spent: number }>;
  pending: Record<string, PendingUse>; events: { id: string; fingerprint: string; actions?: Record<string, number> }[];
}
