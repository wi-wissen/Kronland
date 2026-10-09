// Mission API for campaign levels in Python: world building (find_open, place_building, add_shaft, add_ruin, camp),
// tributes, unlocks, heroes joining and switching sides, objective pointers, silent removal, player names, the census
// for count(), guided steps (step()), conversations (say) and the end after the last line.

import { describe, it, expect } from 'vitest';
import { createScenarioSim, MissionRuntime } from '../../src/sim/missions/runtime.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { scenarioSteps, scenarioLines } from '../../src/sim/scripting/outline.js';
import { WATER } from '../../src/sim/map.js';

const run = (sim, ticks) => { for (let i = 0; i < ticks && !sim.mission.state.result; i++) sim.step(); };
const errors = (sim) => sim.mission.script.state.errors.map((e) => `${e.code} ${JSON.stringify(e.params)} line ${e.sline}`);
const out = (sim) => sim.mission.script.state.console.map((c) => c.text);
const act = (sim, cmd) => sim.step([{ player: 0, ...cmd }]);
const ents = (sim, f) => [...sim.entities.values()].filter(f);

/** Flat test map: castle, serfs, bandits, a computer opponent and the village "moorbrook". */
function level(code, extra = {}) {
  return createScenarioSim({
    format: 'kronland-scenario', version: 2, id: 'apitest', kind: 'mission', end: 'script',
    world: { base: 'flat', width: 48, height: 48, fog: false, starts: [{ x: 12, y: 12 }, { x: 38, y: 38 }], places: { goal: { x: 20, y: 14, r: 2 } } },
    players: [
      { kind: 'human', hero: 'nelia', serfs: 3, stock: { gold: 2000, clay: 2000, wood: 2000, stone: 2000, iron: 500, sulfur: 100 } },
      { kind: 'ai', hero: 'malvor' }, { kind: 'bandits' }, { kind: 'village', name: 'moorbrook' },
    ],
    sections: [{ id: 'mission', level: 'mission', code }],
    ...extra,
  });
}

describe('Mission API: world building', () => {
  it('find_open keeps a free margin, stays reachable, avoids circles and only goes on the ice when asked', () => {
    const sim = level([
      'for y in range(world.height):',
      '    world.set_water(30, y)',
      'a = find_open((24, 24), max_r=10, clear=2, avoid=[(24, 24, 4)])',
      'print(a.x, a.y)',
      'b = find_open((30, 20), max_r=0)',
      'c = find_open((30, 20), max_r=0, on_ice=True)',
      'print(b, c is not None)',
      'd = find_open((34, 20), max_r=3, reachable_from=hq())',
      'print(d)',
    ].join('\n'));
    expect(errors(sim)).toEqual([]);
    const [a, bc, d] = out(sim);
    const [x, y] = a.split(' ').map(Number);
    expect((x - 24) ** 2 + (y - 24) ** 2).toBeGreaterThanOrEqual(16);
    expect(bc).toBe('None False'); // summer: open water is no spot, not even on_ice (not walkable)
    expect(d).toBe('None'); // behind the river: not reachable from the castle
  });

  it('place_building with level, ring and fixed; no space gives None instead of an error', () => {
    const sim = level([
      'b = place_building(ENEMY, "residence", (24, 24), level=1, min_r=3, radius=8, fixed=True)',
      'print(b.level, b.max_hp > 0, b.distance_to((24, 24)) >= 2)',
      'print(place_building(HUMAN, "farm", (2, 2), radius=0))',
    ].join('\n'));
    expect(errors(sim)).toEqual([]);
    expect(out(sim)).toEqual(['1 True True', 'None']);
    const b = ents(sim, (e) => e.kind === 'building' && e.type === 'residence' && e.owner === 1)[0];
    expect(b.fixed).toBe(true);
  });

  it('add_shaft finds or makes a shaft site, add_ruin lays a permanent ruin', () => {
    const sim = level('s = add_shaft("stone", hq(), max_dist=16)\nprint(s.x, s.y)\nr = add_ruin("residence", (30, 30))\nprint(r.kind)\nadd_shaft("wood", hq())\n');
    expect(out(sim)[1]).toBe('ruin');
    expect(sim.shafts.some((s) => s.res === 'stone')).toBe(true);
    expect(errors(sim)[0]).toMatch(/resUnknown/);
    expect(ents(sim, (e) => e.kind === 'ruin')[0].until).toBeGreaterThan(1e9);
  });

  it('camp: clearing, hut and guards, a place of its name; guards attack whoever comes close', () => {
    const sim = level('guards = camp("outpost", (34, 14), [("spear1", 2, 2)], r=5)\nprint(len(guards), place("outpost").r)\n');
    expect(errors(sim)).toEqual([]);
    expect(out(sim)).toEqual(['2 5']);
    const camp = sim.mission.state.camps[0];
    expect(sim.entities.get(camp.id).type).toBe('banditCamp');
    const nelia = ents(sim, (e) => e.kind === 'hero' && e.owner === 0)[0];
    nelia.px = (camp.x + 4) * 1000 + 500; nelia.py = camp.y * 1000 + 500; nelia.path = [];
    run(sim, 20);
    expect(camp.alarm).toBeGreaterThan(0);
  });
});

