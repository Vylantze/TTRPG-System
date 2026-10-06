# React character workspace

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
5. Inspect calculated stats and their modifiers, acquired Features, resources, recovery rules, abilities, and source Features. Explicit actions invoke engine resource commands. Spell casts use the loaded JSON turn policy. Set session action budgets to what is available at the table and use **Start new turn** to restore those entered budgets and reset the turn ledger. Configure selected recovery allocations against recorded rest/recovery events. Settle or release reserved uses explicitly.
6. Export/import character JSON, duplicate characters, and reopen them from the sidebar. Saves pin System and catalogue revisions. Unloading a System preserves characters and their export controls; reloading that revision restores editing. Invalid imported selections remain available for repair.

Changes to a finalized character show an engine edit preview before application, including affected Features, stats, resources, and resulting validity. Declared retraining events must still be supplied. Construction mode does not reopen automatically after finalization. Lowering a progression preserves its history and inactive selections as specified by the engine; adding later levels appends to the advancement ledger.

## Persistence and accessibility

The application stores loaded JSON Systems and character saves in browser `localStorage`, under `ttrpg-feature-forge:v1`. No backend or account is required. This storage belongs to the app's origin: development and preview URLs may have separate workspaces. Use JSON exports to transfer characters and Systems between origins or devices.

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

Automated interactive browser verification was blocked by the available browser tool (`ERR_BLOCKED_BY_CLIENT` for both local URLs). Local HTTP responses, React server-rendering checks, and production compilation were verified. Responsive rendering, keyboard interactions, download/upload dialogs, and complete click-through workflows still require a browser review; server rendering does not establish those results.

## Remaining scope

The structured custom Feature editor, explicit resource-binding and alternative-formula controls, custom advancement-history editing, full 2014 class content, DnD5e 2024, and PF2e remain later work. Loading manually authored engine-compatible JSON is already supported. The UI does not automate combat adjudication, spell effects, dice, targets, equipment inventory, or runtime rule triggers. Session turn/action controls are not persisted as character state.

## Descriptions and display names

The bundled 2014 JSON now retains Class traits and equipment text, Feature descriptions, and full descriptions for all 204 Wizard spells. Class and Feature browsers show description previews and full source text. Selected Features and class traits can be expanded inside the builder; acquired Features can be expanded on the character sheet. Spell wrappers display the shared canonical spell description. Paragraphs are preserved and imported text is rendered as plain text.

All bundled Features have `displayName` values. Systems supply tag labels with `tagDisplayNames`; browsers, filters, selections, source links, advancement lists, and sheet labels use these display names while retaining internal identities for rules and saves. Older/custom Systems fall back to Feature names and humanized tag IDs.

On the Systems page, **Update bundled descriptions** updates previously loaded bundled 2014 text and display labels. It compares all mechanical data before replacement and refuses to overwrite customized or different rules. Character saves and their System/catalogue revision pins remain unchanged.

Browser workspace storage now deduplicates repeated class and stat arrays across System configurations (storage envelope version 2, under the existing key). Version 1 workspaces remain readable and are rewritten on the next save. System import/export JSON and character JSON retain their original formats. The enlarged bundled content fits within the tested five-million-byte UTF-16 storage budget with an example character; storage failures still remain visible. Larger collections can still require JSON exports or a later IndexedDB migration.

The **Class Feature** category covers bundled class/subclass abilities, entry and HP benefits, fighting styles, class ASIs, and Expertise choices. Individual spells, racial traits, backgrounds, and the optional Grappler feat retain their own categories. This tag is available in the Feature browser filter and on Feature detail pages. Refresh also accepts category-tag changes when neither loaded nor incoming rules use those tags in prerequisites, maintenance, choices, or root-acquisition filters; mechanically referenced tags remain protected.

Feature pages and expanded character selections show **Levels & requirements**: direct Class progression grants/selections, content level, acquisition prerequisites, and maintenance requirements. Candidate cards show the same compact information. Boolean combinations retain AND, OR, and NOT grouping. Class progression timing and content level are labeled separately; a level-3 spell is not presented as requiring character level 3. Tag-based spell selections use their authored prerequisite stats instead of inventing a Class advancement level. Raw JSON remains available for inspecting full rule definitions.
