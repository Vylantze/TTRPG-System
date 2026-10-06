import type { Expression, Component, FeatureDefinition, Choice, Grant, ScalingTable } from '../../model.js';

export const PREFIX = 'dnd5e:2014:';
export const id = (name: string): string => PREFIX + name;
export const source = 'SRD 5.1 (CC BY 4.0), https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf';
export const stat = (name: string): Expression => ({ stat: name });
export const context = (name: string): Expression => ({ context: name });
export const parameter = (name: string): Expression => ({ parameter: name });
export const op = (name: Extract<Expression, { op: string }>['op'], ...args: Expression[]): Expression => ({ op: name, args });
export const when = (condition: Expression, yes: Expression, no: Expression = 0): Expression => ({ if: condition, then: yes, else: no });
export const level = (cls: string): Expression => context(`level.${id(cls)}`);
export const feature = (name: string, title: string, components: Component[], extra: Partial<FeatureDefinition> = {}): FeatureDefinition => ({ id: id(name), revision: 1, name: title, source, components, ...extra });
export const grant = (name: string, featureName = name): Grant => ({ id: name, kind: 'grantFeature', feature: id(featureName) });
export const choice = (name: string, candidates: string[], count: Expression = 1, extra: Partial<Choice> = {}): Choice => ({ id: name, kind: 'chooseFeatures', minimum: count, maximum: count, candidates: { ids: candidates.map(id) }, retraining: { allowed: false }, ...extra });
export const modifier = (name: string, target: string, operation: 'add' | 'floor' | 'ceiling' | 'override', value: Expression, condition?: Expression): Component => ({ id: name, kind: 'modifyStat', stat: target, operation, value, ...(condition !== undefined ? { condition } : {}) });
export const describe = (text: string): Component => ({ id: 'rules', kind: 'describe', text });
export const table = (values: number[], start = 0): ScalingTable => ({ mode: 'exact', rows: values.map((value, i) => ({ key: i + start, value })), below: 'error', above: 'error', missing: 'error' });
export const threshold = (...rows: [number, number][]): ScalingTable => ({ mode: 'threshold', rows: rows.map(([key, value]) => ({ key, value })), below: 'error', above: 'boundary' });
export const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const;
export const skills: Record<string, typeof abilities[number]> = {
  acrobatics: 'dexterity', 'animal-handling': 'wisdom', arcana: 'intelligence', athletics: 'strength', deception: 'charisma', history: 'intelligence', insight: 'wisdom', intimidation: 'charisma', investigation: 'intelligence', medicine: 'wisdom', nature: 'intelligence', perception: 'wisdom', performance: 'charisma', persuasion: 'charisma', religion: 'intelligence', 'sleight-of-hand': 'dexterity', stealth: 'dexterity', survival: 'wisdom'
};
export const languages = ['common', 'dwarvish', 'elvish', 'giant', 'gnomish', 'goblin', 'halfling', 'orc', 'abyssal', 'celestial', 'draconic', 'deep-speech', 'infernal', 'primordial', 'sylvan', 'undercommon'];
export const slotRows = [
  [0,0,0,0,0,0,0,0,0], [2,0,0,0,0,0,0,0,0], [3,0,0,0,0,0,0,0,0], [4,2,0,0,0,0,0,0,0],
  [4,3,0,0,0,0,0,0,0], [4,3,2,0,0,0,0,0,0], [4,3,3,0,0,0,0,0,0], [4,3,3,1,0,0,0,0,0],
  [4,3,3,2,0,0,0,0,0], [4,3,3,3,1,0,0,0,0], [4,3,3,3,2,0,0,0,0], [4,3,3,3,2,1,0,0,0],
  [4,3,3,3,2,1,0,0,0], [4,3,3,3,2,1,1,0,0], [4,3,3,3,2,1,1,0,0], [4,3,3,3,2,1,1,1,0],
  [4,3,3,3,2,1,1,1,0], [4,3,3,3,2,1,1,1,1], [4,3,3,3,3,1,1,1,1], [4,3,3,3,3,2,1,1,1], [4,3,3,3,3,2,2,1,1]
];
