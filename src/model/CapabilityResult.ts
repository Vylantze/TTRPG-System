import type { Capability } from '@/src/model/Capability.js';

export interface CapabilityResult { id: string; source: string; definition: Capability; costs: Record<string, number> }
