import type { ClassDefinition, FeatureDefinition, Component, Expression, Grant, Choice, Predicate } from '../../model.js';
import { feature, modifier, stat, context, parameter, op, when, threshold, id, grant, choice, describe, skills } from './primitives.js';

export const classInfo = {
  fighter: { name: 'Fighter', hitDie: 10, saves: ['strength','constitution'], skills: ['acrobatics','animal-handling','athletics','history','insight','intimidation','perception','survival'], startingSkills: 2, multiclassSkills: 0, armor: ['light','medium','heavy','shield'], weapons: ['simple','martial'], asi: [4,6,8,12,14,16,19], subclassAt: 3, subclass: 'champion' },
  rogue: { name: 'Rogue', hitDie: 8, saves: ['dexterity','intelligence'], skills: ['acrobatics','athletics','deception','insight','intimidation','investigation','perception','performance','persuasion','sleight-of-hand','stealth'], startingSkills: 4, multiclassSkills: 1, armor: ['light'], weapons: ['simple'], asi: [4,8,10,12,16,19], subclassAt: 3, subclass: 'thief' },
  wizard: { name: 'Wizard', hitDie: 6, saves: ['intelligence','wisdom'], skills: ['arcana','history','insight','investigation','medicine','religion'], startingSkills: 2, multiclassSkills: 0, armor: [], weapons: [], asi: [4,8,12,16,19], subclassAt: 2, subclass: 'evocation' }
} as const;
export type SupportedClass = keyof typeof classInfo;
export const styleNames = ['archery','defense','dueling','great-weapon-fighting','protection','two-weapon-fighting'];
const starting = context('isStartingClass');
const rest = [{ event: 'short-rest', amount: 'full' as const }, { event: 'long-rest', amount: 'full' as const }];
const resource = (key: string, capacity: Expression, recovery = rest): Component => ({ id: `pool.${key}`, kind: 'defineResource', key, capacity, scope: 'progression', units: 'uses', integer: true, recovery });
const ability = (name: string, key?: string, action?: string, description?: string): Component => ({ id: name.toLowerCase().replaceAll(' ','-'), kind: 'grantCapability', name, ...(key ? { costs: [{ key, amount: 1 }] } : {}), ...(action ? { action: { kind: action, amount: 1 } } : {}), ...(description ? { description } : {}) });
const text = (name: string, title: string, description: string): FeatureDefinition => feature(name, title, [describe(description)]);

