# Feature Engine

## Atomic blocks and shared trackers (prototype revision)

The smallest numeric components are `modifyStat` (one target) and `defineStat` (one derived stat). A Feature-created stat exists only while an active, eligible provider exists. Identical providers share its definition; conflicting definitions or evaluated base values are invalid. Missing dependencies and formula cycles invalidate the build. `getStatDefinition(id)` supplies labels for active calculated stats.

Catalogues and System JSON can declare `blocks`: reusable JSON component templates with typed `parameters`. Features call them with `{ "id": "training", "kind": "useBlock", "block": "core:training", "arguments": { "stat": "training.skill.acrobatics", "rank": 1 } }`. Template nodes such as `{ "argument": "stat" }` substitute a declared argument without evaluating code or interpolating strings. Blocks can use other blocks. Expansion rejects cycles, unknown arguments, depth over 32 calls, and more than 10000 expanded components. Ordinary engine validation then checks every expanded component. Single-leaf calls keep the call's component ID; composites prefix child IDs. Ownership and resource dependencies use recursive `grantFeature` sub-Features.

`trackResource` belongs to a Feature and defines exactly one resource identity (`key`), display `name`, `units`, optional numeric `minimum` (default zero), optional `maximum` expression, explicit `initialAmount`, integer policy, and recovery rules. A Feature may directly track at most one resource; a composite grants multiple tracker sub-Features. Trackers with the same key share one character-wide pool, regardless of acquisition path. Repeated tracker-only Features are allowed without multiplying capacity or resetting current amount. Different keys create independent pools. Active providers must agree on range, initial amount, units, integer policy, and evaluated recovery rules. Display names do not establish identity.

Capacity normally references a stat created by the tracker Feature. Constants, formulas, modifiers, and threshold tables can set or increment that stat at levels. The current amount is stored separately. Maximum increases never refill it. Maximum reductions clamp it; reductions conflicting with reserved costs invalidate the build. Missing maximum means an unbounded pool (`capacity: Infinity` in the in-memory evaluation result); saved amounts remain finite, and unbounded pools cannot recover to `full`. Negative minimums are supported. `available` is the amount spendable above the minimum after reservations, while `current` is the balance before reservations.

`grantResource` explicitly adds a nonnegative amount when its owning assignment becomes active and its optional condition is satisfied. Each stable instance/component path applies once, even across reloads, removal/re-addition at that path, or repeated level changes. Two distinct assignments may explicitly grant separately. Grants are capped at the maximum; overflow is not banked. `initialAmount` applies only on first provisioning of a pool ID. Pool state and assignment receipts are retained while inactive to prevent removal/re-addition from refilling it, but it disappears from the evaluated sheet after its last provider is removed. Dependent Features become invalid; prerequisite waivers never waive resource contracts.

Spending and reservation commands preserve these balances; multi-resource costs are checked before any is spent. Recovery occurs once per shared pool. `PoolResult` exposes current, capacity, minimum, available, reservations, recovery rules and provider instance IDs for the character sheet. Old `defineResource` components remain supported for legacy API fixtures, but the bundled 2014 System now uses shared trackers throughout. The prototype deliberately starts with a fresh browser workspace (`ttrpg-feature-forge:v2`); old saves are not migrated.

The generic engine is implemented in TypeScript with no runtime dependencies. It exposes plain, versioned System, Class, Feature, and Character data for the React UI. The [first DnD5e 2014 catalogue milestone](systems/dnd5e-2014-system.md) is implemented separately; the original small engine example is invented. DnD5e 2024 and PF2e follow the remaining 2014 classes.

## Run the engine

Use Node.js 22 or later and TypeScript 5.4.5. Install the development dependency with `npm install`, then run:

```text
npm run build
npm test
npm run demo
```

The compiler writes JavaScript and TypeScript declarations to `dist/`. Tests use Node's built-in test runner in one process. The example creates a level 3 character with nested resource-dependent Features and prints its calculated stats and resource pools.

This workspace's dependency download was unavailable during development. Build and verification used the installed TypeScript 5.4.5 compiler. A fresh environment must install the declared compiler or provide that version on its command path.

## Modules and contracts

