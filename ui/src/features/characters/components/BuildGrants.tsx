import type { Character, Engine, EvaluationResult } from '@/src/index';
import { AcquiredFeature } from '@/ui/src/features/characters/components/AcquiredFeature';

export function BuildGrants({
  engine,
  character,
  result,
  level,
  openFeature,
}: {
  engine: Engine;
  character: Character;
  result: EvaluationResult;
  level: string;
  openFeature: (id: string) => void;
}) {
  const grants = result.instances
    .filter(
      (instance) =>
        instance.active
        && !instance.selection
        && !instance.id.startsWith('root/')
        && (level === 'all'
          || (instance.progression ? String(instance.acquiredClassLevel) : 'origins') === level),
    )
    .sort(
      (a, b) =>
        a.acquiredClassLevel - b.acquiredClassLevel
        || a.acquiredCharacterLevel - b.acquiredCharacterLevel
        || a.id.localeCompare(b.id),
    );
  const visible = new Set(grants.map((instance) => instance.id));
  const roots = grants.filter((instance) => !instance.parent || !visible.has(instance.parent));
  return (
    <section className="automatic-grants">
      <h3>Automatically granted Features</h3>
      {!grants.length && <p className="muted">No automatic Features at this level.</p>}
      {roots.map((instance) => (
        <div key={instance.id}>
          <small>
            {instance.progression
              ? `${engine.catalogue.classes.find((entry) => entry.id === character.progressions.find((progression) => progression.id === instance.progression)?.class)?.name ?? 'Class'} · Level ${instance.acquiredClassLevel}`
              : `Origin · Character level ${instance.acquiredCharacterLevel}`}
          </small>
          <AcquiredFeature
            instance={instance}
            engine={engine}
            result={result}
            visible={visible}
            openFeature={openFeature}
          />
        </div>
      ))}
    </section>
  );
}
