import { loadSystemFile, parseSystemFile, type SystemFile } from '@/src/index';
import { retainSystemSnapshot } from '@/src/system-snapshot';
import type { SystemWorkerRequest } from '@/ui/src/types/SystemWorkerRequest';

let worker: Worker | undefined;
let sequence = 0;
const pending = new Map<
  number,
  {
    resolve: (file: SystemFile) => void;
    reject: (error: Error) => void;
    started: number;
    name: string;
  }
>();

/** One worker owns validation; only replies from this locally bundled worker are trusted. */
function request(task: Omit<SystemWorkerRequest, 'id'>): Promise<SystemFile> {
  if (typeof Worker === 'undefined')
    return (
      task.kind === 'validate'
        ? Promise.resolve().then(() => parseSystemFile(task.input))
        : loadSystemFile(task.input, async (path) => {
            if (task.documents) {
              if (!Object.hasOwn(task.documents, path))
                throw new Error(`Missing ${path}. Select all referenced files.`);
              const value = task.documents[path];
              return value instanceof Blob ? value.text() : value;
            }
            const url = task.urls?.[path];
            if (!url) throw new Error(`Missing bundled System document: ${path}`);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Could not load System document: ${path}`);
            return response.text();
          })
    ).then(retainSystemSnapshot);
  if (!worker) {
    worker = new Worker(new URL('../../../workers/system-worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<{ id: number; file?: SystemFile; error?: string }>) => {
      const entry = pending.get(event.data.id);
      if (!entry) return;
      pending.delete(event.data.id);
      performance.clearMeasures(entry.name);
      performance.measure(entry.name, { start: entry.started });
      if (event.data.file) entry.resolve(retainSystemSnapshot(event.data.file));
      else entry.reject(new Error(event.data.error ?? 'System validation failed.'));
    };
    worker.onerror = () => {
      for (const entry of pending.values())
        entry.reject(new Error('System loading worker failed. Retry loading the System.'));
      pending.clear();
      worker?.terminate();
      worker = undefined;
    };
  }
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, started: performance.now(), name: `system:${task.kind}` });
    try {
      worker!.postMessage({ ...task, id });
    } catch (error) {
      pending.delete(id);
      reject(error);
    }
  });
}

export const validateSystemAsync = (input: unknown) => request({ kind: 'validate', input });
export const loadPackageAsync = (
  input: unknown,
  documents?: Record<string, unknown>,
  urls?: Record<string, string>,
) => request({ kind: 'package', input, documents, urls });
