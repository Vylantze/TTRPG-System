# TTRPG System

A generic character system in which classes, feats, and class abilities are composed from reusable Features.

The generic TypeScript engine and the first [DnD5e 2014 character-building milestone](docs/systems/dnd5e-2014-system.md) are implemented. See [engine usage and API](docs/engine.md) and the [Feature system specification](docs/feature-system-specification.md). The 2014 catalogue currently supports Fighter, Rogue, Wizard, SRD racial options, Acolyte, and Wizard spell selections. The first React UI is implemented ahead of the remaining System work; DnD5e 2024 and PF2e remain later milestones.

DnD5e 2014 rules and reference metadata are JSON files. The engine provides a browser-safe loader and System registry for the React UI to load and unload Systems. See the [JSON format and integration API](docs/json-systems.md).

Run `npm install --prefix ui` and `npm run ui:dev` to open the React character workspace. See [UI usage, scope, and verification](docs/react-ui.md).

On **Characters**, select **Add 2014 Starter Set party** to create the five level-one pregenerated characters: Human Fighter (Noble), Hill Dwarf Cleric (Soldier), Lightfoot Halfling Rogue (Criminal), High Elf Wizard (Acolyte), and Human Fighter (Folk Hero). The action loads the bundled System if needed and preserves existing copies. Finalized characters open on their character sheets, with editable source, equipment, and reference notes. The numerical builds match the [official 2014 sheets](https://media.wizards.com/downloads/dnd/StarterSet_Charactersv2.pdf). Daily prepared spells use explicitly labelled application defaults. Cleric coverage is limited to level-one Life Cleric and the spell subset used by this party. Higher Cleric levels and multiclassing are rejected. Backgrounds reproduce these templates' proficiencies; their story-specific text is linked to the original sheets. Rebuild the committed character JSON with `npm run templates:build`.

The [hosted UI](https://vylantze.github.io/TTRPG-System/) deploys from `develop` through `.github/workflows/pages.yml`. Pushes run lint, engine tests, UI tests, and a production build before publishing `ui/dist`; pull requests targeting `develop` run the same checks without deploying. The workflow uses GitHub's Pages base path for all built assets, including System JSON and attribution. Hash-based navigation supports direct links without server rewrites. Character data stays in browser storage; local development and the hosted site have separate storage origins.

For a new repository, select **Settings → Pages → Build and deployment → Source: GitHub Actions** and allow `develop` in any `github-pages` environment deployment restrictions. This follows the [Vite Pages deployment guide](https://vite.dev/guide/static-deploy.html#github-pages). To verify a repository-path build locally, run `npm run build --prefix ui -- --base /TTRPG-System/` and `npm run preview --prefix ui -- --base /TTRPG-System/`. Manual dispatch becomes available once the workflow is present on the repository's default branch; pushes to `develop` deploy automatically.

Run `npm run build`, `npm test`, or `npm run demo` after installing the TypeScript development dependency. The engine has no runtime dependencies.

Project-local imports use `@/` for the repository root (for example, `@/src/index.js` and `@/ui/src/display`). Root/UI TypeScript paths, JavaScript editor configuration, and Vite resolve the same alias. npm scripts preload `tools/register-alias.mjs` for Node tests and examples; direct execution of those source scripts requires `node --import ./tools/register-alias.mjs <script>`. The engine build rewrites emitted imports to relative paths, so consumers of `dist` need no alias loader. Package and Node built-in imports retain their normal names.

The 2014 System grants hit points automatically at each Class level: the starting Class receives its maximum Hit Die at level one, and subsequent levels use the fixed average, with Constitution applied at every level. Feature selection defaults to a dropdown; use **Use list** to browse the searchable, paginated cards. Existing browser workspaces keep their loaded System JSON; reload the updated bundled System to use revised rules.

Install development dependencies with `npm install` and `npm install --prefix ui`. The root install automatically sets up the tracked Git hooks; existing checkouts can also run `npm run hooks:install`. The pre-commit hook runs `npm run lint` and blocks the commit if linting fails. Both projects' dependencies must be installed before committing.

`npm run lint` runs ESLint, the single-definition checks, and engine/UI type checking without modifying files or emitting build output. Warnings also fail the check. Run `npm run lint:fix` explicitly to apply ESLint's automatic fixes. React rules apply only to UI source; non-component display helpers live in separate modules for Fast Refresh. Deliberately omitted properties in object-rest expressions are allowed.

The project coding standard combines ESLint's recommended JavaScript rules, [typescript-eslint recommended rules](https://typescript-eslint.io/getting-started/), and the [ESLint Stylistic shared preset](https://eslint.style/guide/config-presets). Its explicit conventions are two-space indentation, single quotes, semicolons, 1TBS braces, parenthesized arrow parameters, trailing commas in multiline structures, and one statement per line. Strict equality, `const` where possible, and unused-variable checks apply across application code, examples, tools, and tests. Node and browser globals are scoped separately, and React Hooks/Fast Refresh rules remain limited to the UI. `.editorconfig` and Git attributes keep indentation and LF source-file line endings consistent across editors and operating systems. JSON rules data and source descriptions are not reformatted by ESLint.

The TypeScript-based checks reject syntax errors, `debugger`, `var`, and files containing more than one class, interface, type alias, or enum definition (including nested declarations). Inline object types, functions, imports and re-exports are allowed. Model definitions live in `src/model/`; other extracted definitions live in adjacent `types/` folders. Compatibility barrels preserve existing public imports. Generated output, dependencies and hidden folders are excluded. The hook checks the working tree; keep staged changes synchronized with the files you have validated. Run `npm run lint:test` to check the lint rules and ESLint configuration.

Run `npm run demo:dnd2014` for a valid Fighter 3 / Rogue 2 character. SRD adaptations carry [Creative Commons attribution](NOTICE.md); the System documentation distinguishes calculated rules from descriptive coverage.

The specification includes a React UI plan for character creation, direct Class and Feature browsing, and future custom Feature authoring. Implementation proceeds from the engine to the UI.

Each ruleset is a **System**. Its canonical document is:

- [DnD5e 2014 System](docs/systems/dnd5e-2014-system.md)
- [DnD5e 2024 System](docs/systems/dnd5e-2024-system.md)
- [PF2e System](docs/systems/pf2e-system.md)

The specification uses Anime5e as its design reference, with official D&D rules and SRDs authorized for the [DnD5e System comparison](docs/systems/dnd5e-system-comparison.md). Implement separate 2014 and 2024 5e systems before PF2e. Dungeons and Dragons 5e, DnD5e, and 5e are interchangeable project terms; Pathfinder2e and PF2e are also interchangeable.


Character sheets now use System-authored ability, skill, and calculated-stat sections, with readable character details and a separate inventory. Starter Set equipment is represented by Items composed from item-only Features; armor and shields affect AC while equipped. Resource tracking supports manual increments/decrements and only exposes abilities the character owns. Feature anchors support new tabs and preserve Class locations and catalogue filters when returning. See [inventory commands](docs/engine.md#inventory-and-manual-resource-tracking) and [sheet presentation JSON](docs/json-systems.md#item-catalogues-and-sheet-presentation).
