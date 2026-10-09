import type { Progression } from '@/src/model/Progression.js';
import type { Pick } from '@/src/model/Pick.js';
import type { RootAcquisition } from '@/src/model/RootAcquisition.js';

export type Edit = { kind: 'input'; stat: string; value: number }
  | { kind: 'removeProgression'; progression: string }
  | { kind: 'addProgression'; progression: Progression }
  | { kind: 'select'; selection: string; picks: Pick[]; event?: string }
  | { kind: 'level'; progression: string; level: number }
  | { kind: 'root'; acquisition: RootAcquisition } | { kind: 'removeRoot'; id: string }
  | { kind: 'alternative'; stat: string; alternative: string } | { kind: 'bind'; requirement: string; pool: string };
