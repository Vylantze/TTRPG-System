import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Engine, getCurrency, moneyTotal, setMoney, convertCurrencyItems, useAbility, deserializeCharacter } from '@/dist/index.js';
import { createDnd2024Engine } from '@/dist/systems/dnd5e-2024/index.js';

const engine = createDnd2024Engine();
const fighter = JSON.parse(readFileSync(new URL('../src/systems/dnd5e-2024/starter-characters.json', import.meta.url), 'utf8')).data.find((character) => character.name === 'Brakka Stonewatch');

test('five coin balances retain quantities, total correctly and survive saves', () => {
  const money = { cp: 3, sp: 2, ep: 1, gp: 4, pp: 2 };
  const changed = setMoney(engine, fighter, money, 'coins');
  assert.equal(moneyTotal(changed, engine.catalogue.system), 24.73);
  assert.deepEqual(changed.money, money);
  assert.deepEqual(deserializeCharacter(JSON.stringify(changed), engine).money, money);
  assert.deepEqual(setMoney(engine, changed, money, 'coins'), changed);
  assert.throws(() => setMoney(engine, changed, { gp: 0 }, 'coins'), /reused/);
  // Fighter option A (4 GP) plus Soldier option A (14 GP).
  assert.equal(fighter.money.gp, 18);
  assert(!fighter.inventory.some((entry) => entry.item.endsWith('gold-piece')));
});

test('money rejects fractional coins, unknown units, negative and overflowing balances', () => {
  for (const money of [{ gp: -1 }, { gp: 0.5 }, { dollars: 1 }, { gp: Infinity }, { pp: Number.MAX_SAFE_INTEGER }]) assert.throws(() => setMoney(engine, fighter, money, 'bad'));
  assert.throws(() => setMoney(engine, { ...fighter, system: { id: 'other', revision: 1 } }, { gp: 1 }, 'wrong'), /mismatch/);
  assert.throws(() => deserializeCharacter(JSON.stringify({ ...fighter, money: { gp: 0.2 } }), engine));
});

test('Systems without currency use one decimal balance and invalid currency schemas fail', () => {
  const catalogue = structuredClone(engine.catalogue);
  delete catalogue.system.currency;
  const generic = new Engine(catalogue);
  assert.equal(getCurrency(generic.catalogue.system).denominations.length, 1);
  const changed = setMoney(generic, { ...fighter, money: undefined }, { unit: 12.34 }, 'balance');
  assert.equal(moneyTotal(changed, generic.catalogue.system), 12.34);
  assert.throws(() => setMoney(generic, changed, { unit: 1.234 }, 'fraction'));
  for (const mutate of [(currency) => currency.denominations.push(currency.denominations[0]), (currency) => currency.primary = 'missing', (currency) => currency.denominations[0].value = 0, (currency) => currency.decimalPlaces = 7]) {
    const invalid = structuredClone(engine.catalogue);
    mutate(invalid.system.currency);
    assert.throws(() => new Engine(invalid));
  }
});

test('legacy coin migration is idempotent and preserves existing money and equipment', () => {
  // A System can name the items that older saves used for coins.
  const system = structuredClone(engine.catalogue.system);
  system.currency.denominations.find((coin) => coin.id === 'gp').legacyItemIds = ['legacy:item.gold-piece'];
  const old = { ...fighter, money: { sp: 2 }, inventory: [...fighter.inventory, { id: 'coins', item: 'legacy:item.gold-piece', quantity: 25, equipped: false }] };
  const changed = convertCurrencyItems(old, system);
  assert.deepEqual(changed.money, { sp: 2, gp: 25 });
  assert.deepEqual(changed.inventory, fighter.inventory);
  assert.equal(convertCurrencyItems(changed, system), changed);
});

test('manual action timing still enforces ability ownership and resource costs', () => {
  const result = engine.evaluate(fighter);
  const ability = result.capabilities.find((entry) => entry.definition.name === 'Second Wind');
  assert(ability);
  assert.throws(() => useAbility(engine, fighter, ability.id, 'budget-required'), /actions/);
  const used = useAbility(engine, fighter, ability.id, 'use', { actionTracking: 'manual' });
  assert.equal(used.actions, undefined);
  // Two uses at Fighter level 1 in 2024.
  assert.equal(Object.values(engine.evaluate(used.character).resources).find((pool) => pool.key === 'second-wind').current, 1);
  const emptied = useAbility(engine, used.character, ability.id, 'use-again', { actionTracking: 'manual' }).character;
  assert.throws(() => useAbility(engine, emptied, ability.id, 'empty', { actionTracking: 'manual' }), /Insufficient/);
  assert.throws(() => useAbility(engine, fighter, 'unowned', 'unknown', { actionTracking: 'manual' }), /unavailable/);
  assert.throws(() => useAbility(engine, fighter, ability.id, 'ambiguous', { actionTracking: 'manual', actions: {} }), /cannot include/);
});
