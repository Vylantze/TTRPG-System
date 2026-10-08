import type { ComponentBase } from './ComponentBase.js';
import type { Grant } from './Grant.js';
import type { Choice } from './Choice.js';
import type { Modifier } from './Modifier.js';
import type { Resource } from './Resource.js';
import type { Capability } from './Capability.js';

export type Component = Grant | Choice | Modifier | Resource | Capability | (ComponentBase & { kind: 'describe'; text: string });
