import definitions from '@/src/systems/dnd5e-2024/definitions.json' with { type: 'json' };
import classes from '@/src/systems/dnd5e-2024/classes.json' with { type: 'json' };
import features from '@/src/systems/dnd5e-2024/features.json' with { type: 'json' };
import classFeatures from '@/src/systems/dnd5e-2024/class-features.json' with { type: 'json' };
import spells from '@/src/systems/dnd5e-2024/spells.json' with { type: 'json' };
import blocks from '@/src/systems/dnd5e-2024/blocks.json' with { type: 'json' };
import items from '@/src/systems/dnd5e-2024/items.json' with { type: 'json' };
import itemFeatures from '@/src/systems/dnd5e-2024/item-features.json' with { type: 'json' };

export const systemDocuments: Record<string, unknown> = {
  'definitions.json': definitions,
  'classes.json': classes,
  'features.json': features,
  'class-features.json': classFeatures,
  'spells.json': spells,
  'blocks.json': blocks,
  'items.json': items,
  'item-features.json': itemFeatures,
};
