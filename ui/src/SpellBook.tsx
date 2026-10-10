import { expressionText } from '@/ui/src/feature-requirements';
import { labelFromId } from '@/ui/src/workspace';
import { useState } from 'react';
import { featureRollInstances, adjustResource, spellGroups, spellSlotPools, useAbility as activateAbility, type Character, type Engine, type EvaluationResult, type SpellGroup } from '@/src/index';
import { FeatureLink } from '@/ui/src/FeatureLink';
import { FeatureRules } from '@/ui/src/RulesText';
import { FeatureRolls } from '@/ui/src/FeatureRolls';
import { Modal } from '@/ui/src/Modal';

export function SpellBook({ engine, character, result, ready, update, report }: { engine: Engine; character: Character; result: EvaluationResult; ready: boolean; update: (character: Character) => void; report: (message: string) => void }) {
  const [showEmpty, setShowEmpty] = useState(false);
  const [casting, setCasting] = useState<string>();
  const [mode, setMode] = useState('');
  const [spent, setSpent] = useState<Record<string, string>>({});
  const spells = spellGroups(engine, result), slots = spellSlotPools(engine, result);
  const selected = spells.find((spell) => spell.id === casting);
  const attempt = (action: () => void) => {
    try {
      action();
    } catch (error) {
      report(error instanceof Error ? error.message : String(error));
    }
  };
  const cast = (id: string) => attempt(() => {
    const spell = spells.find((entry) => entry.modes.some((option) => option.capability.id === id))!;
    const option = spell.modes.find((entry) => entry.capability.id === id)!;
    const costs = Object.entries(option.capability.costs).filter(([, amount]) => amount > 0).map(([pool, amount]) => `${amount} ${result.resources[pool].name} spent`).join(' · ');
    update(activateAbility(engine, character, id, crypto.randomUUID(), { actionTracking: 'manual' }).character);
    setSpent({ ...spent, [spell.id]: costs });
    setCasting(undefined);
  });
  const label = (option: SpellGroup['modes'][number]) => option.ritual ? 'Ritual — no spell slot' : option.slotLevel === 0 ? 'Cantrip — no spell slot' : `Level ${option.slotLevel} · ${Object.keys(option.capability.costs).map((id) => result.resources[id]?.name ?? 'Spell slot').join(', ')}${option.available ? '' : ' — none remaining'}`;
  const actionable = (spell: SpellGroup) => featureRollInstances(engine, result, spell.feature).length > 0 || spell.modes.some((option) => Object.values(option.capability.costs).some((amount) => amount > 0));
  const notification = (spell: SpellGroup) => {
    const latest = character.rollResults?.filter((record) => record.casting?.spell === spell.feature && spell.modes.some((option) => option.capability.id === record.casting?.capability)).at(-1);
    return spent[spell.id] ?? (latest?.casting ? latest.casting.ritual ? 'Ritual · no spell slot spent' : latest.casting.slotLevel ? `1 level ${latest.casting.slotLevel} spell slot spent` : 'Cantrip · no spell slot spent' : undefined);
  };
  if (!spells.length && !slots.length) return null;
  return (
    <section className="spellbook">
      <div className="row">
        <h2>Spell slots</h2>
        <label className="checkbox-label">
          <input type="checkbox" checked={showEmpty} onChange={(event) => setShowEmpty(event.target.checked)} />
          Show all spell slots
        </label>
      </div>
      <div className="spell-slots">
        {slots.filter(({ pool }) => showEmpty || (pool.current ?? pool.capacity - pool.spent) > 0).map(({ level, pool }) => (
          <article className="spell-slot" key={pool.id}>
            <h3>{`${pool.name ?? 'Spell slots'} · Level ${level}`}</h3>
            <strong>{`${pool.current ?? pool.capacity - pool.spent} / ${pool.capacity}`}</strong>
            <p className="muted small">{pool.recovery.map((recovery) => `${labelFromId(recovery.event)}: ${recovery.amount === 'full' ? 'restore to maximum' : `${recovery.dice ? `${recovery.dice} + ` : ''}${expressionText(recovery.amount, engine)}`}`).join(' · ')}</p>
            <div className="slot-pips" aria-hidden="true">{Array.from({ length: Math.min(12, pool.capacity) }, (_, index) => <span className={index < pool.available ? 'filled' : ''} key={index} />)}</div>
            <div className="toolbar">
              <button className="quiet resource-adjust-button" aria-label={`Decrease ${pool.name}`} disabled={!ready || pool.available < 1} onClick={() => attempt(() => update(adjustResource(engine, character, pool.id, -1, crypto.randomUUID())))}>−</button>
              <button className="quiet resource-adjust-button" aria-label={`Increase ${pool.name}`} disabled={!ready || (pool.current ?? pool.capacity - pool.spent) >= pool.capacity} onClick={() => attempt(() => update(adjustResource(engine, character, pool.id, 1, crypto.randomUUID())))}>+</button>
            </div>
          </article>
        ))}
      </div>
      {!showEmpty && !slots.some(({ pool }) => (pool.current ?? pool.capacity - pool.spent) > 0) && <p className="muted">No spell slots remaining. Show all spell slots to adjust or inspect them.</p>}
      <h2>Spells</h2>
      {[...new Set(spells.map((spell) => spell.level))].map((level) => (
        <details className="spell-level" key={level} open>
          <summary>{level === 0 ? 'Cantrips' : `Level ${level} spells`}</summary>
          {spells.filter((spell) => spell.level === level).map((spell) => (
            <article className="panel spell-row" key={spell.id}>
              <div className="row">
                <div>
                  <h3><FeatureLink id={spell.feature} engine={engine}>{spell.name}</FeatureLink></h3>
                  <small>
                    {`Casting ability: ${labelFromId(spell.castingAbility)}`}
                    {spell.modes.every((mode) => mode.ritual) ? ' · Ritual only' : ''}
                  </small>
                </div>
                <div className="spell-action">
                  {actionable(spell) && (
                    <button
                      disabled={!ready || !spell.modes.some((option) => option.available)}
                      onClick={() => {
                        const available = spell.modes.filter((option) => option.available);
                        if (spell.modes.length === 1 && !featureRollInstances(engine, result, spell.feature).length) cast(available[0].capability.id);
                        else {
                          setMode(available[0].capability.id);
                          setCasting(spell.id);
                        }
                      }}
                    >
                      Use Spell
                    </button>
                  )}
                  {notification(spell) && <small role="status">{notification(spell)}</small>}
                </div>
              </div>
              <details>
                <summary>Spell description</summary>
                {engine.getFeature(spell.feature) && <FeatureRules feature={engine.getFeature(spell.feature)!} engine={engine} showRolls={false} />}
              </details>
              {engine.getFeature(spell.feature) && <FeatureRolls feature={engine.getFeature(spell.feature)!} engine={engine} resultsOnly />}
            </article>
          ))}
        </details>
      ))}
      {selected && (
        <Modal title={`Cast ${selected.name}`} onClose={() => setCasting(undefined)}>
          <p>{`Original level: ${selected.level}. Choose an available casting option.`}</p>
          <label>
            Cast using
            <select value={mode} onChange={(event) => setMode(event.target.value)}>{selected.modes.map((option) => <option key={option.capability.id} value={option.capability.id} disabled={!option.available}>{label(option)}</option>)}</select>
          </label>
          {featureRollInstances(engine, result, selected.feature).length
            ? (
                <>
                  <p>Rolling spends the selected casting cost immediately. Apply the saved result separately.</p>
                  <FeatureRolls feature={engine.getFeature(selected.feature)!} engine={engine} castingCapability={mode} />
                </>
              )
            : <button disabled={!ready || !selected.modes.some((option) => option.capability.id === mode && option.available)} onClick={() => cast(mode)}>Use Spell</button>}
        </Modal>
      )}
    </section>
  );
}
