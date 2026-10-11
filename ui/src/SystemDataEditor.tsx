import { useRef, useState } from 'react';
import { releaseVersion, type SystemFile } from '@/src/index';
import { validateSystemAsync } from '@/ui/src/system-worker-client';
import { systemKey } from '@/ui/src/workspace';
import { prepareSystemDataEdit } from '@/ui/src/system-data';
import { LoadingOverlay } from '@/ui/src/LoadingOverlay';

export function SystemDataEditor({ files, save }: { files: SystemFile[]; save: (existing: SystemFile, incoming: SystemFile) => void }) {
  const baseline = useRef<SystemFile | undefined>(undefined);
  const [selected, setSelected] = useState(files[0] ? systemKey(files[0]) : '');
  const [section, setSection] = useState('configurations');
  const [draft, setDraft] = useState<string>();
  const [record, setRecord] = useState('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const file = files.find((entry) => systemKey(entry) === selected);
  const data = section === 'all' ? file : file?.[section as keyof SystemFile];
  const records = Array.isArray(data) ? data : [];
  const text = draft ?? JSON.stringify(record === 'all' ? data : records[Number(record)], null, 2);
  const reset = () => {
    setDraft(undefined);
    baseline.current = undefined;
    setMessage('');
    setFailed(false);
  };
  const apply = async () => {
    if (!file || draft === undefined) return;
    setBusy(true);
    setMessage('Validating System and character compatibility…');
    setFailed(false);
    try {
      if (baseline.current !== file) throw new Error('The System changed while you were editing. Discard these edits and try again.');
      const updated = prepareSystemDataEdit(file, section, draft, record);
      const incoming = await validateSystemAsync(updated);
      save(file, incoming);
      setDraft(undefined);
      setMessage(`Saved local System ${releaseVersion(incoming.contentVersion)}. Character compatibility verified.`);
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : String(error));
    } finally { setBusy(false); }
  };
  return (
    <section className="panel system-data-editor" aria-busy={busy}>
      {busy && <LoadingOverlay />}
      <h1>System data</h1>
      <p>View and edit the loaded System JSON. Changes are local to this browser; export from Systems to keep a portable copy. Saving validates the System and preserves compatible characters. Incompatible edits are rejected.</p>
      {!files.length
        ? (
            <p>
              Load a System from
              <a href="#systems">Systems</a>
              {' '}
              first.
            </p>
          )
        : (
            <fieldset disabled={busy}>
              <div className="toolbar">
                <label>
                  System to edit
                  <select
                    disabled={draft !== undefined}
                    value={selected}
                    onChange={(event) => {
                      setSelected(event.target.value);
                      setRecord('all');
                      setQuery('');
                      reset();
                    }}
                  >
                    {files.map((entry) => <option key={systemKey(entry)} value={systemKey(entry)}>{entry.configurations[0].system.name}</option>)}
                  </select>
                </label>
                <label>
                  Data section
                  <select
                    disabled={draft !== undefined}
                    value={section}
                    onChange={(event) => {
                      setSection(event.target.value);
                      setRecord('all');
                      setQuery('');
                      reset();
                    }}
                  >
                    <option value="all">Complete System</option>
                    {file && Object.keys(file).filter((key) => !['assetVersions', 'contentVersion'].includes(key)).map((key) => <option key={key} value={key}>{key}</option>)}
                  </select>
                </label>
                {records.length > 0 && (
                  <>
                    <label>
                      Find record
                      <input value={query} onChange={(event) => setQuery(event.target.value)} />
                    </label>
                    <label>
                      Record
                      <select
                        disabled={draft !== undefined}
                        value={record}
                        onChange={(event) => {
                          setRecord(event.target.value);
                          reset();
                        }}
                      >
                        <option value="all">All records (add or remove entries here)</option>
                        {records.map((entry, index) => ({ index, label: String(('displayName' in entry ? entry.displayName : undefined) ?? ('name' in entry ? entry.name : undefined) ?? entry.id ?? index) })).filter(({ label, index }) => String(index) === record || label.toLowerCase().includes(query.toLowerCase())).sort((a, b) => Number(String(b.index) === record) - Number(String(a.index) === record)).slice(0, 200).map(({ index, label }) => <option key={index} value={index}>{label}</option>)}
                      </select>
                    </label>
                  </>
                )}
              </div>
              {file && (
                <textarea
                  wrap="off"
                  spellCheck={false}
                  aria-label="System JSON data"
                  value={text ?? ''}
                  onChange={(event) => {
                    if (draft === undefined) baseline.current = file;
                    setDraft(event.target.value);
                  }}
                />
              )}
              {draft !== undefined && <p className="muted small">Save or discard edits before switching records or Systems. The local release version is classified and incremented automatically.</p>}
              <div className="toolbar">
                <button disabled={!file || draft === undefined} onClick={() => void apply()}>Validate and save</button>
                <button className="quiet" disabled={draft === undefined} onClick={reset}>Discard edits</button>
              </div>
            </fieldset>
          )}
      {message && <p role={failed ? 'alert' : 'status'} className={failed ? 'notice invalid' : 'notice'}>{message}</p>}
    </section>
  );
}
