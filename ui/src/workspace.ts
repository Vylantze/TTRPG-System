import { SystemRegistry, parseSystemFile, deserializeCharacter, serializeCharacter, type SystemFile, type Character } from '../../src/index';

export const STORAGE_KEY = 'ttrpg-feature-forge:v1';
export interface Workspace { version: 1; systems: SystemFile[]; characters: Character[]; active?: string }

/** Storage-only deduplication; imported/exported System JSON retains its engine format. */
function packSystem(file:SystemFile) {
  const classes:SystemFile['configurations'][number]['classes'][]=[],stats:SystemFile['configurations'][number]['system']['stats'][]=[];
  const classKeys:string[]=[],statKeys:string[]=[];
  const intern=<T,>(value:T,values:T[],keys:string[])=>{const key=JSON.stringify(value),index=keys.indexOf(key);if(index>=0)return index;keys.push(key);values.push(value);return values.length-1;};
  return {definition:{...file,configurations:undefined},classes,stats,configurations:file.configurations.map(c=>({...c,classes:intern(c.classes,classes,classKeys),system:{...c.system,stats:intern(c.system.stats,stats,statKeys)}}))};
}
function unpackSystem(packed:ReturnType<typeof packSystem>):SystemFile {
  if(!packed||!Array.isArray(packed.classes)||!Array.isArray(packed.stats)||!Array.isArray(packed.configurations))throw new Error('Stored System data is malformed.');
  const item=<T,>(values:T[],index:number)=>{if(!Number.isInteger(index)||index<0||index>=values.length)throw new Error('Stored System has an invalid shared-data reference.');return values[index];};
  return {...packed.definition,configurations:packed.configurations.map(c=>({...c,classes:item(packed.classes,c.classes),system:{...c.system,stats:item(packed.stats,c.system.stats)}}))};
}
export function readWorkspace(storage: Pick<Storage, 'getItem'>): Workspace {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return {version:1,systems:[],characters:[]};
  const value = JSON.parse(raw);
  if (![1,2].includes(value.version) || !Array.isArray(value.systems) || !Array.isArray(value.characters)) throw new Error('Stored workspace has an unsupported format. Export or repair it before replacing it.');
  const registry = new SystemRegistry();
  const systems = value.systems.map((s: unknown) => { const file = parseSystemFile(value.version===2?unpackSystem(s as ReturnType<typeof packSystem>):s); registry.load(file); return file; });
  const characters = value.characters.map((c: unknown) => deserializeCharacter(JSON.stringify(c)));
  if (new Set(characters.map((c: Character) => c.id)).size !== characters.length) throw new Error('Stored character IDs are duplicated.');
  return {version:1,systems,characters,active:typeof value.active === 'string' ? value.active : undefined};
}
export function writeWorkspace(storage: Pick<Storage, 'setItem'>, workspace: Workspace): void {
  // Serialization validates saves; errors propagate so the UI never claims success.
  workspace.characters.forEach(serializeCharacter);
  storage.setItem(STORAGE_KEY, JSON.stringify({...workspace,version:2,systems:workspace.systems.map(packSystem)}));
}

/** A display-only refresh must not silently replace a character's pinned rules. */
export function updateSystemDescriptions(existing:SystemFile,incoming:SystemFile):SystemFile {
  const validated=parseSystemFile(incoming);
  // Tags used by predicates or candidate/root filters are mechanical. Other
  // category tags can be refreshed alongside labels without changing rules.
  const ruleTags=new Set<string>();
  const visit=(value:unknown):void=>{if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object'){
    const object=value as Record<string,unknown>;if(typeof object.tag==='string')ruleTags.add(object.tag);
    for(const key of ['candidates','rootCandidates']){const tags=(object[key] as {tags?:string[]}|undefined)?.tags;if(Array.isArray(tags))tags.forEach(tag=>ruleTags.add(tag));}
    Object.values(object).forEach(visit);
  }};
  visit(existing);visit(validated);
  const strip=(definition:{description?:string;source?:string;textReferences?:string[];textAliases?:string[];displayName?:string})=>{const {description,source,textReferences,textAliases,displayName,...rules}=definition;return rules;};
  const featureRules=(feature:SystemFile['features'][number])=>{const {tags,...rules}=strip(feature) as SystemFile['features'][number];const mechanicalTags=tags?.filter(tag=>ruleTags.has(tag));return {...rules,...(mechanicalTags?.length?{tags:mechanicalTags}:{})};};
  const rules=(file:SystemFile)=>({...file,features:file.features.map(featureRules),configurations:file.configurations.map(c=>{const {tagDisplayNames,...system}=c.system;return {...c,system,classes:c.classes.map(strip)};})});
  const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)])):value;
  if(JSON.stringify(canonical(rules(existing)))!==JSON.stringify(canonical(rules(validated))))throw new Error('Bundled rules differ from this loaded System. Description refresh cannot replace its rules. Export the System before unloading or migrating it.');
  return validated;
}
/** Replace only the snapshot that was checked, preserving concurrent edits and unloads. */
export function applyDescriptionUpdate(workspace:Workspace,existing:SystemFile,updated:SystemFile):Workspace {
  if(!workspace.systems.includes(existing)||JSON.stringify(existing)===JSON.stringify(updated))return workspace;
  return {...workspace,systems:workspace.systems.map(file=>file===existing?updated:file)};
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
