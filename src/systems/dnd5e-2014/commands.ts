import { Engine, clone } from '../../engine.js';
import { useAbility } from '../../commands.js';
import { RuleError, constrain } from '../../expression.js';
import type { Character, Value } from '../../model.js';

export interface SpellTurn { bonusActionSpell: boolean; otherSpell: boolean; onlyActionCantrips: boolean }
function checkEngine(engine: Engine): void { if (engine.catalogue.system.id !== 'dnd5e:2014-srd5.1') throw new RuleError('SYSTEM', 'This command requires DnD5e 2014.'); }

/** The caller owns turn boundaries and supplies fresh turn state each turn. */
export function castSpell(engine: Engine, character: Character, capability: string, eventId: string, turn: SpellTurn, options: { actions?: Record<string, number>; runtime?: Record<string, Value> } = {}): { character: Character; turn: SpellTurn; actions?: Record<string, number> } {
  checkEngine(engine);
  if (Object.values(turn).some(v => typeof v !== 'boolean') || ['bonusActionSpell','otherSpell','onlyActionCantrips'].some(k => !Object.hasOwn(turn,k))) throw new RuleError('TURN', 'Supply a valid spellcasting turn state.');
  const ability = engine.evaluate(character, options.runtime).capabilities.find(c => c.id === capability);
  const meta = ability?.definition.metadata;
  if (!ability || !['intelligence','charisma'].includes(String(meta?.castingAbility)) || typeof meta?.spellLevel !== 'number' || typeof meta.castingTime !== 'string') throw new RuleError('SPELL', 'Choose an available spell capability.');
  const bonus = meta.castingTime === '1 bonus action';
  const actionCantrip = meta.spellLevel === 0 && meta.castingTime === '1 action' && !meta.ritual;
  if ((turn.bonusActionSpell && !actionCantrip) || (bonus && turn.otherSpell && !turn.onlyActionCantrips)) throw new RuleError('BONUS_ACTION_SPELL', 'A bonus-action spell permits other spells on that turn only if they are cantrips with a casting time of one action.');
  const result = useAbility(engine, character, capability, eventId, { ...options, runtime: { ...options.runtime, turnBonusSpell: turn.bonusActionSpell, turnOtherSpell: turn.otherSpell, turnOnlyActionCantrips: turn.onlyActionCantrips } });
  return { character: result.character, actions: result.actions, turn: { bonusActionSpell: turn.bonusActionSpell || bonus, otherSpell: turn.otherSpell || !bonus, onlyActionCantrips: turn.onlyActionCantrips && (bonus || actionCantrip) } };
}

/** Convenient explicit name for callers using only the Wizard class. */
export const castWizardSpell = castSpell;

/** Selected recovery, unlike a rest, never restores all slot levels at once. */
export function recoverArcaneSlots(engine: Engine, input: Character, slots: Record<string, number>, restEventId: string, eventId: string): Character {
  checkEngine(engine);
  if (!eventId || !slots || typeof slots !== 'object' || Array.isArray(slots)) throw new RuleError('ARCANE_RECOVERY', 'Supply slot counts, a short-rest event, and a unique command ID.');
  const fingerprint = JSON.stringify({ kind: 'dnd2014-arcane-recovery', restEventId, slots: Object.fromEntries(Object.entries(slots).sort(([a],[b]) => a.localeCompare(b))) });
  const prior = input.events.find(e => e.id === eventId);
  if (prior) { if (prior.fingerprint !== fingerprint) throw new RuleError('EVENT_CONFLICT', 'Event ID was reused with different recovery data.'); return clone(input); }
  const result = engine.evaluate(input);
  if (result.status !== 'valid') throw new RuleError('INVALID_BUILD', 'Arcane Recovery requires a valid, complete character.');
  const restIndex = input.events.findIndex(e => e.id === restEventId);
  let lastDay = -1;
  input.events.forEach((e, i) => { try { const p = JSON.parse(e.fingerprint); if (p.kind === 'recover' && p.recoveryEvent === 'new-day') lastDay = i; } catch { /* Other event payloads do not supply a day boundary. */ } });
  let rest;
  try { rest = JSON.parse(input.events[restIndex]?.fingerprint ?? 'null'); } catch { rest = null; }
  if (rest?.kind !== 'recover' || rest.recoveryEvent !== 'short-rest' || restIndex < lastDay) throw new RuleError('SHORT_REST', 'Reference a completed short-rest event from the current day.');
  const entries = Object.entries(slots);
  let budget = 0;
  for (const [levelText, count] of entries) {
    if (!/^[1-5]$/.test(levelText)) throw new RuleError('ARCANE_RECOVERY', 'Only slot levels 1–5 can be recovered.');
    constrain(count, { integer: true, minimum: 1 }); budget += Number(levelText) * count;
    const pool = Object.values(result.resources).find(p => p.key === `spell-slot.${levelText}` && p.scope === 'character');
    if (!pool || count > pool.spent) throw new RuleError('ARCANE_RECOVERY', 'Recover only settled expenditure on existing slots.');
  }
  if (!entries.length || budget > result.stats.arcaneRecoveryBudget.value) throw new RuleError('ARCANE_RECOVERY', 'Recovery exceeds the Wizard level budget or contains no slots.');
  const ability = result.capabilities.find(c => c.definition.name === 'Arcane Recovery');
  if (!ability) throw new RuleError('ARCANE_RECOVERY', 'No Arcane Recovery capability.');
  if (input.events.some(e => e.id === `${eventId}/charge`)) throw new RuleError('EVENT_CONFLICT', 'Recovery charge ID is already in use.');
  const character = useAbility(engine, input, ability.id, `${eventId}/charge`).character;
  for (const [levelText, count] of entries) {
    const pool = Object.values(result.resources).find(p => p.key === `spell-slot.${levelText}` && p.scope === 'character')!;
    character.resources[pool.id] = { spent: pool.spent - count };
  }
  character.events.push({ id: eventId, fingerprint });
  return character;
}