| Module | Responsibility |
| --- | --- |
| `src/model.ts` | Serializable definitions, character state, expression types, and result contracts |
| `src/validation.ts` | Catalogue references, cycles, content shape, and save shape validation |
| `src/expression.ts` | Typed, deterministic arithmetic, predicates, tables, and registered functions |
| `src/engine.ts` | Acquisition replay, nested instance expansion, eligibility, stats, capabilities, and pools |
| `src/commands.ts` | Immutable edit previews, resource commands, serialization, and explicit migrations |
| `src/system-loader.ts` | JSON validation, declarative option configurations, loading and unloading Systems |
| `src/policy-commands.ts` | JSON-configured spell-turn restrictions and selected resource recovery |
| `src/index.ts` | Public exports |

`new Engine(catalogue, functions?)` validates, clones, and freezes the catalogue. Invalid catalogues throw a `RuleError` with a code and path. `validateCatalogue` returns diagnostics without constructing an engine. Definitions use stable IDs and positive revisions; character saves pin the entire catalogue's definition revision manifest.

`engine.evaluate(character, runtimeContext?)` returns a valid, incomplete, or invalid result, with provisional totals labeled accordingly. It never changes the character. Runtime context affects conditional effects and capability availability; acquisition eligibility and selection capacity use the permanent build context. Unknown inputs, missing references, incompatible revisions, and malformed saves are errors.

## Create and edit a character

```js
import { Engine, applyEdit, classEntryPath } from '@/dist/index.js';
import { catalogue } from '@/examples/catalogue.js';

const engine = new Engine(catalogue);
const draft = engine.createCharacter('hero', 'Hero', [
  { id: 'main', class: 'example:adventurer', level: 1 }
]);
const character = applyEdit(engine, draft, [{
  kind: 'select',
  selection: classEntryPath('main', 1, 'technique'),
  picks: [{ id: 'first-choice', feature: 'example:guard' }]
}], 'choose-technique', { requireValid: true });
const result = engine.evaluate(character);
```

This snippet uses repository-root import paths. `createCharacter` records class levels in the supplied progression order. For a different multiclass history, provide the intended chronological `history` ledger before evaluation. Root acquisitions declare an acquired character level and may specify a historical event index to distinguish acquisitions that share a character level.

Edit commands support numeric inputs, selecting Features, adding a progression, changing its level, adding or removing roots, selecting alternative stat formulas, and binding a required resource to a pool. `previewEdit` returns the proposed character, before and after evaluations, added and removed instances, and changed stats and pools. `applyEdit` accepts invalid or incomplete drafts by default; `requireValid: true` rejects them. Both preserve the original input.

Replacement is governed by the selection's retraining flag or permitted replacement events. Replacing a chosen parent removes its owned descendant selections and bindings; sibling choices remain. Losing a dependency flags the build invalid. Lowering a progression level deactivates its higher-level Features but retains its historical selections and resource state.

## Feature identity and eligibility

Path helpers generate stable, escaped instance and selection IDs: `rootPath`, `classEntryPath`, `childPath`, `selectionPath`, and `pickPath`. Pick IDs belong to a particular selection; the same pick ID in another selection does not share state. Display order does not determine child identity.

Features can grant Features, choose Features, modify stats, define resource pools, grant capabilities, or carry descriptive text. Choices support explicit candidate IDs, tag queries, acquisition-level caps, expression-based pick counts, and optional ordinary-prerequisite waivers. `getCandidates` evaluates a proposed selection and returns its diagnostics and waiver status. Incomplete sibling provider choices can leave a resource-dependent candidate pending.

Prerequisites support level, Feature or tag ownership, parameters, stat thresholds, all/any/not, and typed boolean expressions. Acquisition replay checks them against already admitted Features at the recorded event. A Feature cannot qualify itself using its own effects or descendants. Shared resource providers resolve before dependent consumers within the same event; a provider cannot depend on its consumer to qualify. Resource requirements are always enforced, including with `ignorePrerequisites` enabled.

System level expressions use explicit context such as `totalClassLevels` or `maximumClassLevel`. Per-instance context includes `characterLevel`, `classLevel`, `acquiredCharacterLevel`, `acquiredClassLevel`, `isStartingClass`, and named progression levels as `class.<progression ID>`. Runtime flags require declared context defaults when permanent evaluation needs them.

Context also exposes `classCount` and aggregate `level.<Class definition ID>` values. Systems may declare permanent predicate checks, a duplicate-class policy, and allowed additional root candidates. Classes may declare a maximum level and multiclass prerequisites. These controls are generic data, not hard-coded DnD5e logic. Multiclass requirements are checked at entry and against the current permanent build. `System.advancement` may use level zero for pre-class origins; class progression starts at level one.

