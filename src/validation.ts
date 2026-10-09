import { rollDice } from '@/src/dice.js';
import { checkMoney } from '@/src/currency.js';
import { checkInventory, itemFeatures } from '@/src/items.js';
import type { Catalogue, Character, Diagnostic, Expression, Predicate, Component, FunctionRegistry } from '@/src/model.js';
import { RuleError, number } from '@/src/expression.js';
import { compileBlocks } from '@/src/blocks.js';

const unsafe = new Set(['__proto__', 'constructor', 'prototype']);
export function record(v: unknown): asserts v is Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new RuleError('SCHEMA', 'Expected an object.');
  for (const key of Object.keys(v)) if (unsafe.has(key)) throw new RuleError('SCHEMA', `Unsafe key ${key}.`);
}
function text(v: unknown): asserts v is string {
  if (typeof v !== 'string' || !v || unsafe.has(v)) throw new RuleError('SCHEMA', 'Expected a nonempty safe string.');
}
function integer(v: unknown, min = 0): void {
  if (!Number.isInteger(number(v)) || number(v) < min) throw new RuleError('SCHEMA', `Expected an integer >= ${min}.`);
}
function list(v: unknown): asserts v is unknown[] {
  if (!Array.isArray(v) || v.length > 10000) throw new RuleError('SCHEMA', 'Expected an array of at most 10000 items.');
}
function unique(values: string[], what: string): void {
  if (new Set(values).size !== values.length) throw new RuleError('DUPLICATE_ID', `Duplicate ${what}.`);
}
function value(v: unknown): void {
  if (typeof v === 'number') {
    number(v);
  } else if (typeof v !== 'string' && typeof v !== 'boolean') {
    throw new RuleError('SCHEMA', 'Invalid parameter value.');
  }
}
function constraints(v: Record<string, unknown>): void {
  for (const k of ['minimum', 'maximum']) if (v[k] !== undefined) number(v[k]);
  if (v.minimum !== undefined && v.maximum !== undefined && number(v.minimum) > number(v.maximum)) throw new RuleError('SCHEMA', 'Minimum exceeds maximum.');
  for (const k of ['integer', 'clamp']) if (v[k] !== undefined && typeof v[k] !== 'boolean') throw new RuleError('SCHEMA', `Invalid ${k}.`);
  if (v.rounding !== undefined && !['floor', 'ceil', 'round'].includes(String(v.rounding))) throw new RuleError('SCHEMA', 'Invalid rounding.');
}
const arities: Record<string, number | 'many'> = { add: 'many', multiply: 'many', min: 'many', max: 'many', and: 'many', or: 'many', subtract: 2, divide: 2, eq: 2, gt: 2, gte: 2, lt: 2, lte: 2, floor: 1, ceil: 1, not: 1 };
export function checkExpression(e: unknown, catalogue: Catalogue, functions: FunctionRegistry, depth = 0): asserts e is Expression {
  if (depth > 64) throw new RuleError('EXPRESSION_DEPTH', 'Expression is too deep.');
  if (typeof e === 'number') {
    number(e);
    return;
  }
  if (typeof e === 'boolean') return;
  record(e);
  if (['literal', 'stat', 'context', 'parameter', 'base', 'if', 'table', 'call', 'op'].filter((k) => k in e).length !== 1) throw new RuleError('SCHEMA', 'Expression must have exactly one operation.');
  const recurse = (v: unknown) => checkExpression(v, catalogue, functions, depth + 1);
  if ('literal' in e) {
    if (typeof e.literal !== 'boolean') number(e.literal);
  } else if ('stat' in e) {
    text(e.stat);
    if (!catalogue.system.stats.some((s) => s.id === e.stat)) throw new RuleError('UNKNOWN_STAT', `Unknown stat ${e.stat}.`);
  } else if ('context' in e) text(e.context);
  else if ('parameter' in e) text(e.parameter);
  else if ('base' in e) {
    if (e.base !== true) throw new RuleError('SCHEMA', 'Invalid base expression.');
  } else if ('if' in e) {
    recurse(e.if);
    recurse(e.then);
    recurse(e.else);
  } else if ('table' in e) {
    text(e.table);
    if (e.owner !== undefined) {
      text(e.owner);
      if (!catalogue.features.some((f) => f.id === e.owner && Object.hasOwn(f.tables ?? {}, String(e.table)))) throw new RuleError('UNKNOWN_TABLE', 'Missing referenced table.');
    }
    recurse(e.input);
  } else if ('call' in e) {
    text(e.call);
    list(e.args);
    const fn = functions[e.call];
    if (!fn || e.args.length !== fn.arguments.length) throw new RuleError('UNKNOWN_FUNCTION', `Unknown function or arity ${e.call}.`);
    e.args.forEach(recurse);
  } else if ('op' in e) {
    text(e.op);
    list(e.args);
    const arity = arities[e.op];
    if (!arity || (arity === 'many' ? !e.args.length : e.args.length !== arity)) throw new RuleError('SCHEMA', 'Unknown operation or wrong arity.');
    e.args.forEach(recurse);
  } else throw new RuleError('SCHEMA', 'Invalid expression.');
}
function checkPredicate(p: unknown, c: Catalogue, depth = 0, functions: FunctionRegistry = {}): asserts p is Predicate {
  if (depth > 64) throw new RuleError('SCHEMA', 'Predicate is too deep.');
  record(p);
  if ('expression' in p) checkExpression(p.expression, c, functions);
  else if ('all' in p || 'any' in p) {
    const a = p.all ?? p.any;
    list(a);
    a.forEach((v) => checkPredicate(v, c, depth + 1, functions));
  } else if ('not' in p) checkPredicate(p.not, c, depth + 1, functions);
  else if ('level' in p) {
    integer(p.level);
    if (p.kind !== undefined && !['class', 'character'].includes(String(p.kind))) throw new RuleError('SCHEMA', 'Invalid level kind.');
  } else if ('feature' in p) {
    text(p.feature);
    if (!c.features.some((f) => f.id === p.feature)) throw new RuleError('UNKNOWN_FEATURE', `Missing prerequisite ${p.feature}.`);
    if (p.parameters !== undefined) {
      record(p.parameters);
      Object.values(p.parameters).forEach(value);
    }
  } else if ('tag' in p) text(p.tag);
  else if ('stat' in p) {
    text(p.stat);
    number(p.minimum);
    if (!c.system.stats.some((s) => s.id === p.stat)) throw new RuleError('UNKNOWN_STAT', 'Unknown prerequisite stat.');
  } else if ('parameter' in p) {
    text(p.parameter);
    value(p.equals);
  } else throw new RuleError('SCHEMA', 'Invalid prerequisite.');
}
function checkComponent(v: unknown, c: Catalogue, functions: FunctionRegistry): asserts v is Component {
  record(v);
  text(v.id);
  const expr = (e: unknown) => checkExpression(e, c, functions);
  if (v.condition !== undefined) expr(v.condition);
  if (v.ignorePrerequisites !== undefined && typeof v.ignorePrerequisites !== 'boolean') throw new RuleError('SCHEMA', 'Invalid prerequisite waiver.');
  switch (v.kind) {
    case 'grantFeature': text(v.feature);
      if (!c.features.some((f) => f.id === v.feature)) throw new RuleError('UNKNOWN_FEATURE', `Missing grant ${v.feature}.`);
      if (v.condition) throw new RuleError('CONDITIONAL_GRANT', 'Use advancement entries for conditional acquisition; grants cannot have runtime conditions.');
      if (v.parameters !== undefined) {
        record(v.parameters);
        Object.values(v.parameters).forEach(value);
      }
      break;
    case 'chooseFeatures':
      if (v.eligibility !== undefined && !['acquisition', 'current'].includes(String(v.eligibility))) throw new RuleError('SCHEMA', 'Invalid choice eligibility timing.');
      if (v.condition) throw new RuleError('CONDITIONAL_CHOICE', 'Choices cannot depend on runtime conditions.');
      expr(v.minimum);
      expr(v.maximum);
      record(v.candidates);
      if (v.candidates.ids !== undefined) {
        list(v.candidates.ids);
        for (const id of v.candidates.ids) {
          text(id);
          if (!c.features.some((f) => f.id === id)) throw new RuleError('UNKNOWN_FEATURE', `Missing candidate ${id}.`);
        }
      }
      if (v.candidates.tags !== undefined) {
        list(v.candidates.tags);
        v.candidates.tags.forEach(text);
      }
      if (!v.candidates.ids && !v.candidates.tags) throw new RuleError('SCHEMA', 'Choice needs a candidate source.');
      if (v.candidates.maximumLevel !== undefined) expr(v.candidates.maximumLevel);
      if (v.retraining !== undefined) {
        record(v.retraining);
        if (typeof v.retraining.allowed !== 'boolean') throw new RuleError('SCHEMA', 'Invalid retraining rule.');
        if (v.retraining.events !== undefined) {
          list(v.retraining.events);
          v.retraining.events.forEach(text);
        }
      }
      break;
    case 'modifyStat':
      text(v.stat);
      if (!c.system.stats.some((s) => s.id === v.stat)) throw new RuleError('UNKNOWN_STAT', `Unknown modified stat ${v.stat}.`);
      if (!['add', 'multiply', 'floor', 'ceiling', 'override'].includes(String(v.operation))) throw new RuleError('SCHEMA', 'Invalid modifier operation.');
      expr(v.value);
      if (v.stacking !== undefined && !['sum', 'highest', 'lowest', 'bestBonusAndWorstPenalty'].includes(String(v.stacking))) throw new RuleError('SCHEMA', 'Invalid stacking policy.');
      if (v.priority !== undefined) number(v.priority);
      if (v.group !== undefined) text(v.group);
      break;
    case 'defineStat':
      record(v.stat);
      text(v.stat.id);
      text(v.stat.name);
      if (v.stat.kind !== 'derived') throw new RuleError('SCHEMA', 'Feature-created stats must be derived.');
      if (v.condition !== undefined) throw new RuleError('SCHEMA', 'A stat follows its owning Feature lifetime; use conditional expressions for its value.');
      constraints(v.stat);
      expr(v.stat.expression);
      break;
    case 'trackResource':
      text(v.key);
      text(v.name);
      text(v.units);
      if (v.contract !== undefined) text(v.contract);
      if (v.minimum !== undefined) number(v.minimum);
      if (v.integer !== undefined && typeof v.integer !== 'boolean') throw new RuleError('SCHEMA', 'Invalid resource integer flag.');
      if (v.maximum !== undefined) expr(v.maximum);
      expr(v.initialAmount);
      list(v.recovery);
      for (const r of v.recovery) {
        record(r);
        text(r.event);
        if (r.amount === 'full') {
          if (v.maximum === undefined) throw new RuleError('SCHEMA', 'An unbounded resource cannot recover to full.');
        } else expr(r.amount);
      }
      break;
    case 'grantResource':
      text(v.key);
      expr(v.amount);
      break;
    case 'defineResource':
      text(v.key);
      text(v.units);
      if (!['character', 'progression', 'parent', 'instance'].includes(String(v.scope))) throw new RuleError('SCHEMA', 'Invalid resource scope.');
      expr(v.capacity);
      constraints(v);
      if (v.combine !== undefined && !['sum', 'highest'].includes(String(v.combine))) throw new RuleError('SCHEMA', 'Invalid pool combination.');
      if (v.initial !== undefined && !['full', 'empty'].includes(String(v.initial))) throw new RuleError('SCHEMA', 'Invalid initialization.');
      list(v.recovery);
      for (const r of v.recovery) {
        record(r);
        text(r.event);
        if (r.amount !== 'full') expr(r.amount);
      }
      break;
    case 'grantCapability':
      text(v.name);
      if (v.requirements) checkPredicate(v.requirements, c, 0, functions);
      if (v.action !== undefined) {
        record(v.action);
        text(v.action.kind);
        integer(v.action.amount);
      }
      if (v.costs !== undefined) {
        list(v.costs);
        for (const cost of v.costs) {
          record(cost);
          text(cost.key);
          expr(cost.amount);
          if (cost.requirement !== undefined) text(cost.requirement);
        }
      }
      if (v.spendOnOutcomes !== undefined) {
        list(v.spendOnOutcomes);
        v.spendOnOutcomes.forEach(text);
      }
      break;
    case 'describe': if (typeof v.text !== 'string') throw new RuleError('SCHEMA', 'Invalid descriptive text.');
      break;
    default: throw new RuleError('SCHEMA', 'Unknown component kind.');
  }
}
export function validateCatalogue(input: unknown, functions: FunctionRegistry = {}): Diagnostic[] {
  try {
    record(input);
    text(input.id);
    integer(input.revision, 1);
    record(input.system);
    list(input.features);
    list(input.classes);
    if (input.blocks !== undefined) list(input.blocks);
    const compiled = compileBlocks(input as unknown as Catalogue);
    if (compiled.system.spellDisplay !== undefined) {
      const display = compiled.system.spellDisplay;
      record(display);
      for (const key of ['spellKey', 'levelKey', 'slotLevelKey', 'ritualKey', 'castingAbilityKey'] as const) text(display[key]);
      list(display.slots);
      unique(display.slots.map((slot) => `${slot.scope}/${slot.key}`), 'spell slot');
      for (const slot of display.slots) {
        integer(slot.level, 1);
        text(slot.key);
        if (!['character', 'progression', 'parent', 'instance'].includes(slot.scope)) throw new RuleError('SCHEMA', 'Invalid spell slot scope.');
      }
    }
    if (compiled.system.currency !== undefined) {
      const currency = compiled.system.currency;
      record(currency);
      text(currency.name);
      text(currency.primary);
      integer(currency.decimalPlaces);
      if (currency.decimalPlaces > 6) throw new RuleError('CURRENCY', 'Currency supports up to six decimal places.');
      list(currency.denominations);
      if (!currency.denominations.length) throw new RuleError('CURRENCY', 'Currency needs at least one denomination.');
      unique(currency.denominations.map((unit) => unit.id), 'currency denomination');
      const legacyIds: string[] = [];
      for (const unit of currency.denominations) {
        record(unit);
        text(unit.id);
        text(unit.name);
        if (typeof unit.symbol !== 'string') throw new RuleError('CURRENCY', 'Currency symbol must be text.');
        integer(unit.value, 1);
        if (!Number.isSafeInteger(unit.value)) throw new RuleError('CURRENCY', 'Currency value exceeds the supported range.');
        if (unit.legacyItemIds !== undefined) {
          list(unit.legacyItemIds);
          unit.legacyItemIds.forEach(text);
          legacyIds.push(...unit.legacyItemIds);
        }
      }
      unique(legacyIds, 'legacy currency item');
      if (!currency.denominations.some((unit) => unit.id === currency.primary)) throw new RuleError('CURRENCY', 'Primary denomination is missing.');
    }
    if (compiled.items !== undefined) list(compiled.items);
    if (compiled.itemFeatures !== undefined) list(compiled.itemFeatures);
    unique((compiled.items ?? []).map((i) => i.id), 'item');
    unique((compiled.itemFeatures ?? []).map((i) => i.id), 'item Feature');
    for (const f of compiled.itemFeatures ?? []) {
      text(f.id);
      text(f.name);
      if (f.features !== undefined) {
        list(f.features);
        f.features.forEach(text);
      }
      if (f.properties !== undefined) {
        record(f.properties);
        Object.values(f.properties).forEach(value);
      }
      if (f.modifiers !== undefined) {
        list(f.modifiers);
        if (f.modifiers.some((m) => m.kind !== 'modifyStat')) throw new RuleError('ITEM_FEATURE', 'Item modifiers must modify one stat.');
      }
      itemFeatures({ ...compiled, items: [{ id: '__validation', revision: 1, name: 'Validation', category: 'Validation', features: [f.id] }] }, '__validation');
    }
    if (compiled.itemFeatures?.length) {
      const errors = validateCatalogue({ ...compiled, items: undefined, itemFeatures: undefined, features: [...compiled.features, ...compiled.itemFeatures.map((feature, index) => ({ id: `item-validation:${index}`, revision: 1, name: feature.name, components: feature.modifiers ?? [] }))] }, functions);
      if (errors.length) throw new RuleError(errors[0].code, errors[0].message);
    }
    for (const item of compiled.items ?? []) {
      text(item.id);
      text(item.name);
      text(item.category);
      integer(item.revision, 1);
      list(item.features);
      item.features.forEach(text);
      if (item.slot !== undefined) text(item.slot);
      if (item.source !== undefined) text(item.source);
      itemFeatures(compiled, item.id);
    }
    if (compiled.system.sheetSections !== undefined) {
      list(compiled.system.sheetSections);
      unique(compiled.system.sheetSections.map((section) => section.id), 'sheet section');
      const stats = new Set([...compiled.system.stats.map((stat) => stat.id), ...compiled.features.flatMap((feature) => feature.components.flatMap((component) => component.kind === 'defineStat' ? [component.stat.id] : []))]);
      for (const section of compiled.system.sheetSections) {
        text(section.id);
        text(section.name);
        list(section.rows);
        if (!['abilities', 'skills', 'stats'].includes(section.layout)) throw new RuleError('PRESENTATION', 'Unknown sheet layout.');
        for (const row of section.rows) {
          for (const id of [row.stat, row.secondaryStat, row.proficiencyStat].filter((id) => id !== undefined)) if (!stats.has(id!)) throw new RuleError('PRESENTATION', `Unknown displayed stat ${id}.`);
          text(row.stat);
          for (const label of [row.name, row.ability].filter((label) => label !== undefined)) text(label);
          if (row.feature !== undefined && !compiled.features.some((feature) => feature.id === row.feature)) throw new RuleError('PRESENTATION', 'Unknown displayed Feature.');
        }
      }
    }
    if (compiled.system.featureCategories !== undefined) {
      list(compiled.system.featureCategories);
      unique(compiled.system.featureCategories.map((category) => category.id), 'Feature category');
      for (const category of compiled.system.featureCategories) {
        text(category.id);
        text(category.name);
        list(category.tags);
        category.tags.forEach(text);
      }
    }
    const created = new Map<string, Catalogue['system']['stats'][number]>();
    for (const f of compiled.features) {
      if (f.roll !== undefined) {
        const roll = f.roll;
        record(roll);
        text(roll.id);
        text(roll.label);
        text(roll.dice);
        rollDice(roll.dice, () => 0);
        if (f.components.length) throw new RuleError('SCHEMA', 'A Roll Feature cannot contain other building blocks.');
        if (roll.capability !== undefined) text(roll.capability);
        if (roll.restoreResource !== undefined) {
          text(roll.restoreResource);
          text(roll.capability);
        }
        if (roll.bonus !== undefined && typeof roll.bonus !== 'number') {
          record(roll.bonus);
          if ('stat' in roll.bonus) text(roll.bonus.stat);
          else text(roll.bonus.class);
        } else if (typeof roll.bonus === 'number' && !Number.isSafeInteger(roll.bonus)) throw new RuleError('SCHEMA', 'Roll bonus must be an integer.');
      }
      list(f.components);
      const trackers = f.components.filter((v) => v.kind === 'trackResource');
      if (trackers.length > 1 || (trackers.length && f.components.some((v) => v.kind === 'defineResource'))) throw new RuleError('RESOURCE_TRACKER', 'A Feature can track only one resource; grant sub-Features for more.');
      for (const component of f.components) if (component.kind === 'defineStat') {
        record(component.stat);
        const stat = component.stat;
        const prior = created.get(stat.id);
        if (compiled.system.stats.some((s) => s.id === stat.id) || (prior && JSON.stringify(prior) !== JSON.stringify(stat))) throw new RuleError('STAT_CONFLICT', `Conflicting definition of ${stat.id}.`);
        created.set(stat.id, stat);
      }
    }
    const c = { ...compiled, system: { ...compiled.system, stats: [...compiled.system.stats, ...created.values()] } };
    text(c.system.id);
    integer(c.system.revision, 1);
    text(c.system.name);
    list(c.system.stats);
    if (typeof c.system.allowMultipleClasses !== 'boolean') throw new RuleError('SCHEMA', 'System must declare multiclass policy.');
    if (c.system.allowDuplicateClasses !== undefined && typeof c.system.allowDuplicateClasses !== 'boolean') throw new RuleError('SCHEMA', 'Invalid duplicate class policy.');
    if (c.system.rootCandidates !== undefined) {
      record(c.system.rootCandidates);
      const policy = c.system.rootCandidates;
      if (!policy.ids && !policy.tags) throw new RuleError('SCHEMA', 'Root candidates need IDs or tags.');
      if (policy.ids) {
        list(policy.ids);
        policy.ids.forEach((id) => {
          text(id);
          if (!c.features.some((f) => f.id === id)) throw new RuleError('UNKNOWN_FEATURE', 'Unknown root candidate.');
        });
      }
      if (policy.tags) {
        list(policy.tags);
        policy.tags.forEach(text);
      }
    }
    for (const s of c.system.stats) {
      record(s);
      text(s.id);
      text(s.name);
      constraints(s);
      if (s.kind === 'input') {
        if (s.default !== undefined) number(s.default);
      } else if (s.kind !== 'derived') throw new RuleError('SCHEMA', 'Invalid stat kind.');
    }
    unique(c.system.stats.map((s) => s.id), 'stat');
    for (const f of c.features) {
      record(f);
      text(f.id);
      integer(f.revision, 1);
      text(f.name);
      list(f.components);
    }
    for (const cls of c.classes) {
      record(cls);
      text(cls.id);
      integer(cls.revision, 1);
      text(cls.name);
      record(cls.levels);
    }
    unique([...c.features, ...c.classes].map((f) => f.id), 'content definition');
    for (const definition of [...c.features, ...c.classes]) {
      for (const key of ['description', 'source'] as const) if (definition[key] !== undefined && typeof definition[key] !== 'string') throw new RuleError('SCHEMA', `Invalid ${key}.`);
    }
    for (const f of c.features) if (f.textReferences !== undefined) {
      list(f.textReferences);
      unique(f.textReferences, 'text reference');
      for (const id of f.textReferences) {
        text(id);
        if (!c.features.some((reference) => reference.id === id)) throw new RuleError('UNKNOWN_FEATURE', `Unknown text reference ${id}.`);
      }
    }
    for (const f of c.features) if (f.displayName !== undefined) text(f.displayName);
    for (const f of c.features) if (f.textLinkContext !== undefined) {
      record(f.textLinkContext);
      if (Object.keys(f.textLinkContext).some((key) => !['before', 'after'].includes(key))) throw new RuleError('SCHEMA', 'Unknown text link context field.');
      let count = 0;
      for (const phrases of [f.textLinkContext.before, f.textLinkContext.after]) if (phrases !== undefined) {
        list(phrases);
        for (const phrase of phrases) {
          text(phrase);
          if (!phrase.trim()) throw new RuleError('SCHEMA', 'Empty text link context phrase.');
          count++;
        }
      }
      if (!count) throw new RuleError('SCHEMA', 'Text link context requires a phrase.');
    }
    for (const f of c.features) if (f.textAliases !== undefined) {
      list(f.textAliases);
      unique(f.textAliases, 'text alias');
      f.textAliases.forEach(text);
    }
    if (c.system.tagDisplayNames !== undefined) {
      record(c.system.tagDisplayNames);
      for (const [id, name] of Object.entries(c.system.tagDisplayNames)) {
        text(id);
        text(name);
      }
    }
    checkExpression(c.system.characterLevel, c, functions);
    if (c.system.validation !== undefined) {
      list(c.system.validation);
      unique(c.system.validation.map((r) => r.id), 'System rule');
      for (const rule of c.system.validation) {
        record(rule);
        text(rule.id);
        text(rule.message);
        checkPredicate(rule.requirement, c, 0, functions);
      }
    }
    if (c.system.commandRules !== undefined) {
      record(c.system.commandRules);
      for (const key of Object.keys(c.system.commandRules)) if (!['spellTurn', 'selectedRecovery'].includes(key)) throw new RuleError('SCHEMA', 'Unknown command policy.');
      const turn = c.system.commandRules.spellTurn;
      if (turn) {
        record(turn);
        for (const key of ['castingAbilityKey', 'levelKey', 'timeKey', 'ritualKey', 'bonusTime', 'actionTime'] as const) text(turn[key]);
      }
      const recovery = c.system.commandRules.selectedRecovery;
      if (recovery) {
        record(recovery);
        if (recovery.eventKind !== undefined) text(recovery.eventKind);
        text(recovery.capabilityName);
        text(recovery.requiredEvent);
        text(recovery.budgetStat);
        if (!c.system.stats.some((s) => s.id === recovery.budgetStat)) throw new RuleError('UNKNOWN_STAT', 'Unknown recovery budget stat.');
        if (recovery.boundaryEvent !== undefined) text(recovery.boundaryEvent);
        record(recovery.targets);
        if (!Object.keys(recovery.targets).length) throw new RuleError('SCHEMA', 'Recovery needs targets.');
        unique(Object.values(recovery.targets).map((t) => `${t.scope}:${t.key}`), 'recovery target pool');
        for (const [key, target] of Object.entries(recovery.targets)) {
          text(key);
          record(target);
          text(target.key);
          if (!['character', 'progression', 'parent', 'instance'].includes(target.scope) || number(target.weight) <= 0) throw new RuleError('SCHEMA', 'Invalid recovery target.');
        }
        if (!c.features.some((f) => f.components.some((v) => v.kind === 'grantCapability' && v.name === recovery.capabilityName && !v.spendOnOutcomes))) throw new RuleError('SCHEMA', 'Recovery needs a capability with immediate costs.');
      }
    }
    for (const cls of c.classes) {
      if (cls.maximumLevel !== undefined) integer(cls.maximumLevel, 1);
      if (cls.multiclassPrerequisites) checkPredicate(cls.multiclassPrerequisites, c, 0, functions);
    }
    for (const s of c.system.stats) if (s.kind === 'derived') checkExpression(s.expression, c, functions);
    if (c.system.contextDefaults) {
      record(c.system.contextDefaults);
      Object.values(c.system.contextDefaults).forEach(value);
    }
    for (const f of c.features) {
      if (f.prerequisites) checkPredicate(f.prerequisites, c, 0, functions);
      if (f.maintenance) checkPredicate(f.maintenance, c, 0, functions);
      if (f.contentLevel !== undefined) integer(f.contentLevel);
      if (f.tags) {
        list(f.tags);
        f.tags.forEach(text);
      }
      if (f.repeat) {
        record(f.repeat);
        integer(f.repeat.maximum, 1);
        if (!['character', 'progression', 'parent'].includes(f.repeat.scope)) throw new RuleError('SCHEMA', 'Invalid repeat scope.');
        if (f.repeat.uniqueBy) {
          list(f.repeat.uniqueBy);
          f.repeat.uniqueBy.forEach(text);
        }
      }
      if (f.parameters) {
        record(f.parameters);
        for (const p of Object.values(f.parameters)) {
          record(p);
          if (!['number', 'boolean', 'string'].includes(p.kind)) throw new RuleError('SCHEMA', 'Invalid parameter kind.');
          constraints(p);
          if (p.default !== undefined) value(p.default);
          if (p.options) {
            list(p.options);
            p.options.forEach(value);
          }
        }
      }
      if (f.resources) {
        list(f.resources);
        unique(f.resources.map((r) => r.id), 'resource requirement');
        for (const r of f.resources) {
          record(r);
          text(r.id);
          text(r.key);
          if (r.minimumCapacity !== undefined) number(r.minimumCapacity);
          if (r.scope && !['character', 'progression', 'parent', 'instance'].includes(r.scope)) throw new RuleError('SCHEMA', 'Invalid required scope.');
        }
      }
      if (f.tables) {
        record(f.tables);
        for (const t of Object.values(f.tables)) {
          record(t);
          if (!['exact', 'threshold'].includes(t.mode)) throw new RuleError('SCHEMA', 'Invalid table mode.');
          list(t.rows);
          if (!t.rows.length) throw new RuleError('SCHEMA', 'Empty table.');
          for (const row of t.rows) {
            record(row);
            number(row.key);
            number(row.value);
          }
          unique(t.rows.map((r) => String(r.key)), 'table key');
          for (const p of [t.below, t.above]) if (p !== 'boundary' && p !== 'error') {
            record(p);
            number(p.fallback);
          }
          if (t.missing !== undefined && t.missing !== 'error') {
            record(t.missing);
            number(t.missing.fallback);
          }
        }
      }
      unique(f.components.map((v) => v.id), 'component');
      f.components.forEach((v) => checkComponent(v, c, functions));
      // Unqualified table lookups resolve to the owning definition.
      const visitTables = (v: unknown): void => {
        if (!v || typeof v !== 'object') return;
        if (Array.isArray(v)) {
          v.forEach(visitTables);
          return;
        }
        const o = v as Record<string, unknown>;
        if ('table' in o && !('owner' in o) && !Object.hasOwn(f.tables ?? {}, String(o.table))) throw new RuleError('UNKNOWN_TABLE', `Missing ${f.id}/${o.table}.`);
        Object.values(o).forEach(visitTables);
      };
      visitTables(f.components);
    }
    const entries = (levels: unknown, minimumLevel = 1): void => {
      record(levels);
      for (const [level, rows] of Object.entries(levels)) {
        integer(Number(level), minimumLevel);
        list(rows);
        unique(rows.map((v) => {
          record(v);
          text(v.id);
          return v.id;
        }), 'progression entry');
        for (const v of rows) {
          checkComponent(v, c, functions);
          if (!['grantFeature', 'chooseFeatures'].includes(v.kind)) throw new RuleError('SCHEMA', 'Invalid progression entry.');
        }
      }
    };
    for (const cls of c.classes) entries(cls.levels);
    if (c.system.advancement) entries(c.system.advancement, 0);
    if (c.system.classes) {
      list(c.system.classes);
      for (const id of c.system.classes) if (!c.classes.some((v) => v.id === id)) throw new RuleError('UNKNOWN_CLASS', `Unknown System class ${id}.`);
    }
    if (c.system.alternatives) {
      record(c.system.alternatives);
      for (const [stat, alternatives] of Object.entries(c.system.alternatives)) {
        if (!c.system.stats.some((s) => s.id === stat)) throw new RuleError('UNKNOWN_STAT', stat);
        list(alternatives);
        unique(alternatives.map((a) => a.id), 'alternative');
        for (const a of alternatives) {
          text(a.id);
          checkExpression(a.expression, c, functions);
          if (a.requirements) checkPredicate(a.requirements, c, 0, functions);
        }
      }
    }
    const visiting = new Set<string>(), done = new Set<string>();
    const visit = (id: string): void => {
      if (visiting.has(id)) throw new RuleError('COMPOSITION_CYCLE', `Composition cycle at ${id}.`);
      if (done.has(id)) return;
      visiting.add(id);
      const f = c.features.find((f) => f.id === id)!;
      for (const v of f.components) {
        if (v.kind === 'grantFeature') visit(v.feature);
        if (v.kind === 'chooseFeatures') for (const candidate of c.features.filter((f) => (!v.candidates.ids || v.candidates.ids.includes(f.id)) && (!v.candidates.tags || v.candidates.tags.every((t) => f.tags?.includes(t))))) visit(candidate.id);
      }
      visiting.delete(id);
      done.add(id);
    };
    c.features.forEach((f) => visit(f.id));
    // Static cycles include all modifier dependencies, not only base formulas.
    const dependencies = new Map(c.system.stats.map((s) => [s.id, new Set<string>()]));
    const refs = (v: unknown, set: Set<string>): void => {
      if (!v || typeof v !== 'object') return;
      if (Array.isArray(v)) {
        v.forEach((x) => refs(x, set));
        return;
      }
      const o = v as Record<string, unknown>;
      if ('stat' in o && !('minimum' in o)) set.add(String(o.stat));
      Object.values(o).forEach((x) => refs(x, set));
    };
    for (const s of c.system.stats) if (s.kind === 'derived') refs(s.expression, dependencies.get(s.id)!);
    for (const f of c.features) for (const v of f.components) if (v.kind === 'modifyStat') {
      refs(v.value, dependencies.get(v.stat)!);
      refs(v.condition, dependencies.get(v.stat)!);
    }
    for (const [stat, values] of Object.entries(c.system.alternatives ?? {})) values.forEach((v) => refs(v.expression, dependencies.get(stat)!));
    visiting.clear();
    done.clear();
    const statVisit = (id: string): void => {
      if (visiting.has(id)) throw new RuleError('STAT_CYCLE', `Stat cycle at ${id}.`);
      if (done.has(id)) return;
      visiting.add(id);
      dependencies.get(id)?.forEach(statVisit);
      visiting.delete(id);
      done.add(id);
    };
    dependencies.forEach((_, id) => statVisit(id));
    return [];
  } catch (e) {
    const err = e instanceof RuleError ? e : new RuleError('SCHEMA', e instanceof Error ? e.message : 'Invalid catalogue.');
    return [{ code: err.code, path: err.path || 'catalogue', severity: 'invalid', message: err.message }];
  }
}

