import { useState } from 'react';
import type { Character, Engine, EvaluationResult } from '@/src/index';

export function CharacterDetails({ character, engine, result, update, notes = false }: { character: Character; engine: Engine; result: EvaluationResult; update: (character: Character) => void; notes?: boolean }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  return (
    <section className="panel character-details">
      <h2>{notes ? 'Notes' : 'Character details'}</h2>
      <dl className="character-facts">
        {!notes && (
          <>
            <div>
              <dt>{engine.catalogue.system.terminology?.creatureSingular ?? 'Race'}</dt>
              <dd>{result.instances.filter((instance) => instance.active && engine.getFeature(instance.feature)?.tags?.includes(engine.catalogue.system.terminology?.creatureTag ?? 'race')).map((instance) => engine.getFeature(instance.feature)?.displayName ?? engine.getFeature(instance.feature)?.name).join(', ') || 'Not selected'}</dd>
            </div>
            <div>
              <dt>{`${engine.catalogue.system.terminology?.classPlural ?? 'Classes'} & levels`}</dt>
              <dd>{character.progressions.filter((progression) => progression.level > 0).map((progression) => `${engine.catalogue.classes.find((cls) => cls.id === progression.class)?.name ?? progression.class} ${progression.level}`).join(' / ') || 'No class selected'}</dd>
            </div>
          </>
        )}
        {Object.entries({ Name: character.name, ...character.notes }).filter(([label]) => !['Starting money', 'Original money note'].includes(label) && (notes ? !(engine.catalogue.system.importantDetails ?? ['Name', 'Alignment']).includes(label) : (engine.catalogue.system.importantDetails ?? ['Name', 'Alignment']).includes(label))).map(([label, text]) => (
          <div key={label}>
            <dt className="row">
              {label}
              <button
                className="link"
                aria-label={`Edit ${label}`}
                onClick={() => {
                  setEditing(label);
                  setDraft(text);
                }}
              >
                Edit
              </button>
            </dt>
            <dd>
              {editing === label
                ? (
                    <div className="detail-editor">
                      <textarea aria-label={label} value={draft} onChange={(event) => setDraft(event.target.value)} />
                      <div className="toolbar">
                        <button onClick={() => {
                          update(label === 'Name' ? { ...character, name: draft } : { ...character, notes: { ...character.notes, [label]: draft } });
                          setEditing(null);
                        }}
                        >
                          Save
                        </button>
                        <button className="quiet" onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    </div>
                  )
                : label === 'Source' && /^https:\/\/[^\s]+$/.test(text) ? <a href={text} target="_blank" rel="noopener noreferrer">Original character sheet ↗</a> : text}
            </dd>
          </div>
        ))}
      </dl>
      {notes && (
        <button
          className="quiet"
          onClick={() => {
            let index = 1;
            while (Object.hasOwn(character.notes ?? {}, `Note ${index}`)) index++;
            const label = `Note ${index}`;
            update({ ...character, notes: { ...character.notes, [label]: '' } });
            setEditing(label);
            setDraft('');
          }}
        >
          Add note
        </button>
      )}

    </section>
  );
}
