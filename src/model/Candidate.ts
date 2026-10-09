import type { Diagnostic } from '@/src/model/Diagnostic.js';
import type { EvaluationResult } from '@/src/model/EvaluationResult.js';

export interface Candidate { feature: string; status: EvaluationResult['status']; waived: boolean; diagnostics: Diagnostic[] }
