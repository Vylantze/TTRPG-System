import { checkMoney, moneyTotal } from '@/src/currency.js';
import { inventoryModifiers, checkInventory } from '@/src/items.js';
import { RuleError, boolean, constrain, evaluateExpression, number, type Environment } from '@/src/expression.js';
import type { Catalogue, Character, Choice, Diagnostic, Expression, FunctionRegistry, Instance, Value,
  Predicate, EvaluationResult, StatResult, Modifier, ModifierExplanation, PoolResult, Resource,
  ResourceRequirement, Candidate, Pick, Progression, RootAcquisition } from '@/src/model.js';
import type { StatView } from '@/src/types/StatView.js';
import type { ClassLevel } from '@/src/types/ClassLevel.js';
import type { FeatureAdvancement } from '@/src/types/FeatureAdvancement.js';
import { checkCharacter, validateCatalogue } from '@/src/validation.js';
import { compileBlocks } from '@/src/blocks.js';
import { trackerPools, storeTrackers } from '@/src/resource-trackers.js';

export const segment = (id: string): string => encodeURIComponent(id);
export const rootPath = (id: string): string => `root/${segment(id)}`;
export const classEntryPath = (progression: string, level: number, entry: string): string => `class/${segment(progression)}/${level}/${segment(entry)}`;
export const childPath = (parent: string, component: string): string => `${parent}/grant/${segment(component)}`;
export const selectionPath = (parent: string, component: string): string => `${parent}/choice/${segment(component)}`;
export const pickPath = (selection: string, entry: string): string => `${selection}/pick/${segment(entry)}`;
export const clone = <T>(v: T): T => structuredClone(v);
function freeze<T>(v: T): T {
  if (v && typeof v === 'object') {
    Object.values(v).forEach(freeze);
    Object.freeze(v);
  }
  return v;
}
function diagnostic(error: unknown, path: string): Diagnostic {
  const e = error instanceof RuleError ? error : new RuleError('EVALUATION', error instanceof Error ? error.message : String(error));
  return { code: e.code, message: e.message, severity: 'invalid', path: e.path || path };
}
export class Engine {
  /** Catalogue lookup; definitions are frozen with the engine's catalogue. */
  getFeature(id: string): Catalogue['features'][number] | undefined {
    return this.features.get(id);
  }

  getStatDefinition(id: string): Catalogue['system']['stats'][number] | undefined {
    return this.catalogue.system.stats.find((s) => s.id === id) ?? this.catalogue.features.flatMap((f) => f.components.flatMap((c) => c.kind === 'defineStat' ? [c.stat] : [])).find((s) => s.id === id);
  }

  /** Authored levels, in numerical order. No character state or rules are changed. */
  getClassLevels(classId: string): ClassLevel[] {
    const cls = this.catalogue.classes.find((item) => item.id === classId);
    return Object.entries(cls?.levels ?? {}).sort(([a, b]) => Number(a) - Number(b))
      .map(([level, entries]) => ({ level: Number(level), entries: [...entries] }));
  }

  /** Structural candidates only. Call getCandidates to check a character's eligibility,
   * including dynamic level limits, prerequisites, conditions and resource contracts. */
  getSelectionFeatures(choice: Choice): Catalogue['features'] {
    return this.catalogue.features.filter((feature) => (!choice.candidates.ids || choice.candidates.ids.includes(feature.id))
      && (!choice.candidates.tags || choice.candidates.tags.every((tag) => feature.tags?.includes(tag))));
  }

  /** Direct Class grants and selection pools, not a promise of character eligibility. */
  getFeatureAdvancement(featureId: string): FeatureAdvancement[] {
    if (!this.getFeature(featureId)) return [];
    return this.catalogue.classes.flatMap((cls) => {
      const levels = this.getClassLevels(cls.id).filter((row) => row.entries.some((entry) => entry.kind === 'grantFeature'
        ? entry.feature === featureId
        : this.getSelectionFeatures(entry).some((feature) => feature.id === featureId))).map((row) => row.level);
      return levels.length ? [{ classId: cls.id, className: cls.name, levels }] : [];
    });
  }

  readonly catalogue: Catalogue;
  private readonly features: Map<string, Catalogue['features'][number]>;
  constructor(catalogue: Catalogue, private functions: FunctionRegistry = {}) {
    catalogue = compileBlocks(catalogue);
    const errors = validateCatalogue(catalogue, functions);
    if (errors.length) throw new RuleError(errors[0].code, errors[0].message, errors[0].path);
    this.catalogue = freeze(clone(catalogue));
    this.features = new Map(this.catalogue.features.map((f) => [f.id, f]));
  }

  resolveDefinition(id: string, revision?: number) {
    const result = this.features.get(id) ?? this.catalogue.classes.find((c) => c.id === id) ?? (this.catalogue.system.id === id ? this.catalogue.system : undefined);
    if (!result || (revision !== undefined && result.revision !== revision)) throw new RuleError('REVISION', `Unknown definition or revision ${id}.`);
    return result;
  }

  evaluateForInstance(character: Character, expression: Expression, instance: Instance, runtime: Record<string, Value> = {}): number | boolean {
    const result = this.evaluate(character, runtime);
    if (result.status !== 'valid') throw new RuleError('INVALID_BUILD', 'Expression requires a valid, complete character.');
    return evaluateExpression(expression, this.environment(this.context(character, undefined, runtime, instance), (id) => {
      if (!result.stats[id]) throw new RuleError('UNKNOWN_STAT', id);
      return result.stats[id].value;
    }, instance));
  }

