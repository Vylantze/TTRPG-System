# Feature Engine

The generic engine is implemented in TypeScript with no runtime dependencies. It exposes plain, versioned System, Class, Feature, and Character data for a later React UI. The [first DnD5e 2014 catalogue milestone](systems/dnd5e-2014-system.md) is implemented separately; the original small engine example is invented. DnD5e 2024 and PF2e follow the remaining 2014 classes.

## Run the engine

Use Node.js 20 or later and TypeScript 5.4.5. Install the development dependency with `npm install`, then run:

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
| `src/index.ts` | Public exports |

`new Engine(catalogue, functions?)` validates, clones, and freezes the catalogue. Invalid catalogues throw a `RuleError` with a code and path. `validateCatalogue` returns diagnostics without constructing an engine. Definitions use stable IDs and positive revisions; character saves pin the entire catalogue's definition revision manifest.

`engine.evaluate(character, runtimeContext?)` returns a valid, incomplete, or invalid result, with provisional totals labeled accordingly. It never changes the character. Runtime context affects conditional effects and capability availability; acquisition eligibility and selection capacity use the permanent build context. Unknown inputs, missing references, incompatible revisions, and malformed saves are errors.

## Create and edit a character

```js
import { Engine, applyEdit, classEntryPath } from './dist/index.js';
import { catalogue } from './examples/catalogue.js';

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

Shared pools combine compatible providers using sum or highest capacity. Providers must agree on recovery and initialization. Persisted expenditure survives capacity changes. Availability subtracts settled expenditure and pending reservations. Integer-use pools also enforce integer costs and expenditure. Exhaustion prevents ability use but does not invalidate resource provision.

`useAbility` validates the complete build, all resource costs, and any declared action cost before changing state. Pass an action budget for abilities with action costs; the returned budget reflects spending. Outcome-dependent abilities reserve resources. `settleAbility` commits or releases a reservation using the authored outcome rule. `recoverResources` applies the declared full or partial recovery event exactly once per pool.

Commands require unique caller-supplied event IDs. Replaying the same event and payload is idempotent; reusing an ID with different data is an error. Save the returned character after a command. Returned action budgets are explicit external turn state; the engine does not run combat rounds or adjudicate dice outcomes.

## Saves and revisions

`serializeCharacter` and `deserializeCharacter` validate the save shape. Loading with an engine also checks revision identity and structural character references. Incomplete and invalid selections can remain in a draft for repair; calculated totals are never authoritative save inputs.

`previewMigration` validates an explicitly prepared target save. `migrateCharacter` requires the same character ID and a valid target, preserves expenditure on stable matching pool IDs, and initializes newly identified pools empty. Settle pending uses first. Content ID remapping is an explicit caller responsibility; no published System content is silently upgraded.

## Remaining milestones

The first DnD5e 2014 milestone implements three SRD classes through level 20, origins, and Wizard spell selections. Complete its remaining nine classes, then implement DnD5e 2024 before the React UI and PF2e. The engine does not provide automated combat resolution. The React UI and Feature editor follow the validated System data.
