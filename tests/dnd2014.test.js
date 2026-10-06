import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, applyEdit, useAbility, recoverResources, classEntryPath, selectionPath, pickPath, serializeCharacter, deserializeCharacter, validateCatalogue } from '../dist/index.js';
import { createDnd2014Catalogue, createDnd2014Engine, wizardSpells, armor, castSpell, castWizardSpell, recoverArcaneSlots, dnd2014Coverage, getDnd2014FeatureCoverage } from '../dist/systems/dnd5e-2014/index.js';
import { exampleCharacter } from '../examples/dnd2014-character.js';
const id = name => `dnd5e:2014:${name}`;
const pick = (feature, parameters, entry = 'pick-0') => ({ id: entry, feature: id(feature), ...(parameters ? { parameters } : {}) });
const code = (r,c) => r.diagnostics.some(d => d.code === c);
const setup = (cls = 'fighter', lvl = 1, extra = {}) => exampleCharacter({ classes: [{ class: cls, level: lvl }], ...extra });
const values = r => Object.fromEntries(Object.entries(r.stats).map(([k,s]) => [k,s.value]));
const pool = (r,key) => Object.values(r.resources).find(p => p.key === key);
const capability = (r,name) => r.capabilities.find(c => c.definition.name === name);
const preparedPath = selectionPath(classEntryPath('class-0',1,'spellcasting'),'prepared');
const freshTurn = () => ({ bonusActionSpell: false, otherSpell: false, onlyActionCantrips: true });

test('2014 catalogue is serializable, isolated, and advertises its precise coverage', () => {
  const catalogue = createDnd2014Catalogue();
  assert.deepEqual(validateCatalogue(JSON.parse(JSON.stringify(catalogue))), []);
  assert.equal(catalogue.classes.length, 3); assert.equal(wizardSpells.length,204);
  assert.equal(dnd2014Coverage.unsupportedClasses.length,9);
  assert.equal(getDnd2014FeatureCoverage(catalogue).length,catalogue.features.length);
  catalogue.features[0].name = 'Changed'; assert.notEqual(createDnd2014Catalogue().features[0].name,'Changed');
  assert.throws(() => createDnd2014Catalogue({ multiclass: 'yes' }));
});

for (const cls of ['fighter','rogue','wizard']) for (let lvl=1; lvl<=20; lvl++) {
  test(`${cls} level ${lvl} has a complete build, correct HP and proficiency`, () => {
    const { evaluation:r } = setup(cls,lvl);
    assert.equal(r.status,'valid',JSON.stringify(r.diagnostics));
    const v=values(r), die={fighter:10,rogue:8,wizard:6}[cls], fixed=die/2+1;
    assert.equal(v.proficiencyBonus,2+Math.floor((lvl-1)/4));
    assert.equal(v.hitPoints,die+(lvl-1)*fixed+lvl*v['modifier.constitution']);
    if (cls==='fighter') {
      assert.equal(v.attacksPerAction,lvl>=20?4:lvl>=11?3:lvl>=5?2:1);
      assert.equal(v.criticalThreshold,lvl>=15?18:lvl>=3?19:20);
      assert.equal(pool(r,'second-wind').capacity,1);
      if(lvl>=2)assert.equal(pool(r,'action-surge').capacity,lvl>=17?2:1);
      if(lvl>=9)assert.equal(pool(r,'indomitable').capacity,lvl>=17?3:lvl>=13?2:1);
    }
    if (cls==='rogue') assert.equal(v.sneakAttackDice,Math.ceil(lvl/2));
    if (cls==='wizard') {
      assert.equal(v.wizardSpellLevel,Math.min(9,Math.ceil(lvl/2)));
      assert.equal(r.instances.filter(i=>i.active&&i.eligible&&i.feature.startsWith(id('spellbook.'))).length,6+(lvl-1)*2);
    }
  });
}

