# React character workspace

The atomic-block prototype starts a fresh workspace under `ttrpg-feature-forge:v2`; old prototype saves are intentionally not loaded or migrated. The resource sheet lists shared resources supplied by active Features, including current amount, maximum (or no maximum), reservations, available amount, recovery event and amount, and provider names. Feature-created stats appear alongside System stats only while active providers exist. Raising a tracked maximum does not refill its current balance.

The first React UI is implemented before additional Systems. It uses the existing DnD5e 2014 JSON milestone and accepts other engine-compatible System files. The UI source lives in `ui/`; the generic engine remains in `src/`. UI components call engine commands rather than duplicating calculation, eligibility, resource, or retraining rules.

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

1. Load the bundled DnD5e 2014 System from the welcome screen, or upload a System JSON from **Systems**. Export loaded System files and unload them independently. The engine validates every configuration before loading.
2. Browse **Classes** and **Features** without a character. Search names and descriptions, filter Features by tag, inspect class progression by level, follow Feature links, and inspect components, prerequisites, required resources, parameters, scaling tables, and complete JSON. Choose a browse configuration through the System's declared option domains.
3. Create a character with a name, System, options, and optional starting Class and level. Initial choices remain editable in construction mode. Add or remove independent class progressions during construction, edit levels and basic stats, and choose Features from level-filtered slots. Selecting a parent exposes its nested slots and parameter controls. Eligibility results come from the engine; candidate lists are paged to avoid evaluating the entire spell catalogue on every interaction.
4. Keep an incomplete or invalid draft while repairing diagnostics. The builder displays provisional totals and unmet requirements. A selected invalid Feature does not bypass engine eligibility or become a legal completed character. Finalization requires a valid build and enables ability spending and recovery.
5. Inspect calculated stats and their modifiers, acquired Features, resources, recovery rules, abilities, and source Features. Explicit actions invoke engine resource commands. Spell casts spend engine-validated resources while action timing is handled at the table. Configure selected recovery allocations against recorded rest/recovery events. Settle or release reserved uses explicitly.
6. Export/import character JSON, duplicate characters, and reopen them from the sidebar. Saves pin System and catalogue revisions. Unloading a System preserves characters and their export controls; reloading that revision restores editing. Invalid imported selections remain available for repair.

Changes to a finalized character show an engine edit preview before application, including affected Features, stats, resources, and resulting validity. Declared retraining events must still be supplied. Edit build explicitly reopens construction after finalization, preserving resource balances and rejecting unresolved reservations. This is available to imported samples as well as custom characters. Lowering a progression preserves its history and inactive selections as specified by the engine; adding later levels appends to the advancement ledger.

## Persistence and accessibility

The application stores loaded JSON Systems and character saves in browser `localStorage`, under `ttrpg-feature-forge:v2`. No backend or account is required. This storage belongs to the app's origin: development and preview URLs may have separate workspaces. Use JSON exports to transfer characters and Systems between origins or devices.

Storage failures remain visible and changes remain in memory. Export before closing when persistence fails. Malformed existing workspace data is not overwritten automatically; a recovery control exports the original stored text before starting afresh. Browser storage limits may be reached with several large Systems. IndexedDB is a suitable later persistence upgrade.

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

The structured custom Feature editor, explicit resource-binding and alternative-formula controls, custom advancement-history editing, full 2014 class content, DnD5e 2024, and PF2e remain later work. Loading manually authored engine-compatible JSON is already supported. The UI does not automate combat adjudication, spell effects, dice, targets, equipment inventory, or runtime rule triggers. Session turn/action controls are not persisted as character state.

## Descriptions and display names

The bundled 2014 JSON now retains Class traits and equipment text, Feature descriptions, and full descriptions for all 204 Wizard spells. Class and Feature browsers show description previews and full source text. Selected Features and class traits can be expanded inside the builder; acquired Features can be expanded on the character sheet. Spell wrappers display the shared canonical spell description. Paragraphs are preserved and imported text is rendered as plain text.

