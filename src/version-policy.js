/** Shared release policy used by the engine, browser, and commit hook. */

/** @param {unknown} value @returns {value is string} */
export function isReleaseVersion(value) {
  return typeof value === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)
    && value.split('.').every((part) => Number.isSafeInteger(Number(part)));
}

/** Read old integer releases without changing character revision pins.
 * @param {unknown} value @returns {string} */
export function releaseVersion(value) {
  if (value === undefined) return '1.0.0';
  if (Number.isSafeInteger(value) && Number(value) > 0) return `1.0.${Number(value) - 1}`;
  if (!isReleaseVersion(value)) throw new Error('Release version must be major.minor.patch.');
  return value;
}

/** @param {unknown} first @param {unknown} second */
export function compareVersions(first, second) {
  const a = releaseVersion(first).split('.').map(Number), b = releaseVersion(second).split('.').map(Number);
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  return 0;
}

/** @param {unknown} previous @param {'patch'|'minor'|'major'} change */
export function bumpVersion(previous, change) {
  const values = releaseVersion(previous).split('.').map(Number);
  const index = change === 'major' ? 0 : change === 'minor' ? 1 : 2;
  if (values[index] === Number.MAX_SAFE_INTEGER) throw new Error('Release version cannot be incremented.');
  values[index]++;
  for (let next = index + 1; next < 3; next++) values[next] = 0;
  return values.join('.');
}

/** @param {unknown} previous @param {unknown} next @returns {'none'|'patch'|'minor'|'major'} */
export function versionChange(previous, next) {
  if (compareVersions(next, previous) <= 0) return 'none';
  const a = releaseVersion(previous).split('.'), b = releaseVersion(next).split('.');
  return a[0] !== b[0] ? 'major' : a[1] !== b[1] ? 'minor' : 'patch';
}

const presentation = new Set(['name', 'displayName', 'description', 'source', 'textReferences', 'textAliases', 'textLinkContext', 'processDescriptionAutomatically', 'descriptionOverride', 'tagDisplayNames', 'label', 'title', 'placeholder', 'help', 'notes']);
const releaseFields = new Set(['contentVersion', 'assetVersion', 'assetVersions']);
const rank = { none: 0, patch: 1, minor: 2, major: 3 };

/** Conservative JSON change classifier. Only explicitly display-only fields qualify for a patch.
 * Removed definitions/fields or identity/format changes are major; other rules/layout changes are minor.
 * @param {unknown} previous @param {unknown} next @returns {'none'|'patch'|'minor'|'major'} */
export function classifyReleaseChange(previous, next) {
  /** @type {'none'|'patch'|'minor'|'major'} */
  let change = 'none';
  /** @param {'patch'|'minor'|'major'} value */
  const promote = (value) => {
    if (rank[value] > rank[change]) change = value;
  };
  /** @param {unknown} a @param {unknown} b @param {string} key */
  const visit = (a, b, key) => {
    if (JSON.stringify(a) === JSON.stringify(b) || releaseFields.has(key)) return;
    if (presentation.has(key)) {
      promote('patch');
      return;
    }
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      if (Array.isArray(a) && Array.isArray(b)) {
        const identified = [...a, ...b].every((item) => item && typeof item === 'object' && typeof item.id === 'string');
        if (identified) {
          const before = new Map(a.map((item) => [item.id, item])), after = new Map(b.map((item) => [item.id, item]));
          for (const [id, item] of before) {
            if (!after.has(id)) promote('major');
            else visit(item, after.get(id), '');
          }
          for (const id of after.keys()) if (!before.has(id)) promote('minor');
          if (JSON.stringify([...before.keys()]) !== JSON.stringify([...after.keys()])) promote('minor');
        } else {
          if (b.length < a.length) promote('major');
          if (b.length > a.length) promote('minor');
          if (['values', 'ids'].includes(key) && a.some((item) => !b.includes(item))) promote('major');
          a.forEach((item, index) => {
            if (index < b.length) visit(item, b[index], '');
          });
        }
        return;
      }
      if (!Array.isArray(a) && !Array.isArray(b)) {
        const before = /** @type {Record<string, unknown>} */ (a), after = /** @type {Record<string, unknown>} */ (b);
        for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
          // Capability names can be referenced by command policies; they are not just labels.
          if (field === 'name' && (before.kind === 'grantCapability' || after.kind === 'grantCapability') && before.name !== after.name) promote('minor');
          else visit(before[field], after[field], field);
        }
        return;
      }
    }
    promote(b === undefined || ['id', 'revision', 'format', 'version'].includes(key) || (a !== undefined && typeof a !== typeof b) ? 'major' : 'minor');
  };
  visit(previous, next, '');
  return change;
}
