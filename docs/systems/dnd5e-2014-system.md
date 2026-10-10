# DnD5e 2014 System

The five Starter Set samples remain editable level-one builds. Life Cleric now supports levels 1–20, its class spell list and Wisdom 13 multiclass requirement. Starting prepared spells remain application defaults. Background-specific text links to the original sheets; equipment is stored as Items.

DnD5e 2014 is a System with its own rules, content identities, and revision history. Its implemented baseline is SRD 5.1. The [React UI baseline](../react-ui.md) is implemented before further System work. DnD5e 2024 and PF2e remain separate later Systems.

The [DnD5e System comparison](dnd5e-system-comparison.md) contains the study notes, conversion requirements, and implementation milestones. The [generic Feature specification](../feature-system-specification.md) defines the shared engine contract.

Status: all twelve core SRD classes have levels 1–20 and their SRD subclass. Source descriptions and class spell lists are included. HP, skills, primary resources, selections, and spell slots are calculated; full combat simulation is not implemented. Only final published rules are included. Artificer and non-SRD subclasses remain pending suitable sources and user approval.

## Run and import

Rules are authored in [system.json](../../src/systems/dnd5e-2014/system.json), with optional reference data in [metadata.json](../../src/systems/dnd5e-2014/metadata.json). A generic engine registry can load and unload this System for the React UI. The existing TypeScript imports below remain thin compatibility adapters.

Run `npm run demo:dnd2014` for a complete Fighter 3 / Rogue 2 example. `npm test` checks the original three progressions at every level and the expanded classes at representative levels, including their resources and selections. The [example builder](../../examples/dnd2014-character.js) supplies explicit choices, and the [demo](../../examples/dnd2014-demo.js) evaluates them.

```js
import { createDnd2014Engine } from 'ttrpg-system/systems/dnd5e-2014';

const engine = createDnd2014Engine({
  multiclass: true,
  feats: false,
  abilityMethod: 'standard-array'
});
const draft = engine.createCharacter('hero', 'Hero', [
  { id: 'main', class: 'dnd5e:2014:fighter', level: 1 }
]);
const result = engine.evaluate(draft); // Incomplete until its choices are supplied.
```

Multiclassing and feats are optional and disabled by default. Ability methods are `standard-array`, `point-buy`, and `manual`. Point buy validates base scores 8–15 and at most 27 points. Manual base scores permit user-supplied values 3–18; final scores after Feature modifiers are clamped to 1–30; rolling dice and validating a generation method are external tasks. Catalogue IDs include the settings, so saves cannot silently switch options. Definitions use revision 1.

Inputs `base.strength`, `base.dexterity`, and the other four base ability scores precede racial and Feature adjustments. Derived scores have the plain ability names; modifiers use `modifier.<ability>`. The ASI Feature accepts six integer allocations totaling two and enforces its own limit of 20. It does not impose a universal engine score cap.

## Character choices

Pre-class origin selections have stable IDs `advancement/0/race` and `advancement/0/background`. Their selected Features own nested language, skill, tool, cantrip, or ancestry choices. The default SRD racial variants are Human, Hill Dwarf, High Elf, Lightfoot Halfling, Dragonborn, Rock Gnome, Half-Elf, Half-Orc, and Tiefling. Acolyte supplies Insight and Religion choices, with nested replacement choices if another origin already supplies either proficiency.

Each class level automatically grants its `hit-points` Feature, without a selection. Grants use the Feature's fixed-average default (Fighter 6, Rogue 5, Wizard 4). The starting class's first level uses the full die; multiclass first levels use the fixed average. System authors can still override the Feature's integer `roll` parameter on a grant. Each level separately adds Constitution modifier with a minimum contribution of one, so later Constitution changes update all attained levels.

Class entry Features distinguish starting saving throws and skill counts from multiclass benefits. Multiclass prerequisites apply to every participating class, including the starting class, and to historical entry; later ASIs cannot qualify an earlier entry. Total level is limited to 20 and duplicate class progressions are prohibited. Provide an explicit ordered acquisition history when the intended multiclass order differs from the default progression order.

Fighter fighting styles, subclasses, ASIs/feats, Rogue Expertise, and Wizard learning are independent choices. Ordinary advancement and origin choices cannot be retrained without an explicit rules extension. Direct additional roots are limited to Wizard spellbook entries for discovered/copied spells; other class benefits must come from their advancement selections. Time, gold, and permission to copy a spell remain external adjudication.

## Stats, equipment, and abilities

Saving throws add proficiency only when trained. Expertise changes the proficiency multiplier, not the ability modifier. Fighter Extra Attack takes the applicable maximum, and Fighter resource capacities scale from its own class level. Champion's critical threshold and untrained physical-check bonus are separate stats. Conditional racial and subclass clauses remain visible as descriptive Feature components.

`armorIndex` selects an entry from the exported `armor` array; `shield` is 0 or 1. AC accounts for armor type, Dexterity caps, shields, and Defense style. Heavy armor Strength requirements can reduce speed; Dwarves are exempt. Nonproficient armor is legal but grants its normal descriptive disadvantages and prevents spellcasting. Inventory ownership, starting equipment selection, weight, and item proficiency exceptions are not automated.

