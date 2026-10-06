# Dungeons and Dragons 5e Systems

Dungeons and Dragons 5e, DnD5e, and 5e are interchangeable project terms. The first implemented system will have two separate rules systems: 2014 and 2024. Both precede PF2e. Build the 2014 system first, then the 2024 system against the same generic engine, so differences become explicit system data and policies. React follows the engine and the 5e character-building contracts.

This is a specification milestone, not an implemented rules engine. The initial distributable catalogues target SRD content rather than every published supplement. The official SRD index provides SRD 5.1 and SRD 5.2.1; use the former for the 2014 baseline and the latter for the revised baseline. Retain document revision and attribution with imported content. Official Basic Rules are also authorized study references. [Official SRD index](https://www.dndbeyond.com/srd).

## Shared rules and model implications

Both systems use six ability scores and derived modifiers. Define an ability modifier as `floor((score - 10) / 2)`. Checks, saving throws, and attacks use modifiers and applicable proficiency; proficiency applies once, including when doubled. Advantage and disadvantage alter dice selection rather than adding a fixed numeric bonus. Multiple sources do not generate extra dice, and opposing advantage and disadvantage cancel. [2014 ability rules](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/using-ability-scores).

The system should expose ability scores as basic inputs, modifiers as derived stats, and training as a separate per-check capability or weight. Expertise modifies the proficiency contribution rather than doubling the entire check. An untrained saving throw must not receive proficiency automatically. This also avoids reproducing Anime5e's saving-throw getter, which multiplies the ability modifier by its proficiency value and then adds proficiency unconditionally.

Proficiency grows from +2 to +6 across character levels 1–20. Class features depend on class levels, while total level controls character advancement. Constitution modifier changes affect maximum HP across levels already attained. [2014 advancement](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/step-by-step-characters), [2024 advancement](https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character).

Store the starting class and an ordered level-acquisition ledger. Store rolled or fixed HP increments separately from Constitution contributions, so changing Constitution recalculates maximum HP without rewriting rolls. System advancement policies own proficiency and total level; no class independently grants another copy of the character's proficiency bonus.

Combat uses movement, an action, qualifying bonus actions, and reactions. A bonus action requires a rule that supplies one; extra attacks can occur within an Attack action rather than representing additional actions. [2014 combat](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/combat), [2024 play rules](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game).

Represent action kinds, triggers, attack counts, and dice policies as capabilities. Keep damage rolls and other dice outcomes out of deterministic stat expressions. The first character engine can expose these rules descriptively; an automated combat executor is separate scope.

## Differences requiring separate systems

| Subject | 2014 baseline | 2024 baseline | Design consequence |
| --- | --- | --- | --- |
| Origins | Race and background contribute different benefits | Species and background; background contributes ability adjustments and an Origin feat | Separate root Feature catalogues and input validation |
| Subclasses | Entry level varies by class | Revised core classes enter subclasses at class level 3 | System-specific progression entries |
| Feats | Optional feat replacement of Ability Score Improvement | Categorized feats include Ability Score Improvement | System option and filtered selection rules |

These origin, progression, and feat structures come from the respective character and class rules. [2014 creation](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/step-by-step-characters), [2014 classes](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/classes), [2014 customization](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/customization-options), [2024 creation](https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character), [2024 classes](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes).

Systems should have distinct IDs, such as `dnd5e:2014-srd5.1` and `dnd5e:2024-srd5.2.1`. Even same-named Features require distinct content identities when their rules differ. A system switch is a migration with diagnostics, not a label change. Custom prerequisite waivers retain their provenance and do not make the resulting build an unmodified official-rules character.

## Resource examples

The 2014 Fighter's Second Wind has one use between short or long rests. The 2024 version starts with two uses, scales by Fighter level, recovers one use on a short rest, and recovers all on a long rest. Its capacity thresholds are 2 at level 1, 3 at level 4, and 4 at level 10. Revised Tactical Mind also spends this pool, with expenditure conditional on the check outcome. [2014 Fighter](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/classes#Fighter), [2024 Fighter](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes#Fighter).

These are useful first fixtures for the generic resource model: constant versus arbitrary-table capacity, full versus partial recovery, shared consumers, and conditional expenditure. Add an explicit outcome-settlement contract for conditional costs. Reserve a use while an outcome is pending, then settle or release it exactly once; the system declares which outcome spends it. Rendering cannot finalize or refund a pending use.

Bardic Inspiration provides a stat-based capacity example: in 2014, uses follow Charisma modifier with a minimum of one, while the die size follows Bard level. Font of Inspiration changes its recovery rule. [2014 Bard](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/classes#Bard).

Model capacity, die metadata, and recovery as separate values. A Feature's recovery upgrade must change a declared recovery policy without creating a second resource pool or silently resetting expenditure.

## Spellcasting and multiclassing

Keep spell ownership, class association, eligibility, prepared or known selections, spellbook entries, and resource pools separate. Ordinary spell slots and Pact Magic remain different pools, even where rules allow a spell to spend either. Slot capacity does not by itself grant permission to learn or prepare a spell of that level. The 2024 multiclass rules distinguish combined slot progression from individual class preparation and allow cross-use of Pact Magic and Spellcasting slots. They also prevent Extra Attack stacking and combining alternative AC formulas. [SRD 5.2.1, character creation](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf).

For multiclass Spellcasting, the 2014 rules count half of Paladin and Ranger levels rounded down; the revised rules round those contributions up. For supported third-caster subclasses, apply their own contribution rule rather than assuming all classes use the same fraction. Starting and multiclass-entry proficiencies also differ. [SRD 5.1, multiclassing](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf), [2024 multiclassing](https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character#Multiclassing).

Use system functions with explicit rounding for effective caster level and table lookups for slots by spell level. Distinguish class-derived slot tables from multiclass tables; Pact Magic does not contribute to the ordinary combined caster level. A prepared-spell choice must preserve its supplying class and casting ability.

The 2014 bonus-action spell restriction permits another spell on that turn only if it is an action cantrip. The revised rule instead limits spending slots to cast spells to one slot per turn. These are different restrictions. [2014 spellcasting](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/spellcasting), [2024 spellcasting](https://www.dndbeyond.com/sources/dnd/br-2024/spells).

Encode these as separate versioned action rules with turn context. Do not replace either with a generic prohibition on casting two leveled spells. Resource prerequisites remain nonwaivable; choosing an ability with ignored ordinary prerequisites must still bind a compatible pool or an explicitly supported alternative payment method.

## Feature conversion and milestones

The following are proposed implementation decisions rather than additional official rules.

| Content | Generic representation |
| --- | --- |
| Starting class benefits | Entry-context grant distinct from multiclass-entry benefits |
| Class feature at a level | Automatic Feature grant with stable acquisition identity |
| Fighting style or subclass | Feature choice with system-specific candidates and timing |
| Ability adjustment | Parameterized Feature with allocation constraints and explicit score cap |
| Spell learning or preparation | Nested selections with event-specific replacement policies and class association |
| Second Wind or similar uses | Named resource with capacity expression or Feature-local table |
| Multiple abilities consuming one pool | Resource bindings shared by independently acquired consumers |
| Extra Attack | Maximum applicable attack count, with system exceptions, rather than summed grants |
| Alternative AC calculation | One selected valid formula, with compatible additions applied afterward |
| Advantage or disadvantage | Dice-policy capability, never a fixed stat bonus |

Do not impose a global ability-score cap of 20 in the engine: limits belong to the specific adjustment or system policy, and exceptions must remain representable. Daily preparation and other rules-authorized replacements are distinct from unrestricted retraining. The generic engine may support editing while a system restricts when it is rules-legal.

1. Implement generic schemas, calculations, composition, resources, and save contracts, using small invented fixtures.
2. Implement the 2014 system with SRD class progressions and origins, explicit optional-rule settings, and a content coverage manifest. Begin with Fighter, then add a spellcaster and multiclass fixtures before expanding the catalogue.
3. Implement the separate 2024 system. Verify origin choices, revised class progressions, table-scaled and shared resources, and changed caster-level rounding against its own fixtures.
4. Build the React Class and Feature browsers, character builder, and sheet against both systems. Add custom Feature authoring afterward.
5. Add PF2e using the same generic contracts once both 5e systems pass character-building acceptance checks.

Before either system is called complete, validate every included class through levels 1–20, track each clause's descriptive or automated coverage, and cover ability allocation, skill choices, HP, proficiencies, equipment-dependent AC, subclasses, spell selections, resources, and multiclass interactions. Unsupported clauses remain visible and marked partial; an SRD catalogue must not be advertised as every official 5e option.

Acceptance fixtures include Fighter 3/Rogue 2 proficiency +3; an untrained save without proficiency; Expertise affecting only proficiency; a Constitution increase updating historical HP contributions; both Second Wind recovery policies; sibling resource provision with ordinary prerequisites waived; and the same caster combination producing different effective caster levels under 2014 and 2024 rounding. Fixture data must pin its source system and revision.
