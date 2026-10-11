# System data editor

Open **System data** in the sidebar to view and edit a loaded System using forms. Choose Classes, Features, Spells, Items, Item Features, Building blocks, System settings, or System options. Search records by name or ID, or browse using Previous and Next. Add and delete records using their buttons.

Expand groups to edit class progression, nested Feature grants and choices, prerequisite logic, formulas, resources, rolls, item composition, stats, currency, reset conditions, and sheet layout. Value type dropdowns select expression or component variants; Add field exposes optional settings. Array entries support adding, removing, and reordering. Feature and stat references have ID suggestions.

Classes and System settings apply to the selected rules configuration; shared Features, spells, and items apply across configurations. Unsaved edits persist while navigating editor categories and records. Save or discard before switching Systems. **Validate and save** checks engine schema, references, and existing character compatibility before replacing the System in the local browser database. Failed validation leaves the previous System and characters intact. Changes increment the local semantic version automatically. Export from **Systems** to keep a portable copy; browser edits do not change bundled source files. Changing IDs does not automatically rewrite references; repair dependent records before saving.

Forms derive their schema from engine model types. After changing those types, run `node tools/generate-editor-schema.mjs`. Linting checks that the generated form schema is current.

Build Choices are sorted by acquisition level, including nested selections. Missing selections and selections with invalid descendants have a red border and a Needs attention badge. Cleric domain spells are granted automatically at their required Cleric levels; ordinary prepared spells remain choices.