Use generic `useAbility` and `recoverResources` commands for abilities such as Second Wind. Supply an explicit action budget for actions, bonus actions, and reactions. Resource spending does not roll healing or damage or change current HP. Second Wind, Action Surge, Indomitable, Stroke of Luck, and relevant racial uses expose their own pools and recovery policies.

## Wizard and racial spellcasting

Wizard spellbook ownership, daily preparation, cantrips, spell slots, Spell Mastery, and Signature Spells have separate Feature IDs and selections. The full Wizard spell list has spell level, school, ritual flag, casting time, range, components, and source page. Spell effects and durations are not automatically executed. Prepared spells expose a capability for each available qualifying slot level; spending a slot does not remove preparation.

The `prepared` selection owned by `wizard.spellcasting` checks current spellbook ownership and class-level eligibility. Its maximum is Wizard level plus Intelligence modifier, with a minimum limit of one; the character may leave capacity unused. Replacements require `event: 'long-rest'` on the selection edit. Spellbook learning at each level checks the historical Wizard level instead. Ritual spells in the book need no preparation or slot and add ten minutes to casting time. Spell Mastery needs preparation; Signature Spells are always prepared in addition to the daily list and each has its own short/long-rest use.

Use engine command `castSpell` (also exported as `castWizardSpell`) for the 2014 bonus-action restriction. Supply `{ bonusActionSpell: false, otherSpell: false, onlyActionCantrips: true }` at the start of a turn and retain the returned turn state with the returned action budget. A bonus-action spell permits other spells that turn only when they are cantrips with a casting time of one action. The rule works in either casting order and includes racial spells. The caller owns turn boundaries, reactions on other turns, and casting time across multiple rounds. Generic `useAbility` alone does not enforce this System turn rule.

The runtime flag `spellComponentsAvailable` defaults to true. Set it to false when a focus, hands, voice, or required components do not permit casting. The caller determines actual component availability. Both Wizard and racial casting check it and armor proficiency.

`recoverArcaneSlots(engine, character, { '1': 2 }, shortRestEventId, commandId)` restores a selected allocation after a recorded `recoverResources(..., 'short-rest', shortRestEventId)` command. It checks settled expenditure, a combined slot-level budget of half Wizard level rounded up, slot levels no higher than five, and the daily use. Replays are idempotent and invalid allocations change nothing. SRD 5.1 specifies once per day; the explicit `new-day` recovery event resets Arcane Recovery, while a long rest alone does not assert that a day has elapsed.

## Coverage and sources

Export `dnd2014Coverage` gives overall coverage; `getDnd2014FeatureCoverage()` reports every Feature component as automated, descriptive, or partial. Capability coverage is partial: availability, costs, and action budgets are enforced, while triggers and effects need adjudication. All twelve core classes have progression entries. Full casters combine their levels and half casters contribute rounded-down levels when multiple Spellcasting classes are present. A lone half caster uses its own rounded-up slot-table progression. Pact Magic remains an independent short-rest pool and can power eligible spells from either class. Mystic Arcanum has independent daily uses. Conditional effects remain source adjudicated.

Source references: SRD 5.1 pp. 3–9 (races), 24–25 (Fighter), 39–41 (Rogue), 52–54 (Wizard), 56–58 (advancement and multiclassing), 60–61 (Acolyte), 62–64 (armor), 75 (Grappler), and 111–113 (Wizard spell list), plus each extracted spell's description page. See [the official SRD](https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf) and [attribution](../../NOTICE.md).

The optional development script `tools/extract-wizard-spells.py` reproduces header metadata from the official PDF in an ignored `.reference-cache` directory. It requires `pypdf`; that dependency is not needed to build or run the engine. Spell header metadata ships in `metadata.json`; rules, Features, Classes, and option configurations ship in `system.json`. The script updates reference headers, while mechanical Features are edited explicitly. See [the JSON loader and registry contract](../json-systems.md).

## Saved rule text and UI labels

The SRD catalogue includes reusable supporting Features and spell wrappers. The Artificer expansion below adds further mechanical entries. Source passages are retained directly or through shared references, with display names in `system.json`. Tag identities have display names in each System configuration. Fighter, Rogue, and Wizard retain source-backed starting traits and equipment text. The included class Features, racial traits, Acolyte, Grappler, and all 319 canonical SRD spells retain source wording with page references and normalized PDF layout. Spell wrappers share canonical descriptions through display-only `textReferences`; supporting building blocks use corresponding SRD clauses. `textAliases` map source skill names and composite ability names to existing Features for automatic prose links and popups.

Run `tools/extract-dnd2014-text.py` with `pdfplumber` installed and the pinned PDF at `.reference-cache/srd-5.1.pdf` to regenerate text and labels. This changes display fields only. Rules and content identities stay at revision 1; existing characters can receive these cosmetic fields using **Update bundled descriptions** in the UI's Systems page. Mechanical modifications require the normal revision/migration workflow.

## Approved sources and expansion scope

