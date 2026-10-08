import type { Character } from './Character.js';
import type { EvaluationResult } from './EvaluationResult.js';

export interface EditPreview { character: Character; before: EvaluationResult; after: EvaluationResult; added: string[]; removed: string[]; changedStats: string[]; changedResources: string[] }
