import { getCurrency, moneyTotal, setMoney, type Character, type Engine } from '@/src/index';

export function MoneySection({ engine, character, update, report }: { engine: Engine; character: Character; update: (character: Character) => void; report: (message: string) => void }) {
  const currency = getCurrency(engine.catalogue.system);
  const primary = currency.denominations.find((unit) => unit.id === currency.primary)!;
  let total: number | undefined;
  try {
    total = moneyTotal(character, engine.catalogue.system);
  } catch {
    // Invalid imported balances remain visible for repair instead of crashing the sheet.
  }
  return (
    <section className="panel money-section">
      <div className="row">
        <h2>Money</h2>
        {currency.denominations.length > 1 && total !== undefined && <strong>{`${total.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${primary.symbol} total`}</strong>}
      </div>
      <div className="money-grid">
        {currency.denominations.map((unit) => (
          <label key={unit.id}>
            {unit.name}
            <span className="money-input">
              <input
                aria-label={`${unit.name} balance`}
                key={`${character.id}:${unit.id}:${character.money?.[unit.id]}`}
                type="number"
                min="0"
                step={10 ** -currency.decimalPlaces}
                defaultValue={character.money?.[unit.id] ?? 0}
                onBlur={(event) => {
                  try {
                    if (!event.target.value.trim()) throw new Error('Enter a currency amount.');
                    if (Number(event.target.value) === (character.money?.[unit.id] ?? 0)) return;
                    update(setMoney(engine, character, { ...character.money, [unit.id]: Number(event.target.value) }, crypto.randomUUID()));
                  } catch (error) {
                    event.target.value = String(character.money?.[unit.id] ?? 0);
                    report(error instanceof Error ? error.message : String(error));
                  }
                }}
              />
              <span>{unit.symbol}</span>
            </span>
          </label>
        ))}
      </div>
      {currency.denominations.length > 1 && <p className="muted small">Coin quantities remain separate. Editing a balance does not exchange other coins.</p>}
      {total === undefined && <p className="diagnostics">This balance is invalid for the loaded currency. Repair the amounts or imported denomination IDs.</p>}
      {(character.notes?.['Starting money'] ?? character.notes?.['Original money note']) && <p>{character.notes?.['Starting money'] ?? character.notes?.['Original money note']}</p>}
    </section>
  );
}