describe('Mission API: tributes, unlocks, heroes, sides', () => {
  it('offer/withdraw: paying runs @on_event("tribute"), a group is a choice, a paid offer stays paid', () => {
    const sim = level([
      'offer("buy", {"gold": 300}, de="Freikaufen", en="Buy free", group="way")',
      'offer("storm", {"wood": 100}, de="Stürmen", en="Storm", group="way")',
      'offer("help", {"clay": 50}, de="Hilfe", en="Help")',
      '@on_event("tribute", id="buy")',
      'def paid(id):',
      '    print("paid", id, offer("buy", {"gold": 1}))',
      '@on_start',
      'def later():',
      '    wait(1)',
      '    withdraw("help")',
    ].join('\n'));
    const st = sim.mission.state;
    expect(sim.mission.uiState(sim).tributes.map((t) => t.id)).toEqual(['buy', 'storm', 'help']);
    expect(sim.mission.uiState(sim).tributes[0].text).toEqual({ de: 'Freikaufen', en: 'Buy free' });
    const gold = sim.players[0].stock.gold;
    act(sim, { type: 'mission', action: 'tribute', id: 'buy' });
    run(sim, 15);
    expect(sim.players[0].stock.gold).toBe(gold - 300);
    expect(st.tributes).toEqual({ buy: 'paid', storm: 'closed', help: 'closed' });
    expect(out(sim)).toEqual(['paid buy False']);
    // the state is part of the save game and the hash
    const sim2 = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    expect(sim2.mission.state.tributeDefs.buy.cost).toEqual({ gold: 300 });
    expect(sim2.hash()).toBe(sim.hash());
  });

  it('unlock adds buildings and technologies to the unlocks of the mission', () => {
    const sim = level('unlock("barracks", "standingArmy")\n', { available: { buildings: ['farm'], techs: [] } });
    expect(sim.mission.locked(0, 'buildings', 'barracks')).toBe(false);
    expect(sim.mission.locked(0, 'techs', 'standingArmy')).toBe(false);
    expect(sim.mission.locked(0, 'buildings', 'smithy')).toBe(true);
  });

  it('add_hero lets a hero join (known by name at once), convert switches sides like bribing', () => {
    const sim = level([
      'add_hero(HUMAN, "orrin", place("goal"))',
      'print(orrin.owner, orrin.distance_to(place("goal")) < 4)',
      'wave = spawn(BANDITS, "sword1", (30, 30), soldiers=2)',
      'print(convert(wave, HUMAN), convert(wave, HUMAN), wave[0].owner)',
      'convert(nelia, ENEMY)',
    ].join('\n'));
    expect(errors(sim)).toEqual([]);
    expect(out(sim)).toEqual(['0 True', '1 0 0']);
    const L = ents(sim, (e) => e.kind === 'leader')[0];
    expect(L.soldiers.every((id) => sim.entities.get(id).owner === 0)).toBe(true);
    expect(ents(sim, (e) => e.kind === 'hero' && e.hero === 'nelia')[0].owner).toBe(1);
  });

  it('player() knows villages, bandits and the enemy; every player argument takes the name too', () => {
    const sim = level('print(player("moorbrook"), player("bandits") == BANDITS, player("enemy") == ENEMY)\nplace_building("moorbrook", "farm", (30, 12))\nplayer("nowhere")\n');
    expect(out(sim)[0]).toBe(`${sim.mission.state.villages.moorbrook} True True`);
    expect(ents(sim, (e) => e.type === 'farm')[0].owner).toBe(sim.mission.state.villages.moorbrook);
    expect(errors(sim)[0]).toMatch(/playerUnknown/);
  });

  it('remove() takes things out without a trace, obj.kill() reports them', () => {
    const sim = level([
      'a = place_building(BANDITS, "residence", (30, 14))',
      'b = place_building(BANDITS, "residence", (30, 24))',
      's = spawn(BANDITS, "sword1", (34, 34))',
      '@on_start',
      'def go():',
      '    remove(a)',
      '    remove(s)',
      '    wait(0.1)',
      '    b.kill()',
    ].join('\n'));
    const ev = sim.step();
    expect(ev.filter((e) => e.type === 'buildingDestroyed' || e.type === 'killed')).toEqual([]);
    expect(ents(sim, (e) => e.kind === 'leader' || e.kind === 'soldier')).toEqual([]);
    const ev2 = [];
    for (let i = 0; i < 3; i++) ev2.push(...sim.step());
    expect(ev2.filter((e) => e.type === 'buildingDestroyed').map((e) => e.buildingType)).toEqual(['residence']);
    expect(ents(sim, (e) => e.kind === 'ruin').length).toBe(1); // only the killed one leaves rubble
  });
});

