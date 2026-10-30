import type { ReactNode } from 'react';

/** One row of a FeatureTree: a Feature, choice, chosen option, resource, use or roll. */
export interface TreeNode {
  id: string;
  /** Short source label shown as a tag (owning Class, subclass, race, or Resource/Use/Roll). */
  tag?: string;
  name: ReactNode;
  /** Plain text used for searching and the path label of deep levels. */
  label: string;
  description?: ReactNode;
  /** Muted text on the right: level gained or "N inside". */
  meta?: ReactNode;
  /** Shown instead of meta when something needs attention. */
  state?: { text: string; tone: 'error' | 'warn' | 'muted' };
  /** Lazily built so deep or very large catalogue trees cost nothing until opened. */
  children?: () => TreeNode[];
  /** Content shown on expand above the children, such as full rules text or controls. */
  detail?: () => ReactNode;
  /** A one-line row with no disclosure, such as "Spells: Bless, Cure Wounds". */
  leaf?: boolean;
  /** Dashed "Choose 1 more" style row. */
  pending?: boolean;
}
