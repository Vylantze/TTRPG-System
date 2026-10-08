import type { Diagnostic } from './Diagnostic.js';
import type { EvaluationResult } from './EvaluationResult.js';

export interface Candidate { feature: string; status: EvaluationResult['status']; waived: boolean; diagnostics: Diagnostic[] }
