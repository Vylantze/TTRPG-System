# TTRPG System

A generic character system in which classes, feats, and class abilities are composed from reusable Features.

The generic TypeScript engine and the first [DnD5e 2014 character-building milestone](docs/systems/dnd5e-2014-system.md) are implemented. See [engine usage and API](docs/engine.md) and the [Feature system specification](docs/feature-system-specification.md). The 2014 catalogue currently supports Fighter, Rogue, Wizard, SRD racial options, Acolyte, and Wizard spell selections. The first React UI is implemented ahead of the remaining System work; DnD5e 2024 and PF2e remain later milestones.

DnD5e 2014 rules and reference metadata are JSON files. The engine provides a browser-safe loader and System registry for the React UI to load and unload Systems. See the [JSON format and integration API](docs/json-systems.md).

Run `npm install --prefix ui` and `npm run ui:dev` to open the React character workspace. See [UI usage, scope, and verification](docs/react-ui.md).

Run `npm run build`, `npm test`, or `npm run demo` after installing the TypeScript development dependency. The engine has no runtime dependencies.

Install development dependencies with `npm install` and `npm install --prefix ui`. The root install automatically sets up the tracked Git hooks; existing checkouts can also run `npm run hooks:install`. The pre-commit hook runs `npm run lint` and blocks the commit if linting fails. Both projects' dependencies must be installed before committing.

`npm run lint` runs ESLint, the single-definition checks, and engine/UI type checking without modifying files or emitting build output. Warnings also fail the check. Run `npm run lint:fix` explicitly to apply ESLint's automatic fixes. React rules apply only to UI source; non-component display helpers live in separate modules for Fast Refresh. Deliberately omitted properties in object-rest expressions are allowed.

The TypeScript-based checks reject syntax errors, `debugger`, `var`, and files containing more than one class, interface, type alias, or enum definition (including nested declarations). Inline object types, functions, imports and re-exports are allowed. Model definitions live in `src/model/`; other extracted definitions live in adjacent `types/` folders. Compatibility barrels preserve existing public imports. Generated output, dependencies and hidden folders are excluded. The hook checks the working tree; keep staged changes synchronized with the files you have validated. Run `npm run lint:test` to check the lint rules and ESLint configuration.

Run `npm run demo:dnd2014` for a valid Fighter 3 / Rogue 2 character. SRD adaptations carry [Creative Commons attribution](NOTICE.md); the System documentation distinguishes calculated rules from descriptive coverage.

The specification includes a React UI plan for character creation, direct Class and Feature browsing, and future custom Feature authoring. Implementation proceeds from the engine to the UI.

Each ruleset is a **System**. Its canonical document is:

- [DnD5e 2014 System](docs/systems/dnd5e-2014-system.md)
- [DnD5e 2024 System](docs/systems/dnd5e-2024-system.md)
- [PF2e System](docs/systems/pf2e-system.md)

The specification uses Anime5e as its design reference, with official D&D rules and SRDs authorized for the [DnD5e System comparison](docs/systems/dnd5e-system-comparison.md). Implement separate 2014 and 2024 5e systems before PF2e. Dungeons and Dragons 5e, DnD5e, and 5e are interchangeable project terms; Pathfinder2e and PF2e are also interchangeable.