describe('Mission API: reading', () => {
  it('count() with placed and level from the census, fresh after own changes in the same tick; researched(); Serf.res', () => {
    const sim = level([
      'print(count("residence"), count("residence", placed=True))',
      'place_building(HUMAN, "residence", (20, 20), done=False)',
      'place_building(HUMAN, "residence", (26, 20), level=1)',
      'print(count("residence"), count("residence", placed=True), count("residence", level=1), count("serf"))',
      'print(researched("conscription"), researched("education", HUMAN))',
      'give_tech(HUMAN, "conscription")',
      'print(researched("conscription"))',
    ].join('\n'));
    expect(errors(sim)).toEqual([]);
    expect(out(sim)).toEqual(['0 0', '1 2 1 3', 'False False', 'True']);
    // what a serf cuts
    const sim2 = level('@every(1)\ndef look():\n    print([s.res for s in serfs()])\n');
    const tree = sim2.addNode('tree', 16, 16, 'wood', 100);
    const serf = ents(sim2, (e) => e.kind === 'unit')[0];
    act(sim2, { type: 'assignWork', units: [serf.id], target: tree.id });
    run(sim2, 12);
    expect(out(sim2).at(-1)).toBe("['wood', None, None]");
  });

  it('@on_event without a short form: serf bought, hero ability (filter), research started, payday', () => {
    const sim = level([
      '@on_event("serf_bought")',
      'def bought(serf):',
      '    print("serf", serf.kind)',
      '@on_event("ability", ability="courage")',
      'def power(hero, name):',
      '    print("ability", hero.name, name)',
      '@on_event("payday")',
      'def pay(income, wages):',
      '    print("payday")',
    ].join('\n'));
    const nelia = ents(sim, (e) => e.kind === 'hero' && e.owner === 0)[0];
    sim.createBuilding(0, 'villageCenter', 20, 20, true); // room for one more serf
    act(sim, { type: 'buySerf', count: 1 });
    act(sim, { type: 'ability', hero: nelia.id, ability: 'courage' });
    run(sim, 3);
    expect(out(sim)).toEqual(['serf serf', 'ability nelia courage']);
    run(sim, 1300);
    expect(out(sim)).toContain('payday');
    expect(errors(sim)).toEqual([]);
  });

  it('ai(forbid=…) and give(energy=…)', () => {
    const sim = level('ai(ENEMY, forbid=["weatherPlant", "barracks"])\ngive(ENEMY, energy=1000)\n');
    expect(sim.mission.state.ai[1].forbid).toEqual(['weatherPlant', 'barracks']);
    expect(sim.players[1].weatherEnergy).toBe(1000);
  });

  it('npc(speaker=, owner=): a figure that speaks for somebody else and belongs to a village', () => {
    const sim = level('n = npc("stranger", look="hero.orrin", at=place("goal"), speaker="orrin", owner="moorbrook")\nprint(n.owner)\n');
    expect(sim.mission.state.npcs.stranger.speaker).toBe('orrin');
    expect(out(sim)).toEqual([String(sim.mission.state.villages.moorbrook)]);
  });
});

