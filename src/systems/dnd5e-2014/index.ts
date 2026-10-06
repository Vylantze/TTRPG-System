import { Engine, clone } from '../../engine.js';
import { SystemRegistry, getFeatureCoverage } from '../../system-loader.js';
import type { Catalogue } from '../../model.js';
import systemFile from './system.json' with { type: 'json' };
import metadata from './metadata.json' with { type: 'json' };

/** Optional bundled-content adapter. The engine also accepts user-supplied JSON. */
export interface Dnd2014Options { multiclass?: boolean; feats?: boolean; abilityMethod?: 'standard-array' | 'point-buy' | 'manual' }
export interface Spell { slug: string; name: string; level: number; school: string; ritual: boolean; castingTime: string; range: string; components: string; page: number }
export type SupportedClass = keyof typeof metadata.classInfo;
export const armor = metadata.armor;
export const wizardSpells: Spell[] = metadata.wizardSpells;
export const classInfo = metadata.classInfo;
export const dnd2014Coverage = metadata.coverage;
export { castSpell, castWizardSpell, recoverArcaneSlots, type SpellTurn } from '../../policy-commands.js';
const registry = new SystemRegistry();
registry.load(systemFile);
export const createDnd2014Engine = (options: Dnd2014Options = {}): Engine => registry.createEngine(systemFile.id, systemFile.revision, Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined)));
export const createDnd2014Catalogue = (options: Dnd2014Options = {}): Catalogue => clone(createDnd2014Engine(options).catalogue);
export const getDnd2014FeatureCoverage = (catalogue: Catalogue = createDnd2014Catalogue()) => getFeatureCoverage(catalogue);
