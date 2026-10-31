# DnD5e 2024 System

DnD5e 2024 is the bundled System, with its own rules, content identities, and revision history. Its baseline is SRD 5.2.1. Implement PF2e after it.

The [DnD5e System comparison](dnd5e-system-comparison.md) contains the study notes, version differences, and implementation milestones. The [generic Feature specification](../feature-system-specification.md) defines the shared engine contract.

Status (2026-10-31): implemented and bundled in the app; the DnD5e 2014 System and its data were removed. All twelve SRD classes (levels 1–20, one SRD subclass each), nine species with their lineages and legacies, four backgrounds, seventeen feats, 339 spells with 144 Roll Features, 171 items, twelve sample characters and a multiclass sample load and validate.

## Build

`npm run build:dnd2024` regenerates `src/systems/dnd5e-2024` from SRD 5.2.1. Run `npm run extract:srd2024` first when the extractor changes; it needs the pinned PDF in `.reference-cache`. The builder is strict TypeScript in `tools/dnd2024` and is type-checked by `npm run lint`:

- `srd.ts` finds SRD sections by heading, scoped to a class chapter where headings repeat.
- `core.ts` holds the shared System definition (stats, sheet layout, rests, Arcane Recovery policy) and the shared Features: skills, Expertise, tools, languages, Weapon Mastery options, Hit Point Dice, spell slots and trackers.
- `spells.ts` parses each spell's header into one canonical spell Feature and generates class casting entries from each spell's class list.
- `origins.ts` builds species, backgrounds and feats; `items.ts` builds weapons, armor, tools and gear from the equipment tables.
- `classes/` holds one specification per class. `common.ts` turns a specification into level entries, hit points, core traits, Ability Score Improvements, the Epic Boon, the subclass choice and Spellcasting.
- `samples.ts` builds the sample characters through the engine's own candidate lists and refuses to write one that is not valid.

### Duplication removed compared with DnD5e 2014