export function checkCharacter(v: unknown): asserts v is Character {
  if (v && typeof v === 'object') checkInventory(v as Character);
  record(v);
  checkMoney(v.money);
  if (v.notes !== undefined) {
    record(v.notes);
    if (Object.values(v.notes).some((note) => typeof note !== 'string')) throw new RuleError('SCHEMA', 'Character notes must be text.');
  }
  if (v.buildState !== undefined && v.buildState !== 'draft' && v.buildState !== 'finalized') throw new RuleError('SCHEMA', 'Invalid character build state.');
  record(v);
  if (v.version !== 1) throw new RuleError('SAVE_VERSION', 'Unsupported character version.');
  text(v.id);
  if (typeof v.name !== 'string') throw new RuleError('SCHEMA', 'Invalid name.');
  for (const k of ['system', 'catalogue']) {
    const ref = v[k];
    record(ref);
    text(ref.id);
    integer(ref.revision, 1);
  }
  record(v.contentRevisions);
  record(v.inputs);
  record(v.selections);
  record(v.bindings);
  record(v.alternatives);
  record(v.resources);
  record(v.pending);
  Object.values(v.contentRevisions).forEach((x) => integer(x, 1));
  Object.values(v.inputs).forEach(number);
  Object.values(v.bindings).forEach(text);
  Object.values(v.alternatives).forEach(text);
  const pick = (p: unknown): void => {
    record(p);
    text(p.id);
    text(p.feature);
    if (p.parameters) {
      record(p.parameters);
      Object.values(p.parameters).forEach(value);
    }
  };
  Object.values(v.selections).forEach((rows) => {
    list(rows);
    rows.forEach(pick);
  });
  list(v.roots);
  v.roots.forEach((p) => {
    pick(p);
    record(p);
    integer(p.acquiredCharacterLevel);
    if (p.acquiredEvent !== undefined) integer(p.acquiredEvent);
  });
  list(v.progressions);
  v.progressions.forEach((p) => {
    record(p);
    text(p.id);
    text(p.class);
    integer(p.level);
  });
  list(v.history);
  v.history.forEach((h) => {
    record(h);
    text(h.progression);
    integer(h.level, 1);
  });
  unique((v.progressions as Character['progressions']).map((p) => p.id), 'progression');
  unique((v.roots as Character['roots']).map((p) => p.id), 'root');
  for (const r of Object.values(v.resources)) {
    record(r);
    if (number(r.spent) < 0) throw new RuleError('SCHEMA', 'Negative expenditure.');
    if (r.current !== undefined) number(r.current);
    if (r.grants !== undefined) {
      list(r.grants);
      r.grants.forEach(text);
      unique(r.grants as string[], 'resource grant');
    }
  }
  for (const p of Object.values(v.pending)) {
    record(p);
    text(p.ability);
    record(p.costs);
    Object.values(p.costs).forEach((v) => {
      if (number(v) < 0) throw new RuleError('SCHEMA', 'Negative reservation.');
    });
    list(p.spendOnOutcomes);
    p.spendOnOutcomes.forEach(text);
  }
  if (v.rollResults !== undefined) {
    list(v.rollResults);
    for (const roll of v.rollResults) {
      record(roll);
      for (const key of ['id', 'instance', 'feature', 'definition', 'expression', 'breakdown']) text(roll[key]);
      number(roll.total);
      if (!Number.isSafeInteger(roll.total)) throw new RuleError('SCHEMA', 'Invalid rolled total.');
      if (roll.applied !== undefined) integer(roll.applied);
    }
    unique((v.rollResults as Character['rollResults'])!.map((roll) => roll.id), 'roll');
  }
  list(v.events);
  v.events.forEach((e) => {
    record(e);
    text(e.id);
    text(e.fingerprint);
    if (e.actions !== undefined) {
      record(e.actions);
      Object.values(e.actions).forEach((x) => integer(x));
    }
  });
  unique((v.events as Character['events']).map((e) => e.id), 'event');
}
