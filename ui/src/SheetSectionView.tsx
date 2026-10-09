import { Tooltip } from '@/ui/src/Tooltip';
import { useState } from 'react';
import type { Character, Engine, EvaluationResult } from '@/src/index';
import type { SheetSection } from '@/src/model/SheetSection';
import { FeatureLink } from '@/ui/src/FeatureLink';
import { StatCalculation } from '@/ui/src/StatCalculation';

const signed = (value: number) => `${value >= 0 ? '+' : ''}${value}`;

export function SheetSectionView({ section, engine, character, result }: { section: SheetSection; engine: Engine; character: Character; result: EvaluationResult }) {
  const [expanded, setExpanded] = useState<string[]>([]);
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
      <div className="section-heading">
        <h2>{section.layout === 'abilities' ? 'Abilities' : section.name}</h2>
        {section.layout === 'abilities' && <Tooltip text={modifierFirst ? 'Show scores first' : 'Show modifiers first'}><button className="quiet icon-button" aria-label={modifierFirst ? 'Show scores first' : 'Show modifiers first'} aria-pressed={modifierFirst} onClick={() => setModifierFirst(!modifierFirst)}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h15l-4-4M20 17H5l4 4M19 7l-4 4M5 17l4-4" /></svg></button></Tooltip>}
      </div>
      {section.layout === 'skills'
        ? (
            <table className={`sheet-table skill-list ${expanded.length ? 'has-calculations' : ''}`}>
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
                  {expanded.length > 0 && <th>Calculation</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.stat}>
                    <td><span className={`proficiency-dot ${training(row) > 0 ? 'trained' : ''}`} aria-label={training(row) >= 2 ? 'Expertise' : training(row) > 0 ? 'Proficient' : 'Not proficient'} title={training(row) >= 2 ? 'Expertise' : training(row) > 0 ? 'Proficient' : 'Not proficient'}>{training(row) >= 2 ? '◆' : training(row) > 0 ? '●' : '○'}</span></td>
                    <th scope="row">{row.feature ? <FeatureLink id={row.feature} engine={engine}>{name(row)}</FeatureLink> : name(row)}</th>
                    <td>{row.ability ?? '—'}</td>
                    <td>
                      <div className="bonus-control">
                        <strong>{signed(result.stats[row.stat].value)}</strong>
                        <button className="link calculation-toggle" aria-label={`Calculation for ${name(row)}`} aria-expanded={expanded.includes(row.stat)} aria-controls={`calculation-${section.id}-${row.stat}`} onClick={() => setExpanded(expanded.includes(row.stat) ? expanded.filter((stat) => stat !== row.stat) : [...expanded, row.stat])}>{expanded.includes(row.stat) ? '▾' : '▸'}</button>
                      </div>
                    </td>
                    {expanded.length > 0 && <td id={`calculation-${section.id}-${row.stat}`}>{expanded.includes(row.stat) && <StatCalculation id={row.stat} engine={engine} character={character} result={result} />}</td>}
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
                    <Tooltip text={`${name(row)} ${swapped ? 'modifier' : 'score'}`}><strong className="stat-value">{swapped ? signed(secondary.value) : result.stats[row.stat].value}</strong></Tooltip>
                    {secondary && <Tooltip text={`${name(row)} ${swapped ? 'score' : 'modifier'}`}><span className="ability-modifier">{swapped ? result.stats[row.stat].value : signed(secondary.value)}</span></Tooltip>}
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
