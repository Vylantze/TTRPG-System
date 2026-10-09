import type { Engine, FeatureDefinition } from '@/src/index';
import { featureName } from '@/ui/src/display';
import { safeReturn } from '@/ui/src/feature-origin';

export function featureHref(id: string, engine: Engine, origin?: string) {
  const params = new URLSearchParams({ system: engine.catalogue.system.id, revision: String(engine.catalogue.system.revision), catalogue: engine.catalogue.id });
  const current = origin ?? (typeof window !== 'undefined' ? window.location.hash : undefined);
  if (current) {
    const [path, search] = current.split('?'), back = new URLSearchParams(search);
    const previous = safeReturn(back.get('returnTo'));
    if (previous && path.startsWith('#features/')) params.set('returnTo', previous);
    else if (safeReturn(current)) {
      if (path.startsWith('#classes') || path.startsWith('#features')) for (const [key, value] of params) back.set(key, value);
      params.set('returnTo', `${path}?${back}`);
    }
  }
  return `#features/${encodeURIComponent(id)}?${params}`;
}

/** The surrounding UI already displays this title. Keep all other source headings. */
export function descriptionBody(feature: FeatureDefinition): string | undefined {
  const text = feature.description;
  if (!text) return text;
  const end = text.indexOf('\n');
  if (end < 0) return text;
  const normalize = (value: string) => value.trim().replace(/[’‘ʼ]/g, '\'').toLocaleLowerCase();
  return normalize(text.slice(0, end)) === normalize(featureName(feature)) ? text.slice(end + 1).trimStart() : text;
}
export const featureDescription = (feature: FeatureDefinition, engine: Engine) => descriptionBody(feature) ?? feature.textReferences?.map((id) => {
  const reference = engine.catalogue.features.find((f) => f.id === id);
  return reference ? descriptionBody(reference) ?? '' : '';
}).filter(Boolean).join('\n\n');
export const descriptionPreview = (text?: string) => text ? text.replace(/\s+/g, ' ').slice(0, 160) + (text.length > 160 ? '…' : '') : undefined;
