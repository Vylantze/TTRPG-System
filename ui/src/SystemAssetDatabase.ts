import type { SystemAssetCache } from '@/src/types/SystemAssetCache';

/** Disposable asset cache, independent of authoritative character snapshots. */
export class SystemAssetDatabase implements SystemAssetCache {
  private connection?: Promise<IDBDatabase | undefined>;
  constructor(private factory: IDBFactory) {}

  private open(): Promise<IDBDatabase | undefined> {
    if (this.connection) return this.connection;
    this.connection = new Promise<IDBDatabase | undefined>((resolve) => {
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
        database.onversionchange = () => {
          database.close();
          this.connection = undefined;
        };
        resolve(database);
      };
    }).catch(() => undefined);
    this.connection.then((database) => {
      if (!database) this.connection = undefined;
    });
    return this.connection;
  }

  private async access(key: string, entry?: { version: number; document: unknown }): Promise<{ version: number; document: unknown } | undefined> {
    const database = await this.open();
    if (!database) return;
    return new Promise<{ version: number; document: unknown } | undefined>((resolve) => {
      const transaction = database.transaction('assets', entry ? 'readwrite' : 'readonly');
      const store = transaction.objectStore('assets');
      const request = entry ? store.put(entry, key) : store.get(key);
      let value: { version: number; document: unknown } | undefined;
      request.onsuccess = () => {
        if (!entry) value = request.result;
      };
      transaction.oncomplete = () => {
        resolve(value);
      };
      transaction.onabort = transaction.onerror = () => {
        resolve(undefined);
      };
    }).catch(() => undefined);
  }

  get(key: string) { return this.access(key); }
  async set(key: string, entry: { version: number; document: unknown }) { await this.access(key, entry); }
}
