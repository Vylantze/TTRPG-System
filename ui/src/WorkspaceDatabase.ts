import { validateSystemAsync } from '@/ui/src/system-worker-client';
import { migrateDescriptionOverrides } from '@/ui/src/migrate-description-overrides';
import { parseSystemFile, serializeCharacter, type Character } from '@/src/index';
import { readWorkspace, decodeWorkspace, systemKey, type Workspace } from '@/ui/src/workspace';
import type { DatabaseSnapshot } from '@/ui/src/types/DatabaseSnapshot';

const stores = ['systems', 'characters', 'workspace'];
function request<T>(operation: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error ?? new Error('Database request failed.'));
  });
}
function completion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Database transaction aborted.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('Database transaction failed.'));
  });
}

/** Atomic local snapshots, with separate System records and optimistic multi-tab locking. */
export class WorkspaceDatabase {
  private connection?: Promise<IDBDatabase>;
  private revision = 0;
  private previous?: Workspace;
  private storedCharacterIds: string[] = [];
  private storedSystemKeys: string[] = [];
  private queue: Promise<void> = Promise.resolve();

  constructor(private factory: IDBFactory, private name = 'ttrpg-feature-forge') {}

  private open(): Promise<IDBDatabase> {
    if (this.connection) return this.connection;
    this.connection = new Promise((resolve, reject) => {
      let blocked = false;
      const opening = this.factory.open(this.name, 1);
      opening.onupgradeneeded = () => {
        for (const store of stores) if (!opening.result.objectStoreNames.contains(store)) opening.result.createObjectStore(store);
      };
      opening.onerror = () => reject(opening.error ?? new Error('Could not open the local database.'));
      opening.onblocked = () => {
        blocked = true;
        reject(new Error('Another tab is blocking the database upgrade. Close other Feature Forge tabs and retry.'));
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
    });
    this.connection.catch(() => {
      this.connection = undefined;
    });
    return this.connection;
  }

  async load(legacy?: Pick<Storage, 'getItem'>, recoverCharacter?: ((value: unknown) => Character | undefined) | Promise<(value: unknown) => Character | undefined>): Promise<Workspace> {
    const recovery = Promise.resolve(recoverCharacter);
    // Attach immediately while database I/O runs in parallel with template loading.
    void recovery.catch(() => {});
    const database = await this.open();
    const transaction = database.transaction(stores, 'readonly');
    const done = completion(transaction);
    const [snapshot, systems, characters] = await Promise.all([
      request(transaction.objectStore('workspace').get('current')) as Promise<DatabaseSnapshot | undefined>,
      request(transaction.objectStore('systems').getAll()),
      request(transaction.objectStore('characters').getAll()),
      done,
    ]);
    await done;
    const recover = await recovery;
    if (!snapshot) {
      if (systems.length || characters.length) throw new Error('The local database snapshot is missing. Existing records have been preserved.');
      // Do not delete the legacy copy: a failed migration must always be recoverable.
      const workspace = legacy ? readWorkspace({ getItem: (key) => legacy.getItem(key) }, recover) : { version: 1 as const, systems: [], characters: [] };
      await this.save(workspace);
      return workspace;
    }
    if (snapshot.version !== 1 || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 1 || !Array.isArray(snapshot.systemKeys) || !Array.isArray(snapshot.characterIds)) throw new Error('Unsupported local database snapshot.');
    const bySystem = new Map(systems.map((file) => [systemKey(file), file]));
    const byCharacter = new Map(characters.map((character) => [character.id, character]));
    if (bySystem.size !== snapshot.systemKeys.length || byCharacter.size !== snapshot.characterIds.length || new Set(snapshot.systemKeys).size !== snapshot.systemKeys.length || new Set(snapshot.characterIds).size !== snapshot.characterIds.length || snapshot.systemKeys.some((key) => !bySystem.has(key)) || snapshot.characterIds.some((id) => !byCharacter.has(id))) throw new Error('The database contains an incomplete workspace. Records have been preserved.');
    const validatedSystems = await Promise.all(snapshot.systemKeys.map((key) => validateSystemAsync(migrateDescriptionOverrides(bySystem.get(key)))));
    const stored = { version: 1, systems: validatedSystems, characters: snapshot.characterIds.map((id) => byCharacter.get(id)), active: snapshot.active };
    let repaired = false;
    const workspace = decodeWorkspace(stored, recover
      ? (value) => {
          repaired = true;
          return recover!(value);
        }
      : undefined);
    this.revision = snapshot.revision;
    this.storedCharacterIds = snapshot.characterIds;
    this.storedSystemKeys = snapshot.systemKeys;
    this.previous = repaired ? undefined : workspace;
    return workspace;
  }

  save(workspace: Workspace): Promise<void> {
    const operation = this.queue.then(() => this.commit(workspace));
    this.queue = operation.catch(() => {});
    return operation;
  }

  private async commit(workspace: Workspace): Promise<void> {
    if (workspace === this.previous) return;
    workspace.characters.forEach(serializeCharacter);
    for (const file of workspace.systems) if (!this.previous?.systems.includes(file)) parseSystemFile(file);
    const systemKeys = workspace.systems.map(systemKey), characterIds = workspace.characters.map((character) => character.id);
    if (new Set(systemKeys).size !== systemKeys.length || new Set(characterIds).size !== characterIds.length) throw new Error('Duplicate workspace records cannot be saved.');
    const database = await this.open();
    const transaction = database.transaction(stores, 'readwrite');
    const done = completion(transaction);
    let conflict = false;
    const current = transaction.objectStore('workspace').get('current');
    current.onsuccess = () => {
      if ((current.result?.revision ?? 0) !== this.revision) {
        conflict = true;
        transaction.abort();
        return;
      }
      const systems = transaction.objectStore('systems'), characters = transaction.objectStore('characters');
      for (const old of this.storedSystemKeys) if (!systemKeys.includes(old)) systems.delete(old);
      for (const file of workspace.systems) if (!this.previous?.systems.includes(file)) systems.put(file, systemKey(file));
      for (const old of this.storedCharacterIds) if (!characterIds.includes(old)) characters.delete(old);
      for (const character of workspace.characters) if (!this.previous?.characters.includes(character)) characters.put(character, character.id);
      const snapshot: DatabaseSnapshot = { version: 1, revision: this.revision + 1, systemKeys, characterIds, active: workspace.active };
      transaction.objectStore('workspace').put(snapshot, 'current');
    };
    try {
      await done;
    } catch (error) {
      if (conflict) throw new Error('Another tab saved a newer workspace. Export your unsaved characters, then reload this page before editing further.', { cause: error });
      throw error;
    }
    this.revision++;
    this.storedCharacterIds = characterIds;
    this.storedSystemKeys = systemKeys;
    this.previous = workspace;
  }

  async close(): Promise<void> {
    await this.queue;
    (await this.connection)?.close();
    this.connection = undefined;
  }
}
