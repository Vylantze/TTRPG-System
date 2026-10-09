import type metadata from '@/src/systems/dnd5e-2014/metadata.json';

export type SupportedClass = keyof typeof metadata.classInfo;
