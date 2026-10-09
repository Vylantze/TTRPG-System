import type { Character, Engine, EvaluationResult } from '@/src/index';
import { FeatureLink } from '@/ui/src/FeatureLink';
import { Inventory } from '@/ui/src/Inventory';

const signed = (value: number) => `${value >= 0 ? '+' : ''}${value}`;

export function CharacterSheet({ engine, character, result, update, report }: { engine: Engine; character: Character; result: EvaluationResult; update: (character: Character) => void; report: (message: string) => void }) {
  const sections = engine.catalogue.system.sheetSections ?? [];
  const describe = (id: string) => (
    <details className="stat-explanation">
      <summary>Calculation</summary>
      <p>
        Base:
        {result.stats[id]?.base}
      </p>
      {result.stats[id]?.modifiers.map((modifier, index) => (
        <p key={index}>
          {modifier.operation}
          {' '}
          {modifier.amount}
          {' '}
          ·
          {' '}
          {modifier.applied ? 'Applied' : modifier.reason}
          <small>{modifier.source.startsWith('item/') ? engine.catalogue.items?.find((item) => item.id === character.inventory?.find((entry) => entry.id === decodeURIComponent(modifier.source.split('/')[1]))?.item)?.name : engine.getFeature(result.instances.find((instance) => instance.id === modifier.source)?.feature ?? '')?.displayName ?? 'Feature'}</small>
        </p>
      ))}
    </details>
  );
  return (
    <div className="character-sheet">
      {character.notes && (
        <section className="panel character-details">
          <div className="row">
            <h2>Character details</h2>
            {character.notes.Source && /^https:\/\/[^\s]+$/.test(character.notes.Source) && <a href={character.notes.Source} target="_blank" rel="noopener noreferrer">Original character sheet ↗</a>}
          </div>
          <dl className="character-facts">
            {Object.entries(character.notes).filter(([label]) => label !== 'Source').map(([label, text]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
          <details>
            <summary>Edit character details</summary>
            <div className="notes-editor">
              {Object.entries(character.notes).map(([label, text]) => (
                <label key={label}>
                  {label}
                  <textarea value={text} onChange={(event) => update({ ...character, notes: { ...character.notes, [label]: event.target.value } })} />
                </label>
              ))}
            </div>
          </details>
        </section>
      )}
      {result.provisional && <p className="diagnostics">Calculated stats are provisional until the build is valid.</p>}
      <div className="sheet-sections">
        {sections.map((section) => {
          const rows = section.rows.filter((row) => result.stats[row.stat]);
          if (!rows.length) return null;
          return (
            <section className={`panel sheet-section sheet-${section.layout}`} key={section.id}>
              <h2>{section.name}</h2>
              {section.layout === 'skills'
                ? (
                    <table className="sheet-table skill-list">
                      <thead>
                        <tr>
                          <th>Training</th>
                          <th>Name</th>
                          <th>Ability</th>
                          <th>Bonus</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => {
                          const training = row.proficiencyStat ? result.stats[row.proficiencyStat]?.value ?? 0 : 0;
                          return (
                            <tr key={row.stat}>
                              <td><span className={`proficiency-dot ${training > 0 ? 'trained' : ''}`} title={training >= 2 ? 'Expertise' : training > 0 ? 'Proficient' : 'Not proficient'} aria-label={training >= 2 ? 'Expertise' : training > 0 ? 'Proficient' : 'Not proficient'}>{training >= 2 ? '◆' : training > 0 ? '●' : '○'}</span></td>
                              <th scope="row">{row.feature ? <FeatureLink id={row.feature} engine={engine}>{row.name ?? engine.getStatDefinition(row.stat)?.name}</FeatureLink> : row.name ?? engine.getStatDefinition(row.stat)?.name}</th>
                              <td className="muted small">{row.ability ?? '—'}</td>
                              <td>
                                <strong>{signed(result.stats[row.stat].value)}</strong>
                                {describe(row.stat)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )
                : (
                    <div className="sheet-stat-grid">
                      {rows.map((row) => (
                        <article className="sheet-stat" key={row.stat}>
                          <h3>{row.name ?? engine.getStatDefinition(row.stat)?.name}</h3>
                          <strong className="stat-value">{result.stats[row.stat].value}</strong>
                          {row.secondaryStat && result.stats[row.secondaryStat] && <span className="ability-modifier" aria-label={`${engine.getStatDefinition(row.stat)?.name} modifier`}>{signed(result.stats[row.secondaryStat].value)}</span>}
                          {describe(row.stat)}
                        </article>
                      ))}
                    </div>
                  )}
            </section>
          );
        })}
      </div>
      <Inventory engine={engine} character={character} update={update} report={report} />
      <details className="panel" open={!sections.length}>
        <summary>All calculated stats</summary>
        <p className="muted small">Includes internal rules values and proficiency markers.</p>
        <div className="stat-grid">
          {Object.entries(result.stats).map(([id, stat]) => (
            <article className="stat-tile" key={id}>
              <span>{engine.getStatDefinition(id)?.name ?? id}</span>
              <strong>{stat.value}</strong>
              {describe(id)}
            </article>
          ))}
        </div>
      </details>
    </div>
  );
}
