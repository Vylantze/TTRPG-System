import type { RolledFeature } from '@/src/model/RolledFeature.js';
import type { Progression } from '@/src/model/Progression.js';
import type { Pick } from '@/src/model/Pick.js';
import type { RootAcquisition } from '@/src/model/RootAcquisition.js';
import type { PendingUse } from '@/src/model/PendingUse.js';
import type { InventoryEntry } from '@/src/model/InventoryEntry.js';

export interface Character {
  displayPreferences?: Record<string, boolean>;
  rollResults?: RolledFeature[];
  money?: Record<string, number>;
  inventory?: InventoryEntry[];
  /** Player-facing sheet notes, independent of calculated rules. */
  notes?: Record<string, string>;
  /** Omitted on older saves: normal retraining rules apply. Construction drafts cannot spend resources. */
  buildState?: 'draft' | 'finalized';
  version: 1; id: string; name: string; system: { id: string; revision: number };
  catalogue: { id: string; revision: number }; contentRevisions: Record<string, number>;
  inputs: Record<string, number>; progressions: Progression[];
  history: { progression: string; level: number }[]; roots: RootAcquisition[];
  selections: Record<string, Pick[]>; bindings: Record<string, string>;
  alternatives: Record<string, string>; resources: Record<string, { spent: number; current?: number; grants?: string[] }>;
  pending: Record<string, PendingUse>; events: { id: string; fingerprint: string; actions?: Record<string, number> }[];
}
