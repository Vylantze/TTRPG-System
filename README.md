# TTRPG System

A generic character system in which classes, feats, and class abilities are composed from reusable Features.

The generic TypeScript engine and the first [DnD5e 2014 character-building milestone](docs/systems/dnd5e-2014-system.md) are implemented. See [engine usage and API](docs/engine.md) and the [Feature system specification](docs/feature-system-specification.md). The 2014 catalogue currently supports Fighter, Rogue, Wizard, SRD racial options, Acolyte, and Wizard spell selections. Its remaining classes, DnD5e 2024, and the React UI follow in that order.

DnD5e 2014 rules and reference metadata are JSON files. The engine provides a browser-safe loader and System registry for the future React UI to load and unload Systems. See the [JSON format and integration API](docs/json-systems.md).

Run `npm run build`, `npm test`, or `npm run demo` after installing the TypeScript development dependency. The engine has no runtime dependencies.

Run `npm run demo:dnd2014` for a valid Fighter 3 / Rogue 2 character. SRD adaptations carry [Creative Commons attribution](NOTICE.md); the System documentation distinguishes calculated rules from descriptive coverage.

The specification includes a React UI plan for character creation, direct Class and Feature browsing, and future custom Feature authoring. Implementation proceeds from the engine to the UI.

Each ruleset is a **System**. Its canonical document is:

- [DnD5e 2014 System](docs/systems/dnd5e-2014-system.md)
- [DnD5e 2024 System](docs/systems/dnd5e-2024-system.md)
- [PF2e System](docs/systems/pf2e-system.md)

The specification uses Anime5e as its design reference, with official D&D rules and SRDs authorized for the [DnD5e System comparison](docs/systems/dnd5e-system-comparison.md). Implement separate 2014 and 2024 5e systems before PF2e. Dungeons and Dragons 5e, DnD5e, and 5e are interchangeable project terms; Pathfinder2e and PF2e are also interchangeable.
