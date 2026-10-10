import { useState } from 'react';
import { adjustResource, deployCompanion, type Character, type Engine, type EvaluationResult } from '@/src/index';
import { FeatureRolls } from '@/ui/src/FeatureRolls';
import { ResourceSummary } from '@/ui/src/ResourceSummary';
import { FeatureRules } from '@/ui/src/RulesText';

export function CompanionPanels({ engine, character, result, update, report }: { engine: Engine; character: Character; result: EvaluationResult; update: (character: Character) => void; report: (message: string) => void }) {
  const [methods, setMethods] = useState<Record<string, string>>({});
  const [modes, setModes] = useState<Record<string, string>>({});
  const instances = result.instances.filter((instance) => instance.active && instance.eligible && engine.getFeature(instance.feature)?.companion && (!engine.getFeature(instance.feature)?.equipmentEffect || character.equipmentAssignments?.some((entry) => entry.instance === instance.id)));
  const orphaned = (character.deployedCompanions ?? []).filter((id) => !instances.some((instance) => instance.id === id));
  if (!instances.length && !orphaned.length) return null;
  const ready = character.buildState !== 'draft' && result.status === 'valid';
  const attempt = (action: () => Character) => {
    try {
      update(action());
    } catch (error) {
      report(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <section className="panel">
      <h2>Companions & objects</h2>
      {orphaned.map((id) => (
        <article className="notice" key={id}>
          <p>This companion’s Feature is no longer active.</p>
          <button className="quiet" onClick={() => attempt(() => deployCompanion(engine, character, id, false, crypto.randomUUID()))}>Dismiss inactive companion</button>
        </article>
      ))}
      {instances.map((instance) => {
        const feature = engine.getFeature(instance.feature)!;
        const companion = feature.companion!;
        const deployed = character.deployedCompanions?.includes(instance.id);
        const capabilities = result.capabilities.filter((capability) => capability.source === instance.id && companion.creationCapability && capability.definition.name.startsWith(companion.creationCapability));
        return (
          <article className="panel" key={instance.id}>
            <h3>{feature.displayName ?? feature.name}</h3>
            {!deployed && companion.modes && (
              <label>
                Type
                <select value={modes[instance.id] ?? companion.modes[0]} onChange={(event) => setModes({ ...modes, [instance.id]: event.target.value })}>{companion.modes.map((mode) => <option key={mode}>{mode}</option>)}</select>
              </label>
            )}
            {deployed && character.companionModes?.[instance.id] && <p>{character.companionModes[instance.id]}</p>}
            <div className="toolbar">
              {!deployed && !!capabilities.length && (
                <label>
                  Creation method
                  <select value={methods[instance.id] ?? capabilities[0].id} onChange={(event) => setMethods({ ...methods, [instance.id]: event.target.value })}>{capabilities.map((capability) => <option key={capability.id} value={capability.id}>{capability.definition.name}</option>)}</select>
                </label>
              )}
              <button className="quiet" disabled={!ready && !deployed} onClick={() => attempt(() => deployCompanion(engine, character, instance.id, !deployed, crypto.randomUUID(), methods[instance.id], modes[instance.id]))}>{deployed ? 'Dismiss' : 'Create / summon'}</button>
            </div>
            {deployed && (
              <>
                <dl className="companion-stats">
                  {companion.stats.map((id) => (
                    <div key={id}>
                      <dt>{engine.getStatDefinition(id)?.name ?? id}</dt>
                      <dd>{result.stats[id]?.value ?? '—'}</dd>
                    </div>
                  ))}
                </dl>
                {Object.values(result.resources).filter((pool) => companion.resources.includes(pool.key)).map((pool) => <ResourceSummary key={pool.id} pool={pool} engine={engine} result={result} ready={ready} adjust={(delta) => attempt(() => adjustResource(engine, character, pool.id, delta, crypto.randomUUID()))} />)}
                <FeatureRolls feature={feature} engine={engine} instanceId={instance.id} />
                <FeatureRules feature={feature} engine={engine} instanceId={instance.id} showRolls={false} />
              </>
            )}
          </article>
        );
      })}
    </section>
  );
}
