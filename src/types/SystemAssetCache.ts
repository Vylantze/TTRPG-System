/** Optional host storage. Entries are only published after package validation. */
export interface SystemAssetCache {
  get(key: string): Promise<{ version: number; document: unknown } | undefined>;
  set(key: string, entry: { version: number; document: unknown }): Promise<void>;
}
