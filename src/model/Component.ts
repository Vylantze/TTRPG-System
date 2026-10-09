import type { ComponentBase } from '@/src/model/ComponentBase.js';
import type { Grant } from '@/src/model/Grant.js';
import type { Choice } from '@/src/model/Choice.js';
import type { Modifier } from '@/src/model/Modifier.js';
import type { Resource } from '@/src/model/Resource.js';
import type { Capability } from '@/src/model/Capability.js';
import type { DefineStat } from '@/src/model/DefineStat.js';
import type { TrackResource } from '@/src/model/TrackResource.js';
import type { GrantResource } from '@/src/model/GrantResource.js';
import type { UseBlock } from '@/src/model/UseBlock.js';

export type Component = Grant | Choice | Modifier | Resource | Capability | DefineStat | TrackResource | GrantResource | UseBlock | (ComponentBase & { kind: 'describe'; text: string });
