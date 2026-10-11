import type { Workspace } from '@/ui/src/types/Workspace';

export interface PrototypeCleanup {
  workspace: Workspace;
  removed: string[];
  rebuilt: string[];
}
