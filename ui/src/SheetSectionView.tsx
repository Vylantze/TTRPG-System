import { useState } from 'react';
import type { Character, Engine, EvaluationResult } from '@/src/index';
import type { SheetSection } from '@/src/model/SheetSection';
import { FeatureLink } from '@/ui/src/FeatureLink';
import { StatCalculation } from '@/ui/src/StatCalculation';

const signed = (value: number) => `${value >= 0 ? '+' : ''}${value}`;

export function SheetSectionView({ section, engine, character, result }: { section: SheetSection; engine: Engine; character: Character; result: EvaluationResult }) {
  const [sort, setSort] = useState('Name');
  const [descending, setDescending] = useState(false);
  const [modifierFirst, setModifierFirst] = useState(false);
  const rows = section.rows.filter((row) => result.stats[row.stat]);
  const name = (row: SheetSection['rows'][number]) => row.name ?? engine.getStatDefinition(row.stat)?.name ?? row.stat;
  const training = (row: SheetSection['rows'][number]) => row.proficiencyStat ? result.stats[row.proficiencyStat]?.value ?? 0 : 0;
  const value = (row: SheetSection['rows'][number]) => sort === 'Training' ? training(row) : sort === 'Bonus' ? result.stats[row.stat].value : sort === 'Ability' ? row.ability ?? '' : name(row);
  if (section.layout === 'skills') rows.sort((a, b) => {
    const left = value(a), right = value(b);
    return ((typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right))) * (descending ? -1 : 1)) || name(a).localeCompare(name(b));
  });
  if (!rows.length) return null;
  return (
    <section className={`panel sheet-section sheet-${section.layout}`}>
      <div className="row">
        <h2>{section.name}</h2>
        {section.layout === 'abilities' && <button className="quiet" aria-pressed={modifierFirst} onClick={() => setModifierFirst(!modifierFirst)}>{modifierFirst ? 'Show scores first' : 'Show modifiers first'}</button>}
      </div>
      {section.layout === 'skills'
        ? (
            <table className="sheet-table skill-list">
              <thead>
                <tr>
                  {['Training', 'Name', 'Ability', 'Bonus'].map((column) => (
                    <th key={column} aria-sort={sort === column ? descending ? 'descending' : 'ascending' : 'none'}>
                      <button
                        className="sort-heading"
                        onClick={() => {
                          setDescending(sort === column ? !descending : false);
                          setSort(column);
                        }}
                      >
                        {column}
                        {sort === column ? descending ? ' ↓' : ' ↑' : ' ↕'}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.stat}>
                    <td><span className={`proficiency-dot ${training(row) > 0 ? 'trained' : ''}`} aria-label={training(row) >= 2 ? 'Expertise' : training(row) > 0 ? 'Proficient' : 'Not proficient'} title={training(row) >= 2 ? 'Expertise' : training(row) > 0 ? 'Proficient' : 'Not proficient'}>{training(row) >= 2 ? '◆' : training(row) > 0 ? '●' : '○'}</span></td>
                    <th scope="row">{row.feature ? <FeatureLink id={row.feature} engine={engine}>{name(row)}</FeatureLink> : name(row)}</th>
                    <td>{row.ability ?? '—'}</td>
                    <td>
                      <details className="bonus-disclosure">
                        <summary aria-label={`Calculation for ${name(row)}`}>
                          <strong>{signed(result.stats[row.stat].value)}</strong>
                          <span className="disclosure-arrow">▸</span>
                        </summary>
                        <StatCalculation id={row.stat} engine={engine} character={character} result={result} />
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        : (
            <div className="sheet-stat-grid">
              {rows.map((row) => {
                const secondary = row.secondaryStat ? result.stats[row.secondaryStat] : undefined;
                const swapped = section.layout === 'abilities' && modifierFirst && secondary;
                return (
                  <article className="sheet-stat" key={row.stat}>
                    <h3>{name(row)}</h3>
                    <strong className="stat-value" title={`${name(row)} ${swapped ? 'modifier' : 'score'}`}>{swapped ? signed(secondary.value) : result.stats[row.stat].value}</strong>
                    {secondary && <span className="ability-modifier" title={`${name(row)} ${swapped ? 'score' : 'modifier'}`}>{swapped ? result.stats[row.stat].value : signed(secondary.value)}</span>}
                    <details>
                      <summary>Calculation</summary>
                      <StatCalculation id={swapped ? row.secondaryStat! : row.stat} engine={engine} character={character} result={result} />
                    </details>
                  </article>
                );
              })}
            </div>
          )}
    </section>
  );
}
