import { useRef, useState } from 'react';

export function SystemLoader({
  loading,
  bundledLoaded,
  loadBundled,
  loadFile,
}: {
  loading: boolean;
  bundledLoaded: boolean;
  loadBundled: () => void;
  loadFile: (files: File[]) => void;
}) {
  const [source, setSource] = useState('dnd2014');
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="toolbar system-loader">
      <label>
        System to load
        <select
          value={source}
          disabled={loading}
          onChange={(event) => setSource(event.target.value)}
        >
          <option value="dnd2014">
            DnD5e 2014
            {bundledLoaded ? ' — loaded' : ''}
          </option>
          <option value="json">Other System from JSON…</option>
        </select>
      </label>
      <button
        disabled={loading || (source === 'dnd2014' && bundledLoaded)}
        onClick={() => (source === 'json' ? input.current?.click() : loadBundled())}
      >
        {loading ? 'Loading…' : source === 'json' ? 'Choose JSON files' : 'Load System'}
      </button>
      <input
        ref={input}
        hidden
        type="file"
        multiple
        accept=".json,application/json"
        aria-label="Load System JSON"
        disabled={loading}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) loadFile(files);
          event.target.value = '';
        }}
      />
    </div>
  );
}
