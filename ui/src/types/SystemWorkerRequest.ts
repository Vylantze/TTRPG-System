export interface SystemWorkerRequest {
  id: number;
  kind: 'validate' | 'package';
  input: unknown;
  documents?: Record<string, unknown>;
  urls?: Record<string, string>;
}