describe('Mission API: objective pointers', () => {
  it('hint() points at a place, an entity and controls; the glow goes for good once ui_until holds', () => {
    const sim = level([
      'objective("farm", lambda: (count("farm"), 1), de="Baue einen Hof", en="Build a farm")',
      'hint("farm", area="goal", ui=["build-farm", "quick-all"], ui_until=lambda: count("farm", placed=True) >= 1)',
      'objective("hero", lambda: False, de="Zu Nelia", en="To Nelia")',
      'hint("hero", entity=nelia)',
      'hint("nothing", area="goal")',
    ].join('\n'));
    const hint = (id) => sim.mission.uiState(sim).objectives.find((o) => o.id === id).hint;
    run(sim, 2);
    expect(hint('farm').ui).toEqual(['build-farm', 'quick-all']);
    expect(hint('farm').area).toMatchObject({ x: 20.5, y: 14.5, r: 2 });
    expect(hint('hero').entity).toMatchObject({ x: expect.any(Number) });
    expect(errors(sim)[0]).toMatch(/objectiveUnknown/);
    sim.createBuilding(0, 'farm', 26, 26, false);
    run(sim, 2);
    expect(hint('farm').ui).toBeUndefined();
    expect(hint('farm').area).toBeTruthy();
  });
});

describe('Guided steps (step)', () => {
  const STEPS = [
    'step("read", title={"de": "Lesen", "en": "Read"}, de="Nur lesen.", en="Just read.", hint={"ui": "topbar"})',
    'step("look", ui="camera", next=True, de="Schau dich um.", en="Look around.", touch={"de": "Wische.", "en": "Swipe."})',
    'r = step("farm", until=lambda: count("farm", placed=True) >= 1, de="Baue einen Hof.", en="Build a farm.", hint={"entity": nelia, "area": "goal"})',
    'print("farm", r)',
    'r = step("skip", until=lambda: False, de="Das hier überspringst du.", en="Skip this one.")',
    'print("skip", r)',
    'victory("tutorial")',
  ].join('\n');
  const stepId = (sim) => sim.mission.currentStep()?.id ?? null;

  it('waits for "Weiter", the UI check or the condition; "Weiter" only for reading steps and next=True; skipping always works', () => {
    const sim = level(STEPS);
    const ui = () => sim.mission.uiState(sim).tutorial;
    expect(stepId(sim)).toBe('read');
    expect(ui()).toMatchObject({ index: 0, total: 4, canNext: true, title: { de: 'Lesen', en: 'Read' }, text: { de: 'Nur lesen.', en: 'Just read.' }, watch: null });
    expect(ui().hint.ui).toEqual(['topbar']);
    act(sim, { type: 'mission', action: 'next' });
    expect(stepId(sim)).toBe('look');
    expect(ui()).toMatchObject({ canNext: true, watch: 'camera', touch: { de: 'Wische.', en: 'Swipe.' } });
    // the engine reports the camera check as a command
    act(sim, { type: 'mission', action: 'ui', check: 'camera' });
    expect(stepId(sim)).toBe('farm');
    expect(ui().canNext).toBe(false);
    expect(ui().hint.entity).toMatchObject({ x: expect.any(Number) });
    expect(ui().hint.area).toMatchObject({ r: 2 });
    const ev = act(sim, { type: 'mission', action: 'next' });
    expect(ev.find((e) => e.type === 'rejected')?.reason).toBe('err.stepByAction');
    sim.createBuilding(0, 'farm', 26, 26, false);
    run(sim, 2);
    expect(stepId(sim)).toBe('skip');
    act(sim, { type: 'mission', action: 'skip' });
    expect(out(sim)).toEqual(['farm done', 'skip skip']);
    expect(sim.mission.state.result).toMatchObject({ won: true, reason: 'tutorial' });
    expect(act(sim, { type: 'mission', action: 'skip' }).length).toBeGreaterThanOrEqual(0);
  });

  it('a UI check reported before the step began does not count; the number of steps comes from the code', () => {
    const sim = level(STEPS);
    act(sim, { type: 'mission', action: 'ui', check: 'camera' });
    act(sim, { type: 'mission', action: 'next' });
    run(sim, 3);
    expect(stepId(sim)).toBe('look');
    expect(scenarioSteps(sim.mission.def.scenario).map((s) => s.id)).toEqual(['read', 'look', 'farm', 'skip']);
    expect(sim.mission.def.steps[0].title).toEqual({ de: 'Lesen', en: 'Read' });
  });

  it('survives saving and loading in the middle of a step', () => {
    const sim = level(STEPS);
    act(sim, { type: 'mission', action: 'next' });
    act(sim, { type: 'mission', action: 'next' });
    expect(stepId(sim)).toBe('farm');
    const sim2 = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    expect(sim2.hash()).toBe(sim.hash());
    for (const s of [sim, sim2]) { s.createBuilding(0, 'farm', 26, 26, false); run(s, 3); }
    expect(stepId(sim2)).toBe('skip');
    expect(sim2.hash()).toBe(sim.hash());
  });

  it('wrong checks are readable errors', () => {
    const sim = level('step("x", ui="dance", de="?", en="?")\n');
    expect(errors(sim)[0]).toMatch(/stepCheckUnknown/);
  });
});