for(const race of ['human','hill-dwarf','high-elf','lightfoot-halfling','dragonborn','rock-gnome','half-elf','half-orc','tiefling']) {
  test(`${race} supplies a valid SRD origin with its correct scores and speed`, () => {
    const {evaluation:r}=setup('fighter',1,{race}); assert.equal(r.status,'valid',JSON.stringify(r.diagnostics));
    const boosts={human:[1,1,1,1,1,1],'hill-dwarf':[0,0,2,0,1,0],'high-elf':[0,2,0,1,0,0],'lightfoot-halfling':[0,2,0,0,0,1],dragonborn:[2,0,0,0,0,1],'rock-gnome':[0,0,1,2,0,0],'half-elf':[1,1,0,0,0,2],'half-orc':[2,0,1,0,0,0],tiefling:[0,0,0,1,0,2]}[race];
    ['strength','dexterity','constitution','intelligence','wisdom','charisma'].forEach((a,i)=>assert.equal(r.stats[a].value,[15,14,13,12,10,8][i]+boosts[i]));
    assert.equal(r.stats.speed.value,['hill-dwarf','rock-gnome','lightfoot-halfling'].includes(race)?25:30);
    if(race==='hill-dwarf')assert.equal(r.stats.hitPoints.value,13);
  });
}

test('Fighter 3 / Rogue 2 uses total proficiency, class resources and multiclass HP', () => {
  const {evaluation:r}=exampleCharacter({classes:[{class:'fighter',level:3},{class:'rogue',level:2}],settings:{multiclass:true}});
  assert.equal(r.status,'valid'); const v=values(r);
  assert.equal(r.characterLevel,5);assert.equal(v.proficiencyBonus,3);assert.equal(v.hitPoints,42);
  assert.equal(v['training.save.strength'],1);assert.equal(v['training.save.dexterity'],0);
  assert.equal(v['save.wisdom'],v['modifier.wisdom']);
  assert.equal(v['skill.insight'],v['modifier.wisdom']+2*v.proficiencyBonus);
  assert.equal(v.sneakAttackDice,1);
});

test('a multiclass Fighter gains no heavy armor or starting saves', () => {
  const {evaluation:r}=exampleCharacter({classes:[{class:'wizard',level:1},{class:'fighter',level:1}],settings:{multiclass:true}});
  assert.equal(r.status,'valid');const v=values(r);
  assert.equal(v['training.armor.medium'],1);assert.equal(v['training.armor.heavy'],0);
  assert.equal(v['training.save.intelligence'],1);assert.equal(v['training.save.constitution'],0);
  assert.equal(v.hitPoints,16);assert.equal(pool(r,'spell-slot.1').capacity,2);
});

test('a multiclass Rogue adds one skill and thieves tools, no weapon proficiencies', () => {
  const {evaluation:r}=exampleCharacter({classes:[{class:'wizard',level:1},{class:'rogue',level:1}],settings:{multiclass:true}});
  assert.equal(r.status,'valid');assert.equal(r.stats['training.weapons.simple'].value,0);
  assert.equal(r.stats['training.tool.thieves-tools'].value,1);
  assert.equal(r.selections.find(s=>s.id===selectionPath(classEntryPath('class-1',1,'entry'),'skills')).minimum,1);
});

test('multiclass optional setting and requirements apply to both classes', () => {
  const {engine,character}=exampleCharacter({classes:[{class:'fighter',level:1},{class:'wizard',level:1}],settings:{multiclass:true,abilityMethod:'manual'}});
  character.inputs['base.intelligence']=8;assert(code(engine.evaluate(character),'MULTICLASS_PREREQUISITE'));
  assert.equal(createDnd2014Engine().catalogue.system.allowMultipleClasses,false);
  const disabled=createDnd2014Engine().createCharacter('x','X',[{id:'f',class:id('fighter'),level:1},{id:'r',class:id('rogue'),level:1}]);
  assert(code(createDnd2014Engine().evaluate(disabled),'MULTICLASS'));
});

test('future ASIs cannot retroactively qualify a multiclass entry', () => {
  const history=[{progression:'class-0',level:1},{progression:'class-1',level:1},{progression:'class-1',level:2},{progression:'class-1',level:3},{progression:'class-1',level:4}];
  const {engine,character}=exampleCharacter({classes:[{class:'fighter',level:1},{class:'rogue',level:4}],history,settings:{multiclass:true,abilityMethod:'manual'}});
  character.inputs['base.dexterity']=10;
  character.selections[classEntryPath('class-1',4,'improvement')]=[pick('ability-score-improvement',{strength:0,dexterity:2,constitution:0,intelligence:0,wisdom:0,charisma:0})];
  const r=engine.evaluate(character);assert.equal(r.stats.dexterity.value,13);assert(r.diagnostics.some(d=>d.code==='MULTICLASS_PREREQUISITE'&&d.path.includes('/history/')));
});

