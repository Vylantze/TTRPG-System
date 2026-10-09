# Loading Systems from JSON

Automatic references can use optional display-only `textLinkContext`, for example `{"before":["cast","cast the"],"after":["spell","cantrip"]}`. At least one immediately adjacent phrase must match, ignoring case and whitespace, before that Feature becomes a link. Phrase boundaries prevent matches such as `forecast` or `spellbook`. Shared-description wrappers obey the canonical target's context. The bundled System uses this for ambiguous spell names such as Light, Shield, and Darkness, leaving equipment and ordinary prose unlinked. Unqualified ambiguous mentions are deliberately left as plain text; author additional context phrases when appropriate. Source text is never rewritten. Description refresh updates this metadata without changing character rules or revision pins.

The engine accepts a self-contained, versioned `ttrpg-system` JSON file. DnD5e 2014 is defined in [system.json](../src/systems/dnd5e-2014/system.json). Its [metadata.json](../src/systems/dnd5e-2014/metadata.json) supplies display and reference data: armor, Wizard spell headers, class summaries, and coverage. Loading `system.json` is sufficient to evaluate characters; the optional metadata file does not execute rules or affect calculations.

The TypeScript module at `systems/dnd5e-2014` is a compatibility adapter that imports these files and calls the generic loader. It contains no class rules, progression generators, spell calculations, or rule commands. The core engine entry point does not import bundled System content. The React application can load user-selected files without knowing their System names.

## File contract

```json
{
  "format": "ttrpg-system",
  "version": 1,
  "id": "example:system",
  "revision": 1,
  "options": {},
  "features": [],
  "configurations": [{
    "options": {},
    "id": "example:catalogue",
    "revision": 1,
    "system": {
      "id": "example:system",
      "revision": 1,
      "name": "Example System",
      "stats": [],
      "allowMultipleClasses": false,
      "characterLevel": 0
    },
    "classes": []
  }]
}
```

Each option declares a finite `values` array and a `default` belonging to that array. Configurations contain every combination exactly once. Their `system` and `classes` are explicit data; all configurations share the file's `features`. This avoids executable option builders or arbitrary patches. DnD5e 2014 supplies twelve configurations for three ability-generation methods, optional multiclassing, and optional feats, retaining the previous catalogue identities.

All configuration System identities must match the file identity. Every catalogue is validated before loading completes, including configurations the user has not selected. Engine validation checks references, compositions, formula types, prerequisites, resources, and cycles. Parsing rejects unsafe object keys, non-JSON values, unknown format versions, incomplete configurations, excessive nesting, arrays over 10,000 items, and text files exceeding 10 MB in UTF-8. JSON never imports code, evaluates source strings, fetches dependencies, or accesses the filesystem.

`parseSystemFile(textOrObject)` returns an isolated, validated file. `catalogueFromSystemFile(file, options)` returns a cloned catalogue suitable for `new Engine(...)`. Imported content uses the engine's existing expression and component vocabulary; adding a new rule primitive requires an engine change. Classes and Features can be browsed through `engine.catalogue.classes` and `engine.catalogue.features`; `getFeatureCoverage(catalogue)` reports component automation coverage independently of the System.

## React integration contract

```js
import { SystemRegistry, serializeCharacter } from 'ttrpg-system';

const registry = new SystemRegistry();
// selectedFile is a browser File from an upload control.
const system = registry.load(await selectedFile.text());
const available = registry.list();
const engine = registry.createEngine(system.id, system.revision, {
  abilityMethod: 'standard-array', multiclass: false, feats: false
});
// Generic UIs derive their option controls from available[].options.
const draft = engine.createCharacter('hero', 'Hero');
const saved = serializeCharacter(draft);
registry.unload(system.id, system.revision);
```

The UI keeps the registry in application state, refresh its available-System list after successful loads or unloads, and display loader errors without replacing existing content. It should render configuration controls from option domains, then use the existing engine selection and edit APIs to construct characters. The [React UI baseline](react-ui.md) implements this lifecycle before additional Systems.

Loading is atomic. Duplicate System ID/revision pairs are rejected; explicitly unload before replacing one. Catalogue ID/revision pairs cannot collide between loaded Systems. Multiple Systems and explicit revisions can coexist. An unloaded System becomes unavailable through registry lookup, while character saves and selections remain intact. Previously acquired Engine objects are immutable snapshots and remain usable; the UI must discard active handles on unload and resolve through `engineForCharacter(character)` before resuming work. This method requires the saved System and catalogue revisions, with no automatic fallback to newer rules. Reloading those revisions restores availability; evaluation still checks the saved content revision manifest. Persist uploaded files separately if availability should survive application restart.