export const classFeatures: FeatureDefinition[] = [
  ...Object.entries(classInfo).flatMap(([cls, info]): FeatureDefinition[] => [
    feature(`${cls}.entry`, `${info.name} entry benefits`, [
      ...info.saves.map(a => modifier(`save.${a}`, `training.save.${a}`, 'floor', 1, starting)),
      ...info.armor.map(a => modifier(`armor.${a}`, `training.armor.${a}`, 'floor', 1, a === 'heavy' ? starting : undefined)),
      ...info.weapons.map(w => modifier(`weapons.${w}`, `training.weapons.${w}`, 'floor', 1, cls === 'rogue' ? starting : undefined)),
      ...(cls === 'rogue' ? [modifier('tools', 'training.tool.thieves-tools', 'floor', 1)] : []),
      choice('skills', info.skills.map(s => `skill.${s}`), when(starting, info.startingSkills, info.multiclassSkills)),
      describe(cls === 'wizard' ? 'Starting class weapon proficiency: daggers, darts, slings, quarterstaffs, light crossbows. Starting equipment: quarterstaff or dagger, component pouch or arcane focus, scholar’s or explorer’s pack, spellbook. Multiclass entry grants none of these starting proficiencies or equipment.' : cls === 'rogue' ? 'Also proficient with hand crossbows, longswords, rapiers, and shortswords when this is the starting class. Starting equipment: rapier or shortsword, shortbow with 20 arrows or shortsword, burglar’s/dungeoneer’s/explorer’s pack, leather armor, two daggers, and thieves’ tools.' : 'Starting equipment: chain mail or leather armor with longbow and 20 arrows; martial weapon with shield or two martial weapons; light crossbow with 20 bolts or two handaxes; dungeoneer’s or explorer’s pack. Multiclass entry supplies neither starting equipment nor heavy armor nor saving throw proficiency.')
    ]),
    feature(`${cls}.hit-points`, `${info.name} hit points for one level`, [modifier('hit-points', 'hitPoints', 'add', op('max', 1, op('add', when(op('and', starting, op('eq', context('acquiredClassLevel'), 1)), info.hitDie, parameter('roll')), stat('modifier.constitution'))))], {
      repeat: { maximum: 20, scope: 'progression' }, parameters: { roll: { kind: 'number', default: info.hitDie / 2 + 1, integer: true, minimum: 1, maximum: info.hitDie } }
    })
  ]),
  feature('fighter.second-wind', 'Second Wind', [resource('second-wind', 1), ability('Second Wind', 'second-wind', 'bonus-action', 'Regain 1d10 + Fighter level hit points; one use per short or long rest.')]),
  feature('fighter.action-surge', 'Action Surge', [resource('action-surge', { table: 'uses', input: context('classLevel') }), ability('Action Surge', 'action-surge', undefined, 'Take one additional action on your turn. Two uses at Fighter 17; at most one use on a turn. The caller tracks the additional action and per-turn limit.')], { tables: { uses: threshold([0,1],[17,2]) } }),
  feature('fighter.extra-attack', 'Extra Attack', [modifier('attacks', 'attacksPerAction', 'floor', { table: 'attacks', input: context('classLevel') })], { tables: { attacks: threshold([0,1],[5,2],[11,3],[20,4]) } }),
  feature('fighter.indomitable', 'Indomitable', [resource('indomitable', { table: 'uses', input: context('classLevel') }, [{ event: 'long-rest', amount: 'full' }]), ability('Indomitable', 'indomitable', undefined, 'Reroll a failed saving throw and use the new result.')], { tables: { uses: threshold([0,1],[13,2],[17,3]) } }),
  feature('style.archery', 'Archery', [modifier('ranged-attack', 'rangedWeaponAttackBonus', 'add', 2), describe('Add this bonus only to attacks with ranged weapons.')]),
  feature('style.defense', 'Defense', [modifier('armor-class', 'armorClass', 'add', 1, op('gt', stat('armorIndex'), 0))]),
  feature('style.dueling', 'Dueling', [modifier('damage', 'oneHandedWeaponDamageBonus', 'add', 2), describe('Apply only while wielding a melee weapon in one hand and no other weapons.')]),
  text('style.great-weapon-fighting', 'Great Weapon Fighting', 'Reroll a 1 or 2 on a damage die of a melee attack with a two-handed or versatile weapon wielded in two hands; use the new result.'),
  feature('style.protection', 'Protection', [ability('Protect ally', undefined, 'reaction', 'With a shield, impose disadvantage when a visible creature attacks another target within 5 feet.')]),
  text('style.two-weapon-fighting', 'Two-Weapon Fighting', 'Add your ability modifier to the damage of the second attack made using two-weapon fighting.'),
  feature('fighter.champion', 'Champion', [modifier('critical', 'criticalThreshold', 'ceiling', 19)], { tags: ['subclass','fighter-subclass'] }),
  feature('fighter.remarkable-athlete', 'Remarkable Athlete', [
    modifier('bonus', 'remarkableAthleteBonus', 'floor', op('ceil', op('divide', stat('proficiencyBonus'), 2))),
    ...Object.entries(skills).filter(([, a]) => ['strength','dexterity','constitution'].includes(a)).map(([s]) => modifier(s, `skill.${s}`, 'add', op('ceil', op('divide', stat('proficiencyBonus'), 2)), op('eq', stat(`training.skill.${s}`), 0))),
    modifier('initiative', 'initiative', 'add', op('ceil', op('divide', stat('proficiencyBonus'), 2))),
    describe('Apply half proficiency rounded up to other untrained Strength, Dexterity, and Constitution checks. Increase running long jump distance by Strength modifier.')
  ]),
  feature('fighter.superior-critical', 'Superior Critical', [modifier('critical', 'criticalThreshold', 'ceiling', 18)]),
  feature('fighter.survivor', 'Survivor', [ability('Survivor', undefined, undefined, 'At the start of your turn, regain 5 + Constitution modifier HP when above 0 HP and no more than half maximum HP.')]),
  feature('rogue.sneak-attack', 'Sneak Attack', [modifier('dice', 'sneakAttackDice', 'floor', op('ceil', op('divide', context('classLevel'), 2))), describe('Once per turn, add sneakAttackDice d6 to a finesse or ranged weapon hit with advantage, or with another non-incapacitated enemy of the target within 5 feet and no disadvantage.')]),
  text('rogue.thieves-cant', 'Thieves’ Cant', 'Understand and convey secret messages through coded conversation, symbols, and signs.'),
  feature('rogue.cunning-action', 'Cunning Action', ['Dash','Disengage','Hide'].map(name => ability(name, undefined, 'bonus-action'))),
  feature('rogue.thief', 'Thief', [ability('Fast Hands', undefined, 'bonus-action', 'Use Cunning Action to make a Sleight of Hand check, use thieves’ tools to disarm a trap or open a lock, or take the Use an Object action.'), describe('Second-Story Work: climbing costs no extra movement; running jump distance increases by Dexterity modifier.')], { tags: ['subclass','rogue-subclass'] }),
  feature('rogue.uncanny-dodge', 'Uncanny Dodge', [ability('Uncanny Dodge', undefined, 'reaction', 'Halve damage from an attack that hits you when you can see the attacker.')]),
  text('rogue.evasion', 'Evasion', 'On a Dexterity save normally dealing half damage on success, take no damage on success and half on failure.'),
  text('rogue.supreme-sneak', 'Supreme Sneak', 'Advantage on Dexterity (Stealth) when moving no more than half your speed on the turn.'),
  text('rogue.reliable-talent', 'Reliable Talent', 'Treat a d20 result of 9 or lower as 10 on an ability check that adds your proficiency bonus.'),
  text('rogue.use-magic-device', 'Use Magic Device', 'Ignore class, race, and level requirements on the use of magic items.'),
  text('rogue.blindsense', 'Blindsense', 'When able to hear, know the location of hidden or invisible creatures within 10 feet.'),
  feature('rogue.slippery-mind', 'Slippery Mind', [modifier('save', 'training.save.wisdom', 'floor', 1)]),
  text('rogue.thiefs-reflexes', 'Thief’s Reflexes', 'Take a second turn at initiative minus 10 during the first round of combat, unless surprised.'),
  text('rogue.elusive', 'Elusive', 'No attack roll has advantage against you while you are not incapacitated.'),
  feature('rogue.stroke-of-luck', 'Stroke of Luck', [resource('stroke-of-luck', 1), ability('Stroke of Luck', 'stroke-of-luck', undefined, 'Turn a miss against a target within range into a hit, or treat the d20 of a failed ability check as 20.')]),
  feature('wizard.evocation', 'School of Evocation', [describe('Evocation Savant halves the time and gold to copy an evocation spell. Sculpt Spells protects 1 + spell level chosen creatures from qualifying evocation saving throws and damage.')], { tags: ['subclass','wizard-subclass'] }),
  text('wizard.potent-cantrip', 'Potent Cantrip', 'A creature succeeding on a saving throw against your damaging cantrip takes half damage and no additional effects.'),
  text('wizard.empowered-evocation', 'Empowered Evocation', 'Add your Intelligence modifier to one damage roll of any Wizard evocation spell you cast.'),
  text('wizard.overchannel', 'Overchannel', 'Maximize damage of a Wizard spell of levels 1–5. First use before a long rest is free; further uses inflict increasing d12 necrotic damage per spell level, ignoring resistance and immunity. Track repeated uses and resulting HP changes manually.')
];