test('duplicate classes, total levels above 20, and class levels above 20 are invalid', () => {
  const e=createDnd2014Engine({multiclass:true});
  assert(code(e.evaluate(e.createCharacter('x','X',[{id:'a',class:id('fighter'),level:1},{id:'b',class:id('fighter'),level:1}])),'DUPLICATE_CLASS'));
  assert(code(e.evaluate(e.createCharacter('x','X',[{id:'a',class:id('fighter'),level:21}])),'CLASS_LEVEL'));
  const {engine,character}=exampleCharacter({classes:[{class:'fighter',level:20},{class:'rogue',level:1}],settings:{multiclass:true}});
  assert(code(engine.evaluate(character),'SYSTEM_RULE'));
});

test('standard array and point-buy validate base inputs before race and ASI adjustments', () => {
  const {engine,character}=setup();character.inputs['base.strength']=16;assert(code(engine.evaluate(character),'SYSTEM_RULE'));
  const b=setup('fighter',1,{settings:{abilityMethod:'point-buy'}});
  const scores=[15,15,15,8,8,8];['strength','dexterity','constitution','intelligence','wisdom','charisma'].forEach((a,i)=>b.character.inputs[`base.${a}`]=scores[i]);
  assert.equal(b.engine.evaluate(b.character).status,'valid');b.character.inputs['base.charisma']=9;assert(code(b.engine.evaluate(b.character),'SYSTEM_RULE'));
  b.character.inputs['base.strength']=16;assert(code(b.engine.evaluate(b.character),'SYSTEM_RULE'));
});

test('ASI requires two integral points and respects its own cap without capping other Features', () => {
  const {engine,character}=setup('fighter',4,{settings:{abilityMethod:'manual'}});
  const path=classEntryPath('class-0',4,'improvement'),params={strength:1,dexterity:1,constitution:0,intelligence:0,wisdom:0,charisma:0};
  character.selections[path]=[pick('ability-score-improvement',params)];assert.equal(engine.evaluate(character).status,'valid');
  character.selections[path][0].parameters.strength=0.5;assert(code(engine.evaluate(character),'PARAMETER'));
  params.strength=1;character.selections[path][0].parameters=params;character.inputs['base.strength']=20;assert(code(engine.evaluate(character),'PREREQUISITE'));
});

test('Constitution changes recalculate every historical HP contribution', () => {
  const {engine,character}=setup('fighter',3,{settings:{abilityMethod:'manual'}});const before=engine.evaluate(character);
  const after=applyEdit(engine,character,[{kind:'input',stat:'base.constitution',value:15}],'increase-con',{requireValid:true});
  assert.equal(engine.evaluate(after).stats.hitPoints.value,before.stats.hitPoints.value+3);
  const rolled=structuredClone(after);rolled.selections[classEntryPath('class-0',2,'hit-points')]=[pick('fighter.hit-points',{roll:1})];
  assert.equal(engine.evaluate(rolled).stats.hitPoints.value,engine.evaluate(after).stats.hitPoints.value-5);
});

test('each HP level contributes at least one and fractional/out-of-die rolls fail', () => {
  const {engine,character}=setup('wizard',2,{settings:{abilityMethod:'manual'}});character.inputs['base.constitution']=1;
  character.selections[classEntryPath('class-0',2,'hit-points')]=[pick('wizard.hit-points',{roll:1})];
  assert.equal(engine.evaluate(character).stats.hitPoints.value,3);
  character.selections[classEntryPath('class-0',2,'hit-points')][0].parameters.roll=6.5;assert(code(engine.evaluate(character),'PARAMETER'));
});

