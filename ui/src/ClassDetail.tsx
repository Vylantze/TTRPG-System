import { FeatureOrigin } from '@/ui/src/feature-origin';
import { FeatureLink } from '@/ui/src/FeatureLink';
import { featureHref } from '@/ui/src/feature-description';
import { useEffect, useState } from 'react';
import type { ClassDefinition, Engine } from '@/src/index';
import { ClassFeature } from '@/ui/src/ClassFeature';
import { FeatureRules, RulesText } from '@/ui/src/RulesText';
import { Modal } from '@/ui/src/Modal';
import { featureName } from '@/ui/src/display';
import { labelFromId } from '@/ui/src/workspace';

export function ClassDetail({ cls, engine, openFeature }: { cls: ClassDefinition; engine: Engine; openFeature: (id: string) => void }) {
  const prefix = `class-${cls.id}`;
  useEffect(() => {
    const restore = () => {
      const section = new URLSearchParams(window.location.hash.split('?')[1]).get('section');
      if (section) document.getElementById(section)?.scrollIntoView({ block: 'start' });
    };
    restore();
    window.addEventListener('hashchange', restore);
    return () => window.removeEventListener('hashchange', restore);
  }, [cls.id]);
  const origin = (section: string) => `#classes/${encodeURIComponent(cls.id)}?${new URLSearchParams({ system: engine.catalogue.system.id, revision: String(engine.catalogue.system.revision), catalogue: engine.catalogue.id, section })}`;
  const [preview, setPreview] = useState<string>();
  const levels = engine.getClassLevels(cls.id);
  const jump = (target: string) => {
    const element = document.getElementById(`${prefix}-${target}`);
    element?.focus({ preventScroll: true });
    element?.scrollIntoView({ block: 'start' });
  };
  return (
    <article className="class-guide">
      <header className="reference-hero">
        <p className="eyebrow">
          {engine.catalogue.system.name}
          {' '}
          · Class guide
        </p>
        <h1>{cls.name}</h1>
        <p>Follow your progression. Explore each Feature. Make the choices your character needs.</p>
        <div className="reference-facts">
          <span>
            <strong>{cls.maximumLevel ?? levels.at(-1)?.level ?? 0}</strong>
            {' '}
            maximum level
          </span>
          <span>
            <strong>{levels.reduce((total, row) => total + row.entries.filter((entry) => entry.kind === 'chooseFeatures').length, 0)}</strong>
            {' '}
            progression choices
          </span>
        </div>
        {cls.source && <p className="small">{cls.source}</p>}
      </header>
      <div className="reference-layout">
        <nav className="reference-index" aria-label={`${cls.name} contents`}>
          <p className="eyebrow">On this page</p>
          <button onClick={() => jump('overview')}>Class overview</button>
          <button onClick={() => jump('progression')}>Progression at a glance</button>
          <p className="eyebrow">Features by level</p>
          <div className="level-jumps">{levels.map((row) => <button key={row.level} aria-label={`Jump to level ${row.level}`} onClick={() => jump(`level-${row.level}`)}>{row.level}</button>)}</div>
        </nav>
        <div className="reference-content">
          <section id={`${prefix}-overview`} tabIndex={-1} className="panel reference-section">
            <h2>Class overview</h2>
            <RulesText text={cls.description} source={cls.source} engine={engine} openFeature={openFeature} />
          </section>
          <section id={`${prefix}-progression`} tabIndex={-1} className="panel reference-section">
            <p className="eyebrow">Your path forward</p>
            <h2>Progression at a glance</h2>
            <div className="progression-table-wrap">
              <table className="progression-table">
                <caption>
                  {cls.name}
                  {' '}
                  Features by level
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Level</th>
                    <th scope="col">Features & choices</th>
                  </tr>
                </thead>
                <tbody>
                  {levels.map((row) => (
                    <tr key={row.level}>
                      <th scope="row"><button className="link" onClick={() => jump(`level-${row.level}`)}>{row.level}</button></th>
                      <td>
                        {row.entries.map((entry) => entry.kind === 'grantFeature'
                          ? (
                              <a
                                className="progression-token"
                                key={entry.id}
                                href={featureHref(entry.feature, engine, origin(`${prefix}-level-${row.level}-${entry.id}`))}
                                onClick={(event) => {
                                  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                                  event.preventDefault();
                                  setPreview(entry.feature);
                                }}
                              >
                                {featureName(engine.getFeature(entry.feature))}
                              </a>
                            )
                          : <button className="progression-token" key={entry.id} onClick={() => jump(`level-${row.level}`)}>{`Choose · ${labelFromId(entry.id)}`}</button>)}
                        {!row.entries.length && <span className="muted">No additional Features</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <h2>Features by level</h2>
          {levels.map(({ level, entries }) => (
            <section id={`${prefix}-level-${level}`} tabIndex={-1} className="level-row reference-section" key={level}>
              <div className="level-label">
                LEVEL
                <strong>{level}</strong>
              </div>
              <div className="panel">
                <h2 className="level-heading">
                  {'Level '}
                  {level}
                </h2>
                {entries.map((entry) => (
                  <FeatureOrigin.Provider key={entry.id} value={origin(`${prefix}-level-${level}-${entry.id}`)}>
                    <div className="component reference-section" tabIndex={-1} id={`${prefix}-level-${level}-${entry.id}`}>
                      {entry.kind === 'grantFeature'
                        ? <ClassFeature id={entry.feature} engine={engine} openFeature={openFeature} />
                        : (
                            <>
                              <p className="eyebrow">Independent selection</p>
                              <h3>{labelFromId(entry.id)}</h3>
                              <p className="muted small">
                                {typeof entry.minimum === 'number' && typeof entry.maximum === 'number' ? `Choose ${entry.minimum === entry.maximum ? entry.minimum : `${entry.minimum}–${entry.maximum}`} from this pool.` : 'The number of choices scales with your character.'}
                                {' '}
                                Eligibility is checked when building a character.
                              </p>
                              {engine.getSelectionFeatures(entry).map((feature) => <ClassFeature key={feature.id} id={feature.id} engine={engine} openFeature={openFeature} />)}
                            </>
                          )}
                      <details className="technical-details">
                        <summary>Selection definition</summary>
                        <pre>{JSON.stringify(entry, null, 2)}</pre>
                      </details>
                    </div>
                  </FeatureOrigin.Provider>
                ))}
                {!entries.length && <p>No additional Features at this level.</p>}
              </div>
            </section>
          ))}
        </div>
      </div>
      {preview && <FeatureOrigin.Provider value={origin(`${prefix}-progression`)}><ClassPreview id={preview} engine={engine} openFeature={openFeature} close={() => setPreview(undefined)} /></FeatureOrigin.Provider>}
    </article>
  );
}

function ClassPreview({ id, engine, openFeature, close }: { id: string; engine: Engine; openFeature: (id: string) => void; close: () => void }) {
  const feature = engine.getFeature(id);
  return (
    <Modal title={featureName(feature)} onClose={close}>
      {feature && (
        <FeatureRules
          feature={feature}
          engine={engine}
          openFeature={(target) => {
            close();
            openFeature(target);
          }}
        />
      )}
      <FeatureLink className="button quiet" id={id} engine={engine}>Open full Feature</FeatureLink>
    </Modal>
  );
}
