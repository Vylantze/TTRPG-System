import type { Pick } from '@/src/model/Pick.js';

export interface RootAcquisition extends Pick { acquiredCharacterLevel: number; acquiredEvent?: number }
