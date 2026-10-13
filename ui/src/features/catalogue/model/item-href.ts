import type { Engine } from '@/src/index';

export function itemHref(id: string, engine: Engine): string {
  const query = new URLSearchParams({
    system: engine.catalogue.system.id,
    revision: String(engine.catalogue.system.revision),
    catalogue: engine.catalogue.id,
  });
  if (typeof window !== 'undefined') query.set('returnTo', window.location.hash);
  return `#items/${encodeURIComponent(id)}?${query}`;
}
