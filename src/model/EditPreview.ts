import type { Character } from '@/src/model/Character.js';
import type { EvaluationResult } from '@/src/model/EvaluationResult.js';

export interface EditPreview { character: Character; before: EvaluationResult; after: EvaluationResult; added: string[]; removed: string[]; changedStats: string[]; changedResources: string[] }
