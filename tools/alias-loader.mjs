const root = new URL('../', import.meta.url);

export function resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('@/') ? new URL(specifier.slice(2), root).href : specifier, context);
}
