import { deserializeCharacter } from '@/src/index';
import starterUrl from '@/src/systems/dnd5e-2014/starter-characters.json?url';
import multiclassUrl from '@/src/systems/dnd5e-2014/multiclass-sample.json?url';

export async function loadPrototypeTemplates() {
  const results = await Promise.all([starterUrl, multiclassUrl].map(async (url) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('Sample characters could not be loaded. Existing characters have been preserved.');
    const data: unknown = await response.json();
    return (Array.isArray(data) ? data : [data]).map((save) => deserializeCharacter(JSON.stringify(save)));
  }));
  return results.flat();
}