test('optional Grappler is filtered, and losing Strength invalidates its maintenance', () => {
  const {engine,character}=setup('fighter',4,{settings:{feats:true,abilityMethod:'manual'}});
  character.selections[classEntryPath('class-0',4,'improvement')]=[pick('feat.grappler')];assert.equal(engine.evaluate(character).status,'valid');
  character.inputs['base.strength']=10;assert.equal(engine.evaluate(character).status,'invalid');assert(code(engine.evaluate(character),'MAINTENANCE')||code(engine.evaluate(character),'PREREQUISITE'));
  const disabled=setup('fighter',4);disabled.character.selections[classEntryPath('class-0',4,'improvement')]=[pick('feat.grappler')];assert(code(disabled.engine.evaluate(disabled.character),'CANDIDATE'));
});

test('Second Wind consumes one bonus action and recovers on either rest', () => {
  const {engine,character,evaluation}=setup();const cap=capability(evaluation,'Second Wind');
  const used=useAbility(engine,character,cap.id,'wind',{actions:{'bonus-action':1}});
  assert.equal(used.actions['bonus-action'],0);assert.equal(pool(engine.evaluate(used.character),'second-wind').available,0);
  assert.throws(()=>useAbility(engine,used.character,cap.id,'wind-again',{actions:{'bonus-action':1}}));
  for(const rest of ['short-rest','long-rest'])assert.equal(pool(engine.evaluate(recoverResources(engine,used.character,rest,rest)),'second-wind').available,1);
});

test('armor AC handles medium Dex caps, heavy armor, shields and Defense', () => {
  const {engine,character}=setup('fighter',1,{settings:{abilityMethod:'manual'}});character.inputs['base.dexterity']=19;
  character.inputs.armorIndex=armor.findIndex(a=>a.name==='Half plate');character.inputs.shield=1;
  assert.equal(engine.evaluate(character).stats.armorClass.value,20);
  character.inputs.armorIndex=12;assert.equal(engine.evaluate(character).stats.armorClass.value,21);
  character.inputs.armorIndex=0;assert.equal(engine.evaluate(character).stats.armorClass.value,17);
});

test('heavy armor speed penalty uses Strength, and Dwarves are exempt', () => {
  const f=setup('fighter',1,{settings:{abilityMethod:'manual'}});f.character.inputs['base.strength']=8;f.character.inputs.armorIndex=12;
  assert.equal(f.engine.evaluate(f.character).stats.speed.value,20);
  const d=setup('fighter',1,{race:'hill-dwarf',settings:{abilityMethod:'manual'}});d.character.inputs['base.strength']=8;d.character.inputs.armorIndex=12;
  assert.equal(d.engine.evaluate(d.character).stats.speed.value,25);
});

test('nonproficient armor is permitted with descriptive penalties but blocks spellcasting', () => {
  const {engine,character}=setup('wizard');character.inputs.armorIndex=12;const r=engine.evaluate(character);
  assert.equal(r.status,'valid');assert.equal(r.stats.armorProficient.value,0);assert(!capability(r,'Magic Missile (slot 1)'));assert(!capability(r,'Fire Bolt'));
});

test('Champion applies half proficiency only to untrained physical checks', () => {
  const {evaluation:r}=setup('fighter',7),v=values(r);
  assert.equal(v['skill.stealth'],v['modifier.dexterity']+2);
  assert.equal(v['skill.acrobatics'],v['modifier.dexterity']+v.proficiencyBonus);
  assert.equal(v.initiative,v['modifier.dexterity']+2);
});

test('Wizard spells pin header metadata to the official SRD, including casting times', () => {
  const missile=wizardSpells.find(s=>s.slug==='magic-missile');assert.equal(missile.level,1);assert.equal(missile.school,'evocation');assert.equal(missile.castingTime,'1 action');
  assert.equal(wizardSpells.find(s=>s.slug==='shield').castingTime.startsWith('1 reaction'),true);
  assert.equal(wizardSpells.find(s=>s.slug==='misty-step').castingTime,'1 bonus action');
  assert(wizardSpells.find(s=>s.slug==='alarm').ritual);assert.equal(wizardSpells.find(s=>s.slug==='see-invisibility').level,2);
  assert(wizardSpells.every(s=>s.page>=114&&s.page<200&&s.range&&s.components));
});

