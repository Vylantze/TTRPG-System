import { loadSystemFile, parseSystemFile } from '@/src/index';
import { SystemAssetDatabase } from '@/ui/src/services/storage/SystemAssetDatabase';
import type { SystemWorkerRequest } from '@/ui/src/types/SystemWorkerRequest';

const assets = new SystemAssetDatabase(indexedDB);
self.onmessage = async (event: MessageEvent<SystemWorkerRequest>) => {
  const task = event.data;
  try {
    const file = task.kind === 'validate'
      ? parseSystemFile(task.input)
      : await loadSystemFile(task.input, async (path) => {
          if (task.documents) {
            if (!Object.hasOwn(task.documents, path)) throw new Error(`Missing ${path}. Select all referenced files.`);
            const value = task.documents[path];
            return value instanceof Blob ? value.text() : value;
          }
          const url = task.urls?.[path];
          if (!url) throw new Error(`Missing bundled System document: ${path}`);
          const response = await fetch(url, { cache: import.meta.env.DEV ? 'no-store' : 'default' });
          if (!response.ok) throw new Error(`Could not load System document: ${path}`);
          return response.text();
        }, task.urls && !import.meta.env.DEV ? assets : undefined);
    self.postMessage({ id: task.id, file });
  } catch (error) {
    self.postMessage({ id: task.id, error: error instanceof Error ? error.message : String(error) });
  }
};
