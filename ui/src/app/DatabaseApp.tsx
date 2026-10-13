import { ScreenBoundary } from '@/ui/src/app/ScreenBoundary';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
const App = lazy(() => import('@/ui/src/app/App').then((module) => ({ default: module.App })));
import { LoadingOverlay } from '@/ui/src/components/LoadingOverlay';
import { WorkspaceDatabase } from '@/ui/src/services/storage/WorkspaceDatabase';
import { download, STORAGE_KEY, type Workspace } from '@/ui/src/lib/workspace';
import { reconcilePrototypeCharacters } from '@/ui/src/features/characters/model/prototype-characters';
import { loadPrototypeTemplates } from '@/ui/src/features/characters/model/load-prototype-templates';

export function DatabaseApp() {
  const [database] = useState(() =>
    typeof indexedDB === 'undefined' ? undefined : new WorkspaceDatabase(indexedDB),
  );
  const [workspace, setWorkspace] = useState<Workspace>();
  const [error, setError] = useState('');
  const [cleanupMessage, setCleanupMessage] = useState('');
  const initialization = useRef<Promise<Workspace> | undefined>(undefined);
  const persist = useCallback((next: Workspace) => database!.save(next), [database]);
  useEffect(() => {
    let cancelled = false;
    // One initialization promise also makes StrictMode's effect replay harmless.
    const loading = (initialization.current ??= Promise.resolve().then(async () => {
      if (!database)
        throw new Error(
          'IndexedDB is unavailable in this browser. Enable local storage and reload.',
        );
      const templatesPromise = loadPrototypeTemplates();
      const schemaMessages: string[] = [];
      const loaded = await database.load(
        { getItem: (key) => localStorage.getItem(key) },
        templatesPromise.then((templates) => (value) => {
          const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
          const template = templates.find((sample) => sample.id === raw.id);
          schemaMessages.push(
            `${template ? 'Rebuilt sample' : 'Removed incompatible character'}: ${typeof raw.name === 'string' ? raw.name : String(raw.id ?? 'Unnamed')}.`,
          );
          return template && structuredClone(template);
        }),
      );
      const templates = await templatesPromise;
      const result = reconcilePrototypeCharacters(loaded, templates);
      if (result.workspace !== loaded || schemaMessages.length)
        await database.save(result.workspace);
      setCleanupMessage(
        [
          ...schemaMessages,
          ...result.rebuilt.map((name) => `Rebuilt sample: ${name}.`),
          ...result.removed.map((name) => `Removed incompatible character: ${name}.`),
        ].join(' '),
      );
      return result.workspace;
    }));
    void loading.then(
      (value) => {
        if (!cancelled) setWorkspace(value);
      },
      (reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [database]);
  if (workspace && database)
    return (
      <ScreenBoundary>
        <Suspense fallback={<LoadingOverlay />}>
          <App
            initialWorkspace={workspace}
            persist={persist}
            startupMessage={cleanupMessage}
          />
        </Suspense>
      </ScreenBoundary>
    );
  if (error)
    return (
      <main
        className="panel"
        role="alert"
      >
        <h1>Local database could not be opened</h1>
        <p>{error}</p>
        <p>Existing data has been preserved.</p>
        <div className="toolbar">
          <button onClick={() => window.location.reload()}>Retry</button>
          <button
            className="quiet"
            onClick={() =>
              download('legacy-workspace-recovery.json', localStorage.getItem(STORAGE_KEY) ?? '{}')}
          >
            Export legacy browser data
          </button>
        </div>
      </main>
    );
  return <LoadingOverlay />;
}