All displayed Feature rules use the original source wording stored in JSON. Supporting building blocks use corresponding SRD passages, and spell wrappers display shared original spell text instead of implementation summaries. Mechanical component notes remain inside engine definitions. Browser and candidate previews are excerpts of the same source text, including shared descriptions; they do not summarize or rewrite it.

Class progression rows display full source descriptions by default beneath each granted Feature and each explicitly listed selection option. Shared descriptions, automatic references, and reference popups use the same renderer as Feature detail pages.

When a description starts with a standalone heading matching the displayed Feature title, the renderer omits that repeated heading. Other source headings and the stored source text are preserved. Granted Class entries use the Feature title without an additional entry-ID label.

Rules text automatically links references using the engine's `FeatureTextIndex`. Links preserve the original words and open a native dialog containing the target Feature's source text and an **Open Feature** link. References inside the popup update that same popup; ambiguous names offer all matching Features. Escape and Close dismiss the popup and return focus to the originating link. Links include the exact System, revision, and catalogue identity; ordinary unambiguous links also support opening the Feature in another tab. Classes, Feature pages, choices, acquired Features, and ability source rules use the same renderer. Imported text remains inert even when it contains HTML or Markdown.

All bundled Features have `displayName` values. Systems supply tag labels with `tagDisplayNames`; browsers, filters, selections, source links, advancement lists, and sheet labels use these display names while retaining internal identities for rules and saves. Older/custom Systems fall back to Feature names and humanized tag IDs.

On startup, the UI automatically fetches current bundled 2014 descriptions for an already loaded System, checks that its mechanical rules match, and saves the updated source text, aliases, and labels to browser storage. This prevents a previously saved System copy from hiding new SRD descriptions after an application update. A visible status reports the refresh; failures are shown with a manual retry through **Systems → Update bundled descriptions**. Customized or different rules are never replaced. Character saves and their System/catalogue revision pins remain unchanged, and an in-flight update cannot restore an unloaded System or overwrite its replacement.

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

## System loading and content containment

The Systems page provides a source dropdown for bundled DnD5e 2014 or another System JSON file. Each loaded System has an accessible refresh-icon button. Bundled reloads fetch without caching; imported Systems request a replacement JSON file. Reload replaces the same ID and revision atomically, keeps character saves, and rejects missing catalogue/content revisions or changes that invalidate a previously valid character. A concurrent workspace change cancels replacement. Other revisions can be loaded separately.

Responsive content wraps within shrinking grid and flex children. Cards grow vertically with their prose; constrained editors, dialogs and large tables retain internal scrolling. Skill calculation disclosures wrap within their cells. Mobile layouts stack controls and columns rather than allowing labels to escape their boxes.


The Abilities heading has an icon-only score/modifier swap control with immediate hover and keyboard-focus help. Skills and saving throws expand calculations into a separate column. Source descriptions render paragraph breaks, bullet lists (including inline Unicode bullets), and numbered lists while retaining automatic rules links and escaping imported HTML.

Spell slots have a dedicated display with remaining/maximum values, recovery conditions, and increment/decrement controls. Slots with no uses remaining are hidden by default; Show all spell slots reveals them. Spells stay visible and are grouped by their original level. Use Spell offers a casting-level picker when multiple engine-provided casting modes exist, including higher slots and ritual modes. Exhausted modes are disabled; the engine validates and spends the selected slot.


Character details include an editable Name field, race, and each active Class level. Add multiclass sample creates a fresh custom Human Fighter 2 / Wizard 3 named Arden, separately from the five official Starter Set samples. Edit build permits changing origin selections and class progressions; finalize again before using resources.