  createCharacter(id: string, name: string, progressions: Progression[] = [], roots: RootAcquisition[] = [], options: { draft?: boolean } = {}): Character {
    const c = this.catalogue;
    const character: Character = {
      version: 1, id, name, system: { id: c.system.id, revision: c.system.revision }, catalogue: { id: c.id, revision: c.revision },
      ...(options.draft ? { buildState: 'draft' as const } : {}),
      contentRevisions: Object.fromEntries([...c.features, ...c.classes].map((f) => [f.id, f.revision])),
      inputs: Object.fromEntries(c.system.stats.filter((s) => s.kind === 'input' && s.default !== undefined).map((s) => [s.id, s.kind === 'input' ? s.default! : 0])),
      progressions: clone(progressions), history: progressions.flatMap((p) => Array.from({ length: p.level }, (_, i) => ({ progression: p.id, level: i + 1 }))),
      roots: clone(roots), selections: {}, bindings: {}, alternatives: {}, resources: {}, pending: {}, events: [],
    };
    checkCharacter(character);
    const result = this.evaluate(character);
    for (const pool of Object.values(result.resources)) character.resources[pool.id] = { spent: pool.initial === 'empty' ? pool.capacity : 0 };
    storeTrackers(character, result.resources);
    return character;
  }

  private environment(context: Record<string, Value>, stats: (id: string) => number, instance?: Instance): Environment {
    return { context, stats, parameters: instance?.parameters ?? {}, owner: instance?.feature, features: this.features, functions: this.functions };
  }

  private context(character: Character, levels?: Record<string, number>, runtime: Record<string, Value> = {}, instance?: Instance): Record<string, Value> {
    const counts = levels ?? Object.fromEntries(character.progressions.map((p) => [p.id, p.level]));
    const values = Object.values(counts);
    const context: Record<string, Value> = { ...this.catalogue.system.contextDefaults, ...runtime,
      totalClassLevels: values.reduce((a, b) => a + b, 0), maximumClassLevel: Math.max(0, ...values),
      classLevel: instance?.progression ? counts[instance.progression] ?? 0 : 0,
      acquiredClassLevel: instance?.acquiredClassLevel ?? 0, acquiredCharacterLevel: instance?.acquiredCharacterLevel ?? 0 };
    context.isStartingClass = !!instance?.progression && character.history[0]?.progression === instance.progression;
    for (const p of character.progressions) context[`class.${p.id}`] = counts[p.id] ?? 0;
    context.classCount = character.progressions.filter((p) => (counts[p.id] ?? 0) > 0).length;
    for (const cls of this.catalogue.classes) context[`level.${cls.id}`] = character.progressions.filter((p) => p.class === cls.id).reduce((sum, p) => sum + (counts[p.id] ?? 0), 0);
    const env = this.environment(context, () => {
      throw new RuleError('LEVEL_DEPENDENCY', 'Character level cannot depend on stats.');
    });
    context.characterLevel = constrain(number(evaluateExpression(this.catalogue.system.characterLevel, env)), { integer: true, minimum: 0 });
    return context;
  }

  private satisfies(p: Predicate | undefined, instance: Instance, instances: Instance[], stats: (id: string) => number, context: Record<string, Value>): boolean {
    if (!p) return true;
    if ('expression' in p) return boolean(evaluateExpression(p.expression, this.environment(context, stats, instance)));
    if ('all' in p) return p.all.every((x) => this.satisfies(x, instance, instances, stats, context));
    if ('any' in p) return p.any.some((x) => this.satisfies(x, instance, instances, stats, context));
    if ('not' in p) return !this.satisfies(p.not, instance, instances, stats, context);
    if ('level' in p) return number(context[p.kind === 'class' ? 'classLevel' : 'characterLevel']) >= p.level;
    if ('stat' in p) return stats(p.stat) >= p.minimum;
    if ('parameter' in p) return instance.parameters[p.parameter] === p.equals;
    if ('feature' in p) return instances.some((i) => i.eligible && i.feature === p.feature && Object.entries(p.parameters ?? {}).every(([k, v]) => i.parameters[k] === v));
    return instances.some((i) => i.eligible && this.features.get(i.feature)?.tags?.includes(p.tag));
  }

