# Description replacements

`description` remains the original source text. On character sheets, `processDescriptionAutomatically` (default `true`) controls automatic value replacement in text that has not been overridden. Set it to `false` to preserve that text literally.

`descriptionOverride` is an array of exact, case-sensitive string pairs. All occurrences are replaced. Nonmatching entries do nothing. Empty `overrideString` removes the matching text; empty `originalString` is invalid. Matching uses the original description, not the output of an earlier replacement. The earliest match wins; for matches starting at the same position, array order wins. Overlapping matches are not applied twice. Whitespace and punctuation are significant.

Replacement text never receives automatic phrase replacement, regardless of `processDescriptionAutomatically`. Only the explicit tokens below resolve there. Other text, including phrases such as “wizard level”, remains literal. Source catalogue views retain the original description. Paragraphs, lists and Feature links remain supported; imported HTML remains inert.

```json
{
  "processDescriptionAutomatically": false,
  "descriptionOverride": [
    {
      "originalString": "your Constitution modifier",
      "overrideString": "{{stat:modifier.constitution}}"
    },
    {
      "originalString": "your wizard level",
      "overrideString": "{{class:dnd5e:2024:wizard}}"
    }
  ]
}
```

## Complete syntax

There are exactly two replacement forms. There are no shorthand aliases such as `CON` or `PB`.

| Syntax | Value |
| --- | --- |
| `{{stat:STAT_ID}}` | Current evaluated value of any named stat, including stats created by active Features. |
| `{{class:CLASS_ID}}` | Sum of the character's levels in that Class across progressions. A known Class with no progression resolves to zero. |

IDs are exact and case-sensitive. Outer whitespace is allowed (`{{ stat:constitution }}`); whitespace inside an ID is not removed. Unknown tokens, missing stats and unknown Classes stay visibly unchanged. Arithmetic, dice evaluation, conditionals, resource balances, arbitrary object access and executable code are not supported. Each resolved value has a hover label naming its stat or Class level. A stat's value can itself come from engine formulas.

Common examples: `{{stat:constitution}}` is the Constitution score; `{{stat:modifier.constitution}}` is its modifier; `{{stat:proficiencyBonus}}` is proficiency bonus; `{{stat:hitPoints}}` is maximum calculated HP, not the resource's current HP.

## DnD5e 2024 Class replacements

| Replacement | Class |
| --- | --- |
| `{{class:dnd5e:2024:barbarian}}` | Barbarian |
| `{{class:dnd5e:2024:bard}}` | Bard |
| `{{class:dnd5e:2024:cleric}}` | Cleric |
| `{{class:dnd5e:2024:druid}}` | Druid |
| `{{class:dnd5e:2024:fighter}}` | Fighter |
| `{{class:dnd5e:2024:monk}}` | Monk |
| `{{class:dnd5e:2024:paladin}}` | Paladin |
| `{{class:dnd5e:2024:ranger}}` | Ranger |
| `{{class:dnd5e:2024:rogue}}` | Rogue |
| `{{class:dnd5e:2024:sorcerer}}` | Sorcerer |
| `{{class:dnd5e:2024:warlock}}` | Warlock |
| `{{class:dnd5e:2024:wizard}}` | Wizard |

## DnD5e 2024 stat replacements

The following is the complete set of stat IDs declared by the bundled System definition and by Feature stat definitions. Some stats exist only while the Feature that defines them is active. Custom Systems and parameterized Features may define additional IDs; every evaluated ID uses the same `stat:` syntax.

