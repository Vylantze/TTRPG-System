import type { SystemFile, Character } from '../../../src/index';

export interface Workspace { version: 1; systems: SystemFile[]; characters: Character[]; active?: string }
