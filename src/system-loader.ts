import { Engine, clone } from './engine.js';
import { RuleError } from './expression.js';
import { record, checkCharacter } from './validation.js';
import type { Catalogue, Character, Value } from './model.js';

export interface SystemFile {
  format: 'ttrpg-system'; version: 1; id: string; revision: number;
  options: Record<string, { default: Value; values: Value[] }>;
  features: Catalogue['features'];
  configurations: { options: Record<string, Value>; id: string; revision: number;
    system: Catalogue['system']; classes: Catalogue['classes'] }[];
}
function safe(value: unknown, depth = 0): void {
  if (depth > 96) throw new RuleError('SYSTEM_JSON', 'System data is too deep.');
  if (Array.isArray(value)) { if (value.length > 10000) throw new RuleError('SYSTEM_JSON', 'Array exceeds limit.'); value.forEach(v => safe(v, depth + 1)); }
  else if (value && typeof value === 'object') { record(value); Object.values(value).forEach(v => safe(v, depth + 1)); }
  else if (!['string','number','boolean'].includes(typeof value) && value !== null) throw new RuleError('SYSTEM_JSON', 'System data must contain only JSON values.');
  if (typeof value === 'number' && !Number.isFinite(value)) throw new RuleError('SYSTEM_JSON', 'Nonfinite number.');
}
const scalar = (v: unknown): v is Value => typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v));
const signature = (options: Record<string, Value>): string => JSON.stringify(Object.entries(options).sort(([a],[b]) => a.localeCompare(b)));

/** Browser-safe parsing: no fetch, filesystem access, imports, or executable JSON. */
export function parseSystemFile(input: string | unknown): SystemFile {
  let parsed: unknown = input;
  if (typeof input === 'string') {
    if (new TextEncoder().encode(input).length > 10_000_000) throw new RuleError('SYSTEM_SIZE', 'System file exceeds 10 MB.');
    try { parsed = JSON.parse(input); } catch { throw new RuleError('SYSTEM_JSON', 'Invalid System JSON.'); }
  }
  safe(parsed); record(parsed);
  if (parsed.format !== 'ttrpg-system' || parsed.version !== 1 || typeof parsed.id !== 'string' || !parsed.id || !Number.isInteger(parsed.revision) || Number(parsed.revision) < 1) throw new RuleError('SYSTEM_VERSION', 'Invalid or unsupported System file.');
  record(parsed.options);
  for (const option of Object.values(parsed.options)) {
    record(option);
    if (!scalar(option.default) || !Array.isArray(option.values) || !option.values.length || option.values.some(v => !scalar(v)) || !option.values.includes(option.default) || new Set(option.values).size !== option.values.length) throw new RuleError('SYSTEM_OPTIONS', 'Invalid option domain or default.');
  }
  if (!Array.isArray(parsed.features) || !Array.isArray(parsed.configurations) || !parsed.configurations.length) throw new RuleError('SYSTEM_JSON', 'System needs Features and configurations.');
  const file = parsed as unknown as SystemFile, seen = new Set<string>(), ids = new Set<string>();
  for (const config of file.configurations) {
    record(config); record(config.options);
    if (Object.keys(config.options).length !== Object.keys(file.options).length || Object.entries(file.options).some(([key, domain]) => !Object.hasOwn(config.options,key) || !domain.values.includes(config.options[key]))) throw new RuleError('SYSTEM_OPTIONS', 'Configuration does not match option domains.');
    const key = signature(config.options);
    if (seen.has(key) || ids.has(config.id)) throw new RuleError('SYSTEM_OPTIONS', 'Duplicate configuration or catalogue ID.');
    seen.add(key); ids.add(config.id);
    record(config.system);
    if (config.system.id !== file.id || config.system.revision !== file.revision) throw new RuleError('SYSTEM_ID', 'Configuration System identity differs from file identity.');
    // Validate every configuration before publishing any of the file.
    new Engine({ id: config.id, revision: config.revision, system: config.system, classes: config.classes, features: file.features });
  }
  const combinations = Object.values(file.options).reduce((n, d) => n * d.values.length, 1);
  if (seen.size !== combinations) throw new RuleError('SYSTEM_OPTIONS', 'Missing option configurations.');
  return clone(file);
}
/** Select a declarative configuration; saves retain its existing catalogue identity. */
export function catalogueFromSystemFile(input: unknown, settings: Record<string, Value> = {}): Catalogue {
  return selectCatalogue(parseSystemFile(input), settings);
}
function selectCatalogue(file: SystemFile, settings: Record<string, Value>): Catalogue {
  record(settings);
  if (Object.values(settings).some(v => !scalar(v)) || Object.keys(settings).some(k => !Object.hasOwn(file.options,k))) throw new RuleError('SYSTEM_OPTIONS', 'Unknown System option.');
  const options = Object.fromEntries(Object.entries(file.options).map(([key, domain]) => [key, settings[key] ?? domain.default]));
  if (Object.entries(options).some(([key,v]) => !file.options[key].values.includes(v))) throw new RuleError('SYSTEM_OPTIONS', 'Invalid System option value.');
  const config = file.configurations.find(c => signature(c.options) === signature(options))!;
  return clone({ id: config.id, revision: config.revision, system: config.system, classes: config.classes, features: file.features });
}