  private statView(character: Character, instances: Instance[], levels?: Record<string, number>, runtime: Record<string, Value> = {}): StatView {
    const results: Record<string, StatResult> = {}, visiting: string[] = [];
    const modifierSources = [...instances.map((instance) => ({ instance, components: this.features.get(instance.feature)!.components })), ...inventoryModifiers(character, this.catalogue)];
    const get = (id: string): number => {
      if (Object.hasOwn(results, id)) return results[id].value;
      if (visiting.includes(id)) throw new RuleError('STAT_CYCLE', `Stat dependency cycle: ${[...visiting, id].join(' -> ')}.`);
      const providers = instances.filter((i) => i.active && i.eligible).flatMap((instance) => this.features.get(instance.feature)!.components.flatMap((component) => component.kind === 'defineStat' && component.stat.id === id ? [{ instance, definition: component.stat }] : []));
      const definition = this.catalogue.system.stats.find((s) => s.id === id) ?? providers[0]?.definition;
      if (!definition) throw new RuleError('UNKNOWN_STAT', `Unknown stat ${id}.`);
      visiting.push(id);
      try {
        const globalEnv = this.environment(this.context(character, levels, runtime), get);
        const provider = providers[0]?.instance;
        const definitionEnv = provider ? this.environment(this.context(character, levels, runtime, provider), get, provider) : globalEnv;
        let base = definition.kind === 'input' ? constrain(number(character.inputs[id] ?? definition.default), definition, true) : number(evaluateExpression(definition.expression, definitionEnv));
        for (const other of providers.slice(1)) if (number(evaluateExpression(other.definition.expression, this.environment(this.context(character, levels, runtime, other.instance), get, other.instance))) !== base) throw new RuleError('STAT_CONFLICT', `Active providers disagree on ${id}.`);
        const alternatives = this.catalogue.system.alternatives?.[id];
        if (character.alternatives[id]) {
          const alternative = alternatives?.find((a) => a.id === character.alternatives[id]);
          const stub: Instance = { id: 'alternative', feature: '', parameters: {}, acquiredCharacterLevel: 0, acquiredClassLevel: 0, active: true, eligible: true, waived: false };
          if (!alternative || !this.satisfies(alternative.requirements, stub, instances, get, globalEnv.context)) throw new RuleError('ALTERNATIVE', `Unavailable alternative for ${id}.`);
          base = number(evaluateExpression(alternative.expression, globalEnv));
        }
        const explanations: ModifierExplanation[] = [], modifiers: { definition: Modifier; explanation: ModifierExplanation; amount: number }[] = [];
        for (const { instance, components } of modifierSources) for (const component of components) {
          if (component.kind !== 'modifyStat' || component.stat !== id) continue;
          const explanation: ModifierExplanation = { source: instance.id, component: component.id, operation: component.operation, applied: false, reason: 'Inactive Feature.' };
          explanations.push(explanation);
          if (!instance.active || !instance.eligible) {
            if (instance.active) explanation.reason = 'Ineligible Feature.';
            continue;
          }
          const env = { ...this.environment(this.context(character, levels, runtime, instance), get, instance), base };
          if (component.condition && !boolean(evaluateExpression(component.condition, env))) {
            explanation.reason = 'Condition is false.';
            continue;
          }
          const amount = number(evaluateExpression(component.value, env));
          explanation.amount = amount;
          explanation.applied = true;
          explanation.reason = 'Applied.';
          modifiers.push({ definition: component, explanation, amount });
        }
        const overrides = modifiers.filter((m) => m.definition.operation === 'override').sort((a, b) => (b.definition.priority ?? 0) - (a.definition.priority ?? 0));
        let value = base;
        if (overrides.length) {
          const highest = overrides[0];
          if (overrides.some((m) => (m.definition.priority ?? 0) === (highest.definition.priority ?? 0) && m.amount !== highest.amount)) throw new RuleError('OVERRIDE_CONFLICT', `Conflicting overrides for ${id}.`);
          value = highest.amount;
          for (const m of overrides.slice(1)) {
            m.explanation.applied = false;
            m.explanation.reason = 'Suppressed by selected override.';
          }
        }
        const groups = new Map<string, typeof modifiers>();
        for (const m of modifiers.filter((m) => m.definition.operation === 'add')) {
          const key = m.definition.group ?? 'untyped';
          groups.set(key, [...groups.get(key) ?? [], m]);
        }
        for (const members of groups.values()) {
          const policies = new Set(members.map((m) => m.definition.stacking ?? 'sum'));
          if (policies.size !== 1) throw new RuleError('STACKING_CONFLICT', `Conflicting stacking policies for ${id}.`);
          const policy = members[0].definition.stacking ?? 'sum';
          let selected = members;
          if (policy === 'highest') selected = [members.reduce((a, b) => a.amount >= b.amount ? a : b)];
          if (policy === 'lowest') selected = [members.reduce((a, b) => a.amount <= b.amount ? a : b)];
          if (policy === 'bestBonusAndWorstPenalty') {
            const positive = members.filter((m) => m.amount > 0).sort((a, b) => b.amount - a.amount)[0];
            const negative = members.filter((m) => m.amount < 0).sort((a, b) => a.amount - b.amount)[0];
            selected = [positive, negative].filter((m): m is typeof members[number] => !!m);
          }
          for (const m of members) if (!selected.includes(m)) {
            m.explanation.applied = false;
            m.explanation.reason = 'Suppressed by stacking policy.';
          }
          value += selected.reduce((sum, m) => sum + m.amount, 0);
        }
        for (const m of modifiers.filter((m) => m.definition.operation === 'multiply')) value *= m.amount;
        const floor = Math.max(-Infinity, ...modifiers.filter((m) => m.definition.operation === 'floor').map((m) => m.amount));
        const ceiling = Math.min(Infinity, ...modifiers.filter((m) => m.definition.operation === 'ceiling').map((m) => m.amount));
        if (floor > ceiling) throw new RuleError('BOUND_CONFLICT', `Floor exceeds ceiling for ${id}.`);
        value = constrain(Math.min(ceiling, Math.max(floor, value)), definition);
        results[id] = { base, value, modifiers: explanations };
        return value;
      } finally {
        visiting.pop();
      }
    };
    return { results, get };
  }