test('Wizard 3 slots, DC, preparation limit, and school are calculated independently', () => {
  const {evaluation:r}=setup('wizard',3),v=values(r);
  assert.equal(v['spellSlots.1'],4);assert.equal(v['spellSlots.2'],2);assert.equal(v['spellSlots.3'],0);
  assert.equal(v.wizardSpellDC,8+v.proficiencyBonus+v['modifier.intelligence']);assert.equal(v.wizardPreparationLimit,3+v['modifier.intelligence']);
});

test('daily preparation uses current ownership while level-up learning remains historical', () => {
  const {engine,character}=setup('wizard',5);
  const prepared=applyEdit(engine,character,[{kind:'select',selection:preparedPath,picks:[pick('prepared.fireball')],event:'long-rest'}],'prepare-fireball',{requireValid:true});
  assert(capability(engine.evaluate(prepared),'Fireball (slot 3)'));
  const malformed=structuredClone(prepared);malformed.selections[classEntryPath('class-0',1,'spellbook')][0]=pick('spellbook.fireball');
  assert(code(engine.evaluate(malformed),'CANDIDATE'));
  const foreign=structuredClone(character);foreign.selections[preparedPath]=[pick('prepared.fly')];assert(code(engine.evaluate(foreign),'PREREQUISITE'));
  foreign.selections[preparedPath]=[pick('prepared.wish')];assert(code(engine.evaluate(foreign),'CANDIDATE'));
});

test('daily preparation changes require a long-rest event and remain limited', () => {
  const {engine,character}=setup('wizard',3);
  assert.throws(()=>applyEdit(engine,character,[{kind:'select',selection:preparedPath,picks:[pick('prepared.misty-step')]}],'illegal-prepare'));
  const legal=applyEdit(engine,character,[{kind:'select',selection:preparedPath,picks:[pick('prepared.misty-step')],event:'long-rest'}],'legal-prepare',{requireValid:true});
  assert.equal(engine.evaluate(legal).status,'valid');
  const tooMany=structuredClone(character);tooMany.selections[preparedPath]=['magic-missile','shield','alarm','burning-hands','find-familiar','mage-armor'].map((s,i)=>pick(`prepared.${s}`,undefined,String(i)));assert(code(engine.evaluate(tooMany),'PICK_LIMIT'));
});

test('Wizard rituals do not require preparation, slots, or an immediate action budget', () => {
  const {engine,character,evaluation}=setup('wizard');const ritual=capability(evaluation,'Alarm (ritual)');assert(ritual);assert.deepEqual(ritual.costs,{});assert.equal(ritual.definition.action,undefined);
  const used=castWizardSpell(engine,character,ritual.id,'ritual',freshTurn());assert.equal(pool(engine.evaluate(used.character),'spell-slot.1').available,2);
});

test('casting an upcast prepared spell spends exactly the chosen slot', () => {
  const {engine,character,evaluation}=setup('wizard',3);
  const cap=capability(evaluation,'Magic Missile (slot 2)');const result=castWizardSpell(engine,character,cap.id,'missile-2',freshTurn(),{actions:{action:1}});
  assert.equal(engine.resolveDefinition(cap.definition.metadata.spell).name,'Magic Missile');
  const r=engine.evaluate(result.character);assert.equal(pool(r,'spell-slot.1').available,4);assert.equal(pool(r,'spell-slot.2').available,1);assert.equal(result.actions.action,0);
  assert(!capability(evaluation,'Magic Missile (slot 3)'));
});

test('2014 bonus-action spell rule permits action cantrips and rejects other spells in either order', () => {
  const {engine,character}=setup('wizard',3);character.selections[preparedPath]=[pick('prepared.misty-step'),pick('prepared.magic-missile',undefined,'second')];
  const r=engine.evaluate(character),misty=capability(r,'Misty Step (slot 2)'),missile=capability(r,'Magic Missile (slot 1)'),cantrip=capability(r,'Fire Bolt');
  const bonus=castWizardSpell(engine,character,misty.id,'misty',freshTurn(),{actions:{'bonus-action':1,action:1}});
  assert.throws(()=>castWizardSpell(engine,bonus.character,missile.id,'forbidden',bonus.turn,{actions:bonus.actions}),e=>e.code==='BONUS_ACTION_SPELL');
  const allowed=castWizardSpell(engine,bonus.character,cantrip.id,'cantrip',bonus.turn,{actions:bonus.actions});assert.equal(allowed.actions.action,0);
  const first=castWizardSpell(engine,character,missile.id,'missile-first',freshTurn(),{actions:{action:1,'bonus-action':1}});
  assert.throws(()=>castWizardSpell(engine,first.character,misty.id,'misty-late',first.turn,{actions:first.actions}),e=>e.code==='BONUS_ACTION_SPELL');
});

