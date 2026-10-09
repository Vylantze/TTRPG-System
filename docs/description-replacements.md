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
      "overrideString": "{{class:dnd5e:2014:wizard}}"
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

## DnD5e 2014 Class replacements

| Replacement | Class |
| --- | --- |
| `{{class:dnd5e:2014:cleric}}` | Cleric (level 1) |
| `{{class:dnd5e:2014:fighter}}` | Fighter |
| `{{class:dnd5e:2014:rogue}}` | Rogue |
| `{{class:dnd5e:2014:wizard}}` | Wizard |

## DnD5e 2014 stat replacements

The following is the complete set of stat IDs declared by the bundled System configurations and fixed Feature stat definitions. Some stats are available only with the relevant options or active Features. Custom Systems and parameterized Features may define additional IDs; every evaluated ID uses the same `stat:` syntax. Internal selection markers and accounting stats are included for completeness.

| Replacement | Stat name |
| --- | --- |
| `{{stat:arcaneRecoveryBudget}}` | arcaneRecoveryBudget |
| `{{stat:armorClass}}` | armorClass |
| `{{stat:armorIndex}}` | Worn armor index |
| `{{stat:armorProficient}}` | armorProficient |
| `{{stat:armorStrengthExemption}}` | armorStrengthExemption |
| `{{stat:attacksPerAction}}` | attacksPerAction |
| `{{stat:base.charisma}}` | Base charisma |
| `{{stat:base.constitution}}` | Base constitution |
| `{{stat:base.dexterity}}` | Base dexterity |
| `{{stat:base.intelligence}}` | Base intelligence |
| `{{stat:base.strength}}` | Base strength |
| `{{stat:base.wisdom}}` | Base wisdom |
| `{{stat:breathWeaponDC}}` | Dragonborn breath save DC |
| `{{stat:breathWeaponDice}}` | Dragonborn breath d6 count |
| `{{stat:charisma}}` | charisma |
| `{{stat:check.thieves-tools}}` | check.thieves-tools |
| `{{stat:clericPreparationLimit}}` | Cleric Prepared Spell Limit |
| `{{stat:clericSpellAttack}}` | Cleric Spell Attack |
| `{{stat:clericSpellDC}}` | Cleric Spell Save DC |
| `{{stat:constitution}}` | constitution |
| `{{stat:criticalThreshold}}` | criticalThreshold |
| `{{stat:darkvision}}` | Darkvision range |
| `{{stat:dexterity}}` | dexterity |
| `{{stat:hitPoints}}` | hitPoints |
| `{{stat:infernalSpellDC}}` | Infernal Legacy spell save DC |
| `{{stat:initiative}}` | initiative |
| `{{stat:intelligence}}` | intelligence |
| `{{stat:modifier.charisma}}` | modifier.charisma |
| `{{stat:modifier.constitution}}` | modifier.constitution |
| `{{stat:modifier.dexterity}}` | modifier.dexterity |
| `{{stat:modifier.intelligence}}` | modifier.intelligence |
| `{{stat:modifier.strength}}` | modifier.strength |
| `{{stat:modifier.wisdom}}` | modifier.wisdom |
| `{{stat:oneHandedWeaponDamageBonus}}` | oneHandedWeaponDamageBonus |
| `{{stat:passivePerception}}` | passivePerception |
| `{{stat:prepared.acid-arrow}}` | Acid Arrow prepared |
| `{{stat:prepared.alarm}}` | Alarm prepared |
| `{{stat:prepared.alter-self}}` | Alter Self prepared |
| `{{stat:prepared.animate-dead}}` | Animate Dead prepared |
| `{{stat:prepared.animate-objects}}` | Animate Objects prepared |
| `{{stat:prepared.antimagic-field}}` | Antimagic Field prepared |
| `{{stat:prepared.antipathy-sympathy}}` | Antipathy/Sympathy prepared |
| `{{stat:prepared.arcane-eye}}` | Arcane Eye prepared |
| `{{stat:prepared.arcane-hand}}` | Arcane Hand prepared |
| `{{stat:prepared.arcane-lock}}` | Arcane Lock prepared |
| `{{stat:prepared.arcane-sword}}` | Arcane Sword prepared |
| `{{stat:prepared.arcanist-s-magic-aura}}` | Arcanist’s Magic Aura prepared |
| `{{stat:prepared.astral-projection}}` | Astral Projection prepared |
| `{{stat:prepared.banishment}}` | Banishment prepared |
| `{{stat:prepared.bestow-curse}}` | Bestow Curse prepared |
| `{{stat:prepared.black-tentacles}}` | Black Tentacles prepared |
| `{{stat:prepared.blight}}` | Blight prepared |
| `{{stat:prepared.blindness-deafness}}` | Blindness/Deafness prepared |
| `{{stat:prepared.blink}}` | Blink prepared |
| `{{stat:prepared.blur}}` | Blur prepared |
| `{{stat:prepared.burning-hands}}` | Burning Hands prepared |
| `{{stat:prepared.chain-lightning}}` | Chain Lightning prepared |
| `{{stat:prepared.charm-person}}` | Charm Person prepared |
| `{{stat:prepared.circle-of-death}}` | Circle of Death prepared |
| `{{stat:prepared.clairvoyance}}` | Clairvoyance prepared |
| `{{stat:prepared.clone}}` | Clone prepared |
| `{{stat:prepared.cloudkill}}` | Cloudkill prepared |
| `{{stat:prepared.color-spray}}` | Color Spray prepared |
| `{{stat:prepared.comprehend-languages}}` | Comprehend Languages prepared |
| `{{stat:prepared.cone-of-cold}}` | Cone of Cold prepared |
| `{{stat:prepared.confusion}}` | Confusion prepared |
| `{{stat:prepared.conjure-elemental}}` | Conjure Elemental prepared |
| `{{stat:prepared.conjure-minor-elementals}}` | Conjure Minor Elementals prepared |
| `{{stat:prepared.contact-other-plane}}` | Contact Other Plane prepared |
| `{{stat:prepared.contingency}}` | Contingency prepared |
| `{{stat:prepared.continual-flame}}` | Continual Flame prepared |
| `{{stat:prepared.control-water}}` | Control Water prepared |
| `{{stat:prepared.control-weather}}` | Control Weather prepared |
| `{{stat:prepared.counterspell}}` | Counterspell prepared |
| `{{stat:prepared.create-undead}}` | Create Undead prepared |
| `{{stat:prepared.creation}}` | Creation prepared |
| `{{stat:prepared.darkness}}` | Darkness prepared |
| `{{stat:prepared.darkvision}}` | Darkvision prepared |
| `{{stat:prepared.delayed-blast-fireball}}` | Delayed Blast Fireball prepared |
| `{{stat:prepared.demiplane}}` | Demiplane prepared |
| `{{stat:prepared.detect-magic}}` | Detect Magic prepared |
| `{{stat:prepared.detect-thoughts}}` | Detect Thoughts prepared |
| `{{stat:prepared.dimension-door}}` | Dimension Door prepared |
| `{{stat:prepared.disguise-self}}` | Disguise Self prepared |
| `{{stat:prepared.disintegrate}}` | Disintegrate prepared |
| `{{stat:prepared.dispel-magic}}` | Dispel Magic prepared |
| `{{stat:prepared.dominate-monster}}` | Dominate Monster prepared |
| `{{stat:prepared.dominate-person}}` | Dominate Person prepared |
| `{{stat:prepared.dream}}` | Dream prepared |
| `{{stat:prepared.enlarge-reduce}}` | Enlarge/Reduce prepared |
| `{{stat:prepared.etherealness}}` | Etherealness prepared |
| `{{stat:prepared.expeditious-retreat}}` | Expeditious Retreat prepared |
| `{{stat:prepared.eyebite}}` | Eyebite prepared |
| `{{stat:prepared.fabricate}}` | Fabricate prepared |
| `{{stat:prepared.faithful-hound}}` | Faithful Hound prepared |
| `{{stat:prepared.false-life}}` | False Life prepared |
| `{{stat:prepared.fear}}` | Fear prepared |
| `{{stat:prepared.feather-fall}}` | Feather Fall prepared |
| `{{stat:prepared.feeblemind}}` | Feeblemind prepared |
| `{{stat:prepared.find-familiar}}` | Find Familiar prepared |
| `{{stat:prepared.finger-of-death}}` | Finger of Death prepared |
| `{{stat:prepared.fire-shield}}` | Fire Shield prepared |
| `{{stat:prepared.fireball}}` | Fireball prepared |
| `{{stat:prepared.flaming-sphere}}` | Flaming Sphere prepared |
| `{{stat:prepared.flesh-to-stone}}` | Flesh to Stone prepared |
| `{{stat:prepared.floating-disk}}` | Floating Disk prepared |
| `{{stat:prepared.fly}}` | Fly prepared |
| `{{stat:prepared.fog-cloud}}` | Fog Cloud prepared |
| `{{stat:prepared.forcecage}}` | Forcecage prepared |
| `{{stat:prepared.foresight}}` | Foresight prepared |
| `{{stat:prepared.freezing-sphere}}` | Freezing Sphere prepared |
| `{{stat:prepared.gaseous-form}}` | Gaseous Form prepared |
| `{{stat:prepared.gate}}` | Gate prepared |
| `{{stat:prepared.geas}}` | Geas prepared |
| `{{stat:prepared.gentle-repose}}` | Gentle Repose prepared |
| `{{stat:prepared.globe-of-invulnerability}}` | Globe of Invulnerability prepared |
| `{{stat:prepared.glyph-of-warding}}` | Glyph of Warding prepared |
| `{{stat:prepared.grease}}` | Grease prepared |
| `{{stat:prepared.greater-invisibility}}` | Greater Invisibility prepared |
| `{{stat:prepared.guards-and-wards}}` | Guards and Wards prepared |
| `{{stat:prepared.gust-of-wind}}` | Gust of Wind prepared |
| `{{stat:prepared.hallucinatory-terrain}}` | Hallucinatory Terrain prepared |
| `{{stat:prepared.haste}}` | Haste prepared |
| `{{stat:prepared.hideous-laughter}}` | Hideous Laughter prepared |
| `{{stat:prepared.hold-monster}}` | Hold Monster prepared |
| `{{stat:prepared.hold-person}}` | Hold Person prepared |
| `{{stat:prepared.hypnotic-pattern}}` | Hypnotic Pattern prepared |
| `{{stat:prepared.ice-storm}}` | Ice Storm prepared |
| `{{stat:prepared.identify}}` | Identify prepared |
| `{{stat:prepared.illusory-script}}` | Illusory Script prepared |
| `{{stat:prepared.imprisonment}}` | Imprisonment prepared |
| `{{stat:prepared.incendiary-cloud}}` | Incendiary Cloud prepared |
| `{{stat:prepared.instant-summons}}` | Instant Summons prepared |
| `{{stat:prepared.invisibility}}` | Invisibility prepared |
| `{{stat:prepared.irresistible-dance}}` | Irresistible Dance prepared |
| `{{stat:prepared.jump}}` | Jump prepared |
| `{{stat:prepared.knock}}` | Knock prepared |
| `{{stat:prepared.legend-lore}}` | Legend Lore prepared |
| `{{stat:prepared.levitate}}` | Levitate prepared |
| `{{stat:prepared.lightning-bolt}}` | Lightning Bolt prepared |
| `{{stat:prepared.locate-creature}}` | Locate Creature prepared |
| `{{stat:prepared.locate-object}}` | Locate Object prepared |
| `{{stat:prepared.longstrider}}` | Longstrider prepared |
| `{{stat:prepared.mage-armor}}` | Mage Armor prepared |
| `{{stat:prepared.magic-circle}}` | Magic Circle prepared |
| `{{stat:prepared.magic-jar}}` | Magic Jar prepared |
| `{{stat:prepared.magic-missile}}` | Magic Missile prepared |
| `{{stat:prepared.magic-mouth}}` | Magic Mouth prepared |
| `{{stat:prepared.magic-weapon}}` | Magic Weapon prepared |
| `{{stat:prepared.magnificent-mansion}}` | Magnificent Mansion prepared |
| `{{stat:prepared.major-image}}` | Major Image prepared |
| `{{stat:prepared.mass-suggestion}}` | Mass Suggestion prepared |
| `{{stat:prepared.maze}}` | Maze prepared |
| `{{stat:prepared.meteor-swarm}}` | Meteor Swarm prepared |
| `{{stat:prepared.mind-blank}}` | Mind Blank prepared |
| `{{stat:prepared.mirage-arcane}}` | Mirage Arcane prepared |
| `{{stat:prepared.mirror-image}}` | Mirror Image prepared |
| `{{stat:prepared.mislead}}` | Mislead prepared |
| `{{stat:prepared.misty-step}}` | Misty Step prepared |
| `{{stat:prepared.modify-memory}}` | Modify Memory prepared |
| `{{stat:prepared.move-earth}}` | Move Earth prepared |
| `{{stat:prepared.nondetection}}` | Nondetection prepared |
| `{{stat:prepared.passwall}}` | Passwall prepared |
| `{{stat:prepared.phantasmal-killer}}` | Phantasmal Killer prepared |
| `{{stat:prepared.phantom-steed}}` | Phantom Steed prepared |
| `{{stat:prepared.planar-binding}}` | Planar Binding prepared |
| `{{stat:prepared.plane-shift}}` | Plane Shift prepared |
| `{{stat:prepared.polymorph}}` | Polymorph prepared |
| `{{stat:prepared.power-word-kill}}` | Power Word Kill prepared |
| `{{stat:prepared.power-word-stun}}` | Power Word Stun prepared |
| `{{stat:prepared.prismatic-spray}}` | Prismatic Spray prepared |
| `{{stat:prepared.prismatic-wall}}` | Prismatic Wall prepared |
| `{{stat:prepared.private-sanctum}}` | Private Sanctum prepared |
| `{{stat:prepared.programmed-illusion}}` | Programmed Illusion prepared |
| `{{stat:prepared.project-image}}` | Project Image prepared |
| `{{stat:prepared.protection-from-energy}}` | Protection from Energy prepared |
| `{{stat:prepared.protection-from-evil-and-good}}` | Protection from Evil and Good prepared |
| `{{stat:prepared.ray-of-enfeeblement}}` | Ray of Enfeeblement prepared |
| `{{stat:prepared.remove-curse}}` | Remove Curse prepared |
| `{{stat:prepared.resilient-sphere}}` | Resilient Sphere prepared |
| `{{stat:prepared.reverse-gravity}}` | Reverse Gravity prepared |
| `{{stat:prepared.rope-trick}}` | Rope Trick prepared |
| `{{stat:prepared.scorching-ray}}` | Scorching Ray prepared |
| `{{stat:prepared.scrying}}` | Scrying prepared |
| `{{stat:prepared.secret-chest}}` | Secret Chest prepared |
| `{{stat:prepared.see-invisibility}}` | See Invisibility prepared |
| `{{stat:prepared.seeming}}` | Seeming prepared |
| `{{stat:prepared.sending}}` | Sending prepared |
| `{{stat:prepared.sequester}}` | Sequester prepared |
| `{{stat:prepared.shapechange}}` | Shapechange prepared |
| `{{stat:prepared.shatter}}` | Shatter prepared |
| `{{stat:prepared.shield}}` | Shield prepared |
| `{{stat:prepared.silent-image}}` | Silent Image prepared |
| `{{stat:prepared.simulacrum}}` | Simulacrum prepared |
| `{{stat:prepared.sleep}}` | Sleep prepared |
| `{{stat:prepared.sleet-storm}}` | Sleet Storm prepared |
| `{{stat:prepared.slow}}` | Slow prepared |
| `{{stat:prepared.spider-climb}}` | Spider Climb prepared |
| `{{stat:prepared.stinking-cloud}}` | Stinking Cloud prepared |
| `{{stat:prepared.stone-shape}}` | Stone Shape prepared |
| `{{stat:prepared.stoneskin}}` | Stoneskin prepared |
| `{{stat:prepared.suggestion}}` | Suggestion prepared |
| `{{stat:prepared.sunbeam}}` | Sunbeam prepared |
| `{{stat:prepared.sunburst}}` | Sunburst prepared |
| `{{stat:prepared.symbol}}` | Symbol prepared |
| `{{stat:prepared.telekinesis}}` | Telekinesis prepared |
| `{{stat:prepared.telepathic-bond}}` | Telepathic Bond prepared |
| `{{stat:prepared.teleport}}` | Teleport prepared |
| `{{stat:prepared.teleportation-circle}}` | Teleportation Circle prepared |
| `{{stat:prepared.thunderwave}}` | Thunderwave prepared |
| `{{stat:prepared.time-stop}}` | Time Stop prepared |
| `{{stat:prepared.tiny-hut}}` | Tiny Hut prepared |
| `{{stat:prepared.tongues}}` | Tongues prepared |
| `{{stat:prepared.true-polymorph}}` | True Polymorph prepared |
| `{{stat:prepared.true-seeing}}` | True Seeing prepared |
| `{{stat:prepared.unseen-servant}}` | Unseen Servant prepared |
| `{{stat:prepared.vampiric-touch}}` | Vampiric Touch prepared |
| `{{stat:prepared.wall-of-fire}}` | Wall of Fire prepared |
| `{{stat:prepared.wall-of-force}}` | Wall of Force prepared |
| `{{stat:prepared.wall-of-ice}}` | Wall of Ice prepared |
| `{{stat:prepared.wall-of-stone}}` | Wall of Stone prepared |
| `{{stat:prepared.water-breathing}}` | Water Breathing prepared |
| `{{stat:prepared.web}}` | Web prepared |
| `{{stat:prepared.weird}}` | Weird prepared |
| `{{stat:prepared.wish}}` | Wish prepared |
| `{{stat:proficiencyBonus}}` | proficiencyBonus |
| `{{stat:rangedWeaponAttackBonus}}` | rangedWeaponAttackBonus |
| `{{stat:remarkableAthleteBonus}}` | remarkableAthleteBonus |
| `{{stat:resource.capacity.action-surge}}` | Action Surge Maximum |
| `{{stat:resource.capacity.arcane-recovery}}` | Arcane Recovery Maximum |
| `{{stat:resource.capacity.dragonborn-breath}}` | Dragonborn Breath Maximum |
| `{{stat:resource.capacity.indomitable}}` | Indomitable Maximum |
| `{{stat:resource.capacity.infernal-darkness}}` | Infernal Darkness Maximum |
| `{{stat:resource.capacity.infernal-rebuke}}` | Infernal Rebuke Maximum |
| `{{stat:resource.capacity.relentless-endurance}}` | Relentless Endurance Maximum |
| `{{stat:resource.capacity.second-wind}}` | Second Wind Maximum |
| `{{stat:resource.capacity.signature.animate-dead}}` | Signature Animate Dead Maximum |
| `{{stat:resource.capacity.signature.bestow-curse}}` | Signature Bestow Curse Maximum |
| `{{stat:resource.capacity.signature.blink}}` | Signature Blink Maximum |
| `{{stat:resource.capacity.signature.clairvoyance}}` | Signature Clairvoyance Maximum |
| `{{stat:resource.capacity.signature.counterspell}}` | Signature Counterspell Maximum |
| `{{stat:resource.capacity.signature.dispel-magic}}` | Signature Dispel Magic Maximum |
| `{{stat:resource.capacity.signature.fear}}` | Signature Fear Maximum |
| `{{stat:resource.capacity.signature.fireball}}` | Signature Fireball Maximum |
| `{{stat:resource.capacity.signature.fly}}` | Signature Fly Maximum |
| `{{stat:resource.capacity.signature.gaseous-form}}` | Signature Gaseous Form Maximum |
| `{{stat:resource.capacity.signature.glyph-of-warding}}` | Signature Glyph Of Warding Maximum |
| `{{stat:resource.capacity.signature.haste}}` | Signature Haste Maximum |
| `{{stat:resource.capacity.signature.hypnotic-pattern}}` | Signature Hypnotic Pattern Maximum |
| `{{stat:resource.capacity.signature.lightning-bolt}}` | Signature Lightning Bolt Maximum |
| `{{stat:resource.capacity.signature.magic-circle}}` | Signature Magic Circle Maximum |
| `{{stat:resource.capacity.signature.major-image}}` | Signature Major Image Maximum |
| `{{stat:resource.capacity.signature.nondetection}}` | Signature Nondetection Maximum |
| `{{stat:resource.capacity.signature.phantom-steed}}` | Signature Phantom Steed Maximum |
| `{{stat:resource.capacity.signature.protection-from-energy}}` | Signature Protection From Energy Maximum |
| `{{stat:resource.capacity.signature.remove-curse}}` | Signature Remove Curse Maximum |
| `{{stat:resource.capacity.signature.sending}}` | Signature Sending Maximum |
| `{{stat:resource.capacity.signature.sleet-storm}}` | Signature Sleet Storm Maximum |
| `{{stat:resource.capacity.signature.slow}}` | Signature Slow Maximum |
| `{{stat:resource.capacity.signature.stinking-cloud}}` | Signature Stinking Cloud Maximum |
| `{{stat:resource.capacity.signature.tiny-hut}}` | Signature Tiny Hut Maximum |
| `{{stat:resource.capacity.signature.tongues}}` | Signature Tongues Maximum |
| `{{stat:resource.capacity.signature.vampiric-touch}}` | Signature Vampiric Touch Maximum |
| `{{stat:resource.capacity.signature.water-breathing}}` | Signature Water Breathing Maximum |
| `{{stat:resource.capacity.spell-slot.1}}` | Spell Slot 1 Maximum |
| `{{stat:resource.capacity.spell-slot.2}}` | Spell Slot 2 Maximum |
| `{{stat:resource.capacity.spell-slot.3}}` | Spell Slot 3 Maximum |
| `{{stat:resource.capacity.spell-slot.4}}` | Spell Slot 4 Maximum |
| `{{stat:resource.capacity.spell-slot.5}}` | Spell Slot 5 Maximum |
| `{{stat:resource.capacity.spell-slot.6}}` | Spell Slot 6 Maximum |
| `{{stat:resource.capacity.spell-slot.7}}` | Spell Slot 7 Maximum |
| `{{stat:resource.capacity.spell-slot.8}}` | Spell Slot 8 Maximum |
| `{{stat:resource.capacity.spell-slot.9}}` | Spell Slot 9 Maximum |
| `{{stat:resource.capacity.stroke-of-luck}}` | Stroke Of Luck Maximum |
| `{{stat:save.charisma}}` | save.charisma |
| `{{stat:save.constitution}}` | save.constitution |
| `{{stat:save.dexterity}}` | save.dexterity |
| `{{stat:save.intelligence}}` | save.intelligence |
| `{{stat:save.strength}}` | save.strength |
| `{{stat:save.wisdom}}` | save.wisdom |
| `{{stat:shield}}` | Wielding a shield |
| `{{stat:sizeCategory}}` | Size (0 Small, 1 Medium) |
| `{{stat:skill.acrobatics}}` | skill.acrobatics |
| `{{stat:skill.animal-handling}}` | skill.animal-handling |
| `{{stat:skill.arcana}}` | skill.arcana |
| `{{stat:skill.athletics}}` | skill.athletics |
| `{{stat:skill.deception}}` | skill.deception |
| `{{stat:skill.history}}` | skill.history |
| `{{stat:skill.insight}}` | skill.insight |
| `{{stat:skill.intimidation}}` | skill.intimidation |
| `{{stat:skill.investigation}}` | skill.investigation |
| `{{stat:skill.medicine}}` | skill.medicine |
| `{{stat:skill.nature}}` | skill.nature |
| `{{stat:skill.perception}}` | skill.perception |
| `{{stat:skill.performance}}` | skill.performance |
| `{{stat:skill.persuasion}}` | skill.persuasion |
| `{{stat:skill.religion}}` | skill.religion |
| `{{stat:skill.sleight-of-hand}}` | skill.sleight-of-hand |
| `{{stat:skill.stealth}}` | skill.stealth |
| `{{stat:skill.survival}}` | skill.survival |
| `{{stat:sneakAttackDice}}` | sneakAttackDice |
| `{{stat:speed}}` | speed |
| `{{stat:spellSlots.1}}` | spellSlots.1 |
| `{{stat:spellSlots.2}}` | spellSlots.2 |
| `{{stat:spellSlots.3}}` | spellSlots.3 |
| `{{stat:spellSlots.4}}` | spellSlots.4 |
| `{{stat:spellSlots.5}}` | spellSlots.5 |
| `{{stat:spellSlots.6}}` | spellSlots.6 |
| `{{stat:spellSlots.7}}` | spellSlots.7 |
| `{{stat:spellSlots.8}}` | spellSlots.8 |
| `{{stat:spellSlots.9}}` | spellSlots.9 |
| `{{stat:strength}}` | strength |
| `{{stat:training.armor.heavy}}` | training.armor.heavy |
| `{{stat:training.armor.light}}` | training.armor.light |
| `{{stat:training.armor.medium}}` | training.armor.medium |
| `{{stat:training.armor.shield}}` | training.armor.shield |
| `{{stat:training.save.charisma}}` | training.save.charisma |
| `{{stat:training.save.constitution}}` | training.save.constitution |
| `{{stat:training.save.dexterity}}` | training.save.dexterity |
| `{{stat:training.save.intelligence}}` | training.save.intelligence |
| `{{stat:training.save.strength}}` | training.save.strength |
| `{{stat:training.save.wisdom}}` | training.save.wisdom |
| `{{stat:training.skill.acrobatics}}` | training.skill.acrobatics |
| `{{stat:training.skill.animal-handling}}` | training.skill.animal-handling |
| `{{stat:training.skill.arcana}}` | training.skill.arcana |
| `{{stat:training.skill.athletics}}` | training.skill.athletics |
| `{{stat:training.skill.deception}}` | training.skill.deception |
| `{{stat:training.skill.history}}` | training.skill.history |
| `{{stat:training.skill.insight}}` | training.skill.insight |
| `{{stat:training.skill.intimidation}}` | training.skill.intimidation |
| `{{stat:training.skill.investigation}}` | training.skill.investigation |
| `{{stat:training.skill.medicine}}` | training.skill.medicine |
| `{{stat:training.skill.nature}}` | training.skill.nature |
| `{{stat:training.skill.perception}}` | training.skill.perception |
| `{{stat:training.skill.performance}}` | training.skill.performance |
| `{{stat:training.skill.persuasion}}` | training.skill.persuasion |
| `{{stat:training.skill.religion}}` | training.skill.religion |
| `{{stat:training.skill.sleight-of-hand}}` | training.skill.sleight-of-hand |
| `{{stat:training.skill.stealth}}` | training.skill.stealth |
| `{{stat:training.skill.survival}}` | training.skill.survival |
| `{{stat:training.tool.carpenter}}` | Carpenter’s Tools Proficiency |
| `{{stat:training.tool.land-vehicles}}` | Land Vehicles Proficiency |
| `{{stat:training.tool.playing-cards}}` | Playing Cards Proficiency |
| `{{stat:training.tool.thieves-tools}}` | training.tool.thieves-tools |
| `{{stat:training.weapons.martial}}` | training.weapons.martial |
| `{{stat:training.weapons.simple}}` | training.weapons.simple |
| `{{stat:walkingSpeed}}` | walkingSpeed |
| `{{stat:wisdom}}` | wisdom |
| `{{stat:wizardPreparationLimit}}` | wizardPreparationLimit |
| `{{stat:wizardSpellAttack}}` | wizardSpellAttack |
| `{{stat:wizardSpellDC}}` | wizardSpellDC |
| `{{stat:wizardSpellLevel}}` | wizardSpellLevel |