  private pools(character: Character, instances: Instance[], stats: StatView, levels?: Record<string, number>, runtime: Record<string, Value> = {}): Record<string, PoolResult> {
    const pools: Record<string, PoolResult> = {}, policies = new Map<string, Resource['combine']>();
    for (const instance of instances.filter((i) => i.active && i.eligible)) for (const component of this.features.get(instance.feature)!.components) {
      if (component.kind !== 'defineResource') continue;
      const env = this.environment(this.context(character, levels, runtime, instance), stats.get, instance);
      if (component.condition && !boolean(evaluateExpression(component.condition, env))) continue;
      const owner = component.scope === 'character' ? 'character' : component.scope === 'progression' ? instance.progression : component.scope === 'parent' ? instance.parent ?? instance.id : instance.id;
      if (!owner) throw new RuleError('RESOURCE_SCOPE', 'A progression resource needs a class progression.');
      const id = `pool/${component.scope}/${segment(owner)}/${segment(component.key)}`;
      const capacity = constrain(number(evaluateExpression(component.capacity, env)), { minimum: 0, ...component });
      if (capacity < 0) throw new RuleError('RESOURCE_CAPACITY', 'Resource capacity cannot be negative.');
      const prior = pools[id];
      if (prior) {
        if (prior.units !== component.units || prior.contract !== component.contract || prior.integer !== (component.integer ?? false) || policies.get(id) !== (component.combine ?? 'sum') || JSON.stringify(prior.recovery) !== JSON.stringify(component.recovery) || prior.initial !== (component.initial ?? 'full')) throw new RuleError('RESOURCE_CONFLICT', `Incompatible contributors to ${id}.`);
        prior.capacity = component.combine === 'highest' ? Math.max(prior.capacity, capacity) : prior.capacity + capacity;
        prior.providers.push(instance.id);
      } else {
        policies.set(id, component.combine ?? 'sum');
        pools[id] = { id, key: component.key, scope: component.scope, units: component.units, contract: component.contract, integer: component.integer ?? false, capacity,
          spent: 0, reserved: 0, available: 0, providers: [instance.id], recovery: component.recovery, initial: component.initial ?? 'full' };
      }
    }
    for (const pool of Object.values(pools)) {
      pool.capacity = number(pool.capacity);
      pool.spent = character.resources[pool.id]?.spent ?? (pool.initial === 'empty' ? pool.capacity : 0);
      pool.reserved = Object.values(character.pending).reduce((sum, use) => sum + (use.costs[pool.id] ?? 0), 0);
      constrain(pool.spent, { integer: pool.integer, minimum: 0 });
      constrain(pool.reserved, { integer: pool.integer, minimum: 0 });
      pool.available = Math.max(0, pool.capacity - pool.spent - pool.reserved);
    }
    const trackers = trackerPools(character, instances, this.features, (expression, instance) => evaluateExpression(expression, this.environment(this.context(character, levels, runtime, instance), stats.get, instance)));
    for (const [id, pool] of Object.entries(trackers)) {
      if (pools[id]) throw new RuleError('RESOURCE_CONFLICT', `Legacy pool and tracker share ${pool.key}.`);
      pools[id] = pool;
    }
    return pools;
  }

  private matchPool(character: Character, instance: Instance, requirement: ResourceRequirement, pools: Record<string, PoolResult>, allInstances: Instance[]): PoolResult {
    const visible = (p: PoolResult): boolean => p.providers.some((id) => {
      const provider = allInstances.find((i) => i.id === id)!;
      if (p.scope === 'character') return true;
      if (p.scope === 'progression') return provider.progression === instance.progression;
      if (p.scope === 'instance') return provider.id === instance.id;
      return (provider.parent ?? provider.id) === (instance.parent ?? instance.id);
    });
    const candidates = Object.values(pools).filter((p) => p.key === requirement.key && (!requirement.scope || p.scope === requirement.scope)
      && (!requirement.units || p.units === requirement.units) && (!requirement.contract || p.contract === requirement.contract)
      && (requirement.minimumCapacity === undefined || p.capacity >= requirement.minimumCapacity) && visible(p));
    const binding = character.bindings[`${instance.id}/${segment(requirement.id)}`];
    if (binding) {
      const match = candidates.find((p) => p.id === binding);
      if (match) return match;
      throw new RuleError('RESOURCE_BINDING', `Invalid pool binding for ${requirement.key}.`);
    }
    if (candidates.length === 1) return candidates[0];
    throw new RuleError(candidates.length ? 'AMBIGUOUS_RESOURCE' : 'MISSING_RESOURCE', candidates.length ? `Choose a pool for ${requirement.key}.` : `Requires resource ${requirement.key}.`);
  }

