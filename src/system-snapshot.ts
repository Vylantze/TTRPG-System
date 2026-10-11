import type { SystemFile } from '@/src/types/SystemFile.js';

const snapshots = new WeakSet<object>();
function freeze(value: unknown): void {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return;
  Object.values(value).forEach(freeze);
  Object.freeze(value);
}

/** Internal trust boundary: only call after validation, including our own worker's reply.
 * Never use this to accept user imports or database records without validation. */
export function retainSystemSnapshot(file: SystemFile): SystemFile {
  if (!snapshots.has(file)) {
    freeze(file);
    snapshots.add(file);
  }
  return file;
}

export function isSystemSnapshot(value: unknown): value is SystemFile {
  return !!value && typeof value === 'object' && snapshots.has(value);
}
