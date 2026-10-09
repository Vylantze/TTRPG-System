/** One authored roll; optional ability or spell costs and recovery effects are explicit. */
export interface FeatureRoll {
  id: string;
  label: string;
  dice: string;
  bonus?: number | { stat: string } | { class: string };
  capability?: string;
  /** Canonical spell whose evaluated casting mode must pay for this roll. */
  spell?: string;
  restoreResource?: string;
}