- The six option configurations share one System definition through JSON pointers; only identity, validation and multiclassing differ (2014 repeats the whole definition and every class twelve times).
- Each spell's text is stored once. Class casting entries are generated from the SRD class lists and only reference the canonical text.
- Fighting Styles, Ability Score Improvement and Epic Boons are shared feats. Every class's Ability Score Improvement and Epic Boon entries choose from the same feat pool.
- Spells an origin or feat lets you cast with a chosen ability (Elven Lineage, Fiendish Legacy, Magic Initiate) are generated per ability rather than written three times.
- Tools exist once (2014 has five copies of every artisan's tool for the Artificer subclasses).

### Automation

Calculated: ability scores and background increases, proficiencies and Expertise, Jack of All Trades, saves (including Aura of Protection), Armor Class with armor, shields, Unarmored Defense and Draconic Resilience, speed (Fast Movement, Unarmored Movement, Roving), Hit Points (Dwarven Toughness, Draconic Resilience), Extra Attack counts, Critical Hit thresholds, caster level with half casters rounded up, Spell Slots, Pact Magic slots, and every limited-use pool with its Short and Long Rest recovery. Tactical Mind spends Second Wind only on a success.

Described for the table: attack and damage resolution, conditions, Concentration, Exhaustion, Heroic Inspiration triggers, Weapon Mastery effects, Metamagic and invocation effects, Wild Shape forms, and most subclass combat riders.

Known simplifications: Wizard spellbook contents are not tracked separately (prepare from the Wizard list); Magical Secrets and Magical Discoveries are described only; instruments share one Musical Instrument proficiency; character-level-gated origin spells are granted at level 1 and become castable at their level.

## Content source

User decision, 2026-10-31: content comes from the [SRD 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf) only, under CC BY 4.0. D&D Beyond is not a data source: its terms forbid extraction tools and grant no personal archiving right. Paid-book options are added only from a list the user supplies, as names, mechanics, original summaries and links.

`tools/extract-dnd2024-srd.py` splits the pinned PDF (SHA-256 `8974902d…5e3d87`) into headed sections with page numbers in `.reference-cache/srd-5.2.1-sections.json`. Run it with the shared `X:\AI\utils\python-envs\pdf-extraction` environment (pdfplumber 0.11.4). Headings are recognised by typeface; lines are ordered by the text matrix baseline, because the PDF's Cambria subset declares a descent that makes pdfplumber's `top` place body lines below the next heading.

## SRD 5.2.1 evaluation

| Content | SRD 5.2.1 | Removed DnD5e 2014 data |
| --- | --- | --- |
| Classes | 12 core classes, levels 1–20 | 12 core, Artificer, Blood Hunter |
| Subclasses | 12, one per class: Berserker, Lore, Life, Land, Open Hand, Devotion, Hunter, Thief, Draconic Sorcery, Fiend, Evoker, Champion | 124 (112 from non-SRD books) |
| Species | 9: Dragonborn, Dwarf, Elf, Gnome, Goliath, Halfling, Human, Orc, Tiefling, each with lineage or legacy choices | 9 race variants |
| Backgrounds | 4: Acolyte, Criminal, Sage, Soldier, each with three ability options, an Origin feat, two skills, one tool and equipment | 5 (4 from the Starter Set) |
| Feats | 17: 4 Origin, 2 General (incl. Ability Score Improvement), 4 Fighting Style, 7 Epic Boons | Ability Score Improvement and Grappler |
| Spells | 338 (26 cantrips; 57/57/42/34/38/31/20/17/16 for levels 1–9) with class lists in each header | 319 |
| Equipment | Weapons with mastery properties, armor, tools, gear, mounts, crafting | 52 items |
| Magic items | About 260 entries | Artificer replicas only |
| Other | Rules glossary (about 155 entries), gameplay toolbox, about 330 monster stat blocks | Not included |

Extraction quality: 2,173 sections. Every spell section starts with its level, school and class list, and paragraphs and run-in labels ("Using a Higher-Level Spell Slot.") are preserved. Tables are the weak point: class progression tables, weapon and armor tables and species legacy tables come out as running text, sometimes attached to a neighbouring section. Build those from hand-checked data rather than from the extracted prose. Four summon stat blocks inside spells (Animated Object, Otherworldly Steed, Giant Insect, Draconic Spirit) appear as their own sections.

### Gaps compared with the removed 2014 data

- Only one subclass per class. The other 2014 subclasses come from non-SRD books and have no 2024 SRD version.
- No Artificer or Blood Hunter.
- Four backgrounds instead of five; the twelve 2024 samples are original SRD builds.

### Rules the engine does not model yet

- Weapon Mastery: choosing weapon kinds per class, swapping one after a Long Rest, and Tactical Master's property replacement.
- Background ability adjustments (+2/+1 or +1/+1/+1 among three named abilities) and the Origin feat granted by a background.
- Heroic Inspiration, Epic Boons and 2024 Exhaustion (−2 per level to D20 Tests, 10 ft speed per level).
- Species size choice (Human, Tiefling and others).
- Concentration is not tracked.

Already supported: conditional expenditure with outcome settlement (Tactical Mind), table-scaled resources with partial recovery (Second Wind), Pact Magic as a separate pool, and multiclass caster-level rounding as data.

### Ways to avoid the 2014 duplication

- **One definition per System.** The 2014 `definitions.json` repeats the whole System definition 12 times (about 70 KB each) and `classes.json` repeats every class 12 times; only validation and multiclass fields differ. 2024 has no feats option, so it needs 6 configurations, and they can share one definition through `$ref` pointers with only their differing fields written out.
- **Spells once.** The 2014 data has a wrapper per class for each spell (295 each for Bard, Druid, Paladin and Warlock) plus spellbook and prepared wrappers. The SRD 5.2.1 header names each spell's classes, so one spell entry can carry its class list and selections can filter by it.
- **Shared Feats.** Fighting Styles, Ability Score Improvement and Epic Boons are Feats in 2024, so each class grants a choice from the shared Feat pool instead of owning copies.
- **Generated progressions.** Subclass at level 3, ASIs at 4, 8, 12 and 16 (Fighter and Rogue add more), and the Epic Boon at 19 come from a short per-class table instead of hand-written entries per level.
