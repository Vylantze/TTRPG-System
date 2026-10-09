import type { CurrencyDenomination } from '@/src/model/CurrencyDenomination.js';

export interface CurrencyDefinition {
  name: string;
  denominations: CurrencyDenomination[];
  primary: string;
  /** Decimal places allowed in each denomination's quantity; zero for coins. */
  decimalPlaces: number;
}
