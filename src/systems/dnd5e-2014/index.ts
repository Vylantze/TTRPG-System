import { Engine } from '../../engine.js';
import type { Catalogue } from '../../model.js';
import { commonFeatures, system, type Dnd2014Options } from './common.js';
import { originFeatures, originStats, raceNames } from './origins.js';
import { classes, classFeatures } from './classes.js';
import { magicFeatures, preparationStats } from './magic.js';
import { id } from './primitives.js';

export { armor, type Dnd2014Options } from './common.js';
export { wizardSpells, type Spell } from './spells.js';
export { classInfo, type SupportedClass } from './classes.js';
export { castSpell, castWizardSpell, recoverArcaneSlots, type SpellTurn } from './commands.js';

/** An explicitly bounded first implementation, not the complete SRD class set. */
export const dnd2014Coverage = {
  source: 'https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf', sourceRevision: 'SRD 5.1', license: 'CC-BY-4.0', revision: 1,
  classes: ['Fighter (Champion)', 'Rogue (Thief)', 'Wizard (Evocation)'], classLevels: [1,20],
  races: ['Human','Hill Dwarf','High Elf','Lightfoot Halfling','Dragonborn','Rock Gnome','Half-Elf','Half-Orc','Tiefling'],
  backgrounds: ['Acolyte'], feats: ['Grappler (optional)'],
  calculated: ['ability scores and modifiers','proficiency and trained saves','skills and Expertise','per-level HP with fixed or supplied rolls','Fighter attack count and critical threshold','armor AC and heavy-armor Strength speed reduction','resource spending and recovery','Wizard spellbook ownership, preparation, slots, mastery, signature spells','Arcane Recovery allocation','2014 bonus-action spell restriction with caller-supplied turn state'],
  descriptive: ['starting equipment choices and inventory','conditional racial traits','dice, targets, spell effects, concentration and durations','damage, temporary/current HP and healing','advantage/disadvantage and class rule triggers','manual spell copying costs','combat rounds, additional actions and once-per-turn limits'],
  unsupportedClasses: ['Barbarian','Bard','Cleric','Druid','Monk','Paladin','Ranger','Sorcerer','Warlock'],
  status: 'first character-building milestone; remaining SRD classes are not implemented'
} as const;

export function createDnd2014Catalogue(settings: Dnd2014Options = {}): Catalogue {
  if (Object.keys(settings).some(k => !['multiclass','feats','abilityMethod'].includes(k)) || (settings.multiclass !== undefined && typeof settings.multiclass !== 'boolean') || (settings.feats !== undefined && typeof settings.feats !== 'boolean') || (settings.abilityMethod !== undefined && !['standard-array','point-buy','manual'].includes(settings.abilityMethod))) throw new Error('Invalid DnD5e 2014 System options.');
  const options: Required<Dnd2014Options> = { multiclass: settings.multiclass ?? false, feats: settings.feats ?? false, abilityMethod: settings.abilityMethod ?? 'standard-array' };
  const definition = system(options, raceNames.map(name => `race.${name}`));
  definition.stats = [...definition.stats, ...originStats, ...preparationStats];
  definition.classes = Object.keys({ fighter: 0, rogue: 0, wizard: 0 }).map(id);
  const features = [...commonFeatures, ...originFeatures, ...classFeatures, ...magicFeatures];
  const subclassFeatures: Record<string, string> = {
    'fighter.remarkable-athlete': 'fighter.champion', 'fighter.superior-critical': 'fighter.champion', 'fighter.survivor': 'fighter.champion',
    'rogue.supreme-sneak': 'rogue.thief', 'rogue.use-magic-device': 'rogue.thief', 'rogue.thiefs-reflexes': 'rogue.thief',
    'wizard.potent-cantrip': 'wizard.evocation', 'wizard.empowered-evocation': 'wizard.evocation', 'wizard.overchannel': 'wizard.evocation'
  };
  const catalogue = structuredClone({ id: `dnd5e:2014:catalogue:${options.abilityMethod}:multiclass-${options.multiclass}:feats-${options.feats}`, revision: 1, system: definition, classes: classes(options.feats), features });
  for (const [name, subclass] of Object.entries(subclassFeatures)) catalogue.features.find(f => f.id === id(name))!.prerequisites = { feature: id(subclass) };
  return catalogue;
}

export const createDnd2014Engine = (options: Dnd2014Options = {}): Engine => new Engine(createDnd2014Catalogue(options));

/** Coverage follows each serialized component rather than implying automated spell effects. */
export function getDnd2014FeatureCoverage(catalogue: Catalogue = createDnd2014Catalogue()) {
  return catalogue.features.map(f => ({ feature: f.id, name: f.name, source: f.source, clauses: f.components.map(c => ({
    component: c.id, kind: c.kind,
    status: c.kind === 'describe' ? 'descriptive' : c.kind === 'grantCapability' ? 'partial' : 'automated',
    note: c.kind === 'grantCapability' ? 'Availability, action budget and resource costs are enforced; effect and triggers require adjudication.' : c.kind === 'describe' ? 'Displayed rule text; no automatic state changes.' : 'Engine evaluates this component.'
  })) }));
}
