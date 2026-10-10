export interface DatabaseSnapshot {
  version: 1;
  revision: number;
  systemKeys: string[];
  characterIds: string[];
  active?: string;
}