test('Arcane Recovery restores an explicit allocation once per day, atomically and idempotently', () => {
  const {engine,character,evaluation}=setup('wizard',3);const missile=capability(evaluation,'Magic Missile (slot 2)');
  const used=castWizardSpell(engine,character,missile.id,'cast',freshTurn(),{actions:{action:1}}).character;
  const rested=recoverResources(engine,used,'short-rest','rest');
  const recovered=recoverArcaneSlots(engine,rested,{'2':1},'rest','arcane');
  assert.equal(pool(engine.evaluate(recovered),'spell-slot.2').available,2);assert.equal(pool(engine.evaluate(recovered),'arcane-recovery').available,0);
  assert.deepEqual(recoverArcaneSlots(engine,recovered,{'2':1},'rest','arcane'),recovered);
  assert.throws(()=>recoverArcaneSlots(engine,recovered,{'1':1},'rest','arcane'),e=>e.code==='EVENT_CONFLICT');
  const longRested=recoverResources(engine,recovered,'long-rest','long-rest');assert.equal(pool(engine.evaluate(longRested),'arcane-recovery').available,0);
  const day=recoverResources(engine,longRested,'new-day','tomorrow');assert.equal(pool(engine.evaluate(day),'arcane-recovery').available,1);
  assert.throws(()=>recoverArcaneSlots(engine,day,{'2':1},'rest','old-rest'),e=>e.code==='SHORT_REST');
});

test('Arcane Recovery rejects missing rests, overspending, unspent slots and level 6+', () => {
  const {engine,character,evaluation}=setup('wizard',3);const used=useAbility(engine,character,capability(evaluation,'Magic Missile (slot 2)').id,'spent',{actions:{action:1}}).character;
  assert.throws(()=>recoverArcaneSlots(engine,used,{'2':1},'missing','no-rest'),e=>e.code==='SHORT_REST');
  const rested=recoverResources(engine,used,'short-rest','rest');
  for(const slots of [{'2':2},{'1':1},{'6':1},{'2':0.5},{}]) assert.throws(()=>recoverArcaneSlots(engine,rested,slots,'rest',`bad-${JSON.stringify(slots)}`));
  assert.deepEqual(rested.resources,used.resources);
});

test('Spell Mastery requires preparation, while Signature Spells are always prepared and recover separately', () => {
  const {engine,character,evaluation}=setup('wizard',20);
  assert(capability(evaluation,'Magic Missile'));assert(!capability(evaluation,'Misty Step'));
  assert(capability(evaluation,'Fireball (slot 3)'));const signature=capability(evaluation,'Fireball');assert(signature);
  const used=useAbility(engine,character,signature.id,'signature-use',{actions:{action:1}}).character;
  assert.equal(pool(engine.evaluate(used),'signature.fireball').available,0);assert.equal(pool(engine.evaluate(used),'spell-slot.3').available,3);
  assert.equal(pool(engine.evaluate(recoverResources(engine,used,'short-rest','pause')),'signature.fireball').available,1);
});

test('level reduction deactivates higher spell ownership and makes dependent preparation invalid', () => {
  const {engine,character}=setup('wizard',5);character.selections[preparedPath]=[pick('prepared.fireball')];assert.equal(engine.evaluate(character).status,'valid');
  const lower=applyEdit(engine,character,[{kind:'level',progression:'class-0',level:1}],'lower');assert.equal(engine.evaluate(lower).status,'invalid');
});

test('Dragonborn resource and dice scale by total character level', () => {
  const {evaluation:r}=setup('fighter',6,{race:'dragonborn'});assert.equal(r.stats.breathWeaponDice.value,3);assert.equal(pool(r,'dragonborn-breath').capacity,1);
  const breath=capability(r,'Breath Weapon');assert.equal(breath.definition.metadata.damage,'fire');assert.equal(r.stats.breathWeaponDC.value,8+r.stats['modifier.constitution'].value+r.stats.proficiencyBonus.value);
});

