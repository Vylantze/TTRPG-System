export interface ResetCondition {
  id: string;
  name: string;
  description: string;
  /** False hides the manual control; Features can still reference the condition. */
  showButton?: boolean;
}
