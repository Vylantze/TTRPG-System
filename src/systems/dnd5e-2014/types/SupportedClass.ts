import type metadata from '../metadata.json';

export type SupportedClass = keyof typeof metadata.classInfo;
