import type { Character, Engine, EvaluationResult, Instance } from '@/src/index';
import { AcquiredFeatureDetail } from '@/ui/src/features/characters/components/AcquiredFeatureDetail';
import { featureName } from '@/ui/src/features/catalogue/model/display';
import { featureDescription } from '@/ui/src/features/catalogue/model/feature-description';
import { instanceFeatureName } from '@/ui/src/features/catalogue/model/feature-instance-name';
import { oneLine } from '@/ui/src/features/catalogue/model/definition-tree';
import { resourceChildren } from '@/ui/src/features/characters/model/resource-children';
import type { TreeNode } from '@/ui/src/types/TreeNode';

/** The class (or "Origin") an instance was acquired from, used as the row's source tag. */
export function instanceSource(instance: Instance, engine: Engine, character: Character) {
  const progression = character.progressions.find((item) => item.id === instance.progression);
  return progression
    ? (engine.catalogue.classes.find((cls) => cls.id === progression.class)?.name ?? 'Class')
    : 'Origin';
}

/** Acquired Features as tree rows: each instance holds its child instances, to any depth. */
export function instanceNodes(
  instances: Instance[],
  engine: Engine,
  character: Character,
  result: EvaluationResult,
  visible: Set<string>,
  openFeature: (id: string) => void,
  /** On a character sheet, resource pools and rolls render inside their parent's detail. */
  inSheet: boolean,
  tag: (instance: Instance) => string | undefined = (instance) =>
    instanceSource(instance, engine, character),
): TreeNode[] {
  return instances.flatMap((instance): TreeNode[] => {
    const feature = engine.getFeature(instance.feature);
    if (!feature) return [];
    const resources = resourceChildren(instance, engine, result, visible);
    // Resource pools render inside their parent and Roll Features under the parent's rules.
    const children = result.instances.filter(
      (child) =>
        child.parent === instance.id
        && visible.has(child.id)
        && (!inSheet || (!resources.includes(child) && !engine.getFeature(child.feature)?.roll)),
    );
    const source = tag(instance);
    const scoped = instanceFeatureName(instance, engine, result);
    // "Life Domain: Bless" reads as "Bless" when the row's tag already says Life Domain.
    const name
      = source && scoped.startsWith(`${source}: `) ? scoped.slice(source.length + 2) : scoped;
    return [
      {
        id: instance.id,
        tag: source,
        name,
        label: name,
        description: oneLine(featureDescription(feature, engine)),
        meta: children.length
          ? `${children.length} inside`
          : instance.progression
            ? `Level ${instance.acquiredClassLevel}`
            : undefined,
        state: !instance.active
          ? { text: 'Inactive', tone: 'muted' }
          : instance.eligible
            ? undefined
            : { text: 'Unmet requirements', tone: 'error' },
        detail: () => (
          <AcquiredFeatureDetail
            instance={instance}
            engine={engine}
            result={result}
            visible={visible}
            openFeature={openFeature}
          />
        ),
        children: children.length
          ? () =>
              instanceNodes(children, engine, character, result, visible, openFeature, inSheet, () =>
                featureName(feature),
              )
          : undefined,
      },
    ];
  });
}
