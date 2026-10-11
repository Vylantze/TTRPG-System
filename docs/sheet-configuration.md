# System-defined character sheets

The linked System definition (for DnD5e 2014, `definitions.json`) owns sheet settings. `sheetTabs`, `sheetSections`, `terminology`, `importantDetails`, and `resetConditions` retain their existing roles. New optional `sheetDisplay` settings control the compact layout. Configuration references are validated during System import, including Feature-created stats and resource trackers.

| Setting | Meaning |
| --- | --- |
| `overview` | Ordered primary stats with `stat`, optional `name`, `signed`, `unit`, and `roll`. |
| `health` | Optional heading, `showHealingFeatures`, `showDeathSavesAtZero`, and resource-key `counters`. |
| `resources` | `compact` cards and `showDetailsByDefault`; current/maximum and recovery precede reservations/providers. |
| `inventory` | Enable `search` and `categoryFilter`. |
| `spells` | Enable `search`, `levelFilter`, and `compact`; `columns` map labels to capability metadata keys. `castingStats` maps each casting ability to authored attack/save stat IDs. |
| `actions` | Configure category filters (`id`, `name`, `kinds`), metadata `columns`, and equipped weapon `itemCategories`. |
| `statuses` | Groups of active, eligible Features matching explicit `tags`, with an authored `name`. No condition or defense mechanics are inferred from prose. |
| `restPreview` | Preview affected pools before confirming any System reset button. |
| `rollHistory` | Shared chronological history of checks and Feature/spell rolls, retained when changing tabs. |
| `detailsDrawer` | Open sheet Feature/spell links and inventory items in a side drawer; modified Feature clicks and the explicit new-tab link keep normal link behavior. Item panels use Item-exclusive properties/components. |
| `sidebarCollapsed` | Default application navigation appearance; the player's saved local preference takes priority. |
| `showAllStats` | Enable the internal calculated-stat inspection panel. |

Stat-section rows can declare `roll: { "dice": "1d20", "bonusStat": "modifier.strength" }`. If `bonusStat` is omitted, the row's own stat supplies the bonus. Overview rows use the same syntax. The engine's `rollStat` command validates the authored roll, uses the evaluated bonus, and persists the expression, total, and breakdown. Replaying the same event does not reroll. Each character retains at most 100 checks; Feature/spell rolls retain their existing separate applications and spending behavior. Section `modifierFirst` and `defaultSort` define defaults, while the character's saved modifier preference wins.

Table sections can also define ordered `columns` using `Training`, `Name`, `Ability`, and `Bonus`, and provide `columnLabels` for their captions. Name and Bonus are required; columns must be unique. The 2014 saving-throw section omits the redundant Ability column, while Skills includes it. Calculation explanations still open in an additional independent column.

`sheetTabs.content` additionally supports `actions` and `spells`. The Actions table exposes existing engine capabilities and spell casting modes; rolling spends the chosen ability cost or spell slot before application, exactly as in the original controls. Equipped weapon properties are shown as reference data: automated attack hit/damage rolls require authored Item capabilities and are not invented from item descriptions. The separate Spells tab retains slot pips, original-level grouping, upcasting, and collapsible descriptions. Columns with no metadata remain absent from spell summaries or show an em dash in the Actions table. Status groups likewise display only explicitly tagged active Features; condition application, concentration enforcement, conditional advantages, and unimplemented weapon mechanics remain manual.

## Health rules

Health behavior belongs in `healthRules`, independently of display:

```json
{
  "resourceKey": "hit-points",
  "temporaryResourceKey": "temporary-hit-points",
  "resetResourceKeysOnHealing": ["death-save.successes", "death-save.failures"],
  "clearOnReset": {
    "long-rest": ["temporary-hit-points", "death-save.successes", "death-save.failures"]
  }
}
```

All referenced resources must have Feature providers. DnD5e grants three separate atomic tracker Features for temporary HP and the two death-save counters. They each start at zero; counters are capped at three. Temporary HP uses its own unbounded pool, accepts an explicit replacement value, and is consumed before normal HP by `changeHealth`. Healing/damage are capped to pool bounds. Supported healing applications and positive manual HP adjustments clear the configured counters. Defined resets clear the configured pools without filling temporary HP; reserved counters must be released before clearing. The zero-HP controls track successes/failures manually: this release does not automatically adjudicate death, stabilization, critical failures, or instant death.

The overview stays outside tabs, with HP first and System reset buttons above it. Race/origin and every class progression appear beneath the editable name. Skills and saving throws remain sortable with a separate calculation column. Tabs support Arrow Left/Right, Home, and End, and retain the existing saved custom order. Name, notes, tab order, and display preferences remain independent of rule totals; history and drawers retain their context during sheet navigation.

Run `node tools/configure-dnd-sheet.mjs` to regenerate the authored 2014 display settings idempotently. After changing Feature providers, rebuild the engine and run both sample generators so bundled samples carry the current content revision manifest. The standing prototype reconciliation policy still rebuilds incompatible samples and removes incompatible other characters at startup.

This release uses UI/engine `0.3.0` for additive configuration and play commands. The 2014 System and definitions asset use `2.0.0` because the sheet structure changes and redundant section rows are removed. New tracker Features and refreshed samples use `1.1.0`; unchanged assets retain their versions. Reload the System to adopt the new configuration.
