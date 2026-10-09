import { useState } from 'react';
import type { Character } from '@/src/index';

export function CharacterDetails({ character, update }: { character: Character; update: (character: Character) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  return (
    <section className="panel character-details">
      <h2>Character details</h2>
      <dl className="character-facts">
        {Object.entries(character.notes ?? {}).filter(([label]) => !['Starting money', 'Original money note'].includes(label)).map(([label, text]) => (
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
                          update({ ...character, notes: { ...character.notes, [label]: draft } });
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
    </section>
  );
}
