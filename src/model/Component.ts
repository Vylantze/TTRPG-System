import type { ComponentBase } from './ComponentBase.js';
import type { Grant } from './Grant.js';
import type { Choice } from './Choice.js';
import type { Modifier } from './Modifier.js';
import type { Resource } from './Resource.js';
import type { Capability } from './Capability.js';
import type { DefineStat } from './DefineStat.js';
import type { TrackResource } from './TrackResource.js';
import type { GrantResource } from './GrantResource.js';
import type { UseBlock } from './UseBlock.js';

export type Component = Grant | Choice | Modifier | Resource | Capability | DefineStat | TrackResource | GrantResource | UseBlock | (ComponentBase & { kind: 'describe'; text: string });