export function classes(feats: boolean): ClassDefinition[] {
  return Object.entries(classInfo).map(([cls, info]) => {
    const levels: Record<string, (Grant | Choice)[]> = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), [choice('hit-points', [`${cls}.hit-points`])]]));
    const add = (level: number, ...entries: (Grant | Choice)[]) => levels[level].push(...entries);
    add(1, grant('entry', `${cls}.entry`));
    for (const level of info.asi) add(level, choice('improvement', ['ability-score-improvement', ...(feats ? ['feat.grappler'] : [])]));
    add(info.subclassAt, choice('subclass', [`${cls}.${info.subclass}`]));
    if (cls === 'fighter') {
      add(1, choice('fighting-style', styleNames.map(s => `style.${s}`)), grant('second-wind', 'fighter.second-wind'));
      add(2, grant('action-surge', 'fighter.action-surge')); add(5, grant('extra-attack', 'fighter.extra-attack')); add(9, grant('indomitable', 'fighter.indomitable'));
      add(7, grant('remarkable-athlete', 'fighter.remarkable-athlete')); add(10, choice('additional-style', styleNames.map(s => `style.${s}`)));
      add(15, grant('superior-critical', 'fighter.superior-critical')); add(18, grant('survivor', 'fighter.survivor'));
      // Scaling is defined on the original Features; later entries expose independent progression information.
      for (const level of [11,13,17,20]) levels[level].push(grant(`upgrade-${level}`, `fighter.upgrade-${level}`));
    } else if (cls === 'rogue') {
      add(1, choice('expertise', [...Object.keys(skills), 'thieves-tools'].map(s => `expertise.${s}`), 2), grant('sneak-attack', 'rogue.sneak-attack'), grant('thieves-cant', 'rogue.thieves-cant'));
      add(6, choice('expertise', [...Object.keys(skills), 'thieves-tools'].map(s => `expertise.${s}`), 2));
      for (const [level, name] of [[2,'cunning-action'],[5,'uncanny-dodge'],[7,'evasion'],[9,'supreme-sneak'],[11,'reliable-talent'],[13,'use-magic-device'],[14,'blindsense'],[15,'slippery-mind'],[17,'thiefs-reflexes'],[18,'elusive'],[20,'stroke-of-luck']] as const) add(level, grant(name, `rogue.${name}`));
    } else {
      add(1, grant('spellcasting', 'wizard.spellcasting'), grant('arcane-recovery', 'wizard.arcane-recovery'));
      for (const [level, name] of [[6,'potent-cantrip'],[10,'empowered-evocation'],[14,'overchannel'],[18,'spell-mastery'],[20,'signature-spells']] as const) add(level, grant(name, `wizard.${name}`));
      for (let level = 1; level <= 20; level++) add(level, choice('spellbook', [], level === 1 ? 6 : 2, { candidates: { tags: ['wizard-spellbook'], maximumLevel: op('min', 9, op('ceil', op('divide', context('acquiredClassLevel'), 2))) } }));
      add(1, choice('cantrips', [], 3, { candidates: { tags: ['wizard-cantrip'] } }));
      for (const level of [4,10]) add(level, choice('cantrip', [], 1, { candidates: { tags: ['wizard-cantrip'] } }));
    }
    const multiclassPrerequisites: Predicate = cls === 'fighter' ? { any: [{ stat: 'strength', minimum: 13 }, { stat: 'dexterity', minimum: 13 }] } : { stat: cls === 'rogue' ? 'dexterity' : 'intelligence', minimum: 13 };
    return { id: id(cls), revision: 1, name: info.name, levels, maximumLevel: 20, multiclassPrerequisites };
  });
}

classFeatures.push(...[11,13,17,20].map(level => text(`fighter.upgrade-${level}`, `Fighter level ${level} resource/attack upgrade`, level === 11 ? 'Extra Attack now allows three attacks.' : level === 13 ? 'Indomitable now has two uses.' : level === 17 ? 'Action Surge now has two uses; Indomitable has three.' : 'Extra Attack now allows four attacks.')));
