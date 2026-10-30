import type { Engine, EvaluationResult, Instance } from '@/src/index';

/** Children that only provide resource pools; their pools show inside the parent instead. */
export function resourceChildren(
  instance: Instance,
  engine: Engine,
  result: EvaluationResult,
  visible: Set<string>,
) {
  return result.instances.filter(
    (item) =>
      item.parent === instance.id
      && visible.has(item.id)
      && engine
        .getFeature(item.feature)
        ?.components.some(
          (component) => component.kind === 'trackResource' || component.kind === 'defineResource',
        ),
  );
}