The user approved the [official CC-BY SRD 5.1](https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf) as the reusable content source and [Roll20’s 2014 compendium](https://roll20.net/compendium/dnd5e/Free%20Basic%20Rules%20%282014%29) for cross-checking. No Unearthed Arcana or other playtest versions are imported. Tasha’s final published Artificer and its four specialists are approved and implemented as described below. Other non-SRD subclasses still require a suitable source and explicit source approval before import.

The added subclasses are Berserker, Lore, Life, Land, Open Hand, Devotion, Hunter, Draconic Bloodline and Fiend, alongside the existing Champion, Thief and Evocation. Land, Devotion and Life spell selections have their own allowances; select the listed always-prepared spells as levels unlock them. Known/prepared spell allowances and subclass choices are distinct. The prototype allows editing these selections; table-specific retraining permissions remain adjudicated.

Automation is deliberately partial: conditional attacks and resistance, transformations, companions, class-triggered recovery, Natural Recovery allocation, invocation effects, sorcery-point conversion, named weapon/tool exceptions and spell effects are source references unless represented by an explicit component. Dice extracted from prose are reference rolls, not a combat simulator; scaling dice and upcast effects still follow the source at the table. The System metadata lists this boundary.

To rebuild expanded content, cache the approved PDF as `.reference-cache/srd-5.1.pdf` and run `tools/extract-srd-catalogue.py`, `tools/expand-dnd2014-classes.py`, `tools/expand-dnd2014-spells.py`, `tools/complete-dnd2014-classes.py`, and `tools/finalize-dnd2014-catalogue.py` in that order. Python requires pdfplumber. Then run `node tools/build-roll-features.mjs`, `npm run templates:build`, and the multiclass sample generator. Review source extraction and regression tests before publishing generated JSON. Existing reviewed spell prose is retained. Progression tables are represented by level entries; other source tables remain in descriptions.


## Tasha’s Artificer (2020)

Approved source: [Tasha’s Cauldron of Everything, Artificer](https://www.dndbeyond.com/sources/dnd/tcoe/artificer). This is the final 2014-compatible class, not Unearthed Arcana or the revised 2024 version. The data includes names, numerical mechanics, original implementation summaries, and source links. Paid book descriptions are not stored. Existing SRD spell descriptions retain their CC BY attribution. Spell names listed by Tasha that have no SRD entry are source-linked casting entries; their detailed effects are not imported from unapproved books.

The class spans levels 1–20 with d8 HP/Hit Dice, proficiencies, ASIs, Intelligence preparation, ritual casting, all four specialists and specialist spell grants. Slot aggregation adds **ceil(Artificer level / 2)** in multiclass builds. Known/active infusion capacities are 4/2, 6/3, 8/4, 10/5, 12/6 at levels 2, 6, 10, 14, 18. The catalogue contains the 15 non-replication infusions and all 49 named Replicate Magic Item table options, for 64 named choices, plus a named common-item option.

Items → Infused items assigns learned techniques to individual inventory entries or external recipients. Replicated items are modeled as item-exclusive properties applied to mundane material templates. Attunement limits are 3/4/5/6, increasing at Artificer 10/14/18. Armorer’s level-9 bonus capacity applies only to its four Arcane Armor component entries. The character must represent the worn Arcane Armor with these entries consistently; inventory does not simulate donning/doffing, body slots, or object identity across another player’s sheet.

Abilities & resources shows relevant companion/object creation controls. A deployed Steel Defender, Homunculus, or cannon shows HP, statistics, attacks and use pools. Cannons select their type on creation, spend the shared free creation allowance or a selected spell slot, and gain a second independent HP panel at level 15. HP application remains separate from rolling; repair rolls spend their use immediately. Resource adjustments allow table-managed damage, replacement, revival and healing. Dawn recovery uses the authored dice; repeated delivery of the same recovery event cannot refill twice.

### Scope and table-managed rules

The engine automates progression, selection eligibility, spell-slot spending, resource counts/recovery, item compatibility/capacity, supported equipped-item stat changes, companion numbers and explicit rolls. It does not simulate combat positions, turns, targets, concentration, conditions, temporary HP, command timing, duration expiry, crafting elapsed time, or another character’s inventory. Conditional damage/healing bonuses, magic weapon attack choices, advantage/disadvantage, immunities/resistances, special movement, death-triggered infusion expiry and the contents of replicated containers are displayed or source-linked for table resolution. Spell-Refueling Ring spends its use; the chosen slot is then restored using the slot control. Soul of Artifice’s saving-throw bonus is calculated; its survival reaction requires ending the selected infusion and setting HP to 1 manually.

Replicated magic items identify the resulting item and attunement. Supported SRD numerical effects include ability-score floors, AC/save bonuses, darkvision and walking speed; their remaining item-specific actions and charges are source-linked for manual resolution. Additional common magic items (other than potions/scrolls) can be named using the common-item option; their effects require a System item entry or table resolution; the catalogue does not invent unapproved item descriptions. Rebuilding uses `tools/add-tashas-artificer.py`, preserving the existing SRD content and other Systems.