Choices default to historical acquisition eligibility. Set `eligibility: 'current'` for mutable choices such as daily spell preparation; those selections check current ownership and current class levels. Count and candidate limits still use the permanent build, and retraining/replacement-event policy remains separate. Numeric Feature parameters can declare `integer: true`.

## Stats and resources

Stat values have an input or derived base, followed by priority overrides, grouped additions, multipliers, floors and ceilings, and declared rounding and bounds. Each result includes source explanations for applied, suppressed, and inactive modifiers. Alternative base formulas require an explicit selected alternative. Static catalogue validation conservatively rejects possible stat cycles, including dependencies in conditional modifiers and mutually exclusive formulas.

Resource capacity can be constant, a stat/context expression, a local exact or threshold table, or a combined expression. Tables declare below-range, above-range, and missing-key policies. No interpolation is implicit. Resource compatibility includes key, scope, units, contract, and minimum capacity. Ambiguous pools need an explicit binding.

For new `trackResource` pools, providers share one current amount and maximum without adding duplicate capacity. See the atomic-block section above. Only legacy `defineResource` pools combine providers using sum or highest capacity and retain expenditure-based balances. Exhaustion prevents ability use but does not invalidate resource provision.

`useAbility` validates the complete build, all resource costs, and any declared action cost before changing state. Pass an action budget for abilities with action costs; the returned budget reflects spending. Outcome-dependent abilities reserve resources. `settleAbility` commits or releases a reservation using the authored outcome rule. `recoverResources` applies the declared full or partial recovery event exactly once per pool.

Commands require unique caller-supplied event IDs. Replaying the same event and payload is idempotent; reusing an ID with different data is an error. Save the returned character after a command. Returned action budgets are explicit external turn state; the engine does not run combat rounds or adjudicate dice outcomes.

## Saves and revisions

`serializeCharacter` and `deserializeCharacter` validate the save shape. Loading with an engine also checks revision identity and structural character references. Incomplete and invalid selections can remain in a draft for repair; calculated totals are never authoritative save inputs.

`previewMigration` validates an explicitly prepared target save. `migrateCharacter` requires the same character ID and a valid target, preserves expenditure on stable matching pool IDs, and initializes newly identified pools empty. Settle pending uses first. Content ID remapping is an explicit caller responsibility; no published System content is silently upgraded.

## Remaining milestones

The first DnD5e 2014 milestone implements three SRD classes through level 20, origins, and Wizard spell selections. The [React UI baseline](react-ui.md) is now implemented before further System work. Complete the remaining nine 2014 classes, DnD5e 2024, and PF2e afterward. The engine does not provide automated combat resolution. A structured Feature editor remains future work.

## JSON System lifecycle

The 2014 content ships as JSON; its TypeScript entry point is an optional compatibility adapter. Core `SystemRegistry` can load any validated System file, create engines from declared options, find the exact System for a saved character, and unload content without changing saves. See [the JSON file contract and React integration](json-systems.md). `castSpell` and `recoverSelectedResources` are core engine commands configured by `SystemDefinition.commandRules`; their 2014 behavior is declared in JSON.

## Construction drafts

Create an initial build with `engine.createCharacter(id, name, progressions, roots, { draft: true })`. Draft selections can be changed without invoking final-character retraining, but resource use and recovery remain blocked. `finalizeCharacter(engine, character, eventId)` requires a valid build and records finalization idempotently. Saves without `buildState` retain the previous behavior. `getCandidates` accepts an optional fourth argument `{ features: ids }` to evaluate one UI page while enforcing the same candidate rules.
## Catalogue reference queries

`engine.getFeature(id)` returns the frozen definition or `undefined`. `engine.getClassLevels(classId)` returns numerically ordered `{level, entries}` rows; unknown classes return an empty array and the returned arrays can be rearranged without changing the catalogue.

`engine.getSelectionFeatures(choice)` returns the structural pool, intersecting explicit IDs with all required tags. It deliberately does not evaluate dynamic content-level limits, conditions, prerequisites, or resource contracts without a character. Use `getCandidates` for character eligibility; it consumes the same structural query before its existing validation.

`engine.getFeatureAdvancement(featureId)` returns direct Class grants and selection-pool membership as `{classId, className, levels}`. It is a catalogue reference, not an acquisition requirement or a trace through nested grants. Character Feature provenance continues to come from evaluated instances (`progression`, `parent`, and acquisition levels).


## Inventory and manual resource tracking

