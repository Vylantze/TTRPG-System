export interface ItemDefinition {
  id: string;
  revision: number;
  name: string;
  category: string;
  features: string[];
  /** Only one equipped item may occupy a named slot. */
  slot?: string;
  source?: string;
}
