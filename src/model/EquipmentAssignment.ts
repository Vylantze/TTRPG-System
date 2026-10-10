export interface EquipmentAssignment {
  instance: string;
  inventory?: string;
  recipient?: string;
  /** External items still use a catalogue template for compatibility checks. */
  item?: string;
  attuned: boolean;
}
