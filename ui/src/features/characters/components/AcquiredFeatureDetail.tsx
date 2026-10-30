import { adjustResource } from '@/src/index';
import { ResourceSummary } from '@/ui/src/features/characters/components/ResourceSummary';
import { CharacterRuleContext } from '@/ui/src/features/characters/model/character-rule-context';
import { useContext } from 'react';
import type { Engine, EvaluationResult, Instance } from '@/src/index';
import { FeatureRequirements } from '@/ui/src/features/catalogue/components/FeatureRequirements';
import { FeatureRules } from '@/ui/src/features/catalogue/components/RulesText';
import { FeatureLink } from '@/ui/src/features/catalogue/components/FeatureLink';
import { resourceChildren } from '@/ui/src/features/characters/model/resource-children';

/** What an acquired Feature shows when opened: rules, requirements and its resource pools. */
export function AcquiredFeatureDetail({
  instance,
  engine,
  result,
  visible,
  openFeature,
}: {
  instance: Instance;
  engine: Engine;
  result: EvaluationResult;
  visible: Set<string>;
  openFeature: (id: string) => void;
}) {
  const context = useContext(CharacterRuleContext);
  const feature = engine.getFeature(instance.feature);
  if (!feature) return null;
  const resources = resourceChildren(instance, engine, result, visible);
  const pools = Object.values(result.resources).filter((pool) =>
    resources.some((child) => pool.providers.includes(child.id)),
  );
  return (
    <>
      <FeatureRequirements
        feature={feature}
        engine={engine}
      />
      <FeatureRules
        instanceId={instance.id}
        feature={feature}
        engine={engine}
        openFeature={openFeature}
      />
      <FeatureLink
        id={feature.id}
        engine={engine}
      >
        View Feature →
      </FeatureLink>
      {context
        && pools.map((pool) => (
          <ResourceSummary
            key={pool.id}
            pool={pool}
            engine={engine}
            result={result}
            ready={context.character.buildState !== 'draft' && result.status === 'valid'}
            adjust={(amount) => {
              try {
                context.update(
                  adjustResource(engine, context.character, pool.id, amount, crypto.randomUUID()),
                );
              } catch (error) {
                context.report(error instanceof Error ? error.message : String(error));
              }
            }}
          />
        ))}
    </>
  );
}
