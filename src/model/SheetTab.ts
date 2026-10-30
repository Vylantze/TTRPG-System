/** Ordered sheet tabs. Custom tabs render any declared stat sections. */
export interface SheetTab {
  id: string;
  name: string;
  content: 'choices' | 'sheet' | 'features' | 'resources' | 'notes' | 'sections' | 'items' | 'actions' | 'spells' | 'rolls';
  sections?: string[];
  /** "rail" keeps this tab's content beside the tab panel on wide screens; narrow screens show it as a tab. */
  placement?: 'rail';
}
