import { ResourceSummary } from '@/ui/src/ResourceSummary';
import { adjustResource } from '@/src/index';
import type { Character, Engine, EvaluationResult } from '@/src/index';
import { CharacterDetails } from '@/ui/src/CharacterDetails';
import { SheetSectionView } from '@/ui/src/SheetSectionView';
import { StatCalculation } from '@/ui/src/StatCalculation';
import { MoneySection } from '@/ui/src/MoneySection';
import { Inventory } from '@/ui/src/Inventory';

export function CharacterSheet({ engine, character, result, update, report }: { engine: Engine; character: Character; result: EvaluationResult; update: (character: Character) => void; report: (message: string) => void }) {
  const sections = engine.catalogue.system.sheetSections ?? [];
  return (
    <div className="character-sheet">
      <CharacterDetails engine={engine} result={result} character={character} update={update} />
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
      {result.provisional && <p className="diagnostics">Calculated stats are provisional until the build is valid.</p>}
      <div className="sheet-sections">
        {sections.map((section) => <SheetSectionView key={section.id} section={section} engine={engine} character={character} result={result} />)}
      </div>
      <MoneySection engine={engine} character={character} update={update} report={report} />
      <Inventory engine={engine} character={character} update={update} report={report} />
      <details className="panel" open={!sections.length}>
        <summary>All calculated stats</summary>
        <p className="muted small">Includes internal rules values and proficiency markers.</p>
        <div className="stat-grid">
          {Object.entries(result.stats).map(([id, stat]) => (
            <article className="stat-tile" key={id}>
              <span>{engine.getStatDefinition(id)?.name ?? id}</span>
              <strong>{stat.value}</strong>
              <details>
                <summary>Calculation</summary>
                <StatCalculation id={id} engine={engine} character={character} result={result} />
              </details>
            </article>
          ))}
        </div>
      </details>
    </div>
  );
}
