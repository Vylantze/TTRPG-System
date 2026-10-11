import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from '@/ui/src/App';
import { LoadingOverlay } from '@/ui/src/LoadingOverlay';
import { WorkspaceDatabase } from '@/ui/src/WorkspaceDatabase';
import { download, STORAGE_KEY, type Workspace } from '@/ui/src/workspace';
import { reconcilePrototypeCharacters } from '@/ui/src/prototype-characters';
import { loadPrototypeTemplates } from '@/ui/src/load-prototype-templates';

export function DatabaseApp() {
  const [database] = useState(() => typeof indexedDB === 'undefined' ? undefined : new WorkspaceDatabase(indexedDB));
  const [workspace, setWorkspace] = useState<Workspace>();
  const [error, setError] = useState('');
  const [cleanupMessage, setCleanupMessage] = useState('');
  const initialization = useRef<Promise<Workspace> | undefined>(undefined);
  const persist = useCallback((next: Workspace) => database!.save(next), [database]);
  useEffect(() => {
    let cancelled = false;
    // One initialization promise also makes StrictMode's effect replay harmless.
    const loading = initialization.current ??= Promise.resolve().then(async () => {
      if (!database) throw new Error('IndexedDB is unavailable in this browser. Enable local storage and reload.');
      const templates = await loadPrototypeTemplates();
      const schemaMessages: string[] = [];
      const loaded = await database.load({ getItem: (key) => localStorage.getItem(key) }, (value) => {
        const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
        const template = templates.find((sample) => sample.id === raw.id);
        schemaMessages.push(`${template ? 'Rebuilt sample' : 'Removed incompatible character'}: ${typeof raw.name === 'string' ? raw.name : String(raw.id ?? 'Unnamed')}.`);
        return template && structuredClone(template);
      });
      const result = reconcilePrototypeCharacters(loaded, templates);
      if (result.workspace !== loaded || schemaMessages.length) await database.save(result.workspace);
      setCleanupMessage([...schemaMessages, ...result.rebuilt.map((name) => `Rebuilt sample: ${name}.`), ...result.removed.map((name) => `Removed incompatible character: ${name}.`)].join(' '));
      return result.workspace;
    });
    void loading.then((value) => {
      if (!cancelled) setWorkspace(value);
    }, (reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => {
      cancelled = true;
    };
  }, [database]);
  if (workspace && database) return <App initialWorkspace={workspace} persist={persist} startupMessage={cleanupMessage} />;
  if (error) return (
    <main className="panel" role="alert">
      <h1>Local database could not be opened</h1>
      <p>{error}</p>
      <p>Existing data has been preserved.</p>
      <div className="toolbar">
        <button onClick={() => window.location.reload()}>Retry</button>
        <button className="quiet" onClick={() => download('legacy-workspace-recovery.json', localStorage.getItem(STORAGE_KEY) ?? '{}')}>Export legacy browser data</button>
      </div>
    </main>
  );
  return <LoadingOverlay />;
}
