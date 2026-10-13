import { assetData, deserializeCharacter } from '@/src/index';
import starterUrl from '@/src/systems/dnd5e-2014/starter-characters.json?url';
import multiclassUrl from '@/src/systems/dnd5e-2014/multiclass-sample.json?url';

let pending: Promise<ReturnType<typeof deserializeCharacter>[]> | undefined;
export function loadPrototypeTemplates() {
  pending ??= readTemplates().catch((error: unknown) => {
    pending = undefined;
    throw error;
  });
  return pending.then((templates) => structuredClone(templates));
}
async function readTemplates() {
  const results = await Promise.all(
    [starterUrl, multiclassUrl].map(async (url) => {
      const response = await fetch(url, { cache: import.meta.env.DEV ? 'no-store' : 'default' });
      if (!response.ok)
        throw new Error(
          'Sample characters could not be loaded. Existing characters have been preserved.',
        );
      const data = assetData(await response.json());
      return (Array.isArray(data) ? data : [data]).map((save) =>
        deserializeCharacter(JSON.stringify(save)),
      );
    }),
  );
  return results.flat();
}
