/** Optional host storage. Entries are only published after package validation. */
export interface SystemAssetCache {
  get(key: string): Promise<{ version: string; document: unknown } | undefined>;
  set(key: string, entry: { version: string; document: unknown }): Promise<void>;
}