| Replacement | Stat name |
| --- | --- |
| `{{stat:arcaneRecoveryBudget}}` | Arcane Recovery budget |
| `{{stat:armorClass}}` | Armor Class |
| `{{stat:armorIndex}}` | Worn armor |
| `{{stat:armorProficient}}` | Trained with worn armor |
| `{{stat:armorStrengthExemption}}` | Heavy armor Strength exemption |
| `{{stat:attacksPerAction}}` | Attacks per Attack action |
| `{{stat:attunementLimit}}` | Attunement limit |
| `{{stat:bardicInspirationDie}}` | Bardic Inspiration die |
| `{{stat:base.charisma}}` | Base charisma |
| `{{stat:base.constitution}}` | Base constitution |
| `{{stat:base.dexterity}}` | Base dexterity |
| `{{stat:base.intelligence}}` | Base intelligence |
| `{{stat:base.strength}}` | Base strength |
| `{{stat:base.wisdom}}` | Base wisdom |
| `{{stat:breathWeaponDC}}` | Breath Weapon save DC |
| `{{stat:casterLevel}}` | Spellcasting level |
| `{{stat:casting.charisma.attack}}` | Charisma spell attack |
| `{{stat:casting.charisma.dc}}` | Charisma spell save DC |
| `{{stat:casting.intelligence.attack}}` | Intelligence spell attack |
| `{{stat:casting.intelligence.dc}}` | Intelligence spell save DC |
| `{{stat:casting.wisdom.attack}}` | Wisdom spell attack |
| `{{stat:casting.wisdom.dc}}` | Wisdom spell save DC |
| `{{stat:charisma}}` | Charisma |
| `{{stat:constitution}}` | Constitution |
| `{{stat:criticalThreshold}}` | Critical Hit threshold |
| `{{stat:darkvision}}` | Darkvision range |
| `{{stat:dexterity}}` | Dexterity |
| `{{stat:focusSaveDC}}` | Focus save DC |
| `{{stat:hitPoints}}` | Hit Point maximum |
| `{{stat:initiative}}` | Initiative |
| `{{stat:intelligence}}` | Intelligence |
| `{{stat:martialArtsDie}}` | Martial Arts die |
| `{{stat:modifier.charisma}}` | Charisma modifier |
| `{{stat:modifier.constitution}}` | Constitution modifier |
| `{{stat:modifier.dexterity}}` | Dexterity modifier |
| `{{stat:modifier.intelligence}}` | Intelligence modifier |
| `{{stat:modifier.strength}}` | Strength modifier |
| `{{stat:modifier.wisdom}}` | Wisdom modifier |
| `{{stat:pactSlotCount}}` | Pact Magic slots |
| `{{stat:pactSlotLevel}}` | Pact Magic slot level |
| `{{stat:passivePerception}}` | Passive Perception |
| `{{stat:proficiencyBonus}}` | Proficiency Bonus |
| `{{stat:rageDamage}}` | Rage Damage |
| `{{stat:rangedWeaponAttackBonus}}` | Ranged weapon attack bonus |
| `{{stat:resource.capacity.action-surge}}` | Action Surge Maximum |
| `{{stat:resource.capacity.adrenaline-rush}}` | Adrenaline Rush Maximum |
| `{{stat:resource.capacity.arcane-recovery}}` | Arcane Recovery Maximum |
| `{{stat:resource.capacity.bardic-inspiration}}` | Bardic Inspiration Maximum |
| `{{stat:resource.capacity.breath-weapon}}` | Breath Weapon Maximum |
| `{{stat:resource.capacity.channel-divinity}}` | Channel Divinity Maximum |
| `{{stat:resource.capacity.dark-ones-own-luck}}` | Dark One’s Own Luck Maximum |
| `{{stat:resource.capacity.divine-intervention}}` | Divine Intervention Maximum |
| `{{stat:resource.capacity.draconic-flight}}` | Draconic Flight Maximum |
| `{{stat:resource.capacity.dragon-wings}}` | Dragon Wings Maximum |
| `{{stat:resource.capacity.focus}}` | Focus Points Maximum |
| `{{stat:resource.capacity.giant-ancestry}}` | Giant Ancestry Maximum |
| `{{stat:resource.capacity.hit-dice.d10}}` | Hit Point Dice (d10) maximum |
| `{{stat:resource.capacity.hit-dice.d12}}` | Hit Point Dice (d12) maximum |
| `{{stat:resource.capacity.hit-dice.d6}}` | Hit Point Dice (d6) maximum |
| `{{stat:resource.capacity.hit-dice.d8}}` | Hit Point Dice (d8) maximum |
| `{{stat:resource.capacity.holy-nimbus}}` | Holy Nimbus Maximum |
| `{{stat:resource.capacity.hurl-through-hell}}` | Hurl Through Hell Maximum |
| `{{stat:resource.capacity.improve-fate}}` | Improve Fate Maximum |
| `{{stat:resource.capacity.indomitable}}` | Indomitable Maximum |
| `{{stat:resource.capacity.innate-sorcery}}` | Innate Sorcery Maximum |
| `{{stat:resource.capacity.intimidating-presence}}` | Intimidating Presence Maximum |
| `{{stat:resource.capacity.large-form}}` | Large Form Maximum |
| `{{stat:resource.capacity.lay-on-hands}}` | Lay On Hands Maximum |
| `{{stat:resource.capacity.magic-initiate.cleric}}` | Magic Initiate (Cleric) free casting Maximum |
| `{{stat:resource.capacity.magic-initiate.druid}}` | Magic Initiate (Druid) free casting Maximum |
| `{{stat:resource.capacity.magic-initiate.wizard}}` | Magic Initiate (Wizard) free casting Maximum |
| `{{stat:resource.capacity.magical-cunning}}` | Magical Cunning Maximum |
| `{{stat:resource.capacity.mystic-arcanum.6}}` | Mystic Arcanum (level 6) Maximum |
| `{{stat:resource.capacity.mystic-arcanum.7}}` | Mystic Arcanum (level 7) Maximum |
| `{{stat:resource.capacity.mystic-arcanum.8}}` | Mystic Arcanum (level 8) Maximum |
| `{{stat:resource.capacity.mystic-arcanum.9}}` | Mystic Arcanum (level 9) Maximum |
| `{{stat:resource.capacity.natural-recovery}}` | Natural Recovery Maximum |
| `{{stat:resource.capacity.natures-veil}}` | Nature’s Veil Maximum |
| `{{stat:resource.capacity.paladin-channel-divinity}}` | Channel Divinity Maximum |
| `{{stat:resource.capacity.paladin.free.divine-smite}}` | Divine Smite (no slot) Maximum |
| `{{stat:resource.capacity.paladin.free.find-steed}}` | Find Steed (no slot) Maximum |
| `{{stat:resource.capacity.rage}}` | Rage Maximum |
| `{{stat:resource.capacity.ranger.free.hunters-mark}}` | Favored Enemy (no slot) Maximum |
| `{{stat:resource.capacity.relentless-endurance}}` | Relentless Endurance Maximum |
| `{{stat:resource.capacity.second-wind}}` | Second Wind Maximum |
| `{{stat:resource.capacity.sorcerer.free.summon-dragon}}` | Dragon Companion (no slot) Maximum |
| `{{stat:resource.capacity.sorcerous-restoration}}` | Sorcerous Restoration Maximum |
| `{{stat:resource.capacity.sorcery-points}}` | Sorcery Points Maximum |
| `{{stat:resource.capacity.species-elf-lineage-drow.darkness}}` | Darkness (Drow) Maximum |
| `{{stat:resource.capacity.species-elf-lineage-drow.faerie-fire}}` | Faerie Fire (Drow) Maximum |
| `{{stat:resource.capacity.species-elf-lineage-high-elf.detect-magic}}` | Detect Magic (High Elf) Maximum |
| `{{stat:resource.capacity.species-elf-lineage-high-elf.misty-step}}` | Misty Step (High Elf) Maximum |
| `{{stat:resource.capacity.species-elf-lineage-wood-elf.longstrider}}` | Longstrider (Wood Elf) Maximum |
| `{{stat:resource.capacity.species-elf-lineage-wood-elf.pass-without-trace}}` | Pass without Trace (Wood Elf) Maximum |
| `{{stat:resource.capacity.species-gnome-lineage-forest-gnome.speak-with-animals}}` | Speak with Animals (Forest Gnome) Maximum |
| `{{stat:resource.capacity.species-tiefling-legacy-abyssal.hold-person}}` | Hold Person (Abyssal Legacy) Maximum |
| `{{stat:resource.capacity.species-tiefling-legacy-abyssal.ray-of-sickness}}` | Ray of Sickness (Abyssal Legacy) Maximum |
| `{{stat:resource.capacity.species-tiefling-legacy-chthonic.false-life}}` | False Life (Chthonic Legacy) Maximum |
| `{{stat:resource.capacity.species-tiefling-legacy-chthonic.ray-of-enfeeblement}}` | Ray of Enfeeblement (Chthonic Legacy) Maximum |
| `{{stat:resource.capacity.species-tiefling-legacy-infernal.darkness}}` | Darkness (Infernal Legacy) Maximum |
| `{{stat:resource.capacity.species-tiefling-legacy-infernal.hellish-rebuke}}` | Hellish Rebuke (Infernal Legacy) Maximum |
| `{{stat:resource.capacity.stonecunning}}` | Stonecunning Maximum |
| `{{stat:resource.capacity.stroke-of-luck}}` | Stroke of Luck Maximum |
| `{{stat:resource.capacity.tireless}}` | Tireless Maximum |
| `{{stat:resource.capacity.uncanny-metabolism}}` | Uncanny Metabolism Maximum |
| `{{stat:resource.capacity.warlock.free.contact-other-plane}}` | Contact Patron (no slot) Maximum |
| `{{stat:resource.capacity.wholeness-of-body}}` | Wholeness of Body Maximum |
| `{{stat:resource.capacity.wild-shape}}` | Wild Shape Maximum |
| `{{stat:save.charisma}}` | Charisma saving throw |
| `{{stat:save.constitution}}` | Constitution saving throw |
| `{{stat:save.dexterity}}` | Dexterity saving throw |
| `{{stat:save.intelligence}}` | Intelligence saving throw |
| `{{stat:save.strength}}` | Strength saving throw |
| `{{stat:save.wisdom}}` | Wisdom saving throw |
| `{{stat:shield}}` | Wielding a shield |
| `{{stat:sizeCategory}}` | Size (0 Small, 1 Medium) |
| `{{stat:skill.acrobatics}}` | Acrobatics |
| `{{stat:skill.animal-handling}}` | Animal Handling |
| `{{stat:skill.arcana}}` | Arcana |
| `{{stat:skill.athletics}}` | Athletics |
| `{{stat:skill.deception}}` | Deception |
| `{{stat:skill.history}}` | History |
| `{{stat:skill.insight}}` | Insight |
| `{{stat:skill.intimidation}}` | Intimidation |
| `{{stat:skill.investigation}}` | Investigation |
| `{{stat:skill.medicine}}` | Medicine |
| `{{stat:skill.nature}}` | Nature |
| `{{stat:skill.perception}}` | Perception |
| `{{stat:skill.performance}}` | Performance |
| `{{stat:skill.persuasion}}` | Persuasion |
| `{{stat:skill.religion}}` | Religion |
| `{{stat:skill.sleight-of-hand}}` | Sleight of Hand |
| `{{stat:skill.stealth}}` | Stealth |
| `{{stat:skill.survival}}` | Survival |
| `{{stat:sneakAttackDice}}` | Sneak Attack dice |
| `{{stat:speed}}` | Speed |
| `{{stat:spellSlots.1}}` | Level 1 spell slots |
| `{{stat:spellSlots.2}}` | Level 2 spell slots |
| `{{stat:spellSlots.3}}` | Level 3 spell slots |
| `{{stat:spellSlots.4}}` | Level 4 spell slots |
| `{{stat:spellSlots.5}}` | Level 5 spell slots |
| `{{stat:spellSlots.6}}` | Level 6 spell slots |
| `{{stat:spellSlots.7}}` | Level 7 spell slots |
| `{{stat:spellSlots.8}}` | Level 8 spell slots |
| `{{stat:spellSlots.9}}` | Level 9 spell slots |
| `{{stat:strength}}` | Strength |
| `{{stat:training.armor.heavy}}` | Heavy armor training |
| `{{stat:training.armor.light}}` | Light armor training |
| `{{stat:training.armor.medium}}` | Medium armor training |
| `{{stat:training.armor.shield}}` | Shield armor training |
| `{{stat:training.save.charisma}}` | Charisma save training |
| `{{stat:training.save.constitution}}` | Constitution save training |
| `{{stat:training.save.dexterity}}` | Dexterity save training |
| `{{stat:training.save.intelligence}}` | Intelligence save training |
| `{{stat:training.save.strength}}` | Strength save training |
| `{{stat:training.save.wisdom}}` | Wisdom save training |
| `{{stat:training.skill.acrobatics}}` | Acrobatics training |
| `{{stat:training.skill.animal-handling}}` | Animal Handling training |
| `{{stat:training.skill.arcana}}` | Arcana training |
| `{{stat:training.skill.athletics}}` | Athletics training |
| `{{stat:training.skill.deception}}` | Deception training |
| `{{stat:training.skill.history}}` | History training |
| `{{stat:training.skill.insight}}` | Insight training |
| `{{stat:training.skill.intimidation}}` | Intimidation training |
| `{{stat:training.skill.investigation}}` | Investigation training |
| `{{stat:training.skill.medicine}}` | Medicine training |
| `{{stat:training.skill.nature}}` | Nature training |
| `{{stat:training.skill.perception}}` | Perception training |
| `{{stat:training.skill.performance}}` | Performance training |
| `{{stat:training.skill.persuasion}}` | Persuasion training |
| `{{stat:training.skill.religion}}` | Religion training |
| `{{stat:training.skill.sleight-of-hand}}` | Sleight of Hand training |
| `{{stat:training.skill.stealth}}` | Stealth training |
| `{{stat:training.skill.survival}}` | Survival training |
| `{{stat:training.tool.alchemists-supplies}}` | Alchemist’s Supplies training |
| `{{stat:training.tool.brewers-supplies}}` | Brewer’s Supplies training |
| `{{stat:training.tool.calligraphers-supplies}}` | Calligrapher’s Supplies training |
| `{{stat:training.tool.carpenters-tools}}` | Carpenter’s Tools training |
| `{{stat:training.tool.cartographers-tools}}` | Cartographer’s Tools training |
| `{{stat:training.tool.cobblers-tools}}` | Cobbler’s Tools training |
| `{{stat:training.tool.cooks-utensils}}` | Cook’s Utensils training |
| `{{stat:training.tool.disguise-kit}}` | Disguise Kit training |
| `{{stat:training.tool.forgery-kit}}` | Forgery Kit training |
| `{{stat:training.tool.gaming-set}}` | Gaming Set training |
| `{{stat:training.tool.glassblowers-tools}}` | Glassblower’s Tools training |
| `{{stat:training.tool.herbalism-kit}}` | Herbalism Kit training |
| `{{stat:training.tool.jewelers-tools}}` | Jeweler’s Tools training |
| `{{stat:training.tool.leatherworkers-tools}}` | Leatherworker’s Tools training |
| `{{stat:training.tool.masons-tools}}` | Mason’s Tools training |
| `{{stat:training.tool.musical-instrument}}` | Musical Instrument training |
| `{{stat:training.tool.navigators-tools}}` | Navigator’s Tools training |
| `{{stat:training.tool.painters-supplies}}` | Painter’s Supplies training |
| `{{stat:training.tool.poisoners-kit}}` | Poisoner’s Kit training |
| `{{stat:training.tool.potters-tools}}` | Potter’s Tools training |
| `{{stat:training.tool.smiths-tools}}` | Smith’s Tools training |
| `{{stat:training.tool.thieves-tools}}` | Thieves’ Tools training |
| `{{stat:training.tool.tinkers-tools}}` | Tinker’s Tools training |
| `{{stat:training.tool.weavers-tools}}` | Weaver’s Tools training |
| `{{stat:training.tool.woodcarvers-tools}}` | Woodcarver’s Tools training |
| `{{stat:training.weapons.martial}}` | Martial weapon proficiency |
| `{{stat:training.weapons.simple}}` | Simple weapon proficiency |
| `{{stat:unarmoredDefense}}` | Unarmored Defense bonus |
| `{{stat:walkingSpeed}}` | Walking speed |
| `{{stat:wisdom}}` | Wisdom |
