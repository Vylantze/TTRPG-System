/** System-authored sheet presentation; resource behavior lives in healthRules. */
export interface SheetDisplay {
  overview?: { stat: string; name?: string; signed?: boolean; unit?: string; roll?: { dice: string; bonusStat?: string } }[];
  health?: { name?: string; showHealingFeatures?: boolean; showDeathSavesAtZero?: boolean; counters?: string[] };
  resources?: { compact?: boolean; showDetailsByDefault?: boolean };
  inventory?: { search?: boolean; categoryFilter?: boolean };
  restPreview?: boolean;
  rollHistory?: boolean;
  showAllStats?: boolean;
  detailsDrawer?: boolean;
  sidebarCollapsed?: boolean;
  actions?: { categories?: { id: string; name: string; kinds: string[] }[]; itemCategories?: string[]; columns?: { name: string; metadataKey: string }[] };
  statuses?: { name: string; tags: string[] }[];
  spells?: { search?: boolean; levelFilter?: boolean; compact?: boolean; columns?: { name: string; metadataKey: string }[]; castingStats?: { ability: string; attackStat: string; saveStat: string }[] };
}