  evaluate(input: Character, runtime: Record<string, Value> = {}): EvaluationResult {
    const result: EvaluationResult = { status: 'valid', provisional: false, characterLevel: 0, instances: [], selections: [], stats: {}, resources: {}, capabilities: [], bindings: {}, diagnostics: [] };
    const report = (e: unknown, path: string) => result.diagnostics.push(diagnostic(e, path));
    const character = input;
    try {
      checkCharacter(character);
      checkInventory(character, this.catalogue);
      checkMoney(character.money, this.catalogue.system);
      moneyTotal(character, this.catalogue.system);
      if (character.system.id !== this.catalogue.system.id || character.system.revision !== this.catalogue.system.revision || character.catalogue.id !== this.catalogue.id || character.catalogue.revision !== this.catalogue.revision) throw new RuleError('REVISION', 'System or catalogue revision mismatch.');
      const revisions = Object.fromEntries([...this.catalogue.features, ...this.catalogue.classes].map((f) => [f.id, f.revision]));
      if (Object.keys(revisions).length !== Object.keys(character.contentRevisions).length || Object.entries(revisions).some(([id, revision]) => character.contentRevisions[id] !== revision)) throw new RuleError('REVISION', 'Content revision manifest mismatch.');
      if (!this.catalogue.system.allowMultipleClasses && character.progressions.length > 1) throw new RuleError('MULTICLASS', 'This System permits only one class.');
      if (this.catalogue.system.allowDuplicateClasses === false && new Set(character.progressions.map((p) => p.class)).size !== character.progressions.length) throw new RuleError('DUPLICATE_CLASS', 'This System permits only one progression per class.');
      for (const [id] of Object.entries(character.inputs)) if (!this.catalogue.system.stats.some((s) => s.id === id && s.kind === 'input')) throw new RuleError('UNKNOWN_INPUT', `Unknown or derived input ${id}.`);
      const snapshots = new Map<number, Record<string, number>>([[0, {}]]), eventSnapshots = new Map<number, Record<string, number>>([[0, {}]]);
      const acquiredLevels = new Map<string, number>(), acquiredEvents = new Map<string, number>(), historical: Record<string, number> = {};
      for (const entry of character.history) {
        if (!character.progressions.some((p) => p.id === entry.progression) || entry.level !== (historical[entry.progression] ?? 0) + 1) throw new RuleError('HISTORY', 'Level history must be contiguous and reference existing progressions.');
        historical[entry.progression] = entry.level;
        const level = number(this.context(character, historical).characterLevel);
        snapshots.set(level, { ...historical });
        acquiredLevels.set(`${entry.progression}/${entry.level}`, level);
        const event = eventSnapshots.size;
        eventSnapshots.set(event, { ...historical });
        acquiredEvents.set(`${entry.progression}/${entry.level}`, event);
      }
      for (const p of character.progressions) {
        const cls = this.catalogue.classes.find((c) => c.id === p.class);
        if (!cls || (this.catalogue.system.classes && !this.catalogue.system.classes.includes(p.class))) throw new RuleError('UNKNOWN_CLASS', `Class ${p.class} is not in this System.`);
        if (cls.maximumLevel !== undefined && p.level > cls.maximumLevel) throw new RuleError('CLASS_LEVEL', `Class ${cls.name} exceeds its maximum level.`);
        if (p.level > (historical[p.id] ?? 0)) throw new RuleError('HISTORY', 'Attained level exceeds recorded acquisitions.');
      }
      result.characterLevel = number(this.context(character).characterLevel);
      const rawSlots: { id: string; owner?: string; definition: Choice; active: boolean; level: number; classLevel: number; event: number; progression?: string; parameters: Record<string, Value> }[] = [];
      const instantiate = (id: string, pick: Pick, acquiredCharacterLevel: number, acquiredClassLevel: number, active: boolean, parent?: string, progression?: string, waived = false, selection?: string, event = 0): void => {
        if (result.instances.length >= 10000) throw new RuleError('INSTANCE_LIMIT', 'Feature expansion exceeds 10000 instances.');
        const f = this.features.get(pick.feature);
        if (!f) throw new RuleError('UNKNOWN_FEATURE', `Unknown Feature ${pick.feature}.`, id);
        const params: Record<string, Value> = { ...Object.fromEntries(Object.entries(f.parameters ?? {}).filter(([, p]) => p.default !== undefined).map(([k, p]) => [k, p.default!])), ...pick.parameters };
        let parameterValid = true;
        for (const [key, def] of Object.entries(f.parameters ?? {})) {
          const v = params[key];
          if (typeof v !== def.kind || (def.options && !def.options.includes(v)) || (typeof v === 'number' && (!Number.isFinite(v) || (def.integer && !Number.isInteger(v)) || v < (def.minimum ?? -Infinity) || v > (def.maximum ?? Infinity)))) {
            report(new RuleError('PARAMETER', `Invalid parameter ${key}.`), id);
            parameterValid = false;
          }
        }
        for (const key of Object.keys(params)) if (!Object.hasOwn(f.parameters ?? {}, key)) {
          report(new RuleError('PARAMETER', `Unknown parameter ${key}.`), id);
          parameterValid = false;
        }
        const instance: Instance = { id, feature: f.id, parent, progression, parameters: params, acquiredCharacterLevel, acquiredClassLevel, acquiredEvent: event, active: active && parameterValid, eligible: false, waived, selection };
        result.instances.push(instance);
        for (const component of f.components) {
          if (component.kind === 'grantFeature') instantiate(childPath(id, component.id), { id: component.id, feature: component.feature, parameters: component.parameters }, acquiredCharacterLevel, acquiredClassLevel, instance.active, id, progression, component.ignorePrerequisites ?? false, undefined, event);
          if (component.kind === 'chooseFeatures') expandChoice(selectionPath(id, component.id), component, instance.active, acquiredCharacterLevel, acquiredClassLevel, id, progression, params, event);
        }
      };
      const expandChoice = (id: string, definition: Choice, active: boolean, level: number, classLevel: number, owner?: string, progression?: string, parameters: Record<string, Value> = {}, event = 0): void => {
        rawSlots.push({ id, definition, active, level, classLevel, event, owner, progression, parameters });
        const picks = character.selections[id] ?? [];
        if (new Set(picks.map((p) => p.id)).size !== picks.length) throw new RuleError('DUPLICATE_PICK_ID', 'Selection entry IDs must be unique.', id);
        const eligibilityEvent = definition.eligibility === 'current' ? eventSnapshots.size - 1 : event;
        for (const pick of picks) instantiate(pickPath(id, pick.id), pick, level, classLevel, active, owner, progression, definition.ignorePrerequisites ?? false, id, eligibilityEvent);
      };
      for (const root of character.roots) {
        const policy = this.catalogue.system.rootCandidates;
        const f = this.features.get(root.feature);
        if (policy && (!f || (policy.ids && !policy.ids.includes(f.id)) || (policy.tags && !policy.tags.every((t) => f.tags?.includes(t))))) throw new RuleError('ROOT_FEATURE', `Feature ${root.feature} is not allowed as an additional root in this System.`);
        if (root.acquiredCharacterLevel > Math.max(0, ...snapshots.keys())) throw new RuleError('HISTORY', 'Root acquisition is beyond recorded character history.');
        const event = root.acquiredEvent ?? [...eventSnapshots].find(([, levels]) => this.context(character, levels).characterLevel === root.acquiredCharacterLevel)?.[0];
        if (event === undefined || !eventSnapshots.has(event) || this.context(character, eventSnapshots.get(event)).characterLevel !== root.acquiredCharacterLevel) throw new RuleError('HISTORY', 'Root acquisition event does not match its character level.');
        instantiate(rootPath(root.id), root, root.acquiredCharacterLevel, 0, root.acquiredCharacterLevel <= result.characterLevel, undefined, undefined, false, undefined, event);
      }
      for (const progression of character.progressions) {
        const cls = this.catalogue.classes.find((c) => c.id === progression.class)!;
        for (const level of Object.keys(cls.levels).map(Number).sort((a, b) => a - b)) {
          const acquired = acquiredLevels.get(`${progression.id}/${level}`);
          if (acquired === undefined) continue;
          for (const entry of [...cls.levels[String(level)]].sort((a, b) => Number(a.kind === 'chooseFeatures') - Number(b.kind === 'chooseFeatures'))) {
            const id = classEntryPath(progression.id, level, entry.id);
            const event = acquiredEvents.get(`${progression.id}/${level}`)!;
            if (entry.kind === 'grantFeature') instantiate(id, { id: entry.id, feature: entry.feature, parameters: entry.parameters }, acquired, level, level <= progression.level, undefined, progression.id, entry.ignorePrerequisites ?? false, undefined, event);
            else expandChoice(id, entry, level <= progression.level, acquired, level, undefined, progression.id, {}, event);
          }
        }
      }
      for (const [levelKey, entries] of Object.entries(this.catalogue.system.advancement ?? {})) {
        const level = Number(levelKey);
        if (level > Math.max(0, ...snapshots.keys())) continue;
        const event = [...eventSnapshots].find(([, levels]) => number(this.context(character, levels).characterLevel) >= level)?.[0] ?? 0;
        for (const entry of entries) {
          const id = `advancement/${level}/${segment(entry.id)}`;
          if (entry.kind === 'grantFeature') {
            instantiate(id, { id: entry.id, feature: entry.feature, parameters: entry.parameters }, level, 0, level <= result.characterLevel, undefined, undefined, entry.ignorePrerequisites ?? false, undefined, event);
          } else {
            expandChoice(id, entry, level <= result.characterLevel, level, 0, undefined, undefined, {}, event);
          }
        }
      }
      const knownSlots = new Set(rawSlots.map((s) => s.id));
      for (const id of Object.keys(character.selections)) if (!knownSlots.has(id)) throw new RuleError('UNKNOWN_SELECTION', `Unknown selection ${id}.`);
      // Validate membership before admitting effects. Invalid picks never supply resources.
      for (const slot of rawSlots.filter((s) => s.active)) {
        // Membership is checked before effects; expression filters use the acquisition view below.
        for (const pick of character.selections[slot.id] ?? []) {
          const f = this.features.get(pick.feature)!;
          if ((slot.definition.candidates.ids && !slot.definition.candidates.ids.includes(f.id)) || (slot.definition.candidates.tags && !slot.definition.candidates.tags.every((t) => f.tags?.includes(t)))) {
            const path = pickPath(slot.id, pick.id);
            report(new RuleError('CANDIDATE', `Feature ${f.id} is outside this selection's candidates.`), path);
            result.instances.filter((i) => i.id === path || i.id.startsWith(path + '/')).forEach((i) => {
              i.active = false;
            });
          }
        }
      }
      const errors = new Map<string, unknown>();
      const admitted: Instance[] = [];
      for (const event of [...new Set(result.instances.filter((i) => i.active).map((i) => i.acquiredEvent ?? 0))].sort((a, b) => a - b)) {
        const pending = result.instances.filter((i) => i.active && (i.acquiredEvent ?? 0) === event);
        const levels = eventSnapshots.get(event) ?? {};
        let progress = true;
        while (progress) {
          progress = false;
          for (const i of pending.filter((i) => !i.eligible)) {
            try {
              if (i.parent && !admitted.some((parent) => parent.id === i.parent)) throw new RuleError('PARENT_INELIGIBLE', 'Owning Feature is not eligible.');
              const f = this.features.get(i.feature)!;
              const currentChoice = i.selection && rawSlots.find((s) => s.id === i.selection)?.definition.eligibility === 'current';
              const instanceLevels = currentChoice ? Object.fromEntries(character.progressions.map((p) => [p.id, p.level])) : levels;
              const stats = this.statView(character, admitted, instanceLevels);
              const context = this.context(character, instanceLevels, {}, i);
              if (i.selection) {
                const slot = rawSlots.find((s) => s.id === i.selection)!;
                const slotOwner = slot.owner ? admitted.find((p) => p.id === slot.owner) : undefined;
                const slotContext = { ...context, acquiredCharacterLevel: slot.level, acquiredClassLevel: slot.classLevel };
                const env = this.environment(slotContext, stats.get, slotOwner);
                if (slot.definition.candidates.maximumLevel !== undefined && (f.contentLevel ?? 0) > number(evaluateExpression(slot.definition.candidates.maximumLevel, env))) throw new RuleError('CANDIDATE', 'Feature exceeds the acquisition-level candidate limit.');
              }
              if (!i.waived && !this.satisfies(f.prerequisites, i, admitted, stats.get, context)) throw new RuleError('PREREQUISITE', `Prerequisites are not satisfied for ${f.name}.`);
              const pools = this.pools(character, admitted, stats, instanceLevels);
              for (const req of f.resources ?? []) this.matchPool(character, i, req, pools, admitted);
              i.eligible = true;
              admitted.push(i);
              progress = true;
              errors.delete(i.id);
            } catch (e) {
              errors.set(i.id, e);
            }
          }
        }
      }
      for (const i of result.instances.filter((i) => i.active && !i.eligible)) report(errors.get(i.id) ?? new RuleError('PREREQUISITE', 'Feature is not eligible.'), i.id);
      // Maintenance and required resources remain enforced in the current permanent build.
      let changed = true;
      while (changed) {
        changed = false;
        for (const i of result.instances.filter((i) => i.active && i.eligible)) {
          const peers = result.instances.filter((p) => p.active && p.eligible && p.id !== i.id && !p.id.startsWith(i.id + '/'));
          try {
            if (i.parent && !peers.some((p) => p.id === i.parent)) throw new RuleError('PARENT_INELIGIBLE', 'Owning Feature is inactive.');
            const view = this.statView(character, peers);
            const f = this.features.get(i.feature)!;
            if (!this.satisfies(f.maintenance, i, peers, view.get, this.context(character, undefined, {}, i))) throw new RuleError('MAINTENANCE', 'Maintenance requirements are not met.');
            for (const req of f.resources ?? []) this.matchPool(character, i, req, this.pools(character, peers, view), peers);
          } catch (e) {
            i.eligible = false;
            changed = true;
            report(e, i.id);
          }
        }
      }
      const repeats = new Map<string, Instance[]>();
      for (const i of result.instances.filter((i) => i.active && i.eligible)) {
        const definition = this.features.get(i.feature)!;
        const sharedTracker = definition.components.some((c) => c.kind === 'trackResource') && definition.components.every((c) => ['trackResource', 'defineStat', 'describe'].includes(c.kind));
        const repeat = definition.repeat ?? { maximum: sharedTracker ? 10000 : 1, scope: 'character' as const };
        const key = JSON.stringify([i.feature, repeat.scope === 'parent' ? i.parent ?? i.id : repeat.scope === 'progression' ? i.progression : '', ...(repeat.uniqueBy ?? []).map((k) => i.parameters[k])]);
        const group = [...repeats.get(key) ?? [], i];
        repeats.set(key, group);
        if (group.length > repeat.maximum) {
          i.eligible = false;
          report(new RuleError('REPEAT_LIMIT', `Feature ${i.feature} exceeds its repeat limit.`), i.id);
        }
      }
      const view = this.statView(character, result.instances, undefined, runtime);
      const permanentView = Object.keys(runtime).length ? this.statView(character, result.instances) : view;
      const stub: Instance = { id: 'system', feature: '', parameters: {}, acquiredCharacterLevel: 0, acquiredClassLevel: 0, active: true, eligible: true, waived: false };
      const permanentContext = this.context(character);
      for (const rule of this.catalogue.system.validation ?? []) {
        try {
          if (!this.satisfies(rule.requirement, stub, result.instances, permanentView.get, permanentContext)) report(new RuleError('SYSTEM_RULE', rule.message), `system/${rule.id}`);
        } catch (e) {
          report(e, `system/${rule.id}`);
        }
      }
      if (number(permanentContext.classCount) > 1) for (const p of character.progressions.filter((p) => p.level > 0)) {
        const cls = this.catalogue.classes.find((c) => c.id === p.class)!;
        try {
          if (!this.satisfies(cls.multiclassPrerequisites, { ...stub, progression: p.id }, result.instances, permanentView.get, this.context(character, undefined, {}, { ...stub, progression: p.id }))) report(new RuleError('MULTICLASS_PREREQUISITE', `Multiclass prerequisites are not met for ${cls.name}.`), `class/${segment(p.id)}`);
        } catch (e) {
          report(e, `class/${segment(p.id)}`);
        }
      }
      // Entry legality also uses its historical stat view: later Features cannot qualify an earlier multiclass entry.
      for (const [event, levels] of eventSnapshots) {
        const entry = character.history[event - 1];
        if (!entry || entry.level !== 1 || character.progressions.filter((p) => p.level > 0 && (levels[p.id] ?? 0) > 0).length < 2 || !character.progressions.some((p) => p.id === entry.progression && p.level > 0)) continue;
        const historicalView = this.statView(character, result.instances.filter((i) => (i.acquiredEvent ?? 0) <= event), levels);
        for (const p of character.progressions.filter((p) => p.level > 0 && (levels[p.id] ?? 0) > 0)) {
          const cls = this.catalogue.classes.find((c) => c.id === p.class)!;
          try {
            if (!this.satisfies(cls.multiclassPrerequisites, { ...stub, progression: p.id }, result.instances.filter((i) => (i.acquiredEvent ?? 0) <= event), historicalView.get, this.context(character, levels, {}, { ...stub, progression: p.id }))) report(new RuleError('MULTICLASS_PREREQUISITE', `Multiclass prerequisites were not met when entering ${cls.name}.`), `class/${segment(p.id)}/history/${event}`);
          } catch (e) {
            report(e, `class/${segment(p.id)}/history/${event}`);
          }
        }
      }
      for (const stat of this.catalogue.system.stats) try {
        view.get(stat.id);
      } catch (e) {
        report(e, `stat/${stat.id}`);
      }
      for (const instance of result.instances.filter((i) => i.active && i.eligible)) for (const component of this.features.get(instance.feature)!.components) {
        if (component.kind !== 'defineStat' && component.kind !== 'modifyStat') continue;
        const id = component.kind === 'defineStat' ? component.stat.id : component.stat;
        try {
          view.get(id);
        } catch (e) {
          report(e, `stat/${id}`);
        }
      }
      result.stats = view.results;
      try {
        result.resources = this.pools(character, result.instances, view, undefined, runtime);
      } catch (e) {
        report(e, 'resources');
      }
      for (const slot of rawSlots.filter((s) => s.active && (!s.owner || result.instances.some((i) => i.id === s.owner && i.eligible)))) {
        try {
          const owner = slot.owner ? result.instances.find((i) => i.id === slot.owner)! : undefined;
          const context = { ...this.context(character, undefined, {}, owner), acquiredCharacterLevel: slot.level, acquiredClassLevel: slot.classLevel,
            classLevel: slot.progression ? character.progressions.find((p) => p.id === slot.progression)!.level : 0 };
          const env = this.environment(context, permanentView.get, owner);
          const minimum = constrain(number(evaluateExpression(slot.definition.minimum, env)), { integer: true, minimum: 0 });
          const maximum = constrain(number(evaluateExpression(slot.definition.maximum, env)), { integer: true, minimum });
          const picks = character.selections[slot.id] ?? [];
          result.selections.push({ id: slot.id, owner: slot.owner, definition: slot.definition, minimum, maximum, picks: clone(picks), context });
          if (picks.length < minimum) result.diagnostics.push({ code: 'MISSING_SELECTION', severity: 'incomplete', path: slot.id, message: `Choose ${minimum - picks.length} more Feature(s).` });
          if (picks.length > maximum) report(new RuleError('PICK_LIMIT', 'Too many selections.'), slot.id);
          if (!slot.definition.allowDuplicates && new Set(picks.map((p) => p.feature)).size !== picks.length) report(new RuleError('DUPLICATE_SELECTION', 'Duplicate candidates are not allowed.'), slot.id);
        } catch (e) {
          report(e, slot.id);
        }
      }
      for (const i of result.instances.filter((i) => i.active && i.eligible)) {
        const f = this.features.get(i.feature)!;
        try {
          const env = this.environment(this.context(character, undefined, runtime, i), view.get, i);
          for (const component of f.components) if (component.kind === 'grantResource' && (!component.condition || boolean(evaluateExpression(component.condition, env)))) this.matchPool(character, i, { id: component.id, key: component.key }, result.resources, result.instances);
          for (const req of f.resources ?? []) result.bindings[`${i.id}/${segment(req.id)}`] = this.matchPool(character, i, req, result.resources, result.instances).id;
          for (const component of f.components) if (component.kind === 'grantCapability') {
            if ((component.condition && !boolean(evaluateExpression(component.condition, env))) || !this.satisfies(component.requirements, i, result.instances, view.get, env.context)) continue;
            const costs: Record<string, number> = {};
            for (const cost of component.costs ?? []) {
              const requirement = cost.requirement ? f.resources?.find((r) => r.id === cost.requirement) : { id: component.id + '/' + cost.key, key: cost.key };
              if (!requirement) throw new RuleError('MISSING_RESOURCE', `Unknown required resource ${cost.requirement}.`);
              const pool = this.matchPool(character, i, requirement, result.resources, result.instances);
              const amount = constrain(number(evaluateExpression(cost.amount, env)), { minimum: 0, integer: pool.integer });
              costs[pool.id] = (costs[pool.id] ?? 0) + amount;
            }
            result.capabilities.push({ id: `${i.id}/capability/${segment(component.id)}`, source: i.id, definition: component, costs });
          }
        } catch (e) {
          report(e, i.id);
        }
      }
    } catch (e) {
      report(e, 'character');
    }
    result.status = result.diagnostics.some((d) => d.severity === 'invalid') ? 'invalid' : result.diagnostics.length ? 'incomplete' : 'valid';
    result.provisional = result.status !== 'valid';
    return result;
  }

