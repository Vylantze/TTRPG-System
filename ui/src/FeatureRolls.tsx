import { useContext } from 'react';
import { featureRollExpression, featureRollInstances, rollCapability, rollFeature, applyFeatureRoll, type Engine, type FeatureDefinition } from '@/src/index';
import { CharacterRuleContext } from '@/ui/src/character-rule-context';
import { Tooltip } from '@/ui/src/Tooltip';

export function FeatureRolls({ feature, engine, instanceId }: { feature: FeatureDefinition; engine: Engine; instanceId?: string }) {
  const context = useContext(CharacterRuleContext);
  if (!context) return null;
  const { character, result, update, report } = context;
  const instances = featureRollInstances(engine, result, feature.id, instanceId);
  const ready = character.buildState !== 'draft' && result.status === 'valid';
  const attempt = (action: () => void) => {
    try {
      action();
    } catch (error) {
      report(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <div className="feature-rolls">
      {instances.map((instance) => {
        const roll = engine.getFeature(instance.feature)!.roll!;
        const capability = rollCapability(engine, result, instance.id);
        const affordable = !roll.capability || Boolean(capability && Object.entries(capability.costs).every(([pool, cost]) => (result.resources[pool]?.available ?? 0) >= cost));
        const records = character.rollResults?.filter((record) => record.instance === instance.id) ?? [];
        return (
          <section className="roll-control" key={instance.id}>
            <div className="toolbar">
              <button className="quiet" disabled={!ready || !affordable} onClick={() => attempt(() => update(rollFeature(engine, character, instance.id, crypto.randomUUID()).character))}>{`Roll ${featureRollExpression(roll, character, result)}`}</button>
              <small>{roll.capability ? `${roll.label} · spends the ability use when rolled` : `${roll.label} · reference dice only`}</small>
            </div>
            {records.map((record) => (
              <div className="toolbar roll-result" key={record.id}>
                <Tooltip text={record.breakdown}><output aria-live="polite" aria-label={`Result of ${record.expression}`}>{record.total}</output></Tooltip>
                {roll.restoreResource && <button className="quiet" disabled={!ready || record.applied !== undefined} onClick={() => attempt(() => update(applyFeatureRoll(engine, character, record.id, crypto.randomUUID()).character))}>{record.applied === undefined ? 'Apply healing' : 'Applied'}</button>}
                {record.applied !== undefined && <small>{`Restored ${record.applied} HP`}</small>}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
