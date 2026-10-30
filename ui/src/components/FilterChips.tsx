/** A labelled row of toggle chips; several can be selected at once. */
export function FilterChips({
  label,
  options,
  selected,
  toggle,
}: {
  label: string;
  options: { value: string; label: string; count?: number }[];
  selected: string[];
  toggle: (value: string) => void;
}) {
  if (!options.length) return null;
  return (
    <div
      className="filter-chips"
      role="group"
      aria-label={label}
    >
      <span className="filter-label">{label}</span>
      <div className="chips">
        {options.map((option) => (
          <button
            key={option.value}
            className={`chip${selected.includes(option.value) ? ' selected' : ''}`}
            aria-pressed={selected.includes(option.value)}
            onClick={() => toggle(option.value)}
          >
            {option.label}
            {option.count !== undefined && <span className="chip-count">{option.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
