import { useAbility } from './commands.js';
import { Engine, clone } from './engine.js';
import { RuleError, constrain } from './expression.js';
import type { Character, Value } from './model.js';
import type { SpellTurn } from './types/SpellTurn.js';
import { checkCharacter, record } from './validation.js';
export type { SpellTurn } from './types/SpellTurn.js';

/** The caller owns turn boundaries and supplies fresh turn state each turn. */
export function castSpell (engine: Engine, character: Character, capability: string, eventId: string, turn: SpellTurn, options: { actions?: Record<string, number>; runtime?: Record<string, Value> } = {}): { character: Character; turn: SpellTurn; actions?: Record<string, number> } {
  const policy = engine.catalogue.system.commandRules?.spellTurn;
  if (!policy) throw new RuleError('SYSTEM', 'This System has no spell turn policy.');
  record(turn);
  if (Object.values(turn).some(v => typeof v !== 'boolean') || ['bonusActionSpell','otherSpell','onlyActionCantrips'].some(k => !Object.hasOwn(turn,k))) throw new RuleError('TURN', 'Supply a valid spellcasting turn state.');
  const ability = engine.evaluate(character, options.runtime).capabilities.find(c => c.id === capability);
  const meta = ability?.definition.metadata;
  if (!ability || typeof meta?.[policy.castingAbilityKey] !== 'string' || typeof meta?.[policy.levelKey] !== 'number' || typeof meta[policy.timeKey] !== 'string') throw new RuleError('SPELL', 'Choose an available spell capability.');
  const bonus = meta[policy.timeKey] === policy.bonusTime;
  const actionCantrip = meta[policy.levelKey] === 0 && meta[policy.timeKey] === policy.actionTime && !meta[policy.ritualKey];
  if ((turn.bonusActionSpell && !actionCantrip) || (bonus && turn.otherSpell && !turn.onlyActionCantrips)) throw new RuleError('BONUS_ACTION_SPELL', 'The System turn policy permits only action cantrips alongside a bonus-action spell.');
  const result = useAbility(engine, character, capability, eventId, { ...options, runtime: { ...options.runtime, turnBonusSpell: turn.bonusActionSpell, turnOtherSpell: turn.otherSpell, turnOnlyActionCantrips: turn.onlyActionCantrips } });
  return { character: result.character, actions: result.actions, turn: { bonusActionSpell: turn.bonusActionSpell || bonus, otherSpell: turn.otherSpell || !bonus, onlyActionCantrips: turn.onlyActionCantrips && (bonus || actionCantrip) } };
}

/** Convenient explicit name for callers using only the Wizard class. */
export const castWizardSpell = castSpell;

/** Selected recovery, unlike a rest, never restores all slot levels at once. */
export function recoverSelectedResources (engine: Engine, input: Character, slots: Record<string, number>, restEventId: string, eventId: string): Character {
  checkCharacter(input); record(slots);
  const policy = engine.catalogue.system.commandRules?.selectedRecovery;
  if (!policy) throw new RuleError('SYSTEM', 'This System has no selected recovery policy.');
  if (!eventId || !slots || typeof slots !== 'object' || Array.isArray(slots)) throw new RuleError('SELECTED_RECOVERY', 'Supply target counts, a recovery event, and a unique command ID.');
  const fingerprint = JSON.stringify({ kind: policy.eventKind ?? 'selected-recovery', restEventId, slots: Object.fromEntries(Object.entries(slots).sort(([a],[b]) => a.localeCompare(b))) });
  const prior = input.events.find(e => e.id === eventId);
  if (prior) { if (prior.fingerprint !== fingerprint) throw new RuleError('EVENT_CONFLICT', 'Event ID was reused with different recovery data.'); return clone(input); }
  const result = engine.evaluate(input);
  if (result.status !== 'valid') throw new RuleError('INVALID_BUILD', 'Selected recovery requires a valid, complete character.');
  const restIndex = input.events.findIndex(e => e.id === restEventId);
  let lastDay = -1;
  input.events.forEach((e, i) => { try { const p = JSON.parse(e.fingerprint); if (p.kind === 'recover' && p.recoveryEvent === policy.boundaryEvent) lastDay = i; } catch { /* Other event payloads do not supply a day boundary. */ } });
  let rest;
  try { rest = JSON.parse(input.events[restIndex]?.fingerprint ?? 'null'); } catch { rest = null; }
  if (rest?.kind !== 'recover' || rest.recoveryEvent !== policy.requiredEvent || restIndex < lastDay) throw new RuleError('SHORT_REST', 'Reference a completed required recovery event after the last boundary.');
  const entries = Object.entries(slots);
  let budget = 0;
  for (const [levelText, count] of entries) {
    if (!Object.hasOwn(policy.targets, levelText)) throw new RuleError('SELECTED_RECOVERY', 'Unknown recovery target.');
    constrain(count, { integer: true, minimum: 1 }); budget += policy.targets[levelText].weight * count;
    const pools = Object.values(result.resources).filter(p => p.key === policy.targets[levelText].key && p.scope === policy.targets[levelText].scope);
    if (pools.length > 1) throw new RuleError('SELECTED_RECOVERY', 'Ambiguous recovery pool.');
    const pool = pools[0];
    if (!pool || count > pool.spent) throw new RuleError('SELECTED_RECOVERY', 'Recover only settled expenditure on existing slots.');
  }
  if (!entries.length || budget > result.stats[policy.budgetStat].value) throw new RuleError('SELECTED_RECOVERY', 'Recovery exceeds the System budget or contains no slots.');
  const abilities = result.capabilities.filter(c => c.definition.name === policy.capabilityName);
  if (abilities.length > 1) throw new RuleError('SELECTED_RECOVERY', 'Ambiguous recovery capability.');
  const ability = abilities[0];
  if (!ability) throw new RuleError('SELECTED_RECOVERY', 'No selected recovery capability.');
  if (ability.definition.spendOnOutcomes) throw new RuleError('SELECTED_RECOVERY', 'Selected recovery requires immediate capability costs.');
  if (input.events.some(e => e.id === `${eventId}/charge`)) throw new RuleError('EVENT_CONFLICT', 'Recovery charge ID is already in use.');
  const character = useAbility(engine, input, ability.id, `${eventId}/charge`).character;
  for (const [levelText, count] of entries) {
    const pool = Object.values(result.resources).find(p => p.key === policy.targets[levelText].key && p.scope === policy.targets[levelText].scope)!;
    character.resources[pool.id] = { spent: (character.resources[pool.id]?.spent ?? pool.spent) - count };
  }
  character.events.push({ id: eventId, fingerprint });
  return character;
}

/** Compatibility aliases; all behavior comes from the loaded System command policies. */
export const recoverArcaneSlots = recoverSelectedResources;