test('2014 saves pin System options and restore resource expenditure', () => {
  const {engine,character,evaluation}=setup('fighter',3,{settings:{feats:true}});
  const spent=useAbility(engine,character,capability(evaluation,'Second Wind').id,'wind',{actions:{'bonus-action':1}}).character;
  const loaded=deserializeCharacter(serializeCharacter(spent),engine);assert.deepEqual(loaded,spent);assert.equal(engine.evaluate(loaded).status,'valid');
  assert.throws(()=>deserializeCharacter(serializeCharacter(spent),createDnd2014Engine()),e=>e.code==='REVISION');
});

test('background can replace a duplicate skill through a nested choice', () => {
  const {engine,character}=setup('fighter',1,{race:'half-elf'});
  const race=pickPath('advancement/0/race','pick-0'),background=pickPath('advancement/0/background','pick-0');
  character.selections[selectionPath(race,'skills')]=[pick('skill.insight'),pick('skill.survival',undefined,'other')];
  const path=selectionPath(background,'insight');character.selections[path]=[pick('background-replacement.insight')];
  character.selections[selectionPath(pickPath(path,'pick-0'),'replacement')]=[pick('skill.deception')];
  assert.equal(engine.evaluate(character).status,'valid');assert.equal(engine.evaluate(character).stats['training.skill.deception'].value,1);
});

test('engine rejects malformed new System policies and eligibility timing', () => {
  const c=createDnd2014Catalogue();c.system.validation[0].requirement={expression:{stat:'absent'}};assert.equal(validateCatalogue(c)[0].code,'UNKNOWN_STAT');
  const d=createDnd2014Catalogue();d.classes[0].maximumLevel=1.5;assert(validateCatalogue(d).length);
  const e=createDnd2014Catalogue();e.features.find(f=>f.id===id('wizard.spellcasting')).components.find(c=>c.kind==='chooseFeatures').eligibility='future';assert(validateCatalogue(e).length);
  assert.throws(()=>new Engine(e));
});

test('additional roots cannot grant free advancement Features but can record copied Wizard spells', () => {
  const f=setup('fighter');f.character.roots.push({id:'free',feature:id('ability-score-improvement'),acquiredCharacterLevel:1});assert(code(f.engine.evaluate(f.character),'ROOT_FEATURE'));
  const w=setup('wizard',3);w.character.roots.push({id:'copy',feature:id('spellbook.invisibility'),acquiredCharacterLevel:3});assert.equal(w.engine.evaluate(w.character).status,'valid');
  w.character.selections[preparedPath]=[pick('prepared.invisibility')];assert.equal(w.engine.evaluate(w.character).status,'valid');
});

test('Tiefling spell gates, casting ability and armor restrictions apply to innate magic', () => {
  const low=setup('fighter',1,{race:'tiefling'});assert(capability(low.evaluation,'Thaumaturgy'));assert(!capability(low.evaluation,'Hellish Rebuke'));
  const high=setup('fighter',5,{race:'tiefling'});const rebuke=capability(high.evaluation,'Hellish Rebuke');assert(rebuke);assert(capability(high.evaluation,'Darkness'));
  const used=castSpell(high.engine,high.character,rebuke.id,'rebuke',freshTurn(),{actions:{reaction:1}});assert.equal(pool(high.engine.evaluate(used.character),'infernal-rebuke').available,0);
  const wizard=setup('wizard',1,{race:'tiefling'});wizard.character.inputs.armorIndex=12;assert(!capability(wizard.engine.evaluate(wizard.character),'Thaumaturgy'));
});

test('spellcasting can be gated by declared component availability without changing preparation', () => {
  const {engine,character,evaluation}=setup('wizard');const blocked=engine.evaluate(character,{spellComponentsAvailable:false});
  assert.equal(blocked.status,'valid');assert.equal(blocked.selections.find(s=>s.id===preparedPath).maximum,evaluation.selections.find(s=>s.id===preparedPath).maximum);
  assert(!capability(blocked,'Magic Missile (slot 1)'));assert(!capability(blocked,'Alarm (ritual)'));
});
