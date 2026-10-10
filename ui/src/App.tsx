import { LoadingOverlay } from '@/ui/src/LoadingOverlay';
import multiclassUrl from '@/src/systems/dnd5e-2014/multiclass-sample.json?url';
import { SystemLoader } from '@/ui/src/SystemLoader';
import { ReloadSystemButton } from '@/ui/src/ReloadSystemButton';
import { safeReturn } from '@/ui/src/feature-origin';
import { FeatureLink } from '@/ui/src/FeatureLink';
import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from 'react';
import noticeUrl from '@/NOTICE.md?url';
import { deserializeCharacter, parseSystemFile, serializeCharacter, type Character, type Engine, type SystemFile, type Value } from '@/src/index';
import bundledUrl from '@/src/systems/dnd5e-2014/system.json?url';
import starterUrl from '@/src/systems/dnd5e-2014/starter-characters.json?url';
import { addStarterCharacters, addStarterInventory, migrateMoney } from '@/ui/src/starter-characters';
import { CharacterBuilder } from '@/ui/src/CharacterBuilder';
import { ClassDetail } from '@/ui/src/ClassDetail';
import { FeatureDetail } from '@/ui/src/FeatureDetail';
import { Modal } from '@/ui/src/Modal';
import { RulesText } from '@/ui/src/RulesText';
import { descriptionPreview, featureDescription, featureHref } from '@/ui/src/feature-description';

import { featureName, tagName } from '@/ui/src/display';
import type { Route } from '@/ui/src/types/Route';
import { reloadSystem, applyDescriptionUpdate, createRegistry, download, labelFromId, readWorkspace, systemKey, updateSystemDescriptions, writeWorkspace, type Workspace } from '@/ui/src/workspace';
function readRoute(): Route {
  const [path, query] = window.location.hash.slice(1).split('?');
  const params = new URLSearchParams(query);
  const [page, id] = path.split('/');
  try {
    return { page: page || 'characters', id: id ? decodeURIComponent(id) : undefined, system: params.get('system') ?? undefined, revision: Number(params.get('revision')) || undefined, catalogue: params.get('catalogue') ?? undefined, query: params.get('q') ?? '', tag: params.get('tag') ?? '', sort: params.get('sort') ?? 'name', listPage: Math.max(0, Math.floor(Number(params.get('page')) || 0)), returnTo: safeReturn(params.get('returnTo')) };
  } catch {
    return { page: 'characters' };
  }
}
function go(page: string, id?: string, engine?: Engine) {
  const query = engine ? `?${new URLSearchParams({ system: engine.catalogue.system.id, revision: String(engine.catalogue.system.revision), catalogue: engine.catalogue.id })}` : '';
  window.location.hash = `${page}${id ? `/${encodeURIComponent(id)}` : ''}${query}`;
}
const errorMessage = (e: unknown) => e instanceof Error ? e.message : String(e);
const empty: Workspace = { version: 1, systems: [], characters: [] };

