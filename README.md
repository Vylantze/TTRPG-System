# TTRPG System

A generic character system in which classes, feats, and class abilities are composed from reusable Features.

The generic TypeScript engine is implemented. See [engine usage and API](docs/engine.md) and the [Feature system specification](docs/feature-system-specification.md). Official System catalogues and the React UI are the next milestones.

Run `npm run build`, `npm test`, or `npm run demo` after installing the TypeScript development dependency. The engine has no runtime dependencies.

The specification includes a React UI plan for character creation, direct Class and Feature browsing, and future custom Feature authoring. Implementation proceeds from the engine to the UI.

Each ruleset is a **System**. Its canonical document is:

- [DnD5e 2014 System](docs/systems/dnd5e-2014-system.md)
- [DnD5e 2024 System](docs/systems/dnd5e-2024-system.md)
- [PF2e System](docs/systems/pf2e-system.md)

The specification uses Anime5e as its design reference, with official D&D rules and SRDs authorized for the [DnD5e System comparison](docs/systems/dnd5e-system-comparison.md). Implement separate 2014 and 2024 5e systems before PF2e. Dungeons and Dragons 5e, DnD5e, and 5e are interchangeable project terms; Pathfinder2e and PF2e are also interchangeable.
