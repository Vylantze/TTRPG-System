import { version } from '@/ui/package.json';

export function UiVersion() {
  return (
    <div
      className="ui-version"
      aria-label={`UI version ${version}`}
    >
      {version}
    </div>
  );
}