Authoring tools should increment appropriate System, catalogue, and content revisions for changed rules. The registry does not establish the authenticity of a revision label. Unloading and uploading different rules under an unchanged identity is a deliberate replacement, so publishers must maintain version discipline. Character migration continues to use the engine's explicit migration commands.

## Data-driven command policies

`SystemDefinition.commandRules` optionally configures reusable engine commands. DnD5e 2014 declares both policies in its JSON:

- `spellTurn` identifies the capability metadata keys for casting ability, spell level, casting time, and ritual status, plus the bonus-action and action casting-time values. Engine `castSpell` applies the bonus-action spell restriction in either order. Callers supply and retain the returned turn ledger, reset it at turn boundaries, and retain the returned action budget. Route spell casts through this command; low-level `useAbility` does not maintain the caller's turn ledger.
- `selectedRecovery` identifies the supplying capability by name, a required recovery event, an optional boundary event, a budget stat, an optional event fingerprint kind for save compatibility, and named target resources with scopes and positive weights. Engine `recoverSelectedResources` checks a completed event after the boundary, settled expenditure, weighted capacity, and immediate capability costs before restoring the allocation atomically. Ambiguous capabilities or resource pools are rejected. Target aliases cannot refer to the same pool twice. DnD5e 2014 names targets `1` through `5`, weights them by spell-slot level, uses `arcaneRecoveryBudget`, requires `short-rest`, and uses `new-day` as its boundary.

These commands reside in `src/policy-commands.ts` and are exported by the core engine. `castWizardSpell` and `recoverArcaneSlots` remain compatibility aliases. No command checks a DnD System ID or hardcodes its resource keys, casting ability, budget stat, or event names. The supported command algorithms are engine primitives; JSON supplies their parameters. New spell-turn rule algorithms need a new engine policy primitive rather than executable content in a System file.

## Editing and source extraction

Features can store `displayName`, plain-text `description`, and `source`. Classes can store `description` and `source`. A System's `tagDisplayNames` maps internal tag IDs to display names; tag IDs remain strings in Feature definitions and filters. The UI uses Feature display names and tag display names, with fallbacks for older/custom Systems. The engine validates these fields without using them for rule evaluation or changing character identity.

`textReferences` optionally lists Feature IDs whose shared descriptions should also be displayed. Prepared/book/cantrip/mastery/signature spell wrappers reference the canonical spell text, avoiding repeated descriptions. References must resolve but grant no Features, satisfy no prerequisites, and affect no stats. The UI renders one level of shared text and links to its source Feature; even circular text references cannot cause recursive expansion. Imported text is rendered as plain text.

The bundled 2014 data supplies source passages (directly or through shared references) and display names for all 825 Features, all 17 tag identities, source-backed introductions for Fighter, Rogue, and Wizard, and full source descriptions for 204 Wizard spells. Supporting skill, Expertise, tool, language, ancestry, and choice building blocks use the corresponding SRD clauses. Spell wrappers store `textReferences` without a project-authored description. `tools/extract-dnd2014-text.py` reproduces these display fields from the pinned official PDF using the development-only `pdfplumber` library. It excludes progression tables already represented by class level entries and normalizes PDF typography and paragraphs while retaining original wording.

`FeatureDefinition.textAliases` optionally lists alternate source names for prose linking (for example, `Sleight of Hand` for `Sleight of Hand Proficiency`, or `Sculpt Spells` for the composite School of Evocation Feature). Each entry must be a nonempty string and aliases within a Feature must be unique. Aliases may overlap across Features, and are display metadata with no effect on evaluation or acquisition.

The core `FeatureTextIndex` indexes display names (falling back to names) and aliases from a catalogue's Features. `resolve(text, excludedIds?)` returns original source spans with UTF-16 start/end offsets and matching Feature IDs. Matching uses whole names, prefers longer overlapping names, and tolerates case, whitespace, apostrophe, and dash variants without rewriting the returned text. Identically named wrappers with direct `textReferences` resolve to their shared source. Genuine ambiguity retains all targets for a UI picker, and excluded IDs avoid self-links. A UI must use only the current System/catalogue's index, escape imported text, and render these spans as links rather than treating the source as HTML or executable Markdown.

Edit `system.json` to change rules, Features, class progression, or option configurations. Edit `metadata.json` for display/reference data. `tools/extract-wizard-spells.py` updates the metadata file's Wizard spell headers from the authorized SRD PDF. It does not regenerate mechanical Features; review corresponding Feature text and capability metadata explicitly when source spell headers change. The bundled rules are the existing partial 2014 milestone, with the same nine unsupported classes and descriptive combat effects.