describe('Conversations (say)', () => {
  it('lines of two conversations never mix: the second waits until the first is over', () => {
    const sim = level([
      '@on_start',
      'def first():',
      '    say("nelia", de="Eins", en="One")',
      '    say("orrin", de="Zwei", en="Two")',
      '    say("nelia", de="Drei", en="Three")',
      '@on_start',
      'def second():',
      '    wait(0.1)',
      '    say("elder", de="Dazwischen?", en="In between?")',
    ].join('\n'));
    run(sim, 200);
    expect(sim.mission.state.messages.map((m) => m.text.de)).toEqual(['Eins', 'Zwei', 'Drei', 'Dazwischen?']);
    expect(scenarioLines(sim.mission.def.scenario).map((l) => l.speaker)).toEqual(['nelia', 'orrin', 'nelia', 'elder']);
  });

  it('wait=False only queues the line; "Gespräch überspringen" leaves out the rest of the conversation', () => {
    const sim = level([
      '@on_start',
      'def talk():',
      '    say("nelia", de="Leise", en="Quiet", wait=False)',
      '    say("nelia", de="Eins", en="One")',
      '    say("orrin", de="Zwei", en="Two")',
      '    say("nelia", de="Drei", en="Three")',
      '    print("after", time() < 5)',
    ].join('\n'));
    run(sim, 3);
    const msgs = () => sim.mission.state.messages;
    expect(msgs().map((m) => [m.text.de, m.dur > 0])).toEqual([['Leise', false], ['Eins', true]]);
    sim.step([{ player: 0, type: 'script', action: 'skipDialog', all: true }]);
    expect(msgs().map((m) => [m.text.de, !!m.skipped])).toEqual([['Leise', false], ['Eins', false], ['Zwei', true], ['Drei', true]]);
    expect(out(sim)).toEqual(['after True']);
  });

  it('a mission won by its objectives first lets the last conversation finish', () => {
    const sim = level([
      'done = False',
      'objective("x", lambda: done, de="X", en="X")',
      '@on_start',
      'def go():',
      '    global done',
      '    done = True',
      '@on_objective("x", "done")',
      'def end(id, status):',
      '    say("nelia", de="Geschafft.", en="Done.")',
      '    say("orrin", de="Endlich.", en="At last.")',
    ].join('\n'), { end: 'objectives' });
    run(sim, 5);
    expect(sim.mission.state.result).toBeNull();
    run(sim, 300);
    expect(sim.mission.state.result).toMatchObject({ won: true, reason: 'objectives' });
    expect(sim.mission.state.messages.map((m) => m.text.de)).toEqual(['Geschafft.', 'Endlich.']);
  });
});

describe('Save games of rewritten missions', () => {
  it('an old save of a mission that is a level folder now cannot be continued (readable error)', () => {
    const sim = level('');
    const data = JSON.parse(JSON.stringify(saveGame(sim)));
    // as an old JS save of mission 1 would look: no scenario, not an own level
    const state = { ...data.mission, id: 'c1', scenario: null, custom: false };
    expect(() => MissionRuntime.fromState(state)).toThrow(expect.objectContaining({ code: 'saves.err.missionChanged' }));
  });

  it('frozen water is never chosen by find_open in winter unless on_ice', () => {
    const sim = level([
      'for x in range(26, 35):',
      '    for y in range(world.height):',
      '        world.set_water(x, y)',
      'set_weather("winter")',
      '@on_start',
      'def look():',
      '    wait(0.1)',
      '    print(find_open((30, 20), max_r=1), find_open((30, 20), max_r=1, on_ice=True))',
    ].join('\n'));
    run(sim, 5);
    expect(sim.map.frozen).toBe(true);
    expect(sim.map.flags[sim.map.idx(30, 20)] & WATER).toBeTruthy();
    expect(out(sim)).toEqual(['None <Place 30, 20>']);
  });
});
