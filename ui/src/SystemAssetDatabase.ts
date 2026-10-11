import type { SystemAssetCache } from '@/src/types/SystemAssetCache';

/** Disposable asset cache, independent of authoritative character snapshots. */
export class SystemAssetDatabase implements SystemAssetCache {
  constructor(private factory: IDBFactory) {}

  private async access(key: string, entry?: { version: number; document: unknown }): Promise<{ version: number; document: unknown } | undefined> {
    return new Promise<{ version: number; document: unknown } | undefined>((resolve) => {
      let blocked = false;
      const opening = this.factory.open('ttrpg-system-assets', 1);
      opening.onupgradeneeded = () => opening.result.createObjectStore('assets');
      opening.onerror = () => resolve(undefined);
      opening.onblocked = () => {
        blocked = true;
        resolve(undefined);
      };
      opening.onsuccess = () => {
        const database = opening.result;
        if (blocked) {
          database.close();
          return;
        }
        database.onversionchange = () => database.close();
        const transaction = database.transaction('assets', entry ? 'readwrite' : 'readonly');
        const store = transaction.objectStore('assets');
        const request = entry ? store.put(entry, key) : store.get(key);
        let value: { version: number; document: unknown } | undefined;
        request.onsuccess = () => {
          if (!entry) value = request.result;
        };
        transaction.oncomplete = () => {
          database.close();
          resolve(value);
        };
        transaction.onabort = transaction.onerror = () => {
          database.close();
          resolve(undefined);
        };
      };
    }).catch(() => undefined);
  }

  get(key: string) { return this.access(key); }
  async set(key: string, entry: { version: number; document: unknown }) { await this.access(key, entry); }
}
