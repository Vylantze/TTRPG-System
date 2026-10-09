import { useRef } from 'react';

export function ReloadSystemButton({ name, loading, bundled, reload }: { name: string; loading: boolean; bundled: boolean; reload: (file?: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button className="quiet" disabled={loading} title={bundled ? 'Reload the latest bundled System' : 'Choose an updated JSON file for this System'} aria-label={`Reload ${name}`} onClick={() => bundled ? reload() : input.current?.click()}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 7v5h-5M4 17v-5h5" />
          <path d="M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9" />
        </svg>
        Reload System
      </button>
      <input
        ref={input}
        hidden
        type="file"
        accept=".json,application/json"
        aria-label={`Replacement JSON for ${name}`}
        disabled={loading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) reload(file);
          event.target.value = '';
        }}
      />
    </>
  );
}