Items live in `Catalogue.items`, with reusable item-only definitions in `Catalogue.itemFeatures`. They do not appear in `Catalogue.features`, character selections, or acquired Feature instances. An `ItemDefinition` has an ID, revision, display name, category, item Feature references, and an optional equipment slot. `ItemFeature.features` recursively references other item Features; diamonds apply each definition once per item, and cycles or missing references are rejected. `properties` supplies readable item facts; later definitions override earlier values for the same property. `modifiers` uses the existing single-stat `modifyStat` primitive and normal stacking/condition rules. Effects apply once per equipped inventory entry, independently of its stack quantity. An item Feature cannot grant a character Feature, proficiency, resource, or capability. Tool ownership is separate from training.

`Character.inventory` entries contain `{ id, item, quantity, equipped }`. Quantities are positive safe integers; remove an entry to discard its stack. Named equipment slots allow only one equipped item per slot. `updateInventory(engine, character, inventory, eventId)` validates references and slot conflicts, recalculates stats, and preserves tracked resource amounts. Changes to a valid build must leave it valid. Inventory roundtrips with character JSON and remains unavailable if its owning System is unloaded. Item definitions belong to the pinned catalogue; changing them requires normal catalogue revision discipline.

The five Starter Set templates now carry their printed equipment and gold. Chain mail, leather armor, and shields modify the existing armor inputs while equipped. Unequipping them removes those modifiers. Weapon dice and damage types are composed item properties; attack rolls, damage resolution, encumbrance, and automatic ammunition expenditure are not implemented by inventory. The printed attack note remains explicitly a starting reference.

`adjustResource(engine, character, poolId, delta, eventId)` records a manual increase or decrease without triggering recovery or assignment grants. It requires a finalized, valid character and an existing pool. It rejects nonfinite amounts, fractions for integer pools, values outside the range, and reductions into reserved amounts. Replaying the same event is idempotent; reusing its ID with another payload is rejected. The sheet offers an adjustable amount and increase/decrease buttons alongside current, maximum, reservation, provider, and recovery information. Selected-recovery controls appear only when the character actually has the configured capability.

## Currency balances and manual action timing

`SystemDefinition.currency` defines a name, primary denomination, decimal precision (0–6), and denominations `{ id, name, symbol, value }`. Values are positive safe-integer multiples of a common smallest unit. Omitting the definition provides a single `unit` balance with two decimal places; a System can name this Zenny, dollars, or another currency. DnD5e 2014 defines cp/sp/ep/gp/pp at values 1/10/50/100/1000, with whole coin counts and gp as the display total.

`Character.money` stores separate denomination quantities. `setMoney(engine, character, balances, eventId)` validates identity, known denominations, precision, nonnegative finite amounts and supported totals, then records an idempotent update. `moneyTotal` converts only for display and never exchanges coins. Saves preserve the balances. Optional `legacyItemIds` enables `convertCurrencyItems` to move old currency inventory into money exactly once while retaining other items. The old gold item remains available to validate legacy saves; the UI excludes it from new inventory choices. Starter templates now store starting gold in `money`.

`useAbility` accepts `{ actionTracking: 'manual' }` for clients that adjudicate timing at the table. This explicitly omits action-budget accounting while retaining eligibility, resource costs, reservations and replay protection. It cannot be combined with an action budget. Default callers still use the existing budget checks. The character-sheet UI uses manual timing; spell-turn restrictions, targets, effects and dice require table adjudication.


Systems may declare optional `spellDisplay` metadata keys for spell identity, original level, slot level, ritual status and casting ability, plus scoped slot pool keys. `spellGroups` and `spellSlotPools` query only evaluated capabilities and owned resources. These presentation queries do not grant spells or bypass prerequisites; casting uses the existing ability command and resource validation. The DnD5e 2014 JSON declares this mapping.


`reopenCharacter` explicitly returns a finalized save to construction while preserving resource balances. Pending uses must be resolved first. The 2014 walking-speed Feature takes a feet parameter and is granted by each race; the System baseline is zero. All class HP grants share a single hit-points tracker whose maximum derives from calculated hitPoints.

Features may declare validated `rolls` (ID, label, bounded dice notation, optional stat or Class-level bonus, capability name, and optional resource to restore). `rollFeature` checks ownership and readiness, spends the originating capability, and applies capped self-recovery atomically. It returns the total, dice breakdown and applied amount; event IDs prevent replay. Arbitrary prose rolls use `rollDice` and never infer targets or state changes. Second Wind is the first configured healing effect.

SystemRegistry reuses frozen Engines for repeated identical configuration requests and clears its cache on unload. Feature advancement lookup checks direct membership in each class selection rather than enumerating its entire candidate pool.