/** Registry ownership controls availability; unloading never edits character saves. */
export class SystemRegistry {
  private files = new Map<string, SystemFile>();
  private key(id: string, revision: number): string { return JSON.stringify([id, revision]); }
  load(input: unknown): { id: string; revision: number } {
    const file = parseSystemFile(input), key = this.key(file.id,file.revision);
    if (this.files.has(key)) throw new RuleError('SYSTEM_LOADED', 'System revision is already loaded; unload it before replacement.');
    for (const loaded of this.files.values()) for (const config of file.configurations) if (loaded.configurations.some(c => c.id === config.id && c.revision === config.revision)) throw new RuleError('CATALOGUE_CONFLICT', 'Catalogue identity is already supplied by another loaded System.');
    this.files.set(key,file); return { id: file.id, revision: file.revision };
  }
  unload(id: string, revision: number): boolean { return this.files.delete(this.key(id,revision)); }
  list(): { id: string; revision: number; name: string; options: SystemFile['options'] }[] {
    return [...this.files.values()].map(f => ({ id: f.id, revision: f.revision, name: f.configurations[0].system.name, options: clone(f.options) }));
  }
  createEngine(id: string, revision: number, options: Record<string, Value> = {}): Engine {
    const file = this.files.get(this.key(id,revision));
    if (!file) throw new RuleError('SYSTEM_UNAVAILABLE', 'Required System revision is not loaded.');
    return new Engine(selectCatalogue(file,options));
  }
  engineForCharacter(character: Character): Engine {
    checkCharacter(character);
    const file = this.files.get(this.key(character.system.id,character.system.revision));
    const config = file?.configurations.find(c => c.id === character.catalogue.id && c.revision === character.catalogue.revision);
    if (!file || !config) throw new RuleError('SYSTEM_UNAVAILABLE', 'The saved System and catalogue revisions must be loaded.');
    return new Engine(selectCatalogue(file,config.options));
  }
}

export function getFeatureCoverage(catalogue: Catalogue) {
  return catalogue.features.map(f => ({ feature: f.id, name: f.name, source: f.source, clauses: f.components.map(c => ({
    component: c.id, kind: c.kind,
    status: c.kind === 'describe' ? 'descriptive' : c.kind === 'grantCapability' ? 'partial' : 'automated',
    note: c.kind === 'grantCapability' ? 'Availability, action budget and resource costs are enforced; effect and triggers require adjudication.' : c.kind === 'describe' ? 'Displayed rule text; no automatic state changes.' : 'Engine evaluates this component.'
  })) }));
}
