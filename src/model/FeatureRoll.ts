/** One authored roll; optional ability or spell costs and recovery effects are explicit. */
export interface FeatureRoll {
  id: string;
  label: string;
  /** Fixed notation or evaluated named stats, for scaling resource dice. */
  dice: string | { count: number | { stat: string }; sides: number | { stat: string } };
  bonus?: number | { stat: string } | { class: string } | { castingAbility: true };
  /** Replace the base dice count at character-level thresholds. */
  characterScaling?: { level: number; count: number }[];
  /** Add dice when the selected casting slot exceeds the authored base level. */
  slotScaling?: { baseLevel: number; dicePerLevel: number };
  capability?: string;
  /** Canonical spell whose evaluated casting mode must pay for this roll. */
  spell?: string;
  restoreResource?: string;
}
