/** Feature-owned creature/object presentation; numeric rules remain ordinary stats and resources. */
export interface CompanionDisplay {
  kind: 'creature' | 'object';
  stats: string[];
  resources: string[];
  creationCapability?: string;
  modes?: string[];
  resetOnCreation?: string[];
}
