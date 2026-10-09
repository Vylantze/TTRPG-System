import type { FeatureDefinition, SystemDefinition } from '../../src/index';

/** Older/custom Systems keep a readable fallback until they supply explicit labels. */
export const featureName = (feature?:Pick<FeatureDefinition,'name' | 'displayName'>)=>feature?.displayName ?? feature?.name ?? 'Unavailable Feature';
export const tagName = (system:SystemDefinition,tag:string)=>system.tagDisplayNames?.[tag] ?? tag.replace(/[._-]/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase());