  getCandidates(character: Character, selection: string, parameters: Record<string, Value> = {}, options: { features?: string[] } = {}): Candidate[] {
    const result = this.evaluate(character), slot = result.selections.find((s) => s.id === selection);
    if (!slot) throw new RuleError('UNKNOWN_SELECTION', `Unknown active selection ${selection}.`);
    return this.getSelectionFeatures(slot.definition).filter((f) => !options.features || options.features.includes(f.id)).map((f) => {
      const draft = clone(character), pick: Pick = { id: 'candidate-preview', feature: f.id, parameters };
      draft.selections[selection] = [...(character.selections[selection] ?? []).slice(0, Math.max(0, slot.maximum - 1)), pick];
      const evaluation = this.evaluate(draft), path = pickPath(selection, pick.id);
      const signature = (d: Diagnostic) => JSON.stringify(d);
      const baseline = new Set(result.diagnostics.map(signature));
      const diagnostics = evaluation.diagnostics.filter((d) => d.path === selection || d.path === path || d.path.startsWith(path + '/') || !baseline.has(signature(d)));
      const own = evaluation.instances.find((i) => i.id === path);
      const requiredKeys = evaluation.instances.filter((i) => i.id === path || i.id.startsWith(path + '/')).flatMap((i) => this.features.get(i.feature)?.resources?.map((r) => r.key) ?? []);
      const provides = (id: string, keys: string[]): boolean => {
        const feature = this.features.get(id)!;
        return feature.components.some((c) => ((c.kind === 'defineResource' || c.kind === 'trackResource') && keys.includes(c.key)) || (c.kind === 'grantFeature' && provides(c.feature, keys)));
      };
      const pendingResource = diagnostics.some((d) => d.code === 'MISSING_RESOURCE') && evaluation.selections.some((s) => s.id !== selection
        && (slot.owner ? s.owner === slot.owner : !s.owner && s.id.split('/').slice(0, 3).join('/') === slot.id.split('/').slice(0, 3).join('/'))
        && s.picks.length < s.minimum && this.catalogue.features.some((f) => (!s.definition.candidates.ids || s.definition.candidates.ids.includes(f.id))
          && (!s.definition.candidates.tags || s.definition.candidates.tags.every((t) => f.tags?.includes(t))) && provides(f.id, requiredKeys)));
      return { feature: f.id, waived: slot.definition.ignorePrerequisites ?? false, status: pendingResource ? 'incomplete' : diagnostics.some((d) => d.severity === 'invalid') || !own?.eligible ? 'invalid' : diagnostics.length ? 'incomplete' : 'valid', diagnostics };
    });
  }
}
