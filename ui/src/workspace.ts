import { SystemRegistry, parseSystemFile, deserializeCharacter, serializeCharacter, type SystemFile, type Character } from '../../src/index';

export const STORAGE_KEY = 'ttrpg-feature-forge:v1';
export interface Workspace { version: 1; systems: SystemFile[]; characters: Character[]; active?: string }
export function readWorkspace(storage: Pick<Storage, 'getItem'>): Workspace {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return {version:1,systems:[],characters:[]};
  const value = JSON.parse(raw);
  if (value.version !== 1 || !Array.isArray(value.systems) || !Array.isArray(value.characters)) throw new Error('Stored workspace has an unsupported format. Export or repair it before replacing it.');
  const registry = new SystemRegistry();
  const systems = value.systems.map((s: unknown) => { const file = parseSystemFile(s); registry.load(file); return file; });
  const characters = value.characters.map((c: unknown) => deserializeCharacter(JSON.stringify(c)));
  if (new Set(characters.map((c: Character) => c.id)).size !== characters.length) throw new Error('Stored character IDs are duplicated.');
  return {version:1,systems,characters,active:typeof value.active === 'string' ? value.active : undefined};
}
export function writeWorkspace(storage: Pick<Storage, 'setItem'>, workspace: Workspace): void {
  // Serialization validates saves; errors propagate so the UI never claims success.
  workspace.characters.forEach(serializeCharacter);
  storage.setItem(STORAGE_KEY, JSON.stringify(workspace));
}
export function createRegistry(files: SystemFile[]): SystemRegistry {
  const registry = new SystemRegistry(); files.forEach(f => registry.load(f)); return registry;
}
export const systemKey = (s: {id: string; revision: number}) => JSON.stringify([s.id,s.revision]);
export const labelFromId = (value: string) => value.split(/[/:]/).at(-1)!.replace(/[.-]/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,letter=>letter.toUpperCase());
export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text],{type:'application/json'}));
  const anchor = document.createElement('a'); anchor.href=url; anchor.download=name; anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
