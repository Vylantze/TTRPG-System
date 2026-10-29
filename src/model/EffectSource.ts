/** Provenance only; source disappearance never implicitly removes an effect. */
export interface EffectSource {
  /** Supply exactly one of character or origin (for a shrine, item or other source). */
  character?: string;
  origin?: string;
  feature?: string;
  instance?: string;
  application: string;
}
