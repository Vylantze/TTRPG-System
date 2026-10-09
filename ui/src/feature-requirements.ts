import type { Engine, Expression, FeatureDefinition, Predicate } from '../../src/index';
import { featureName, tagName } from './display';
import { labelFromId } from './workspace';

function expressionText (expression:Expression,engine:Engine):string {
  if(typeof expression !== 'object')return String(expression);
  if('literal' in expression)return String(expression.literal);
  if('stat' in expression)return engine.catalogue.system.stats.find(s=>s.id === expression.stat)?.name ?? labelFromId(expression.stat);
  if('context' in expression) {
    const cls = expression.context.startsWith('level.') ? engine.catalogue.classes.find(c=>c.id === expression.context.slice(6)) : undefined;
    return cls ? `${cls.name} level` : labelFromId(expression.context);
  }
  if('parameter' in expression)return labelFromId(expression.parameter);
  if('base' in expression)return 'Base value';
  if('if' in expression)return `if ${expressionText(expression.if,engine)}, then ${expressionText(expression.then,engine)}, otherwise ${expressionText(expression.else,engine)}`;
  if('table' in expression)return `${labelFromId(expression.table)} table at ${expressionText(expression.input,engine)}`;
  if('call' in expression)return `${labelFromId(expression.call)}(${expression.args.map(a=>expressionText(a,engine)).join(', ')})`;
  const symbols:Record<string,string> = {add:' + ',subtract:' − ',multiply:' × ',divide:' ÷ ',eq:' = ',gt:' > ',gte:' ≥ ',lt:' < ',lte:' ≤ ',and:' AND ',or:' OR '};
  const args = expression.args.map(a=>expressionText(a,engine));
  if(expression.op === 'not')return `NOT (${args[0]})`;
  return symbols[expression.op] ? `(${args.join(symbols[expression.op])})` : `${labelFromId(expression.op)}(${args.join(', ')})`;
}

export function predicateText (predicate:Predicate,engine:Engine):string {
  if('level' in predicate)return `${predicate.kind === 'class' ? 'Class' : 'Character'} level ${predicate.level} or higher`;
  if('feature' in predicate)return `Requires ${featureName(engine.catalogue.features.find(f=>f.id === predicate.feature))}${predicate.parameters ? ` (${Object.entries(predicate.parameters).map(([key,value])=>`${labelFromId(key)}: ${value}`).join(', ')})` : ''}`;
  if('tag' in predicate)return `Requires a Feature tagged ${tagName(engine.catalogue.system,predicate.tag)}`;
  if('stat' in predicate)return `${engine.catalogue.system.stats.find(s=>s.id === predicate.stat)?.name ?? labelFromId(predicate.stat)} ${predicate.minimum} or higher`;
  if('parameter' in predicate)return `${labelFromId(predicate.parameter)}: ${predicate.equals}`;
  if('expression' in predicate)return expressionText(predicate.expression,engine);
  if('not' in predicate)return `NOT (${predicateText(predicate.not,engine)})`;
  const children = 'all' in predicate ? predicate.all : predicate.any;
  return `(${children.map(child=>predicateText(child,engine)).join('all' in predicate ? ' AND ' : ' OR ')})`;
}

function levelList (levels:number[]):string {
  const sorted = [...new Set(levels)].sort((a,b)=>a - b),ranges:string[] = [];
  for(let i = 0;i < sorted.length;i++) {const start = sorted[i];while(i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1)i++;ranges.push(start === sorted[i] ? String(start) : `${start}–${sorted[i]}`);}
  return ranges.join(', ');
}

/** Class grants need no redundant level predicate: expose their authored progression timing. */
export function advancementLabels (feature:FeatureDefinition,engine:Engine):string[] {
  return engine.getFeatureAdvancement(feature.id).map(({className,levels})=>`${className} ${levels.length === 1 ? 'level' : 'levels'} ${levelList(levels)}`);
}
