import { RestControls } from '@/ui/src/RestControls';
import { FeatureRolls } from '@/ui/src/FeatureRolls';
import { adjustResource, type Character, type Engine, type EvaluationResult } from '@/src/index';
import { ResourceSummary } from '@/ui/src/ResourceSummary';

export function HitPoints({ engine, character, result, update, report }: { engine: Engine; character: Character; result: EvaluationResult; update: (character: Character) => void; report: (message: string) => void }) {
  return (
    <div className="sheet-hit-points">
      <RestControls engine={engine} character={character} result={result} update={update} report={report} />
      {Object.values(result.resources).filter((pool) => pool.key === 'hit-points').map((pool) => (
        <ResourceSummary
          key={pool.id}
          pool={pool}
          engine={engine}
          result={result}
          ready={character.buildState !== 'draft' && result.status === 'valid'}
          adjust={(amount) => {
            try {
              update(adjustResource(engine, character, pool.id, amount, crypto.randomUUID()));
            } catch (error) {
              report(error instanceof Error ? error.message : String(error));
            }
          }}
        />
      ))}
      {engine.catalogue.system.healingFeaturesTag && [...new Set(result.instances.filter((instance) => instance.active && instance.eligible && engine.getFeature(instance.feature)?.tags?.includes(engine.catalogue.system.healingFeaturesTag!)).map((instance) => instance.feature))].map((id) => (
        <details className="panel rest-healing" key={id}>
          <summary>{engine.getFeature(id)!.displayName ?? engine.getFeature(id)!.name}</summary>
          {Object.values(result.resources).filter((pool) => pool.providers.some((provider) => result.instances.some((instance) => instance.feature === id && provider.startsWith(`${instance.id}/`)))).map((pool) => <ResourceSummary key={pool.id} pool={pool} engine={engine} result={result} />)}
          <FeatureRolls feature={engine.getFeature(id)!} engine={engine} />
        </details>
      ))}
    </div>
  );
}
