import { adjustResource } from '@/src/index';
import { ResourceSummary } from '@/ui/src/ResourceSummary';
import { CharacterRuleContext } from '@/ui/src/character-rule-context';
import { useContext, useState } from 'react';
import type { Engine, EvaluationResult, Instance } from '@/src/index';
import { FeatureRequirements } from '@/ui/src/FeatureRequirements';
import { FeatureRules } from '@/ui/src/RulesText';
import { FeatureLink } from '@/ui/src/FeatureLink';
import { featureName } from '@/ui/src/display';

/** Mount detailed rules only when opened; descendants stay with their owning Feature. */
export function AcquiredFeature({ instance, engine, result, visible, openFeature }: { instance: Instance; engine: Engine; result: EvaluationResult; visible: Set<string>; openFeature: (id: string) => void }) {
  const context = useContext(CharacterRuleContext);
  const [open, setOpen] = useState(false);
  const feature = engine.getFeature(instance.feature);
  if (!feature) return null;
  const children = result.instances.filter((item) => item.parent === instance.id && visible.has(item.id));
  const resourceChildren = children.filter((child) => engine.getFeature(child.feature)?.components.some((component) => component.kind === 'trackResource' || component.kind === 'defineResource'));
  const pools = Object.values(result.resources).filter((pool) => resourceChildren.some((child) => pool.providers.includes(child.id)));
  return (
    <details className="acquired-feature panel" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <span>
          {featureName(feature)}
          <small>{children.length ? `${children.length} included Features` : `Acquired at character level ${instance.acquiredCharacterLevel}`}</small>
        </span>
        <span className={`badge ${!instance.active ? 'incomplete' : instance.eligible ? 'valid' : 'invalid'}`}>{!instance.active ? 'Inactive' : instance.eligible ? 'Active' : 'Unmet requirements'}</span>
      </summary>
      {open && (
        <>
          <FeatureRequirements feature={feature} engine={engine} />
          <FeatureRules feature={feature} engine={engine} openFeature={openFeature} />
          <FeatureLink id={feature.id} engine={engine}>View Feature →</FeatureLink>
          {context && pools.map((pool) => (
            <ResourceSummary
              key={pool.id}
              pool={pool}
              engine={engine}
              result={result}
              ready={context.character.buildState !== 'draft' && result.status === 'valid'}
              adjust={(amount) => {
                try {
                  context.update(adjustResource(engine, context.character, pool.id, amount, crypto.randomUUID()));
                } catch (error) {
                  context.report(error instanceof Error ? error.message : String(error));
                }
              }}
            />
          ))}
          {children.filter((child) => !context || !resourceChildren.includes(child)).map((child) => <AcquiredFeature key={child.id} instance={child} engine={engine} result={result} visible={visible} openFeature={openFeature} />)}
        </>
      )}
    </details>
  );
}
