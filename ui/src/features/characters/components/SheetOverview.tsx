import type { Character, Engine, EvaluationResult } from '@/src/index';
import { HitPoints } from '@/ui/src/features/characters/components/HitPoints';
import { StatRollButton } from '@/ui/src/features/characters/components/StatRollButton';
import { StatCalculation } from '@/ui/src/features/characters/components/StatCalculation';
import { FeatureLink } from '@/ui/src/features/catalogue/components/FeatureLink';

export function SheetOverview({
  engine,
  character,
  result,
  update,
  report,
}: {
  engine: Engine;
  character: Character;
  result: EvaluationResult;
  update: (character: Character) => void;
  report: (message: string) => void;
}) {
  const hasHealth = Object.values(result.resources).some(
    (pool) => pool.key === engine.catalogue.system.healthRules?.resourceKey,
  );
  const compactHealth
    = hasHealth
      && !(
        character.displayPreferences?.healthExpanded
        ?? !(engine.catalogue.system.sheetDisplay?.health?.compactDefault ?? true)
      );
  return (
    <section
      className={`sheet-overview ${hasHealth ? '' : 'without-health'} ${compactHealth ? 'health-compact' : ''}`}
      aria-label="Character overview"
    >
      <HitPoints
        engine={engine}
        character={character}
        result={result}
        update={update}
        report={report}
      />
      <div className="overview-stats">
        {(engine.catalogue.system.sheetDisplay?.overview ?? [])
          .filter((row) => result.stats[row.stat])
          .map((row) => {
            const name = row.name ?? engine.getStatDefinition(row.stat)?.name ?? row.stat;
            const number = result.stats[row.stat].value;
            const value = row.signed && number >= 0 ? `+${number}` : number;
            return (
              <article
                className="overview-stat"
                key={row.stat}
              >
                <span>{name}</span>
                <strong>
                  {row.roll
                    ? (
                        <StatRollButton
                          stat={row.stat}
                          label={name}
                          value={value}
                          engine={engine}
                          character={character}
                          result={result}
                          update={update}
                          report={report}
                        />
                      )
                    : (
                        value
                      )}
                  {row.unit && <small>{row.unit}</small>}
                </strong>
                <details>
                  <summary>Calculation</summary>
                  <StatCalculation
                    id={row.stat}
                    engine={engine}
                    character={character}
                    result={result}
                  />
                </details>
              </article>
            );
          })}
      </div>
      {(engine.catalogue.system.sheetDisplay?.statuses ?? []).map((group) => {
        const features = [
          ...new Set(
            result.instances
              .filter(
                (instance) =>
                  instance.active
                  && instance.eligible
                  && engine
                    .getFeature(instance.feature)
                    ?.tags?.some((tag) => group.tags.includes(tag)),
              )
              .map((instance) => instance.feature),
          ),
        ];
        return features.length
          ? (
              <div
                className="sheet-statuses"
                key={group.name}
              >
                <h3>{group.name}</h3>
                {features.map((id) => (
                  <FeatureLink
                    key={id}
                    id={id}
                    engine={engine}
                  >
                    {engine.getFeature(id)?.displayName ?? engine.getFeature(id)?.name}
                  </FeatureLink>
                ))}
              </div>
            )
          : null;
      })}
    </section>
  );
}
