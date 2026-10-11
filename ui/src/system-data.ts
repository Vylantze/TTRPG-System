import { bumpVersion, releaseVersion, classifyReleaseChange, type SystemFile } from '@/src/index';

/** Compose an immutable local edit; full engine validation happens in the worker. */
export function prepareSystemDataEdit(file: SystemFile, section: string, draft: string, record = 'all'): SystemFile {
  const data: unknown = JSON.parse(draft);
  let value = data;
  if (record !== 'all') {
    const existing = file[section as keyof SystemFile];
    const index = Number(record);
    if (!Array.isArray(existing) || !Number.isInteger(index) || index < 0 || index >= existing.length) throw new Error('The selected record is no longer available.');
    value = existing.map((entry, position) => position === index ? data : entry);
  }
  const candidate = section === 'all' ? data : { ...file, [section]: value };
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('Expected System JSON.');
  const kind = classifyReleaseChange(file, candidate);
  const updated = { ...candidate as SystemFile, contentVersion: kind === 'none' ? file.contentVersion : bumpVersion(releaseVersion(file.contentVersion), kind) };
  if (kind !== 'none') delete updated.assetVersions;
  return updated;
}
