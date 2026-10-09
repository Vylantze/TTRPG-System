/** Ordered sheet tabs. Custom tabs render any declared stat sections. */
export interface SheetTab {
  id: string;
  name: string;
  content: 'choices' | 'sheet' | 'features' | 'resources' | 'notes' | 'sections' | 'items';
  sections?: string[];
}
