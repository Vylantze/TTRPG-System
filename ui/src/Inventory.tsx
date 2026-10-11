import { useState, useContext, useDeferredValue } from 'react';
import { CharacterRuleContext } from '@/ui/src/character-rule-context';
import { Modal } from '@/ui/src/Modal';
import { getCurrency, itemProperties, infusedItemProperties, updateInventory, type Character, type Engine, type InventoryEntry } from '@/src/index';

export function Inventory({ engine, character, update, report }: { engine: Engine;
  character: Character;
  update: (character: Character) => void;
  report: (message: string) => void; }) {
  const [selected, setSelected] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [details, setDetails] = useState<string>();
  const query = useDeferredValue(search.trim().toLowerCase());
  const context = useContext(CharacterRuleContext);
  const entries = character.inventory ?? [];
  const settings = engine.catalogue.system.sheetDisplay?.inventory;
  const detailEntry = entries.find((entry) => entry.id === details);
  const detailItem = engine.catalogue.items?.find((item) => item.id === detailEntry?.item);
  const itemName = (entry: InventoryEntry) => {
    const item = engine.catalogue.items?.find((candidate) => candidate.id === entry.item);
    return String(infusedItemProperties(character, engine.catalogue, entry.id, context?.result.instances ?? [])['Replicated item'] ?? item?.name ?? 'Unavailable item');
  };
  const visible = entries.filter((entry) => (!settings?.search || itemName(entry).toLowerCase().includes(query)) && (!settings?.categoryFilter || !category || engine.catalogue.items?.find((item) => item.id === entry.item)?.category === category));
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
      <div className="toolbar inventory-filters">
        {settings?.search && (
          <label>
            Search inventory
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find an item…" />
          </label>
        )}
        {settings?.categoryFilter && (
          <label>
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">All categories</option>
              {[...new Set(entries.map((entry) => engine.catalogue.items?.find((item) => item.id === entry.item)?.category).filter((value) => value !== undefined))].sort().map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
        )}
      </div>
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
            {visible.map((entry) => {
              const item = engine.catalogue.items?.find((candidate) => candidate.id === entry.item);
              const properties = { ...(item ? itemProperties(engine.catalogue, item.id) : {}), ...infusedItemProperties(character, engine.catalogue, entry.id, context?.result.instances ?? []) };
              return (
                <tr key={entry.id}>
                  <th scope="row">
                    {engine.catalogue.system.sheetDisplay?.detailsDrawer && item ? <button className="link" onClick={() => setDetails(entry.id)}>{String(properties['Replicated item'] ?? item.name)}</button> : <span>{String(properties['Replicated item'] ?? item?.name ?? 'Unavailable item')}</span>}
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
                  <td>
                    <input type="checkbox" aria-label={`Equip ${item?.name}`} checked={entry.equipped} onChange={(event) => change(entries.map((value) => value.id === entry.id ? { ...entry, equipped: event.target.checked } : value))} />
                    {!!properties.attunement && (
                      <label>
                        <input type="checkbox" checked={entry.attuned ?? false} onChange={(event) => change(entries.map((value) => value.id === entry.id ? { ...entry, attuned: event.target.checked } : value))} />
                        Attuned
                      </label>
                    )}
                  </td>
                  <td><button className="quiet" aria-label={`Remove ${item?.name}`} onClick={() => change(entries.filter((value) => value.id !== entry.id))}>Remove</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!entries.length && <p className="muted">No items carried.</p>}
      {!!entries.length && !visible.length && <p className="muted">No items match these filters.</p>}
      <div className="toolbar">
        <label>
          Add item
          <select value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">Choose an item…</option>
            {engine.catalogue.items?.filter((item) => !getCurrency(engine.catalogue.system).denominations.some((unit) => unit.legacyItemIds?.includes(item.id))).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
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
      {detailEntry && detailItem && (
        <Modal className="details-drawer" title={itemName(detailEntry)} onClose={() => setDetails(undefined)}>
          <p>{`${detailItem.category} · quantity ${detailEntry.quantity}${detailEntry.equipped ? ' · equipped' : ''}${detailEntry.attuned ? ' · attuned' : ''}`}</p>
          <dl className="item-details-properties">
            {Object.entries({ ...itemProperties(engine.catalogue, detailItem.id), ...infusedItemProperties(character, engine.catalogue, detailEntry.id, context?.result.instances ?? []) }).map(([name, value]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
          <h3>Item components</h3>
          <ul>{detailItem.features.map((id) => <li key={id}>{engine.catalogue.itemFeatures?.find((feature) => feature.id === id)?.name ?? id}</li>)}</ul>
          {detailItem.source && <p className="source">{detailItem.source}</p>}
        </Modal>
      )}
    </section>
  );
}
