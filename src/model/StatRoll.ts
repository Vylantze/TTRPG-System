/** A free stat check, independent of ability costs or applications. */
export interface StatRoll {
  id: string;
  stat: string;
  name: string;
  expression: string;
  total: number;
  breakdown: string;
  modifierReasons?: string;
}
