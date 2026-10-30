/** Small ring with a label, for the one part of the page that is waiting. */
export function Spinner({ label }: { label: string }) {
  return (
    <span
      className="spinner"
      role="status"
    >
      <span
        className="spinner-ring"
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
