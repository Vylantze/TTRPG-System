# React character workspace

The atomic-block prototype starts a fresh workspace under `ttrpg-feature-forge:v2`; old prototype saves are intentionally not loaded or migrated. The resource sheet lists shared resources supplied by active Features, including current amount, maximum (or no maximum), reservations, available amount, recovery event and amount, and provider names. Feature-created stats appear alongside System stats only while active providers exist. Raising a tracked maximum does not refill its current balance.

The first React UI is implemented before additional Systems. It bundles the DnD5e 2024 System and accepts other engine-compatible System files. The UI source lives in `ui/`; the generic engine remains in `src/`. UI components call engine commands rather than duplicating calculation, eligibility, resource, or retraining rules.

## Source organization

React does not mandate a folder structure. This project groups related UI and model helpers by feature, following [React's guidance on file organization](https://legacy.reactjs.org/docs/faq-structure.html), with shallow folders and explicit `@/` imports:

```text
ui/src/
  app/                   Application shell, database startup and error boundary
  components/            Shared modal, tooltip and loading controls
  features/
    characters/          Character sheet components and character model helpers
    catalogue/           Class, Feature and item views; rules text and linking
    systems/             System loading and editing components and helpers
  lib/                   Shared workspace utilities
  services/storage/      IndexedDB adapters
  styles/                Global CSS
  types/                 Shared UI type definitions
  workers/               System validation and loading worker
  main.tsx               React entry point
```

Each feature groups `components/` and `model/` together. UI tests remain in `ui/tests/`, organized into independently runnable suites. Engine definitions stay in the repository's `src/`; the React refactor does not move rules or change character saves. The TypeScript and Vite `@/` alias remains rooted at the repository, so editor and build resolution use the same imports. The worker uses a relative `new URL` asset reference so Vite emits it as a separate bundle.

CSS uses Stylelint's standard configuration and Prettier formatting: two-space indentation, readable declaration blocks, and separate selector lines. `npm run lint:css` validates CSS and formatting; `npm run lint:css:fix` applies safe rule fixes and formats it. These checks are included in `npm run lint` and the existing pre-commit hook. Repeated selectors and descending specificity remain allowed for the current stylesheet's intentional responsive and System overrides; all other standard rules apply.

React JSX uses two-space indentation. Elements with multiple props put their first prop on a new line and each prop on its own line; multiline opening tags align `>` or `/>` with the tag. Children of multiline tags have their own lines, and multiline conditional children use `&& (...)` with a complete closing `)}`. Short single-line elements and short inline value expressions can remain compact. `npm run lint:fix` first runs Prettier on UI TypeScript/TSX to wrap long callbacks and ternaries using the configured 100-column print width, then runs ESLint to apply the required JSX prop/child layout. The final output is stable across repeated runs. `npm run format:ui` exposes the initial formatting pass separately; use `lint:fix` for the complete project style.

Expanded HP presents a native number input to the left of its maximum, using the same field styling as Amount. Typing or the input's native stepper changes the pending value; leaving the field or pressing Enter saves it through the engine. Invalid values restore the current value. The engine enforces minimum, maximum, whole-number settings and reservations. Direct HP edits set the raw balance; Damage and Heal retain their separate rules, including temporary HP absorption.

## Run

Use Node.js 22.12 or later. From the repository root:

```text
npm install
npm install --prefix ui
npm run ui:dev
```

Open the local address printed by Vite, normally `http://127.0.0.1:5173/`. Both the development and preview servers bind to the local machine. To build and serve the production output:

```text
npm run ui:build
npm run preview --prefix ui
```

The static application is written to `ui/dist`. Serve it over HTTP rather than opening `index.html` directly from the filesystem, because the bundled System is fetched as a JSON asset. Hash routes support bookmarkable Class, Feature, and character details without server rewrite rules.

## Supported workflows

1. Load the bundled DnD5e 2024 System from the welcome screen, or upload a System JSON from **Systems**. Export loaded System files and unload them independently. The engine validates every configuration before loading.
2. Browse **Classes** and **Features** without a character. Search names and descriptions, filter Features by tag, inspect class progression by level, follow Feature links, and inspect components, prerequisites, required resources, parameters, scaling tables, and complete JSON. Choose a browse configuration through the System's declared option domains.
3. Create a character with a name, System, options, and optional starting Class and level. Initial choices remain editable in construction mode. Add or remove independent class progressions during construction, edit levels and basic stats, and choose Features from level-filtered slots. Selecting a parent exposes its nested slots and parameter controls. Eligibility results come from the engine; candidate lists are paged to avoid evaluating the entire spell catalogue on every interaction.
4. Keep an incomplete or invalid draft while repairing diagnostics. The builder displays provisional totals and unmet requirements. A selected invalid Feature does not bypass engine eligibility or become a legal completed character. Finalization requires a valid build and enables ability spending and recovery.
5. Inspect calculated stats and their modifiers, acquired Features, resources, recovery rules, abilities, and source Features. Explicit actions invoke engine resource commands. Spell casts spend engine-validated resources while action timing is handled at the table. Configure selected recovery allocations against recorded rest/recovery events. Settle or release reserved uses explicitly.
6. Export/import character JSON, duplicate characters, and reopen them from the Characters page or the character switcher. Saves pin System and catalogue revisions. Unloading a System preserves characters and their export controls; reloading that revision restores editing. Invalid imported selections remain available for repair.

Changes to a finalized character show an engine edit preview before application, including affected Features, stats, resources, and resulting validity. Declared retraining events must still be supplied. Edit build explicitly reopens construction after finalization, preserving resource balances and rejecting unresolved reservations. This is available to imported samples as well as custom characters. Lowering a progression preserves its history and inactive selections as specified by the engine; adding later levels appends to the advancement ledger.

## Persistence and accessibility

The application stores loaded JSON Systems and character saves in the browser's `ttrpg-feature-forge` IndexedDB database. Separate `systems`, `characters`, and `workspace` stores are committed in one atomic transaction. No backend or account is required. This storage belongs to the app's origin: development and preview URLs may have separate workspaces. Use JSON exports to transfer characters and Systems between origins or devices.

On the first database load, existing `ttrpg-feature-forge:v2` localStorage data is validated and migrated atomically; the legacy copy is retained for recovery. Subsequent loads use the database, without fetching bundled System JSON. Explicit Load and Reload controls import JSON into the database. Unloading a System retains its character saves. Writes are queued and only changed records are written. A revision check rejects a stale browser tab instead of overwriting newer edits. Storage failures remain visible and changes remain in memory: export before closing when persistence fails. Malformed existing data is preserved, and initialization errors provide a legacy-data export. Browser storage is still subject to quota limits and clearing browser data removes it.

Controls have labels, visible focus, text-based validation, and a skip link. Native dialogs provide focus containment, Escape cancellation, and focus restoration. Layouts adapt to smaller screens. Catalogue detail links preserve System revision and configuration context; browser back and forward navigation preserve saved character choices.

## Engine additions

- `engine.createCharacter(id, name, progressions, roots, { draft: true })` creates a construction draft. Existing callers and older saves retain normal retraining behavior. Draft-only `removeProgression` edits prune that progression and its owned selections/history; dependent roots or sibling prerequisites remain visible for repair. Removing finalized class progressions requires explicit migration.
- `Character.buildState` optionally records `draft` or `finalized`. Draft choices can be changed before finalization; newly introduced full pools start full during construction, and existing expenditure is preserved. Resource use/recovery is blocked while constructing.
- `finalizeCharacter(engine, character, eventId)` validates the complete build and records finalization idempotently.
- `engine.getCandidates(character, selection, parameters, { features: ids })` evaluates a requested subset while retaining all engine candidate-domain and eligibility checks. This lets the UI display a page of candidates efficiently.

## Libraries and verification

The UI installs React, React DOM, TypeScript, and [Vite](https://vite.dev/guide/). Styling uses plain CSS and native browser controls. Additional suggestions remain optional: [Radix Primitives](https://www.radix-ui.com/primitives/docs/overview/introduction) for complex accessible menus and dialogs, and [TanStack Virtual](https://tanstack.com/virtual/latest/docs/introduction) if larger catalogues need virtualized lists. Current lists use pagination. These libraries have not been added to the runtime.

```text
npm test
npm run test:ui
npm run ui:build
```

The engine suite covers construction state, finalization, backward compatibility, resource initialization, and paged candidate evaluation, alongside existing rule tests. UI integration tests exercise storage roundtrips, quota errors, React server rendering of browsers and nested character choices, unavailable-System saves, and corrupted-storage recovery notices. The production build type-checks UI and engine imports.

The original broad browser review was blocked by the available browser tool. The source-reference workflow has since been verified in a temporary headless Chrome session: ability, skill, and spell dialogs, an ambiguous-name picker, Escape dismissal, focus restoration, and exact-System navigation. React server-rendering checks and production compilation are also verified. Full responsive rendering, download/upload dialogs, and complete character workflows still require a broader browser review.

## Remaining scope

The structured custom Feature editor, explicit resource-binding and alternative-formula controls, custom advancement-history editing, and PF2e remain later work. Loading manually authored engine-compatible JSON is already supported. The UI does not automate combat adjudication, spell effects, targets, or runtime rule triggers. Session turn/action controls are not persisted as character state.

## Descriptions and display names

The bundled DnD5e 2024 JSON retains each class's Core Traits, Feature descriptions, and full descriptions for all 339 SRD 5.2.1 spells. Class and Feature browsers show description previews and full source text. Selected Features and class traits can be expanded inside the builder; acquired Features can be expanded on the character sheet. Class spell entries display the shared canonical spell description. Paragraphs are preserved and imported text is rendered as plain text.

All displayed Feature rules use the original source wording stored in JSON. Supporting building blocks use corresponding SRD passages, and spell wrappers display shared original spell text instead of implementation summaries. Mechanical component notes remain inside engine definitions. Browser and candidate previews are excerpts of the same source text, including shared descriptions; they do not summarize or rewrite it.

Class progression rows display full source descriptions by default beneath each granted Feature and each explicitly listed selection option. Shared descriptions, automatic references, and reference popups use the same renderer as Feature detail pages.

When a description starts with a standalone heading matching the displayed Feature title, the renderer omits that repeated heading. Other source headings and the stored source text are preserved. Granted Class entries use the Feature title without an additional entry-ID label.

Rules text automatically links references using the engine's `FeatureTextIndex`. Links preserve the original words and open a native dialog containing the target Feature's source text and an **Open Feature** link. References inside the popup update that same popup; ambiguous names offer all matching Features. Escape and Close dismiss the popup and return focus to the originating link. Links include the exact System, revision, and catalogue identity; ordinary unambiguous links also support opening the Feature in another tab. Classes, Feature pages, choices, acquired Features, and ability source rules use the same renderer. Imported text remains inert even when it contains HTML or Markdown.

All bundled Features have `displayName` values. Systems supply tag labels with `tagDisplayNames`; browsers, filters, selections, source links, advancement lists, and sheet labels use these display names while retaining internal identities for rules and saves. Older/custom Systems fall back to Feature names and humanized tag IDs.

On startup, the UI automatically fetches current bundled descriptions for an already loaded System, checks that its mechanical rules match, and saves the updated source text, aliases, and labels to browser storage. This prevents a previously saved System copy from hiding new SRD descriptions after an application update. A visible status reports the refresh; failures are shown with a manual retry through **Systems → Update bundled descriptions**. Customized or different rules are never replaced. Character saves and their System/catalogue revision pins remain unchanged, and an in-flight update cannot restore an unloaded System or overwrite its replacement.

Browser workspace storage now deduplicates repeated class and stat arrays across System configurations (storage envelope version 2, under the existing key). Version 1 workspaces remain readable and are rewritten on the next save. System import/export JSON and character JSON retain their original formats. The enlarged bundled content fits within the tested five-million-byte UTF-16 storage budget with an example character; storage failures still remain visible. Larger collections can still require JSON exports or a later IndexedDB migration.

The **Class Feature** category covers bundled class/subclass abilities, entry and HP benefits, fighting styles, class ASIs, and Expertise choices. Individual spells, racial traits, backgrounds, and the optional Grappler feat retain their own categories. This tag is available in the Feature browser filter and on Feature detail pages. Refresh also accepts category-tag changes when neither loaded nor incoming rules use those tags in prerequisites, maintenance, choices, or root-acquisition filters; mechanically referenced tags remain protected.

Feature pages and expanded character selections show **Levels & requirements**: direct Class progression grants/selection pools, content level, acquisition prerequisites, and maintenance requirements. Candidate cards show the same compact information. Boolean combinations retain AND, OR, and NOT grouping. Class progression timing and content level are labeled separately; a level-3 spell is not presented as requiring character level 3. Class selection pools include ID and tag filters. Pool membership is not eligibility: dynamic level limits, prerequisites, and resource requirements are still checked by the engine against the character. Raw JSON remains available for inspecting full rule definitions.

### Reference design study — 9 October 2026

Reviewed the public [D&D Beyond Fighter page](https://www.dndbeyond.com/classes/2190879-fighter) and [Demiplane Fighter primer](https://app.demiplane.com/nexus/pathfinder2e/classes/fighter-rm) in the browser. Beyond places a section index beside class traits and progression; Demiplane emphasizes class identity, source attribution, a linked advancement table, and level-labelled Feature descriptions. These are navigation and hierarchy references only; their artwork, branding, and rules have not been copied into this System.

[D&D Beyond's sheet documentation](https://dndbeyond-support.wizards.com/hc/en-us/articles/7747193946388-Sheet-Sections) separates Features/traits, actions, and limited-use abilities. The documentation itself notes that its screenshots/experience may lag the live builder. [Demiplane's published changes](https://www.demiplane.com/changelog) describe preserving reading position and less intrusive tooltips. Private or paid character-builder flows were not inspected.

The resulting implementation adds a class guide with sticky section navigation, keyboard-focusable level destinations, an advancement table with Feature previews, and full source descriptions still visible by default. Feature detail pages lead with rules, readable requirements, tags, action kinds, and source attribution; authoring JSON is grouped under a closed disclosure. Character Features now have their own searchable section with source-progression filters, acquisition levels, parent Feature provenance, and explicit inactive/unmet states. The existing palette remains, with a stronger class header and responsive reading columns.

The engine owns `getFeature`, `getClassLevels`, `getSelectionFeatures`, and `getFeatureAdvancement`. React consumes these queries instead of independently interpreting catalogue selection filters. None of the queries grants Features or bypasses eligibility checks. No new UI dependencies or System migrations are required.

## Sheet editing and presentation controls

Character detail fields expose inline Edit buttons with fixed-height, bounded-width textareas and Save/Cancel controls. Money has its own panel, using the loaded System currency definition and preserving denomination counts separately. Existing currency items and recognized starting-money notes migrate into this panel without counting a note twice. Unrecognized legacy money notes remain visible in Money.

Every `skills` layout (including Saving Throws) defaults to name sorting and provides ascending/descending controls on all column headers. An arrow beside each bonus expands its formula, contributing stat values and applied modifiers. Every `abilities` layout includes a score/modifier primary-value toggle; number tooltips identify the value type. Other stat sections preserve the System-authored row order.

Abilities form a vertical list with their resource controls on the right and Use Ability beside them. Every resource cost is displayed and checked by the engine. Selected-recovery allocation expands beneath its owning ability. Resources without an associated ability remain accessible. The UI has no turn budget or action/bonus-action counters.

The DnD5e 2024 System uses Abilities & resources for action-cost groups, ability use, and equipped weapon properties, with no separate Actions tab. `sheetDisplay.abilities.groupByActionCost` controls default grouping; `sheetDisplay.abilities.actionFilter` and `sheetDisplay.spells.actionFilter` enable independent filters. Both use `sheetDisplay.actions.categories` (`id`, `name`, `kinds`); zero-cost and untimed capabilities use the `special` kind. Weapon categories remain configurable through `sheetDisplay.actions.itemCategories`. `sheetDisplay.health.healingResourceIcons` displays available and spent healing dice beside their collapsible controls. Skill calculations always have their own table column, including the collapsed toggle. Mobile tab indicators stay inside the buttons above the horizontal scrollbar.

**Level up** is available beside each character progression. Changing a level reopens the character as a construction draft, preserves existing choices and resource balances, and opens Build Choices. Finish the new requirements and finalize the draft to resume ability use. Unfinished sample drafts survive prototype cleanup instead of being replaced by the original sample.

## System loading and content containment

The Systems page provides a source dropdown for bundled DnD5e 2024 or another System JSON file. Each loaded System has an accessible refresh-icon button. Bundled reloads fetch without caching; imported Systems request a replacement JSON file. Reload replaces the same ID and revision atomically, keeps character saves, and rejects missing catalogue/content revisions or changes that invalidate a previously valid character. A concurrent workspace change cancels replacement. Other revisions can be loaded separately.

Responsive content wraps within shrinking grid and flex children. Cards grow vertically with their prose; constrained editors, dialogs and large tables retain internal scrolling. Skill calculation disclosures wrap within their cells. Mobile layouts stack controls and columns rather than allowing labels to escape their boxes.


The Abilities heading has an icon-only score/modifier swap control with immediate hover and keyboard-focus help. Skills and saving throws expand calculations into a separate column. Source descriptions render paragraph breaks, bullet lists (including inline Unicode bullets), and numbered lists while retaining automatic rules links and escaping imported HTML.

Spell slots have a dedicated display with remaining/maximum values, recovery conditions, and increment/decrement controls. Slots with no uses remaining are hidden by default; Show all spell slots reveals them. Spells stay visible and are grouped by their original level. Use Spell offers a casting-level picker when multiple engine-provided casting modes exist, including higher slots and ritual modes. Exhausted modes are disabled; the engine validates and spends the selected slot.


Character details include an editable Name field, species, and each active Class level. Add multiclass sample creates a fresh Human Fighter 3 / Wizard 2 named Rook Ashveil, separately from the twelve level 1 samples. Edit build permits changing origin selections and class progressions; finalize again before using resources.

Features & Traits nests child Features under their owning instance. Resource children render their current pools inside the parent instead of repeating the ability description. Nested rule bodies mount on expansion. On character views, recognized ability modifiers, Class levels, and proficiency bonus references display current values with the original value name on hover; source catalogue descriptions remain unchanged. Granted Roll Features offer dice controls under their parent ability. Rolling Second Wind spends its use immediately and saves the total; a separate Apply healing button applies that total once, up to maximum HP. There is no reroll control. Results persist across navigation and save/load and show the individual dice and bonus on hover. Other targets and conditional effects remain table decisions. Resource controls and spell slots share the same 2rem square one-step minus/plus buttons.

Loading indicators cover initial startup, navigation, character tabs, and System loading. Engines are reused per loaded configuration, catalogue search runs only on the Feature list, immutable System packing is cached, and requirement lookup tests a single Feature against selection filters instead of repeatedly scanning every Feature. Explicit System reload accepts additive manifest entries while retaining character choices and balances; removing or changing pinned revisions is rejected.

For spells with Roll Features, Use Spell opens casting options and roll controls without spending a slot. Rolling spends the selected mode and retains the result on the spell card. Mark applied records manual target application once, independently of casting. Spell descriptions do not expose a second free dice control. Feature views also require a matching casting option.

The character-name field fills the space before the status badge. Recovery buttons lead the resource view; currency labels include symbols in their headings. Spell levels are native collapsible sections, initially expanded. Spell use controls appear only for granted rolls or positive resource costs, use the label “Use Spell”, and show casting consumption beside the control.

Feature `processDescriptionAutomatically` controls automatic value replacement in unchanged prose. `descriptionOverride` is an array of exact `originalString` / `overrideString` pairs; replacement text resolves explicit `{{stat:STAT_ID}}` and `{{class:CLASS_ID}}` tokens only. See [Description replacements](description-replacements.md) for all supported syntax, matching rules, and the complete bundled stat/Class token reference. Hit Points replaces only “your Constitution modifier” with `{{stat:modifier.constitution}}`, retaining its class-level wording.


The favicon is an original vector wizard-hat d6 in `ui/public/wizard-die.svg`, pending visual review.

Roll histories can be cleared per Feature or for the entire character from the resource view. Clearing removes stored results, including unapplied ones, without changing resources, rest state, or event IDs. Cleared results can no longer be applied. Spell Roll Features are generated only from text before the “At Higher Levels” heading; higher-slot effects remain outside reference-roll generation. System reload can retire removed Roll definitions while preserving character balances and validating the updated build. The top-left brand uses the same wizard-d6 icon as the favicon.


### System-authored character tabs and details

`system.sheetTabs` is an ordered array of `{ id, name, content, sections?, placement? }`. Content may be `choices`, `sheet`, `features`, `resources`, `notes`, or `sections`. `placement: "rail"` (the only accepted value) shows that tab's content in the left column on wide screens instead of in the tab row. The `sections` array references IDs in `system.sheetSections`; `sections` content creates a custom stat tab, while `sheet` content filters the main sheet's stat panels. IDs must be unique and references must exist. Omitted tab configuration uses the standard tabs. DnD5e places Skills immediately after Character sheet.

`system.importantDetails` lists the exact note labels displayed on Character sheet (DnD5e: Name and Alignment). Race and class levels remain visible there. Other detail labels appear in Notes. Add note creates another editable text entry with no application text-length limit; browser storage capacity still applies. Notes and `character.displayPreferences` travel with character exports. `modifierFirst:SECTION_ID` remembers the ability score/modifier toggle. Clicking an ability name rolls 1d20 plus its calculated modifier, with the die and modifier in the result tooltip; these checks do not spend resources.

Hit Points leads both Character sheet and Abilities & resources. The validity button toggles build counts; invalid builds reveal them automatically. Loading uses a modal spinner that blocks pointer input, keyboard interaction, and background focus until loading finishes. DnD5e base ability inputs accept integral values from 3 through 18; racial and Feature bonuses apply to the derived scores independently. Existing loaded Systems receive presentation updates automatically, but changed input rules require Reload System, which rejects changes that would invalidate a previously valid character.


The Items tab follows Skills by default and renders currency above inventory. **Rearrange tabs** exposes keyboard-accessible left/right controls; the character's `tabOrder` persists across reloads and exports. The HP panel contains rest buttons and expandable rest-healing Features. Hit Dice rolls consume the appropriate die pool immediately, with a separate healing application; long-rest allocation shares one budget across die types. Race/Class navigation and detail labels use System terminology.

Expanded System snapshots use cached lz-string compression in local storage; existing uncompressed and deduplicated saves remain readable. Engine loading reuses validation for unchanged JSON and invalidates that reuse on edits, without skipping validation of changed hidden configurations.

## Proposed character-sheet improvements (2026-10-11)

Status: recommendations recorded after comparing the rendered D&D Beyond sheet, the deployed Feature Forge sheet, and current source. The implementation below now covers the overview, HP workflow, actions/spell presentation, rolling, resource summaries, inventory filters, details drawer, history, rest preview, and tab accessibility. The deployed sheet originally showed some older presentation details; source was checked before identifying gaps.

Priority order:

1. Compact overview: keep HP first and System-defined resets above tabs; group AC, initiative, speed, and proficiency nearby. Reduce oversized cards and offer a collapsible application sidebar.
2. HP workflow: amount input with Damage/Heal, retain small +/- adjustments, add temporary HP and conditional death-save controls through System-defined mechanics.
3. Unified Actions view: aggregate equipped attacks, spells, and abilities; show hit/save, effect, range, cost, and remaining uses. Filter by action category without tracking action budgets.
4. Rollable skill, saving-throw, and initiative bonuses; keep calculation expansion separate and preserve sortable tables.
5. Compact spell rows with casting time, range, attack/save, effect, concentration/ritual indicators, search and filters. Show casting attack/DC per source for multiclass characters. Preserve original-level grouping, slot visibility preference, upcasting, and separate roll/application behavior.
6. Player-facing resource labels: remaining/maximum and recovery first; move reservations and provider details into expandable explanations. Keep shared pools unified.
7. Put race and all class levels beneath the character name; remove duplicate name presentation from details.
8. Add a status area for conditions, concentration, defenses, and conditional roll bonuses. Rules behavior belongs in the engine/System, not prose inference.
9. Inventory search/category filters and structured properties; retain money at the top of Items and existing equipment/attunement support.
10. Persistent feature/spell/item details drawer retaining scroll and tab context, alongside existing new-tab links.
11. Shared roll history: ability checks currently use component-local state while Feature rolls persist. Preserve resource spending on roll and separate application; do not add free rerolls.
12. Rest preview showing affected pools and relevant Hit Dice controls before completion.
13. Extend existing System display configuration with primary-stat roles, action columns, status displays, and resource presentation types; avoid hardcoded HP keys.
14. Separate presentation-only character edits from rule evaluation; improve keyboard-accessible tab semantics and touch-accessible explanations.

Preserve custom tab order, separate Skills and Items tabs, explicit calculation details, System-defined terminology, and character validity diagnostics. First implementation phase should cover overview, HP controls, and skill/save rolling; second phase Actions and spells.

Reference: https://dndbeyond-support.wizards.com/hc/en-us/articles/7747193980820-Character-Header and https://dndbeyond-support.wizards.com/hc/en-us/articles/7747193946388-Sheet-Sections . These describe product patterns; they are not sources for imported game rules.

## System-loading optimization assessment (2026-10-11)

Status: source-based assessment, not a timing benchmark or implemented optimization. React 19.2.4 with Vite and local IndexedDB is the current architecture.

### Observed loading path and costs

- DatabaseApp waits for both prototype template downloads before loading IndexedDB. Those files total approximately 1.73 MB uncompressed and use no-store. Template loading failures currently prevent opening the saved workspace.
- WorkspaceDatabase reads all Systems and characters, then serializes the retrieved structured objects so readWorkspace can parse them again.
- readWorkspace calls parseSystemFile; registry loading calls it again. Even cache hits still traverse safe(), stringify the full System, and clone it. The existing cache saves validation work but not all traversal/allocation costs.
- Prototype reconciliation creates before/after registries even when there is no replacement. App creates another registry afterward. Engines are cached within each registry, but that cache is not shared between these registries.
- loadSystemFile reads each linked asset/cache entry sequentially and writes cache entries sequentially after validation. Independent files could load concurrently. Versioned caching already skips unchanged asset downloads, but assembly and full validation still run.
- resolveSystemFile reparses documents and serializes the expanded result before parseSystemFile parses it again. Shared references expand into repeated structures.
- Bundled JSON and templates are fetched with no-store, including Vite-emitted asset URLs. Keep manifest freshness, but allow normal caching for verified content-hashed immutable asset URLs.
- CharacterBuilder, ClassDetail, and FeatureDetail are eagerly imported by App. Character evaluation also depends on the entire character object, including presentation-only changes.
- StrictMode initialization already shares a Promise: disabling StrictMode is not a recommended optimization.

### Recommended sequence

1. Instrument cold import, warm startup, unchanged reload, one-asset update, and character navigation. Time fetch, JSON parsing, reference expansion, validation, compilation, reconciliation, database commit, and first usable render separately. Record main-thread long tasks, transferred bytes, and engine/validation invocation counts. Use production builds and representative multiclass/caster saves; report medians rather than inventing speedup claims.
2. Load independent assets with bounded concurrency (for example four reads), retain in-flight Promise deduplication, cycle/depth/size limits, and all-or-nothing publication. Batch IndexedDB reads/writes where possible. Do not publish cache entries as trusted until package validation succeeds.
3. Accept structured database objects directly instead of stringify/parse round trips. Introduce an internal immutable validated System representation and reuse registry/compiled catalogue instances across reconciliation and UI. Public imports must remain fully validated; a version number alone does not make arbitrary imported data trustworthy.
4. Allow HTTP caching of immutable emitted assets and cache template files by their emitted URL/version. Start raw database reads and template reads together where feasible; keep the authorized every-run compatibility check and sample rebuilding/deletion behavior. Do not bypass reconciliation to make startup appear faster.
5. Put parsing, compilation, and compatibility checking in a Web Worker if timings show main-thread blocking. Keep engine ownership in the worker where practical and return compact serializable view data; returning whole compiled catalogues can introduce expensive structured-clone work. Preserve atomic saves and existing optimistic multi-tab locking.
6. For partial updates, track dependency invalidation: a changed block or stat can affect many classes/features. Asset-version caching currently optimizes I/O, not incremental compilation. Reuse unchanged data only where dependency analysis proves it safe. Include engine/schema version in any persistent compiled-cache key.
7. Code-split secondary routes with React.lazy and Suspense after measuring JS startup costs. Render progress stages such as Reading saved Systems, Validating rules, and Checking characters. Preserve the requested disabled interactions during actual System replacement.

### React API applicability

- lazy + Suspense: defer route component JavaScript and provide loading boundaries. They do not automatically cache JSON or reduce validation work. Suspense does not detect ordinary fetching inside Effects.
- useTransition: already used for navigation; schedules non-urgent React updates and exposes pending state. It does not move synchronous parsing/engine evaluation onto a background thread.
- useMemo / memo: reduce repeated computation/rendering when inputs have stable identities. Treat them as performance optimizations, not durable validated-data storage. The existing engine registry should remain the owner of engine caching.
- useDeferredValue: useful for catalogue filtering while typing; does not accelerate initial System loading or independently debounce network requests.
- use: can read a stable cached Promise under Suspense; the application or a compatible data layer still needs to own Promise caching, invalidation, cancellation, and errors. Avoid constructing new Promises on each render or adopting undocumented Suspense integrations.
- cache: React's cache API is for Server Components, not a browser IndexedDB cache. Server Functions are not a built-in backend for this static GitHub Pages deployment. A server/framework migration is unnecessary for the identified bottlenecks.

Recommendation: retain the client-only architecture. Optimize the loader and data ownership first; use React APIs for route splitting and responsive presentation. Add a fetching library only if query lifecycle complexity justifies it, not as a substitute for engine/loader optimization.

Official React references: https://react.dev/reference/react/Suspense , https://react.dev/reference/react/lazy , https://react.dev/reference/react/useTransition , https://react.dev/reference/react/useDeferredValue , https://react.dev/reference/react/use , https://react.dev/reference/react/cache .

### Loading optimizations implemented (2026-10-11)

The loading recommendations above now have the following implementation:

- Package reads use bounded four-way concurrency with one read per referenced path; reference order, cycle/depth/size checks, complete validation, and publication only after success remain intact. Unchanged per-asset versions still use IndexedDB.
- A bundled Web Worker resolves and validates imported/bundled packages and validates restored database Systems. Selected files are transferred as File objects and read on demand. The main thread accepts immutable snapshots only from its own worker or its own validation fallback; public mutable imports still receive full validation.
- Validated snapshots are deeply frozen and identified by a private WeakSet. Reusing those snapshots avoids repeated safety traversal, serialization, and cloning. Registries share compiled engines by snapshot identity and configuration; a replaced snapshot gets a new cache. Unloading still disables access in the owning registry.
- IndexedDB workspace decoding accepts structured records directly. Asset caching reuses its database connection; workspace reads overlap template loading. Template Promises and concurrent bundled-load Promises are deduplicated, failed template loads can retry, and returned templates are copied to preserve independent character editing.
- Production immutable asset URLs use HTTP caching. Manifest checks remain fresh; in-memory bundled snapshots are reused only when System identity, contentVersion, and the asset-version map match. Development bypasses snapshot and persistent asset reuse so uncommitted JSON edits cannot be hidden by an unchanged version. Changed packages still receive full cross-asset validation rather than unsafe partial compilation.
- Validation uses private per-run stat/Feature indexes. Engine stat-definition lookups use an index. Rules-link results are cached with exclusions included in the key, a 256-entry bound, an 8,000-character text bound, and isolated return arrays.
- Character-sheet evaluations are cached by engine and complete rules state, excluding only name, notes, tab order, and display preferences. Structural checks still run, cached results are frozen, and only eight characters per engine are retained. Commands continue evaluating independently. System replacement, resource changes, and rule edits cannot reuse an old result.
- App, character builder, Class details, and Feature details use lazy screen loading with Suspense; expensive screen components receive stable callbacks and memoization. Spell groups and slot summaries are memoized by evaluation result. A screen error boundary handles failed/retired deployment chunks.

Run `npm run benchmark:loading` to measure cold package validation, first engine creation, and repeated engine reuse. Browser User Timing entries `system:package` and `system:validate` include worker turnaround and transfer. These measurements do not represent the entire time to an interactive character sheet.

Observed local runs: before this change, package loading was approximately 32.2 seconds and fresh registry/engine creation 4.4-4.8 seconds. With immutable reuse, repeat registry/engine creation rounds to 0 ms (under 1 ms); one later cold-validation run was 27.4 seconds. Cold timings vary with machine load, and no percentage speedup is claimed. Full cold validation remains substantial, but runs in the worker so the loading UI can remain responsive. Further persistent compiled-data caching needs an explicit schema/engine-version and dependency-validation design; it must not trust arbitrary imports solely by their declared version.
# Automatic UI releases

HP uses a compact overview card by default. `sheetDisplay.health.compactDefault` can set a System's default, and `displayPreferences.healthExpanded` retains each character's override. The expand/collapse icon switches between the compact current/maximum value and the full health controls. Build Choices groups choice slots and automatically granted Features by acquisition level, lazily showing nested grants. Level-up controls only appear there. Feature headings and calculation sources prefix the immediate owning Feature or direct Class choice name (`Fighting Style: Defense`), without inserting the Class name as a parent tag. Canonical rules text and definition names remain unchanged. The version badge shows only the version and remains fixed to the viewport's bottom-right corner.

Stat-table sections can set `calculationPlacement` to `column` (default) or `belowValue`, and `valueAlignment` to `left` or `right` (default). DnD saving throws use `belowValue` with left alignment; skills retain the Calculation column. These settings also appear in the System data editor.

Character-sheet calculation panels use the engine's evaluated `StatResult.contributions`, each with a signed `amount` and source `label`. They follow selected expression branches and effective modifier stacking, replace overridden bases, and omit zero contributions. Race/parent Features and equipped items supply source names. Multiplication scales the contributing amounts and includes its source. Effective bounds replace superseded terms; final rounding/clamping shows the evaluated value and its limit source. Panels display contributing sources without rule formulas or conditional expressions. The original modifier audit remains available in `StatResult.modifiers` for diagnostics. This evaluation metadata does not change saved characters or System assets, so existing sample characters pick up the display on the next UI load.

The pre-commit hook versions UI changes before linting. It compares the staged UI sources, public assets, entry HTML, Vite/TypeScript configuration, dependencies, and lockfile against HEAD. Tests, documentation, release tooling, and version-only edits do not trigger a release.

- Patch: styles, existing image/font assets, visible JSX copy, and tooltip/placeholder text.
- Minor: added files or behavior and other implementation/configuration changes whose compatibility cannot be determined automatically.
- Major: removed UI files or exports, changed exported function signatures or type definitions, and incompatible dependency/configuration changes detected by the shared JSON release classifier.

These are conservative source-based defaults, not proof of semantic compatibility. When the intended change differs (for example, an implementation bug fix is a patch, or a persisted character format change is major), explicitly classify the commit. In PowerShell, set `$env:UI_RELEASE_TYPE = 'patch'`, `'minor'`, or `'major'` before committing and remove it afterward with `Remove-Item Env:UI_RELEASE_TYPE`. Review this override along with the staged diff; it applies to all UI changes in that commit. Authors may also supply a higher package version; the hook never lowers it.

The hook synchronizes `ui/package.json`, the lockfile root, and the lockfile package entry, then stages those metadata files. Both files must be fully staged or unchanged to avoid capturing unrelated edits. Failed-commit retries compare against HEAD and do not repeatedly increment the version. The existing bottom-right version note reads the package version, so each subsequent UI build displays the release automatically. Install hooks with `npm run hooks:install`; verify classification with `npm run version:test`.

Roll history is a System-defined tab (`content: "rolls"`); an enabled legacy `sheetDisplay.rollHistory` also adds the tab if absent. Checks save their modifier sources at roll time, so later stat changes do not alter recorded explanations. Spell tabs are hidden while the character has no granted spells, without discarding the saved tab order. Inventory entries expand inline; **View item** uses a normal item-page anchor with System and return-location information, supporting new tabs and browser navigation.


## Claude-style layout (2026-10-30)

Plan and reference reviews: [claude-style-ui-plan.md](claude-style-ui-plan.md).

- **Tokens.** Every colour is a custom property in the `:root` block at the top of `ui/src/styles/app.css`, with a dark palette under `prefers-color-scheme: dark`. `npm run lint` rejects colour literals anywhere else (`tools/lint-css-colours.mjs`). Fonts are system stacks; the serif is reserved for page titles.
- **Shell.** The sidebar is gone. `AppHeader` holds the brand, System picker, save status and New character, with text tabs below. The character list lives on the Characters page and in the character switcher beside Export. The old `sheetDisplay.sidebarCollapsed` setting is still accepted in System JSON but no longer has an effect.
- **Catalogues.** `CatalogueBrowser` renders Classes, Races and Features as `DataTable`s. Search (`q`), category tags (comma-separated `tag`), `level`, `sort` (column key, `-desc` for descending; the older `name`, `name-desc` and `level` values still work) and `page` stay in the URL. Rows open in place: Classes show their level rows as a Feature tree; Features show rules text and their contents.
- **Feature tree.** `FeatureTree` renders nested rows with no depth limit: source tag, name, one-line description and a right-hand count or state. Indentation stops growing after four levels (two on phones) and deeper levels show their path. Catalogue trees (`definition-tree.tsx`) build children lazily and list the first 40 options of a choice; a wrapper that only grants a same-named Feature is collapsed into it. Character trees (`instance-tree.tsx`) follow instance parents; resource pools and rolls stay inside the parent's detail. Open rows are remembered per character in browser storage.
- **Sheet.** The overview is one stat strip joined to the compact HP tile. `sheetTabs[].placement: "rail"` keeps a tab's content in a left column at 1100px and wider (hidden while Build & choices is open); narrower screens show it as a normal tab. DnD5e places Character sheet and Skills in the rail. Spells render as one compact table per level with the System's spell columns; descriptions open in the row. Abilities render as hairline rows. On phones the section tabs and a one-line vitals summary stay pinned while scrolling.
- **Not yet done.** Limited-use pips in action group headers, HP management and roll history inside the drawer on phones, and filter chips for the spell and ability action filters remain on the plan.
