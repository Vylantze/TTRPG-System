import { createContext } from 'react';
import type { Character, EvaluationResult } from '@/src/index';

export const CharacterRuleContext = createContext<{ character: Character; result: EvaluationResult; update: (character: Character) => void; report: (message: string) => void } | undefined>(undefined);
