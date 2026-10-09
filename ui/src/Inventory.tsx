import { useState } from 'react';
import { itemProperties, updateInventory, type Character, type Engine, type InventoryEntry } from '@/src/index';

export function Inventory({ engine, character, update, report }: { engine: Engine;
  character: Character;
  update: (character: Character) => void;
  report: (message: string) => void; }) {
  const [selected, setSelected] = useState('');
  const entries = character.inventory ?? [];
  const change = (inventory: InventoryEntry[]) => {
    try {
      update(updateInventory(engine, character, inventory, crypto.randomUUID()));
    } catch (error) {
      report(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <section className="panel inventory-section">
      <h2>Inventory</h2>
      <p className="muted small">
        Equipped items apply their stat modifiers. Quantities track supplies;
        owning a tool does not grant proficiency.
      </p>
      <div className="sheet-table-wrap">
        <table className="sheet-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Equipped</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const item = engine.catalogue.items?.find((candidate) => candidate.id === entry.item);
              const properties = item ? itemProperties(engine.catalogue, item.id) : {};
              return (
                <tr key={entry.id}>
                  <th scope="row">
                    <span>{item?.name ?? 'Unavailable item'}</span>
                    <small>
                      {item?.category}
                      {Object.entries(properties).map(([key, value]) => ` · ${key}: ${value}`).join('')}
                    </small>
                  </th>
                  <td>
                    <input
                      aria-label={`Quantity of ${item?.name}`}
                      type="number"
                      min="1"
                      step="1"
                      key={`${entry.id}:${entry.quantity}`}
                      defaultValue={entry.quantity}
                      onBlur={(event) => {
                        const quantity = Number(event.target.value);
                        if (Number.isSafeInteger(quantity) && quantity > 0) change(entries.map((value) => value.id === entry.id ? { ...entry, quantity } : value));
                        else event.target.value = String(entry.quantity);
                      }}
                    />
                  </td>
                  <td><input type="checkbox" aria-label={`Equip ${item?.name}`} checked={entry.equipped} onChange={(event) => change(entries.map((value) => value.id === entry.id ? { ...entry, equipped: event.target.checked } : value))} /></td>
                  <td><button className="quiet" aria-label={`Remove ${item?.name}`} onClick={() => change(entries.filter((value) => value.id !== entry.id))}>Remove</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!entries.length && <p className="muted">No items carried.</p>}
      <div className="toolbar">
        <label>
          Add item
          <select value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">Choose an item…</option>
            {engine.catalogue.items?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <button
          className="quiet"
          disabled={!selected}
          onClick={() => {
            change([...entries, { id: crypto.randomUUID(), item: selected, quantity: 1, equipped: false }]);
            setSelected('');
          }}
        >
          Add to inventory
        </button>
      </div>
    </section>
  );
}