export function App() {
  const [initial] = useState(() => {
    try {
      return { workspace: readWorkspace(localStorage), error: '' };
    } catch (e) {
      return { workspace: empty, error: errorMessage(e) };
    }
  });
  const [workspace, setWorkspace] = useState(initial.workspace), [route, setRoute] = useState(readRoute), [error, setError] = useState(initial.error), [storageError, setStorageError] = useState(initial.error), [blocked, setBlocked] = useState(Boolean(initial.error));
  const [navigating, startNavigation] = useTransition();
  const [reloadMessage, setReloadMessage] = useState('');
  const [saved, setSaved] = useState(false), [loading, setLoading] = useState(false), [creating, setCreating] = useState(false);
  const [updatingDescriptions, setUpdatingDescriptions] = useState(() => !initial.error && initial.workspace.systems.some((file) => file.id === 'dnd5e:2014-srd5.1'));
  const [selectedSystem, setSelectedSystem] = useState(systemKey(workspace.systems[0] ?? { id: '', revision: 1 })), [options, setOptions] = useState<Record<string, Value>>({});
  const registry = useMemo(() => createRegistry(workspace.systems), [workspace.systems]);
  const workspaceRef = useRef(workspace);
  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);
  const selected = workspace.systems.find((s) => systemKey(s) === selectedSystem) ?? workspace.systems[0];
  const browserEngine = useMemo(() => selected ? registry.createEngine(selected.id, selected.revision, options) : undefined, [registry, selected, options]);
  const active = route.page === 'characters' && route.id ? workspace.characters.find((c) => c.id === route.id) : undefined;
  const resolved = useMemo(() => {
    try {
      if (active) return { engine: registry.engineForCharacter(active), error: '' };
      if (route.system && route.catalogue) {
        const file = workspace.systems.find((s) => s.id === route.system && s.revision === route.revision), config = file?.configurations.find((c) => c.id === route.catalogue);
        if (!file || !config) return { error: 'The System for this link is not loaded. Load its JSON file from Systems.' };
        return { engine: registry.createEngine(file.id, file.revision, config.options), error: '' };
      }
      return { engine: browserEngine, error: '' };
    } catch (e) {
      return { error: errorMessage(e) };
    }
  }, [registry, active, route.system, route.revision, route.catalogue, browserEngine, workspace.systems]);
  const engine = resolved.engine;
  useEffect(() => {
    const existing = initial.workspace.systems.find((file) => file.id === 'dnd5e:2014-srd5.1');
    if (initial.error || !existing) return;
    const controller = new AbortController();
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(bundledUrl, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Bundled SRD descriptions could not be loaded.');
        const incoming = parseSystemFile(await response.text());
        const updated = updateSystemDescriptions(existing, incoming);
        const templates = await fetch(starterUrl, { signal: controller.signal, cache: 'no-store' });
        if (!templates.ok) throw new Error('Starter inventory could not be loaded.');
        const saves: unknown = await templates.json();
        if (!cancelled)setWorkspace((current) => migrateMoney(addStarterInventory(applyDescriptionUpdate(current, existing, updated), saves)));
      } catch (e) {
        if (!cancelled)setError(`Automatic SRD description update failed. ${errorMessage(e)} Retry with Systems → Reload System.`);
      } finally {
        if (!cancelled)setUpdatingDescriptions(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [initial]);
  useEffect(() => {
    const onHash = () => {
      startNavigation(() => setRoute(readRoute()));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (blocked) return;
    // Report the result of synchronizing with external browser storage, including quota failures.

    try {
      writeWorkspace(localStorage, workspace);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Reflect the result of writing external browser storage.
      setStorageError('');
      setSaved(true);
    } catch (e) {
      setStorageError(`Changes are in memory. Browser storage failed: ${errorMessage(e)} Export your characters before closing.`);
      setSaved(false);
    }
  }, [workspace, blocked]);
  const change = (next: Workspace | ((current: Workspace) => Workspace)) => {
    setSaved(false);
    setWorkspace(next);
  };
  const update = (character: Character) => change((current) => ({ ...current, characters: current.characters.map((c) => c.id === character.id ? character : c), active: character.id }));
  const loadFile = async (input: File | string) => {
    setLoading(true);
    setError('');
    try {
      const file = parseSystemFile(typeof input === 'string' ? input : await input.text());
      registry.load(file);
      change((current) => migrateMoney({ ...current, systems: [...current.systems, file] }));
      setSelectedSystem(systemKey(file));
      setOptions({});
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  const loadBundled = async () => {
    setLoading(true);
    try {
      const response = await fetch(bundledUrl);
      if (!response.ok) throw new Error('Bundled System could not be loaded.');
      await loadFile(await response.text());
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  };
  const reload = async (existing: SystemFile, source?: File) => {
    setReloadMessage('');
    setLoading(true);
    setError('');
    try {
      let text: string;
      if (source) text = await source.text();
      else {
        const response = await fetch(bundledUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error('Bundled System could not be reloaded.');
        text = await response.text();
      }
      const incoming = parseSystemFile(text);
      const next = migrateMoney(reloadSystem(workspace, existing, incoming));
      change((current) => {
        if (current !== workspace) {
          setError('The workspace changed during reload. Try again.');
          return current;
        }
        setReloadMessage(`Reloaded ${incoming.configurations[0].system.name}. Characters preserved.`);
        return next;
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  const importCharacter = async (file: File) => {
    try {
      const character = deserializeCharacter(await file.text());
      if (workspace.characters.some((c) => c.id === character.id)) throw new Error('A character with this ID already exists. Duplicate the existing character or import a different ID.');
      // Missing Systems are allowed: preserve the save and offer an explicit load action.
      try {
        deserializeCharacter(serializeCharacter(character), registry.engineForCharacter(character));
      } catch (e) {
        if ((e as { code?: string }).code !== 'SYSTEM_UNAVAILABLE') throw e;
      }
      change((current) => migrateMoney({ ...current, characters: [...current.characters, character], active: character.id }));
      go('characters', character.id);
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const query = route.query ?? '', tag = route.tag ?? '', sort = route.sort ?? 'name', page = route.listPage ?? 0;
  const browse = (key: string, value: string) => {
    const [path, search] = window.location.hash.split('?');
    const params = new URLSearchParams(search);
    if (value) params.set(key, value);
    else params.delete(key);
    window.history.replaceState(null, '', `${path}?${params}`);
    setRoute(readRoute());
  };
  const setQuery = (value: string) => browse('q', value);
  const setTag = (value: string) => browse('tag', value);
  const setPage = (value: number) => browse('page', String(value));
  const openFeature = (id: string) => {
    if (engine) window.location.hash = featureHref(id, engine);
  };
  const loadStarterParty = async () => {
    setLoading(true);
    setError('');
    try {
      const responses = await Promise.all([fetch(bundledUrl), fetch(starterUrl)]);
      if (responses.some((response) => !response.ok)) throw new Error('Starter Set files could not be loaded.');
      const [system, saves] = await Promise.all(responses.map((response) => response.json()));
      const next = addStarterCharacters(workspaceRef.current, system, saves);
      change(next);
      go('characters');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  const loadMulticlassSample = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(multiclassUrl);
      if (!response.ok) throw new Error('Multiclass sample could not be loaded.');
      const character = deserializeCharacter(await response.text());
      const result = registry.engineForCharacter(character).evaluate(character);
      if (result.status !== 'valid') throw new Error('Reload the bundled System before adding this sample.');
      character.id = crypto.randomUUID();
      change((current) => ({ ...current, characters: [...current.characters, character] }));
      go('characters', character.id);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };
  const feature = engine?.catalogue.features.find((f) => f.id === route.id);
  const cls = engine?.catalogue.classes.find((c) => c.id === route.id);
  const list = useMemo(() => ['features', 'races'].includes(route.page) && !route.id ? engine?.catalogue.features.filter((f) => (route.page !== 'races' || f.tags?.includes(engine.catalogue.system.terminology?.creatureTag ?? 'race')) && `${featureName(f)} ${f.name} ${featureDescription(f, engine!) ?? ''} ${f.source ?? ''}`.toLowerCase().includes(query.toLowerCase()) && (!tag || f.tags?.includes(tag))).sort((a, b) => sort === 'level' ? (a.contentLevel ?? 0) - (b.contentLevel ?? 0) || featureName(a).localeCompare(featureName(b)) : featureName(a).localeCompare(featureName(b)) * (sort === 'name-desc' ? -1 : 1)) ?? [] : [], [engine, query, tag, sort, route.page, route.id]);
  return (
    <div className="app-shell" aria-busy={loading || navigating || updatingDescriptions}>
      {(loading || navigating || updatingDescriptions) && <LoadingOverlay />}
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <a href="#characters" className="brand">
          <img className="brand-icon" src={`${import.meta.env.BASE_URL}wizard-die.svg`} alt="Wizard die" width="48" height="48" />
          <span>
            Feature Forge
            <small>TTRPG SYSTEM</small>
          </span>
        </a>
        <p className="sidebar-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {[['characters', 'Characters', '◈'], ['classes', engine?.catalogue.system.terminology?.classPlural ?? 'Classes', '▤'], ['races', engine?.catalogue.system.terminology?.creaturePlural ?? 'Races', '♧'], ['features', 'Features', '◇'], ['systems', 'Systems', '⬡']].map(([id, title, icon]) => (
            <a href={`#${id}`} className={route.page === id ? 'active' : ''} aria-current={route.page === id ? 'page' : undefined} key={id}>
              <span aria-hidden="true">{icon}</span>
              {title}
              {id === 'characters' && <small>{workspace.characters.length}</small>}
            </a>
          ))}
        </nav>
        <div className="sidebar-characters">
          <p className="sidebar-label">YOUR CHARACTERS</p>
          {workspace.characters.length
            ? workspace.characters.map((c) => (
                <a href={`#characters/${encodeURIComponent(c.id)}`} className={active?.id === c.id ? 'selected' : ''} key={c.id}>
                  <span className="avatar">{c.name.slice(0, 1)}</span>
                  <span>
                    {c.name}
                    <small>{c.buildState === 'draft' ? 'Construction draft' : 'Character'}</small>
                  </span>
                </a>
              ))
            : <p className="muted small">Your next story starts here.</p>}
        </div>
        <div className="sidebar-bottom">
          <span className={`save-dot ${saved ? '' : 'unsaved'}`} />
          {saved ? 'Saved in this browser' : 'Changes not saved'}
          <p>Local workspace · no account required</p>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>{route.page === 'races' ? engine?.catalogue.system.terminology?.creaturePlural ?? 'Races' : route.page === 'classes' ? engine?.catalogue.system.terminology?.classPlural ?? 'Classes' : route.page.slice(0, 1).toUpperCase() + route.page.slice(1)}</span>
          <div className="toolbar">
            {selected && (
              <label className="system-switch">
                <span>System</span>
                <select
                  aria-label="Browse System"
                  value={systemKey(selected)}
                  onChange={(e) => {
                    setSelectedSystem(e.target.value);
                    setOptions({});
                    go(route.page === 'characters' ? 'characters' : route.page);
                  }}
                >
                  {workspace.systems.map((s) => (
                    <option key={systemKey(s)} value={systemKey(s)}>
                      {s.configurations[0].system.name}
                      {' '}
                      · r
                      {s.revision}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button onClick={() => setCreating(true)} disabled={!selected}>+ New character</button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} aria-busy={loading || navigating}>
          {(loading || navigating) && <div className="loading-banner" role="status">Loading…</div>}
          {updatingDescriptions && <p role="status" className="muted">Updating bundled SRD descriptions…</p>}
          {error && (
            <div role="alert" className="alert row">
              <span>{error}</span>
              <button className="quiet" onClick={() => setError('')}>Dismiss</button>
            </div>
          )}
          {storageError && (
            <div role="alert" className="alert">
              <p>{storageError}</p>
              {blocked && (
                <button
                  className="quiet"
                  onClick={() => {
                    try {
                      download('workspace-recovery.json', localStorage.getItem('ttrpg-feature-forge:v1') ?? '{}');
                      setBlocked(false);
                      setStorageError('');
                    } catch (e) {
                      setError(errorMessage(e));
                    }
                  }}
                >
                  Export stored data and start a new workspace
                </button>
              )}
            </div>
          )}
          {resolved.error && (
            <div className="notice">
              <p>{resolved.error}</p>
              <a href="#systems">Manage Systems →</a>
            </div>
          )}
          {route.page === 'systems' && (
            <>
              <PageTitle eyebrow="Your rules, your table" title="Systems" description="Load a System from JSON. Its Classes, Features, options, and calculations become available throughout your workspace." />
              <SystemLoader loading={loading} bundledLoaded={workspace.systems.some((s) => s.id === 'dnd5e:2014-srd5.1')} loadBundled={() => void loadBundled()} loadFile={(file) => void loadFile(file)} />
              {reloadMessage && <p role="status">{reloadMessage}</p>}
              <div className="cards">
                {workspace.systems.map((file) => (
                  <article className="panel system-card" key={systemKey(file)}>
                    <p className="eyebrow">
                      {'Loaded · revision '}
                      {file.revision}
                    </p>
                    <h2>{file.configurations[0].system.name}</h2>
                    <p>
                      {file.configurations[0].classes.length}
                      {' '}
                      {`${file.configurations[0].system.terminology?.classPlural ?? 'Classes'} · `}
                      {' '}
                      {file.features.length}
                      {' '}
                      {'Features · '}
                      {' '}
                      {file.configurations.length}
                      {' '}
                      configurations
                    </p>
                    <div className="toolbar">
                      <button className="quiet" onClick={() => download(`${file.id.replace(/[^a-z0-9-]/gi, '-')}.json`, JSON.stringify(file, null, 2))}>Export JSON</button>
                      <button
                        className="quiet danger"
                        onClick={() => {
                          const next = workspace.systems.filter((s) => systemKey(s) !== systemKey(file));
                          change({ ...workspace, systems: next });
                          setOptions({});
                          setSelectedSystem(next[0] ? systemKey(next[0]) : '');
                        }}
                      >
                        Unload System
                      </button>
                      <ReloadSystemButton name={file.configurations[0].system.name} loading={loading} bundled={file.id === 'dnd5e:2014-srd5.1'} reload={(source) => void reload(file, source)} />
                    </div>
                    <p className="muted small">Unloading preserves characters. Reload the same revision to resume them.</p>
                  </article>
                ))}
              </div>
              <section className="panel">
                <h3>Current bundled content</h3>
                <p>DnD5e 2014 includes all 12 SRD classes plus Tasha’s Artificer, its four specialists and infusions. Tasha’s entries use mechanical data and source links without paid book descriptions. Conditional combat and some item effects require table resolution. Other non-SRD subclasses await approved sources.</p>
                <p className="muted">
                  {'The SRD 5.1 is licensed under CC BY 4.0. '}
                  <a href="https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf" target="_blank" rel="noreferrer">Official SRD</a>
                  {' '}
                  {'· '}
                  <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">License</a>
                  {' '}
                  {'· '}
                  <a href={noticeUrl} target="_blank" rel="noreferrer">Full attribution</a>
                </p>
              </section>
            </>
          )}
          {route.page === 'characters' && (!active
            ? (
                <>
                  <PageTitle eyebrow="A character is a collection of choices" title="Every adventure starts with a Feature." description="Build your character one choice at a time. Explore what makes them different, and let the System handle the numbers." />
                  <div className="toolbar">
                    <button disabled={!selected} onClick={() => setCreating(true)}>Create a character →</button>
                    <button className="quiet" disabled={loading || blocked || !selected} onClick={() => void loadMulticlassSample()}>Add multiclass sample</button>
                    <button className="quiet" disabled={loading || blocked} onClick={() => void loadStarterParty()}>{loading ? 'Loading…' : 'Add 2014 Starter Set party'}</button>
                    <label className="button quiet">
                      Import character
                      <input
                        className="file-input"
                        type="file"
                        accept=".json,application/json"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void importCharacter(f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                  {!workspace.systems.length && (
                    <div className="welcome panel">
                      <span className="large-mark">◇</span>
                      <h2>Choose the rules for your story</h2>
                      <p>Load the bundled DnD5e 2014 System to begin, or bring your own System JSON.</p>
                      <button disabled={loading} onClick={() => void loadBundled()}>{loading ? 'Loading System…' : 'Load DnD5e 2014'}</button>
                      <a href="#systems">Manage Systems →</a>
                    </div>
                  )}
                  <div className="cards">
                    {workspace.characters.map((c) => (
                      <article className="panel character-card" key={c.id}>
                        <span className="avatar">{c.name.slice(0, 1)}</span>
                        <h2>{c.name}</h2>
                        <p className="muted">
                          {c.buildState === 'draft' ? 'Construction draft' : 'Character'}
                          {' '}
                          {'· '}
                          {' '}
                          {c.progressions.length}
                          {' '}
                          class progressions
                        </p>
                        <button className="quiet" onClick={() => go('characters', c.id)}>Open character →</button>
                      </article>
                    ))}
                  </div>
                </>
              )
            : (
                <>
                  <div className="toolbar character-actions">
                    <a href="#characters">← All characters</a>
                    <button className="quiet" onClick={() => download(`${active.name.replace(/[^a-z0-9-]/gi, '-')}.json`, serializeCharacter(active))}>Export character</button>
                    <button
                      className="quiet"
                      onClick={() => {
                        const copy = { ...structuredClone(active), id: crypto.randomUUID(), name: `${active.name} (copy)` };
                        change({ ...workspace, characters: [...workspace.characters, copy], active: copy.id });
                        go('characters', copy.id);
                      }}
                    >
                      Duplicate
                    </button>
                  </div>
                  {engine ? <CharacterBuilder key={active.id} engine={engine} character={active} update={update} openFeature={openFeature} report={setError} /> : <h1>{active.name}</h1>}
                </>
              ))}
          {['classes', 'features', 'races'].includes(route.page) && !route.id && (
            <>
              <PageTitle eyebrow="The building blocks of a character" title={route.page === 'classes' ? 'Find your path.' : route.page === 'races' ? `Explore ${engine?.catalogue.system.terminology?.creaturePlural ?? 'Races'}.` : 'Explore Features.'} description={route.page === 'classes' ? `Inspect each ${engine?.catalogue.system.terminology?.classSingular ?? 'Class'} progression, including every independent grant and selection at each level.` : 'Browse reusable abilities, choices, resources, and stat modifiers. Open a Feature to see what it contains.'} />
              {engine
                ? (
                    <>
                      {selected && (
                        <details className="configuration-options">
                          <summary>Browse configuration</summary>
                          <div className="input-grid">
                            {Object.entries(selected.options).map(([key, domain]) => (
                              <label key={key}>
                                {labelFromId(key)}
                                <select
                                  value={JSON.stringify(options[key] ?? domain.default)}
                                  onChange={(e) => {
                                    setOptions({ ...options, [key]: JSON.parse(e.target.value) });
                                    setPage(0);
                                    go(route.page);
                                  }}
                                >
                                  {domain.values.map((value) => <option value={JSON.stringify(value)} key={JSON.stringify(value)}>{typeof value === 'boolean' ? value ? 'Enabled' : 'Disabled' : String(value).replaceAll('-', ' ')}</option>)}
                                </select>
                              </label>
                            ))}
                          </div>
                        </details>
                      )}
                      <div className="toolbar browser-filters">
                        {['features', 'races'].includes(route.page) && (
                          <label>
                            Sort
                            <select
                              value={sort}
                              onChange={(event) => {
                                browse('sort', event.target.value);
                                setPage(0);
                              }}
                            >
                              <option value="name">Name A–Z</option>
                              <option value="name-desc">Name Z–A</option>
                              <option value="level">Level, then name</option>
                            </select>
                          </label>
                        )}
                        <label>
                          Search
                          <input
                            type="search"
                            placeholder={`Search ${route.page}…`}
                            value={query}
                            onChange={(e) => {
                              setQuery(e.target.value);
                              setPage(0);
                            }}
                          />
                        </label>
                        {route.page === 'features' && (
                          <label>
                            Tag
                            <select
                              value={tag}
                              onChange={(e) => {
                                setTag(e.target.value);
                                setPage(0);
                              }}
                            >
                              <option value="">All tags</option>
                              {[...new Set(engine.catalogue.features.flatMap((f) => f.tags ?? []))].sort().map((t) => <option key={t} value={t}>{tagName(engine.catalogue.system, t)}</option>)}
                            </select>
                          </label>
                        )}
                      </div>
                      {route.page === 'classes'
                        ? (
                            <div className="cards">
                              {engine.catalogue.classes.filter((c) => `${c.name} ${c.description ?? ''}`.toLowerCase().includes(query.toLowerCase())).map((c) => (
                                <article className="panel class-card" key={c.id}>
                                  <p className="eyebrow">
                                    {`${engine.catalogue.system.terminology?.classSingular ?? 'Class'} · revision `}
                                    {c.revision}
                                  </p>
                                  <h2>{c.name}</h2>
                                  {c.description && <p className="muted">{descriptionPreview(c.description)}</p>}
                                  <p>
                                    {Object.keys(c.levels).length}
                                    {' '}
                                    levels of progression
                                  </p>
                                  <button className="quiet" onClick={() => go('classes', c.id, engine)}>{`Explore ${engine.catalogue.system.terminology?.classSingular ?? 'Class'} →`}</button>
                                </article>
                              ))}
                            </div>
                          )
                        : (
                            <>
                              <p className="muted small">
                                {list.length}
                                {' '}
                                {route.page === 'races' ? `${engine.catalogue.system.terminology?.creaturePlural ?? 'Races'} found` : 'Features found'}
                              </p>
                              <div className="catalogue-grid">
                                {list.slice(page * 24, (page + 1) * 24).map((f) => (
                                  <article className="feature-card" key={f.id}>
                                    <span className="eyebrow">
                                      {f.tags?.[0] ? tagName(engine.catalogue.system, f.tags[0]) : 'Feature'}
                                      {f.contentLevel !== undefined ? ` · level ${f.contentLevel}` : ''}
                                    </span>
                                    <FeatureLink className="link feature-card-title" id={f.id} engine={engine}>{featureName(f)}</FeatureLink>
                                    <RulesText text={descriptionPreview(featureDescription(f, engine))} engine={engine} openFeature={openFeature} exclude={[f.id]} />
                                    <span className="muted small">
                                      {f.components.length}
                                      {' '}
                                      building blocks · r
                                      {f.revision}
                                    </span>
                                    <span className="card-arrow" aria-hidden="true">↗</span>
                                  </article>
                                ))}
                              </div>
                              <div className="row pagination">
                                <button className="quiet" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                                <span>
                                  {'Page '}
                                  {page + 1}
                                  {' '}
                                  {'of '}
                                  {Math.max(1, Math.ceil(list.length / 24))}
                                </span>
                                <button className="quiet" disabled={(page + 1) * 24 >= list.length} onClick={() => setPage(page + 1)}>Next</button>
                              </div>
                            </>
                          ) }
                      <p className="muted small">Custom Feature authoring will use these same building blocks in a future editor.</p>
                    </>
                  )
                : (
                    <p>
                      <a href="#systems">Load a System</a>
                      {' '}
                      to browse its content.
                    </p>
                  )}
            </>
          )}
          {route.page === 'features' && route.id && engine && (feature
            ? (
                <>
                  <a className="button quiet" href={route.returnTo ?? featureHref('', engine).replace('#features/', '#features').split('&returnTo=')[0]}>
                    {'← '}
                    {route.returnTo?.startsWith('#classes/') ? `Back to ${engine.catalogue.system.terminology?.classSingular ?? 'Class'} Features` : route.returnTo?.startsWith('#characters/') ? 'Back to character' : route.returnTo?.startsWith('#races') ? `Back to ${engine.catalogue.system.terminology?.creaturePlural ?? 'Races'}` : 'Features'}
                  </a>
                  <FeatureDetail feature={feature} engine={engine} openFeature={openFeature} />
                </>
              )
            : <p>This Feature is unavailable in the loaded catalogue.</p>)}
          {route.page === 'classes' && route.id && engine && (cls
            ? (
                <>
                  <button className="quiet" onClick={() => go('classes', undefined, engine)}>{`← ${engine.catalogue.system.terminology?.classPlural ?? 'Classes'}`}</button>
                  <ClassDetail key={`${engine.catalogue.id}:${cls.id}`} cls={cls} engine={engine} openFeature={openFeature} />
                </>
              )
            : <p>{`This ${engine.catalogue.system.terminology?.classSingular ?? 'Class'} is unavailable in the loaded catalogue.`}</p>)}
        </main>
        <footer>
          {'Feature Forge '}
          <span>Built from Features. Governed by your System.</span>
        </footer>
      </div>
      {creating && selected && (
        <Modal title="Create a character" onClose={() => setCreating(false)}>
          <CreateForm
            files={workspace.systems}
            initial={selected}
            create={(file, settings, name, classId, level) => {
              try {
                const e = registry.createEngine(file.id, file.revision, settings);
                const character = e.createCharacter(crypto.randomUUID(), name, classId ? [{ id: crypto.randomUUID(), class: classId, level }] : [], [], { draft: true });
                change((current) => migrateMoney({ ...current, characters: [...current.characters, character], active: character.id }));
                setCreating(false);
                go('characters', character.id);
              } catch (e) {
                setError(errorMessage(e));
              }
            }}
          />
        </Modal>
      )}
    </div>
  );
}
function PageTitle({ eyebrow, title, description }: { eyebrow: string;
  title: string;
  description: string; }) {
  return (
    <div className="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
function CreateForm({ files, initial, create }: { files: SystemFile[];
  initial: SystemFile;
  create: (file: SystemFile, options: Record<string, Value>, name: string, classId: string, level: number) => void; }) {
  const [key, setKey] = useState(systemKey(initial)), [settings, setSettings] = useState<Record<string, Value>>({}), [name, setName] = useState(''), [classId, setClassId] = useState(''), [level, setLevel] = useState(1);
  const file = files.find((f) => systemKey(f) === key)!;
  const registry = useMemo(() => createRegistry([file]), [file]);
  const classes = useMemo(() => registry.createEngine(file.id, file.revision, settings).catalogue.classes, [registry, file, settings]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create(file, settings, name.trim() || 'Unnamed character', classId, level);
  };
  return (
    <form onSubmit={submit}>
      <p className="muted">Create a draft, then choose the Features that shape your character.</p>
      <label>
        Character name
        <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Give your character a name" />
      </label>
      <label>
        System
        <select
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setSettings({});
            setClassId('');
          }}
        >
          {files.map((f) => <option key={systemKey(f)} value={systemKey(f)}>{f.configurations[0].system.name}</option>)}
        </select>
      </label>
      {Object.entries(file.options).map(([key, domain]) => (
        <label key={key}>
          {labelFromId(key)}
          <select
            value={JSON.stringify(settings[key] ?? domain.default)}
            onChange={(e) => {
              setSettings({ ...settings, [key]: JSON.parse(e.target.value) });
              setClassId('');
            }}
          >
            {domain.values.map((v) => <option key={JSON.stringify(v)} value={JSON.stringify(v)}>{typeof v === 'boolean' ? v ? 'Enabled' : 'Disabled' : String(v).replaceAll('-', ' ')}</option>)}
          </select>
        </label>
      ))}
      <div className="input-grid">
        <label>
          {`Starting ${file.configurations[0].system.terminology?.classSingular ?? 'Class'}`}
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">{`Choose a ${file.configurations[0].system.terminology?.classSingular ?? 'Class'} later`}</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>
          {`${file.configurations[0].system.terminology?.classSingular ?? 'Class'} level`}
          <input type="number" min="1" step="1" max={classes.find((c) => c.id === classId)?.maximumLevel} value={level} disabled={!classId} onChange={(e) => setLevel(Number(e.target.value))} />
        </label>
      </div>
      <button type="submit" className="full">Create draft →</button>
    </form>
  );
}
