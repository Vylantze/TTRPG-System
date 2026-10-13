import type { SystemDefinition } from '@/src/model/SystemDefinition';
import { labelFromId } from '@/ui/src/lib/workspace';

export function resetConditionName(system: SystemDefinition, id: string): string {
  return system.resetConditions?.find((condition) => condition.id === id)?.name ?? labelFromId(id);
}
