/** An explicit self-effect; arbitrary source-text rolls never infer targets or effects. */
export interface FeatureRoll {
  id: string;
  label: string;
  dice: string;
  bonus?: number | { stat: string } | { class: string };
  capability?: string;
  restoreResource?: string;
}