Features & Traits nests child Features under their owning instance. Resource children render their current pools inside the parent instead of repeating the ability description. Nested rule bodies mount on expansion. On character views, recognized ability modifiers, Class levels, and proficiency bonus references display current values with the original value name on hover; source catalogue descriptions remain unchanged. Granted Roll Features offer dice controls under their parent ability. Rolling Second Wind spends its use immediately and saves the total; a separate Apply healing button applies that total once, up to maximum HP. There is no reroll control. Results persist across navigation and save/load and show the individual dice and bonus on hover. Other targets and conditional effects remain table decisions. Resource controls and spell slots share the same 2rem square one-step minus/plus buttons.

Loading indicators cover initial startup, navigation, character tabs, and System loading. Engines are reused per loaded configuration, catalogue search runs only on the Feature list, immutable System packing is cached, and requirement lookup tests a single Feature against selection filters instead of repeatedly scanning every Feature. Explicit System reload accepts additive manifest entries while retaining character choices and balances; removing or changing pinned revisions is rejected.

For spells with Roll Features, Use Spell opens casting options and roll controls without spending a slot. Rolling spends the selected mode and retains the result on the spell card. Mark applied records manual target application once, independently of casting. Spell descriptions do not expose a second free dice control. Feature views also require a matching casting option.

The character-name field fills the space before the status badge. Recovery buttons lead the resource view; currency labels include symbols in their headings. Spell levels are native collapsible sections, initially expanded. Spell use controls appear only for granted rolls or positive resource costs, use the label “Use Spell”, and show casting consumption beside the control.

Feature `processDescriptionAutomatically` controls automatic value replacement in unchanged prose. `descriptionOverride` is an array of exact `originalString` / `overrideString` pairs; replacement text resolves explicit `{{stat:STAT_ID}}` and `{{class:CLASS_ID}}` tokens only. See [Description replacements](description-replacements.md) for all supported syntax, matching rules, and the complete bundled stat/Class token reference. Hit Points replaces only “your Constitution modifier” with `{{stat:modifier.constitution}}`, retaining its class-level wording.


The favicon is an original vector wizard-hat d6 in `ui/public/wizard-die.svg`, pending visual review.

Roll histories can be cleared per Feature or for the entire character from the resource view. Clearing removes stored results, including unapplied ones, without changing resources, rest state, or event IDs. Cleared results can no longer be applied. Spell Roll Features are generated only from text before the “At Higher Levels” heading; higher-slot effects remain outside reference-roll generation. System reload can retire removed Roll definitions while preserving character balances and validating the updated build. The top-left brand uses the same wizard-d6 icon as the favicon.


### System-authored character tabs and details

`system.sheetTabs` is an ordered array of `{ id, name, content, sections? }`. Content may be `choices`, `sheet`, `features`, `resources`, `notes`, or `sections`. The `sections` array references IDs in `system.sheetSections`; `sections` content creates a custom stat tab, while `sheet` content filters the main sheet's stat panels. IDs must be unique and references must exist. Omitted tab configuration uses the standard tabs. DnD5e places Skills immediately after Character sheet.

`system.importantDetails` lists the exact note labels displayed on Character sheet (DnD5e: Name and Alignment). Race and class levels remain visible there. Other detail labels appear in Notes. Add note creates another editable text entry with no application text-length limit; browser storage capacity still applies. Notes and `character.displayPreferences` travel with character exports. `modifierFirst:SECTION_ID` remembers the ability score/modifier toggle. Clicking an ability name rolls 1d20 plus its calculated modifier, with the die and modifier in the result tooltip; these checks do not spend resources.

Hit Points leads both Character sheet and Abilities & resources. The validity button toggles build counts; invalid builds reveal them automatically. Loading uses a modal spinner that blocks pointer input, keyboard interaction, and background focus until loading finishes. DnD5e base ability inputs accept integral values from 3 through 18; racial and Feature bonuses apply to the derived scores independently. Existing loaded Systems receive presentation updates automatically, but changed input rules require Reload System, which rejects changes that would invalidate a previously valid character.
