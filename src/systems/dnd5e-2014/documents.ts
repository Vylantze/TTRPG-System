import definitions from '@/src/systems/dnd5e-2014/definitions.json' with { type: 'json' };
import classes from '@/src/systems/dnd5e-2014/classes.json' with { type: 'json' };
import features from '@/src/systems/dnd5e-2014/features.json' with { type: 'json' };
import classFeatures from '@/src/systems/dnd5e-2014/class-features.json' with { type: 'json' };
import subclasses from '@/src/systems/dnd5e-2014/subclasses.json' with { type: 'json' };
import spells from '@/src/systems/dnd5e-2014/spells.json' with { type: 'json' };
import races from '@/src/systems/dnd5e-2014/races.json' with { type: 'json' };
import blocks from '@/src/systems/dnd5e-2014/blocks.json' with { type: 'json' };
import items from '@/src/systems/dnd5e-2014/items.json' with { type: 'json' };
import itemFeatures from '@/src/systems/dnd5e-2014/item-features.json' with { type: 'json' };

export const systemDocuments: Record<string, unknown> = {
  'definitions.json': definitions,
  'classes.json': classes,
  'features.json': features,
  'class-features.json': classFeatures,
  'subclasses.json': subclasses,
  'spells.json': spells,
  'races.json': races,
  'blocks.json': blocks,
  'items.json': items,
  'item-features.json': itemFeatures,
};
