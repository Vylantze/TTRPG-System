import type { SystemFile } from '@/src/index';
import { systemKey } from '@/ui/src/lib/workspace';

/** Slim top bar and main text tabs; replaces the former navigation sidebar. */
export function AppHeader({
  page,
  systems,
  selectedSystem,
  selectSystem,
  saved,
  characterCount,
  classPlural,
  creaturePlural,
  createCharacter,
}: {
  page: string;
  systems: SystemFile[];
  selectedSystem?: SystemFile;
  selectSystem: (key: string) => void;
  saved: boolean;
  characterCount: number;
  classPlural: string;
  creaturePlural: string;
  createCharacter?: () => void;
}) {
  const tabs: [string, string][] = [
    ['characters', 'Characters'],
    ['classes', classPlural],
    ['races', creaturePlural],
    ['features', 'Features'],
    ['systems', 'Systems'],
    ['system-data', 'System data'],
  ];
  return (
    <header className="app-header">
      <div className="topbar">
        <a
          href="#characters"
          className="brand"
        >
          <img
            className="brand-icon"
            src={`${import.meta.env.BASE_URL}wizard-die.svg`}
            alt=""
            width="28"
            height="28"
          />
          <span>Feature Forge</span>
        </a>
        <div className="topbar-actions">
          {selectedSystem && (
            <label className="system-switch">
              <span>System</span>
              <select
                aria-label="Browse System"
                value={systemKey(selectedSystem)}
                onChange={(e) => selectSystem(e.target.value)}
              >
                {systems.map((s) => (
                  <option
                    key={systemKey(s)}
                    value={systemKey(s)}
                  >
                    {s.configurations[0].system.name}
                    {' · r'}
                    {s.revision}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span
            className={`status-chip${saved ? '' : ' unsaved'}`}
            role="status"
            title={saved ? 'Saved in the local browser database' : 'Changes not saved yet'}
          >
            <span
              className="status-dot"
              aria-hidden="true"
            />
            <span className="status-text">{saved ? 'Saved' : 'Not saved'}</span>
          </span>
          {createCharacter && (
            <button
              className="new-character"
              onClick={createCharacter}
            >
              New character
            </button>
          )}
        </div>
      </div>
      <nav
        className="main-tabs"
        aria-label="Main navigation"
      >
        {tabs.map(([id, title]) => (
          <a
            href={`#${id}`}
            className={page === id ? 'active' : undefined}
            aria-current={page === id ? 'page' : undefined}
            key={id}
          >
            {title}
            {id === 'characters' && characterCount > 0 && (
              <span className="count">{characterCount}</span>
            )}
          </a>
        ))}
      </nav>
    </header>
  );
}
