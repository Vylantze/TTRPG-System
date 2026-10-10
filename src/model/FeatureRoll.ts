/** One authored roll; optional ability or spell costs and recovery effects are explicit. */
export interface FeatureRoll {
  id: string;
  label: string;
  /** Fixed notation or evaluated named stats, for scaling resource dice. */
  dice: string | { count: number | { stat: string }; sides: number | { stat: string } };
  bonus?: number | { stat: string } | { class: string };
  capability?: string;
  /** Canonical spell whose evaluated casting mode must pay for this roll. */
  spell?: string;
  restoreResource?: string;
}
