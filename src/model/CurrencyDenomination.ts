export interface CurrencyDenomination {
  id: string;
  name: string;
  symbol: string;
  /** Value relative to the smallest unit. */
  value: number;
  legacyItemIds?: string[];
}
