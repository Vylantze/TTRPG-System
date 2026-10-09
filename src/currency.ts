import type { Character, SystemDefinition } from '@/src/model.js';
import type { CurrencyDefinition } from '@/src/model/CurrencyDefinition.js';
import { RuleError } from '@/src/expression.js';

export function getCurrency(system: SystemDefinition): CurrencyDefinition {
  return system.currency ?? { name: 'Money', primary: 'unit', decimalPlaces: 2, denominations: [{ id: 'unit', name: 'Balance', symbol: '', value: 1 }] };
}

export function checkMoney(money: unknown, system?: SystemDefinition): void {
  if (money === undefined) return;
  if (!money || typeof money !== 'object' || Array.isArray(money)) throw new RuleError('MONEY', 'Money must be a denomination balance.');
  const currency = system ? getCurrency(system) : undefined;
  for (const [id, amount] of Object.entries(money)) {
    if (['__proto__', 'constructor', 'prototype'].includes(id) || !id || typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > Number.MAX_SAFE_INTEGER) throw new RuleError('MONEY', 'Currency amounts must be finite and nonnegative.');
    if (currency) {
      const scale = 10 ** currency.decimalPlaces;
      if (!currency.denominations.some((denomination) => denomination.id === id)) throw new RuleError('MONEY', `Unknown denomination ${id}.`);
      if (!Number.isSafeInteger(Math.round(amount * scale)) || Math.abs(amount * scale - Math.round(amount * scale)) > 1e-7) throw new RuleError('MONEY', `Use at most ${currency.decimalPlaces} decimal places.`);
    }
  }
}

/** Display conversion only: coin counts are never exchanged automatically. */
export function moneyTotal(character: Character, system: SystemDefinition): number {
  checkMoney(character.money, system);
  const currency = getCurrency(system);
  const total = currency.denominations.reduce((sum, denomination) => sum + (character.money?.[denomination.id] ?? 0) * denomination.value, 0);
  if (!Number.isFinite(total) || total > Number.MAX_SAFE_INTEGER) throw new RuleError('MONEY', 'Currency total exceeds the supported range.');
  return total / currency.denominations.find((denomination) => denomination.id === currency.primary)!.value;
}

/** Move old currency items once, preserving already-tracked money and other inventory. */
export function convertCurrencyItems(character: Character, system: SystemDefinition): Character {
  const currency = getCurrency(system), money = { ...character.money };
  const inventory = character.inventory?.filter((entry) => {
    const denomination = currency.denominations.find((unit) => unit.legacyItemIds?.includes(entry.item));
    if (!denomination) return true;
    money[denomination.id] = (money[denomination.id] ?? 0) + entry.quantity;
    return false;
  });
  if (inventory?.length === character.inventory?.length) return character;
  checkMoney(money, system);
  return { ...character, money, inventory };
}
