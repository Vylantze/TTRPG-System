import { LoadingOverlay } from '@/ui/src/components/LoadingOverlay';
import multiclassUrl from '@/src/systems/dnd5e-2024/multiclass-sample.json?url';
import { SystemLoader } from '@/ui/src/features/systems/components/SystemLoader';
import { ReloadSystemButton } from '@/ui/src/features/systems/components/ReloadSystemButton';
import { safeReturn } from '@/ui/src/features/catalogue/model/feature-origin';
import { AppHeader } from '@/ui/src/app/AppHeader';
import { CatalogueBrowser } from '@/ui/src/features/catalogue/components/CatalogueBrowser';
import {
  lazy,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from 'react';
import noticeUrl from '@/NOTICE.md?url';
import {
  deserializeCharacter,
  serializeCharacter,
  type Character,
  type Engine,
  type SystemFile,
  type Value,
} from '@/src/index';
import {
  loadBundledSystem,
  loadSelectedSystem,
} from '@/ui/src/features/systems/model/load-system-package';
import bundledUrl from '@/src/systems/dnd5e-2024/system.json?url';
import starterUrl from '@/src/systems/dnd5e-2024/starter-characters.json?url';
import {
  addStarterCharacters,
  migrateMoney,
} from '@/ui/src/features/characters/model/starter-characters';
const CharacterBuilder = lazy(() =>
  import('@/ui/src/features/characters/components/CharacterBuilder').then((module) => ({
    default: memo(module.CharacterBuilder),
  })),
);
const ClassDetail = lazy(() =>
  import('@/ui/src/features/catalogue/components/ClassDetail').then((module) => ({
    default: memo(module.ClassDetail),
  })),
);
const FeatureDetail = lazy(() =>
  import('@/ui/src/features/catalogue/components/FeatureDetail').then((module) => ({
    default: memo(module.FeatureDetail),
  })),
);
const SystemDataEditor = lazy(() =>
  import('@/ui/src/features/systems/components/SystemDataEditor').then((module) => ({
    default: module.SystemDataEditor,
  })),
);
import { ItemDetail } from '@/ui/src/features/catalogue/components/ItemDetail';
import { Modal } from '@/ui/src/components/Modal';
import { featureHref } from '@/ui/src/features/catalogue/model/feature-description';
import type { Route } from '@/ui/src/types/Route';
import {
  createRegistry,
  download,
  labelFromId,
  systemKey,
  reloadSystem,
  type Workspace,
} from '@/ui/src/lib/workspace';
import { reconcilePrototypeCharacters } from '@/ui/src/features/characters/model/prototype-characters';
import { loadPrototypeTemplates } from '@/ui/src/features/characters/model/load-prototype-templates';
import { bundledSystem } from '@/ui/src/features/systems/model/bundled-system';
import {
  bundledUpdateKind,
  applySystemPatch,
} from '@/ui/src/features/systems/model/system-updates';
import { releaseVersion, assetData } from '@/src/index';
function readRoute(): Route {
  const [path, query] = window.location.hash.slice(1).split('?');
  const params = new URLSearchParams(query);
  const [page, id] = path.split('/');
  try {
    return {
      page: page || 'characters',
      id: id ? decodeURIComponent(id) : undefined,
      system: params.get('system') ?? undefined,
      revision: Number(params.get('revision')) || undefined,
      catalogue: params.get('catalogue') ?? undefined,
      query: params.get('q') ?? '',
      tag: params.get('tag') ?? '',
      level: params.get('level') ?? '',
      sort: params.get('sort') ?? 'name',
      listPage: Math.max(0, Math.floor(Number(params.get('page')) || 0)),
      returnTo: safeReturn(params.get('returnTo')),
    };
  } catch {
    return { page: 'characters' };
  }
}
function pageHref(page: string, id?: string, engine?: Engine) {
  const query = engine
    ? `?${new URLSearchParams({ system: engine.catalogue.system.id, revision: String(engine.catalogue.system.revision), catalogue: engine.catalogue.id })}`
    : '';
  return `#${page}${id ? `/${encodeURIComponent(id)}` : ''}${query}`;
}
function go(page: string, id?: string, engine?: Engine) {
  window.location.hash = pageHref(page, id, engine);
}
const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
export function App({
  initialWorkspace,
  persist,
  startupMessage = '',
}: {
  initialWorkspace: Workspace;
  persist: (workspace: Workspace) => Promise<void>;
  startupMessage?: string;
}) {
  const [workspace, setWorkspace] = useState(initialWorkspace),
    [route, setRoute] = useState(readRoute),
    [error, setError] = useState(''),
    [storageError, setStorageError] = useState('');
  const [navigating, startNavigation] = useTransition();
  const [reloadMessage, setReloadMessage] = useState(startupMessage);
  const [bundledUpdate, setBundledUpdate] = useState<SystemFile>();
  const [updateError, setUpdateError] = useState('');
  const [saved, setSaved] = useState(false),
    [loading, setLoading] = useState(false),
    [creating, setCreating] = useState(false);
  const [selectedSystem, setSelectedSystem] = useState(
      systemKey(workspace.systems[0] ?? { id: '', revision: 1 }),
    ),
    [options, setOptions] = useState<Record<string, Value>>({});
  const registry = useMemo(() => createRegistry(workspace.systems), [workspace.systems]);
  const workspaceRef = useRef(workspace);
  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);
  const selected
    = workspace.systems.find((s) => systemKey(s) === selectedSystem) ?? workspace.systems[0];
  const browserEngine = useMemo(
    () => (selected ? registry.createEngine(selected.id, selected.revision, options) : undefined),
    [registry, selected, options],
  );
  const active
    = route.page === 'characters' && route.id
      ? workspace.characters.find((c) => c.id === route.id)
      : undefined;
  const resolved = useMemo(() => {
    try {
      if (active) return { engine: registry.engineForCharacter(active), error: '' };
      if (route.system && route.catalogue) {
        const file = workspace.systems.find(
            (s) => s.id === route.system && s.revision === route.revision,
          ),
          config = file?.configurations.find((c) => c.id === route.catalogue);
        if (!file || !config)
          return {
            error: 'The System for this link is not loaded. Load its JSON file from Systems.',
          };
        return { engine: registry.createEngine(file.id, file.revision, config.options), error: '' };
      }
      return { engine: browserEngine, error: '' };
    } catch (e) {
      return { error: errorMessage(e) };
    }
  }, [
    registry,
    active,
    route.system,
    route.revision,
    route.catalogue,
    browserEngine,
    workspace.systems,
  ]);
  const engine = resolved.engine;
  useEffect(() => {
    const loaded = workspace.systems.find((file) => file.id === bundledSystem.id);
    if (!loaded) return;
    let cancelled = false;
    void (async () => {
      const response = await fetch(bundledUrl, { cache: 'no-store' });
      if (!response.ok)
        throw new Error('Could not check for a bundled System update. Use Reload System to retry.');
      const incoming = (await response.json()) as Pick<
        SystemFile,
        'id' | 'revision' | 'contentVersion' | 'assetVersions'
      >;
      const kind = bundledUpdateKind(loaded, incoming);
      if (kind === 'patch') {
        const patch = await loadBundledSystem();
        // A deployment can change between manifest checks; never apply a minor update silently.
        if (!cancelled && bundledUpdateKind(loaded, patch) === 'patch') {
          const accepted = applySystemPatch(
            { version: 1, systems: [loaded], characters: [] },
            loaded,
            patch,
          ).systems[0];
          setWorkspace((current) =>
            current.systems.includes(loaded)
              ? {
                  ...current,
                  systems: current.systems.map((file) => (file === loaded ? accepted : file)),
                }
              : current,
          );
        } else if (!cancelled)
          setBundledUpdate(bundledUpdateKind(loaded, patch) === 'none' ? undefined : loaded);
      }
      if (!cancelled) {
        if (kind !== 'patch')
          setBundledUpdate(['minor', 'major'].includes(kind) ? loaded : undefined);
        setUpdateError('');
      }
    })().catch((reason: unknown) => {
      if (!cancelled) setUpdateError(errorMessage(reason));
    });
    return () => {
      cancelled = true;
    };
  }, [workspace.systems]);
  useEffect(() => {
    const onHash = () => {
      startNavigation(() => setRoute(readRoute()));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    let cancelled = false;
    void persist(workspace).then(
      () => {
        if (!cancelled) {
          setStorageError('');
          setSaved(true);
        }
      },
      (reason: unknown) => {
        if (!cancelled) {
          setStorageError(
            `Changes are in memory. Local database save failed: ${errorMessage(reason)} Export your characters before closing.`,
          );
          setSaved(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [workspace, persist]);
  const change = (next: Workspace | ((current: Workspace) => Workspace)) => {
    setSaved(false);
    setWorkspace(next);
  };
  const update = useCallback((character: Character) => {
    setSaved(false);
    setWorkspace((current) => ({
      ...current,
      characters: current.characters.map((c) => (c.id === character.id ? character : c)),
      active: character.id,
    }));
  }, []);
  const loadFile = async (input?: File[]) => {
    setLoading(true);
    setError('');
    try {
      const file = input ? await loadSelectedSystem(input) : await loadBundledSystem();
      createRegistry([...workspaceRef.current.systems, file]);
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
      await loadFile();
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  };
  const reload = async (existing: SystemFile, source?: File[]) => {
    setReloadMessage('');
    setLoading(true);
    setError('');
    try {
      const incoming = source ? await loadSelectedSystem(source) : await loadBundledSystem();
      if (systemKey(incoming) !== systemKey(existing))
        throw new Error('Load a different System revision separately.');
      if (bundledUpdateKind(existing, incoming) === 'patch') {
        const patched = applySystemPatch(workspace, existing, incoming);
        change((current) => {
          if (current !== workspace) {
            setError('The workspace changed during the patch update. Try again.');
            return current;
          }
          setReloadMessage(
            `Applied ${incoming.configurations[0].system.name} patch ${releaseVersion(incoming.contentVersion)}.`,
          );
          setBundledUpdate(undefined);
          return patched;
        });
        return;
      }
      const cleanup = reconcilePrototypeCharacters(
        workspace,
        await loadPrototypeTemplates(),
        incoming,
      );
      const next = migrateMoney(cleanup.workspace);
      change((current) => {
        if (current !== workspace) {
          setError('The workspace changed during reload. Try again.');
          return current;
        }
        setReloadMessage(
          `Reloaded ${incoming.configurations[0].system.name}. Compatible characters preserved. ${cleanup.rebuilt.map((name) => `Rebuilt sample: ${name}.`).join(' ')} ${cleanup.removed.map((name) => `Removed incompatible character: ${name}.`).join(' ')}`,
        );
        setBundledUpdate(undefined);
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
      if (workspace.characters.some((c) => c.id === character.id))
        throw new Error(
          'A character with this ID already exists. Duplicate the existing character or import a different ID.',
        );
      // Missing Systems are allowed: preserve the save and offer an explicit load action.
      try {
        deserializeCharacter(serializeCharacter(character), registry.engineForCharacter(character));
      } catch (e) {
        if ((e as { code?: string }).code !== 'SYSTEM_UNAVAILABLE') throw e;
      }
      change((current) =>
        migrateMoney({
          ...current,
          characters: [...current.characters, character],
          active: character.id,
        }),
      );
      go('characters', character.id);
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const query = route.query ?? '',
    tags = (route.tag ?? '').split(',').filter(Boolean),
    page = route.listPage ?? 0;
  const browse = (changes: Record<string, string>) => {
    const [path, search] = window.location.hash.split('?');
    const params = new URLSearchParams(search);
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    window.history.replaceState(null, '', `${path}?${params}`);
    setRoute(readRoute());
  };
  const openFeature = useCallback(
    (id: string) => {
      if (engine) window.location.hash = featureHref(id, engine);
    },
    [engine],
  );
  const loadStarterParty = async () => {
    setLoading(true);
    setError('');
    try {
      const [system, response] = await Promise.all([loadBundledSystem(), fetch(starterUrl)]);
      if (!response.ok) throw new Error('Sample characters could not be loaded.');
      const saves = assetData(await response.json());
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
      const character = deserializeCharacter(JSON.stringify(assetData(await response.json())));
      const result = registry.engineForCharacter(character).evaluate(character);
      if (result.status !== 'valid')
        throw new Error('Reload the bundled System before adding this sample.');
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
  return (
    <div
      className="app-shell"
      aria-busy={loading || navigating}
    >
      {(loading || navigating) && <LoadingOverlay />}
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
      <AppHeader
        page={route.page}
        systems={workspace.systems}
        selectedSystem={selected}
        selectSystem={(key) => {
          setSelectedSystem(key);
          setOptions({});
          go(route.page === 'characters' ? 'characters' : route.page);
        }}
        saved={saved}
        characterCount={workspace.characters.length}
        classPlural={engine?.catalogue.system.terminology?.classPlural ?? 'Classes'}
        creaturePlural={engine?.catalogue.system.terminology?.creaturePlural ?? 'Races'}
        createCharacter={selected ? () => setCreating(true) : undefined}
      />
      <main
        id="main-content"
        className={active ? 'character-page' : undefined}
        tabIndex={-1}
        aria-busy={loading || navigating}
      >
        {reloadMessage && (
          <p
            className="notice"
            role="status"
          >
            {reloadMessage}
          </p>
        )}
        {bundledUpdate && workspace.systems.includes(bundledUpdate) && (
          <div
            className="notice row"
            role="status"
          >
            <span>
              A minor or major System update is available and requires reloading. Compatible
              characters are preserved; incompatible samples are rebuilt and other incompatible
              characters are removed.
            </span>
            <button
              disabled={loading}
              onClick={() => void reload(bundledUpdate)}
            >
              Reload updated System
            </button>
          </div>
        )}
        {updateError && (
          <p
            className="notice"
            role="status"
          >
            {updateError}
          </p>
        )}
        {(loading || navigating) && (
          <div
            className="loading-banner"
            role="status"
          >
            Loading…
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="alert row"
          >
            <span>{error}</span>
            <button
              className="quiet"
              onClick={() => setError('')}
            >
              Dismiss
            </button>
          </div>
        )}
        {storageError && (
          <div
            role="alert"
            className="alert"
          >
            <p>{storageError}</p>
          </div>
        )}
        {resolved.error && (
          <div className="notice">
            <p>{resolved.error}</p>
            <a href="#systems">Manage Systems →</a>
          </div>
        )}
        {route.page === 'system-data' && (
          <SystemDataEditor
            files={workspace.systems}
            save={(existing, incoming) => {
              const current = workspaceRef.current;
              const next = reloadSystem(current, existing, incoming);
              change(next);
              setOptions({});
            }}
          />
        )}
        {route.page === 'systems' && (
          <>
            <PageTitle
              eyebrow="Your rules, your table"
              title="Systems"
              description="Load a System from JSON into the local browser database. Its Classes, Features, options, and calculations become available throughout your workspace."
            />
            <SystemLoader
              loading={loading}
              bundledLoaded={workspace.systems.some((s) => s.id === bundledSystem.id)}
              loadBundled={() => void loadBundled()}
              loadFile={(file) => void loadFile(file)}
            />
            <div className="cards">
              {workspace.systems.map((file) => (
                <article
                  className="panel system-card"
                  key={systemKey(file)}
                >
                  <p className="eyebrow">
                    {'Loaded · revision '}
                    {file.revision}
                    {' · content version '}
                    {releaseVersion(file.contentVersion)}
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
                    <button
                      className="quiet"
                      onClick={() =>
                        download(
                          `${file.id.replace(/[^a-z0-9-]/gi, '-')}.json`,
                          JSON.stringify(file, null, 2),
                        )}
                    >
                      Export JSON
                    </button>
                    <button
                      className="quiet danger"
                      onClick={() => {
                        const next = workspace.systems.filter(
                          (s) => systemKey(s) !== systemKey(file),
                        );
                        change({ ...workspace, systems: next });
                        setOptions({});
                        setSelectedSystem(next[0] ? systemKey(next[0]) : '');
                      }}
                    >
                      Unload System
                    </button>
                    <ReloadSystemButton
                      name={file.configurations[0].system.name}
                      loading={loading}
                      bundled={file.id === bundledSystem.id}
                      reload={(source) => void reload(file, source)}
                    />
                  </div>
                  <p className="muted small">
                    Unloading preserves characters. Reload the same revision to resume them.
                  </p>
                </article>
              ))}
            </div>
            <section className="panel">
              <h3>Current bundled content</h3>
              <p>
                {bundledSystem.name}
                {' '}
                includes the 12 SRD 5.2.1 classes with one subclass each, 9
                species, 4 backgrounds, 17 feats, 339 spells and the SRD equipment, plus 12 sample
                characters. Each Feature quotes its source page and lists the effects that need table
                resolution.
              </p>
              <p className="muted">
                {'The SRD 5.2.1 is licensed under CC BY 4.0. '}
                <a
                  href="https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf"
                  target="_blank"
                  rel="noreferrer"
                >
                  Official SRD
                </a>
                {' '}
                {'· '}
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  License
                </a>
                {' '}
                {'· '}
                <a
                  href={noticeUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Full attribution
                </a>
              </p>
            </section>
          </>
        )}
        {route.page === 'characters'
          && (!active
            ? (
                <>
                  <PageTitle
                    eyebrow="A character is a collection of choices"
                    title="Every adventure starts with a Feature."
                    description="Build your character one choice at a time. Explore what makes them different, and let the System handle the numbers."
                  />
                  <div className="toolbar">
                    <button
                      disabled={!selected}
                      onClick={() => setCreating(true)}
                    >
                      Create a character →
                    </button>
                    <button
                      className="quiet"
                      disabled={loading || !selected}
                      onClick={() => void loadMulticlassSample()}
                    >
                      Add multiclass sample
                    </button>
                    <button
                      className="quiet"
                      disabled={loading}
                      onClick={() => void loadStarterParty()}
                    >
                      {loading ? 'Loading…' : 'Add sample party'}
                    </button>
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
                      <p>
                        Load the bundled {bundledSystem.name} System to begin, or bring your own System JSON.
                      </p>
                      <button
                        disabled={loading}
                        onClick={() => void loadBundled()}
                      >
                        {loading ? 'Loading System…' : `Load ${bundledSystem.name}`}
                      </button>
                      <a href="#systems">Manage Systems →</a>
                    </div>
                  )}
                  <div className="cards">
                    {workspace.characters.map((c) => (
                      <article
                        className="panel character-card"
                        key={c.id}
                      >
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
                        <a
                          className="quiet"
                          href={pageHref('characters', c.id)}
                        >
                          Open character →
                        </a>
                      </article>
                    ))}
                  </div>
                </>
              )
            : (
                <>
                  <div className="toolbar character-actions">
                    <a href="#characters">← All characters</a>
                    <label className="character-switch">
                      <span>Character</span>
                      <select
                        aria-label="Switch character"
                        value={active.id}
                        onChange={(e) => go('characters', e.target.value)}
                      >
                        {workspace.characters.map((c) => (
                          <option
                            key={c.id}
                            value={c.id}
                          >
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="quiet"
                      onClick={() =>
                        download(
                          `${active.name.replace(/[^a-z0-9-]/gi, '-')}.json`,
                          serializeCharacter(active),
                        )}
                    >
                      Export character
                    </button>
                    <button
                      className="quiet"
                      onClick={() => {
                        const copy = {
                          ...structuredClone(active),
                          id: crypto.randomUUID(),
                          name: `${active.name} (copy)`,
                        };
                        change({
                          ...workspace,
                          characters: [...workspace.characters, copy],
                          active: copy.id,
                        });
                        go('characters', copy.id);
                      }}
                    >
                      Duplicate
                    </button>
                  </div>
                  {engine
                    ? (
                        <CharacterBuilder
                          key={active.id}
                          engine={engine}
                          character={active}
                          update={update}
                          openFeature={openFeature}
                          report={setError}
                        />
                      )
                    : (
                        <h1>{active.name}</h1>
                      )}
                </>
              ))}
        {['classes', 'features', 'races'].includes(route.page) && !route.id && (
          <>
            <PageTitle
              eyebrow="The building blocks of a character"
              title={route.page === 'classes'
                ? 'Find your path.'
                : route.page === 'races'
                  ? `Explore ${engine?.catalogue.system.terminology?.creaturePlural ?? 'Races'}.`
                  : 'Explore Features.'}
              description={route.page === 'classes'
                ? `Inspect each ${engine?.catalogue.system.terminology?.classSingular ?? 'Class'} progression, including every independent grant and selection at each level.`
                : 'Browse reusable abilities, choices, resources, and stat modifiers. Open a Feature to see what it contains.'}
            />
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
                                  browse({ page: '' });
                                  go(route.page);
                                }}
                              >
                                {domain.values.map((value) => (
                                  <option
                                    value={JSON.stringify(value)}
                                    key={JSON.stringify(value)}
                                  >
                                    {typeof value === 'boolean'
                                      ? value
                                        ? 'Enabled'
                                        : 'Disabled'
                                      : String(value).replaceAll('-', ' ')}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                        </div>
                      </details>
                    )}
                    <CatalogueBrowser
                      key={route.page}
                      page={route.page as 'classes' | 'features' | 'races'}
                      engine={engine}
                      query={query}
                      tags={tags}
                      level={route.level ?? ''}
                      listPage={page}
                      sort={route.sort ?? 'name'}
                      browse={browse}
                      openFeature={openFeature}
                      classHref={(id) => pageHref('classes', id, engine)}
                    />
                    <p className="muted small">
                      Custom Feature authoring will use these same building blocks in a future editor.
                    </p>
                  </>
                )
              : (
                  <p>
                    <a href="#systems">Load a System</a> to browse its content.
                  </p>
                )}
          </>
        )}
        {route.page === 'features'
          && route.id
          && engine
          && (feature
            ? (
                <>
                  <a
                    className="button quiet"
                    href={route.returnTo
                      ?? featureHref('', engine)
                        .replace('#features/', '#features')
                        .split('&returnTo=')[0]}
                  >
                    {'← '}
                    {route.returnTo?.startsWith('#classes/')
                      ? `Back to ${engine.catalogue.system.terminology?.classSingular ?? 'Class'} Features`
                      : route.returnTo?.startsWith('#characters/')
                        ? 'Back to character'
                        : route.returnTo?.startsWith('#races')
                          ? `Back to ${engine.catalogue.system.terminology?.creaturePlural ?? 'Races'}`
                          : 'Features'}
                  </a>
                  <FeatureDetail
                    feature={feature}
                    engine={engine}
                    openFeature={openFeature}
                  />
                </>
              )
            : (
                <p>This Feature is unavailable in the loaded catalogue.</p>
              ))}
        {route.page === 'items' && route.id && engine && (
          <>
            <a href={route.returnTo ?? '#characters'}>← Back</a>
            <ItemDetail
              engine={engine}
              id={route.id}
            />
          </>
        )}
        {route.page === 'classes'
          && route.id
          && engine
          && (cls
            ? (
                <>
                  <a
                    className="quiet"
                    href={pageHref('classes', undefined, engine)}
                  >
                    {`← ${engine.catalogue.system.terminology?.classPlural ?? 'Classes'}`}
                  </a>
                  <ClassDetail
                    key={`${engine.catalogue.id}:${cls.id}`}
                    cls={cls}
                    engine={engine}
                    openFeature={openFeature}
                  />
                </>
              )
            : (
                <p>{`This ${engine.catalogue.system.terminology?.classSingular ?? 'Class'} is unavailable in the loaded catalogue.`}</p>
              ))}
      </main>
      <footer>
        {'Feature Forge '}
        <span>Built from Features. Governed by your System.</span>
      </footer>
      {creating && selected && (
        <Modal
          title="Create a character"
          onClose={() => setCreating(false)}
        >
          <CreateForm
            files={workspace.systems}
            initial={selected}
            create={(file, settings, name, classId, level) => {
              try {
                const e = registry.createEngine(file.id, file.revision, settings);
                const character = e.createCharacter(
                  crypto.randomUUID(),
                  name,
                  classId ? [{ id: crypto.randomUUID(), class: classId, level }] : [],
                  [],
                  { draft: true },
                );
                change((current) =>
                  migrateMoney({
                    ...current,
                    characters: [...current.characters, character],
                    active: character.id,
                  }),
                );
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
function PageTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
function CreateForm({
  files,
  initial,
  create,
}: {
  files: SystemFile[];
  initial: SystemFile;
  create: (
    file: SystemFile,
    options: Record<string, Value>,
    name: string,
    classId: string,
    level: number,
  ) => void;
}) {
  const [key, setKey] = useState(systemKey(initial)),
    [settings, setSettings] = useState<Record<string, Value>>({}),
    [name, setName] = useState(''),
    [classId, setClassId] = useState(''),
    [level, setLevel] = useState(1);
  const file = files.find((f) => systemKey(f) === key)!;
  const registry = useMemo(() => createRegistry([file]), [file]);
  const classes = useMemo(
    () => registry.createEngine(file.id, file.revision, settings).catalogue.classes,
    [registry, file, settings],
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create(file, settings, name.trim() || 'Unnamed character', classId, level);
  };
  return (
    <form onSubmit={submit}>
      <p className="muted">Create a draft, then choose the Features that shape your character.</p>
      <label>
        Character name
        <input
          autoFocus
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Give your character a name"
        />
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
          {files.map((f) => (
            <option
              key={systemKey(f)}
              value={systemKey(f)}
            >
              {f.configurations[0].system.name}
            </option>
          ))}
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
            {domain.values.map((v) => (
              <option
                key={JSON.stringify(v)}
                value={JSON.stringify(v)}
              >
                {typeof v === 'boolean'
                  ? v
                    ? 'Enabled'
                    : 'Disabled'
                  : String(v).replaceAll('-', ' ')}
              </option>
            ))}
          </select>
        </label>
      ))}
      <div className="input-grid">
        <label>
          {`Starting ${file.configurations[0].system.terminology?.classSingular ?? 'Class'}`}
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">{`Choose a ${file.configurations[0].system.terminology?.classSingular ?? 'Class'} later`}</option>
            {classes.map((c) => (
              <option
                key={c.id}
                value={c.id}
              >
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {`${file.configurations[0].system.terminology?.classSingular ?? 'Class'} level`}
          <input
            type="number"
            min="1"
            step="1"
            max={classes.find((c) => c.id === classId)?.maximumLevel}
            value={level}
            disabled={!classId}
            onChange={(e) => setLevel(Number(e.target.value))}
          />
        </label>
      </div>
      <button
        type="submit"
        className="full"
      >
        Create draft →
      </button>
    </form>
  );
}
