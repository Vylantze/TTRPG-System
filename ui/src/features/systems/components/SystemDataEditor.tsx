import { useRef, useState } from 'react';
import { releaseVersion, type SystemFile } from '@/src/index';
import { validateSystemAsync } from '@/ui/src/features/systems/model/system-worker-client';
import { systemKey } from '@/ui/src/lib/workspace';
import { versionSystemDataEdit } from '@/ui/src/features/systems/model/system-data';
import { LoadingOverlay } from '@/ui/src/components/LoadingOverlay';
import { AuthoringField } from '@/ui/src/features/systems/components/AuthoringField';
import { formSchema } from '@/ui/src/features/systems/model/authoring-form';
import {
  editorRecords,
  editSystemRecord,
  newSystemRecord,
  editorCategories,
} from '@/ui/src/features/systems/model/system-editor-records';

export function SystemDataEditor({
  files,
  save,
}: {
  files: SystemFile[];
  save: (existing: SystemFile, incoming: SystemFile) => void;
}) {
  const baseline = useRef<SystemFile | undefined>(undefined);
  const [selected, setSelected] = useState(files[0] ? systemKey(files[0]) : '');
  const [category, setCategory] = useState('classes');
  const [configuration, setConfiguration] = useState(0);
  const [record, setRecord] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [draft, setDraft] = useState<SystemFile>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const original = files.find((entry) => systemKey(entry) === selected);
  const file = draft ?? original;
  const records = file ? editorRecords(file, category, configuration) : [];
  const entry = records.find((entry) => entry.id === record) ?? records[0];
  const definition = editorCategories.find((entry) => entry.id === category)!;
  const matches = records.filter((entry) =>
    `${entry.label} ${entry.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  const lastPage = Math.max(0, Math.ceil(matches.length / 50) - 1);
  const currentPage = Math.min(page, lastPage);
  const reset = () => {
    setDraft(undefined);
    baseline.current = undefined;
    setMessage('');
    setFailed(false);
  };
  const change = (next: SystemFile) => {
    if (!draft) baseline.current = original;
    setDraft(next);
    setMessage('');
  };
  const apply = async () => {
    if (!original || !draft) return;
    setBusy(true);
    setFailed(false);
    try {
      if (baseline.current !== original)
        throw new Error(
          'The System changed while you were editing. Discard these edits and try again.',
        );
      const incoming = await validateSystemAsync(versionSystemDataEdit(original, draft));
      save(original, incoming);
      setDraft(undefined);
      baseline.current = undefined;
      setMessage(
        `Saved local System ${releaseVersion(incoming.contentVersion)}. Character compatibility verified.`,
      );
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="panel system-data-editor"
      aria-busy={busy}
    >
      {busy && <LoadingOverlay />}
      <h1>System data</h1>
      <p>
        Edit rules with forms. Changes are saved to this browser after validation; export from
        Systems to keep a portable copy. Existing characters are preserved, and incompatible edits
        are rejected.
      </p>
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
                    value={selected}
                    disabled={!!draft}
                    onChange={(event) => {
                      setSelected(event.target.value);
                      setConfiguration(0);
                      setRecord('');
                      reset();
                    }}
                  >
                    {files.map((entry) => (
                      <option
                        key={systemKey(entry)}
                        value={systemKey(entry)}
                      >
                        {entry.configurations[0].system.name}
                      </option>
                    ))}
                  </select>
                </label>
                {file && (
                  <label>
                    Rules configuration
                    <select
                      value={configuration}
                      onChange={(event) => {
                        setConfiguration(Number(event.target.value));
                        setRecord('');
                      }}
                    >
                      {file.configurations.map((config, index) => (
                        <option
                          key={config.id}
                          value={index}
                        >
                          {Object.entries(config.options)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(' · ') || config.id}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <nav
                className="subnav"
                aria-label="System editor categories"
              >
                {editorCategories.map((entry) => (
                  <button
                    key={entry.id}
                    className={category === entry.id ? 'active' : 'quiet'}
                    aria-pressed={category === entry.id}
                    onClick={() => {
                      setCategory(entry.id);
                      setRecord('');
                      setQuery('');
                      setPage(0);
                    }}
                  >
                    {entry.label}
                  </button>
                ))}
              </nav>
              {file && (
                <div className="system-editor-layout">
                  <aside className="system-editor-browser">
                    <label>
                      Find record
                      <input
                        value={query}
                        onChange={(event) => {
                          setQuery(event.target.value);
                          setPage(0);
                        }}
                      />
                    </label>
                    <p className="muted small">
                      {records.length} {definition.label.toLowerCase()}
                    </p>
                    <div className="system-editor-records">
                      {matches.slice(currentPage * 50, (currentPage + 1) * 50).map((item) => (
                        <button
                          className={entry?.id === item.id ? '' : 'quiet'}
                          key={item.id}
                          onClick={() => setRecord(item.id)}
                        >
                          {item.label}
                          <small>{item.id}</small>
                        </button>
                      ))}
                    </div>
                    <div className="toolbar">
                      <button
                        className="quiet"
                        disabled={currentPage === 0}
                        onClick={() => setPage(currentPage - 1)}
                      >
                        Previous
                      </button>
                      <span>
                        {currentPage + 1} / {lastPage + 1}
                      </span>
                      <button
                        className="quiet"
                        disabled={currentPage === lastPage}
                        onClick={() => setPage(currentPage + 1)}
                      >
                        Next
                      </button>
                    </div>
                    {!['settings', 'options'].includes(category) && (
                      <button
                        className="quiet"
                        onClick={() => {
                          const created = newSystemRecord(file, category, configuration);
                          change(created.file);
                          setRecord(created.id);
                          setQuery('');
                        }}
                      >
                        Add
                        {definition.singular}
                      </button>
                    )}
                  </aside>
                  <article className="system-editor-form">
                    <h2>{entry?.label ?? `No ${definition.label.toLowerCase()} yet`}</h2>
                    {(category === 'classes' || category === 'settings') && (
                      <p className="notice">Changes here apply to the selected rules configuration.</p>
                    )}
                    {entry && (
                      <AuthoringField
                        key={`${category}/${configuration}`}
                        schema={formSchema(definition.schema)}
                        value={entry.value}
                        label={definition.singular}
                        change={(value) => {
                          const next = editSystemRecord(file, category, configuration, entry.id, value);
                          change(next);
                          if (
                            category !== 'options'
                            && value
                            && typeof value === 'object'
                            && 'id' in value
                          )
                            setRecord(String(value.id));
                        }}
                      />
                    )}
                    {entry && !['settings', 'options'].includes(category) && (
                      <button
                        className="quiet danger"
                        onClick={() => {
                          change(editSystemRecord(file, category, configuration, entry.id, undefined));
                          setRecord('');
                        }}
                      >
                        Delete
                        {definition.singular}
                      </button>
                    )}
                  </article>
                </div>
              )}
              {!!draft && (
                <p className="notice">
                  Unsaved changes. You can switch categories and records without losing edits. Save or
                  discard before switching Systems.
                </p>
              )}
              <div className="toolbar">
                <button
                  disabled={!draft}
                  onClick={() => void apply()}
                >
                  Validate and save
                </button>
                <button
                  className="quiet"
                  disabled={!draft}
                  onClick={reset}
                >
                  Discard edits
                </button>
              </div>
              <datalist id="authoring-references">
                {file
                  && [
                    ...new Map(
                      [
                        ...file.features,
                        ...file.configurations[configuration].classes,
                        ...(file.items ?? []),
                        ...(file.itemFeatures ?? []),
                        ...(file.blocks ?? []),
                        ...file.configurations[configuration].system.stats,
                      ].map((entry) => [entry.id, entry]),
                    ).values(),
                  ].map((entry) => (
                    <option
                      value={entry.id}
                      key={entry.id}
                    >
                      {'name' in entry ? entry.name : entry.id}
                    </option>
                  ))}
              </datalist>
              <datalist id="authoring-tags">
                {file
                  && [...new Set(file.features.flatMap((feature) => feature.tags ?? []))]
                    .sort()
                    .map((tag) => (
                      <option
                        value={tag}
                        key={tag}
                      >
                        {file.configurations[configuration].system.tagDisplayNames?.[tag] ?? tag}
                      </option>
                    ))}
              </datalist>
            </fieldset>
          )}
      {message && (
        <p
          role={failed ? 'alert' : 'status'}
          className={failed ? 'notice invalid' : 'notice'}
        >
          {message}
        </p>
      )}
    </section>
  );
}
