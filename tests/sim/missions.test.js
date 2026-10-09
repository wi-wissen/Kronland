import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/sim.js';
import { MissionRuntime, createMissionSim, createScenarioSim } from '../../src/sim/missions/runtime.js';
import { CAMPAIGN, allMissions, getMission } from '../../src/sim/missions/registry.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { AiPlayer } from '../../src/ai/AiPlayer.js';
import { tr } from '../../src/i18n/tr.js';
import * as api from '../../src/sim/missions/setupApi.js';
import { act, build, own, hero, objective, stepId, until, idle, P, ref, refIds, talkTo, py, stepWithEvent, takeOut, heroOf } from './missionBot.js';
import { playTutorial, playMission1, meetOrrin } from './playthroughs.js';

/** Collect all texts of a mission (recursively). */
function texts(obj, out = []) {
  if (!obj || typeof obj !== 'object') return out;
  if (typeof obj.de === 'string' || typeof obj.en === 'string') { out.push(obj); return out; }
  for (const v of Object.values(obj)) if (typeof v !== 'function') texts(v, out);
  return out;
}

describe('Translation helper', () => {
  it('delivers language, falls back to German and replaces placeholders', () => {
    expect(tr({ de: 'Hallo', en: 'Hello' }, 'en')).toBe('Hello');
    expect(tr({ de: 'Nur Deutsch' }, 'en')).toBe('Nur Deutsch');
    expect(tr({ de: 'Schritt {n}' }, 'de', { n: 3 })).toBe('Schritt 3');
    expect(tr('raw')).toBe('raw');
    expect(tr(null)).toBe('');
  });

  it('all mission texts exist in German and English', () => {
    for (const m of allMissions()) {
      for (const t of texts(m)) {
        expect(t.de, JSON.stringify(t)).toBeTruthy();
        expect(t.en, JSON.stringify(t)).toBeTruthy();
      }
    }
  });
});

/** Small test level: a generated map, the mission program `code` (Python), more scenario fields in `extra`. */
function testSim(code, extra = {}, seed = 42) {
  return createScenarioSim({
    format: 'kronland-scenario', version: 2, id: 'test', kind: 'mission', end: 'objectives',
    world: { base: 'generate', seed, size: 64, fog: true },
    players: [{ kind: 'human', hero: 'nelia' }],
    sections: [{ id: 'mission', level: 'mission', code }],
    ...extra,
  });
}
const scriptErrors = (sim) => sim.mission.script.state.errors.map((e) => `${e.code} ${JSON.stringify(e.params)} line ${e.sline}`);

describe('Objectives', () => {
  it('build objective with progress; victory when all main objectives are fulfilled', () => {
    const sim = testSim([
      'objective("farm", lambda: (count("farm"), 1), de="x", en="x")',
      'objective("opt", lambda: (count("residence"), 2), primary=False, de="x", en="x")',
    ].join('\n'));
    sim.step();
    expect(objective(sim, 'farm').progress).toEqual([0, 1]);
    const id = build(sim, 'farm');
    until(sim, () => sim.mission.state.result, 3000, (s) => { const ids = idle(s).map((u) => u.id); if (ids.length) s.command({ player: P, type: 'assignWork', units: ids, target: id }); });
    expect(objective(sim, 'farm').status).toBe('done');
    expect(objective(sim, 'opt').status).toBe('active');
    expect(sim.mission.state.result).toMatchObject({ won: true, reason: 'objectives' });
  });

  it('resource, research, workers: conditions read the game', () => {
    const sim = testSim([
      'objective("gold", lambda: (stock("gold"), 500), de="x", en="x")',
      'objective("edu", lambda: researched("education"), de="x", en="x")',
      'objective("w", lambda: (count("worker"), 1), de="x", en="x")',
    ].join('\n'), { players: [{ kind: 'human', hero: 'nelia', stock: { gold: 100, clay: 0, wood: 0, stone: 0, iron: 0, sulfur: 0 } }] });
    sim.step();
    expect(objective(sim, 'gold').progress).toEqual([100, 500]);
    sim.players[0].stock.gold = 600;
    sim.players[0].techs.add('education');
    sim.step();
    expect(objective(sim, 'gold').status).toBe('done');
    expect(objective(sim, 'edu').status).toBe('done');
    expect(objective(sim, 'w').status).toBe('active');
  });

  it('recruiting: @on_recruited counts only matching troops', () => {
    const sim = testSim([
      'swords = 0',
      'objective("swords", lambda: (swords, 2), de="x", en="x")',
      '@on_recruited',
      'def recruited(troop):',
      '    global swords',
      '    if troop.type.startswith("sword"):',
      '        swords += 1',
    ].join('\n'), { players: [{ kind: 'human', hero: 'nelia', techs: ['conscription'], stock: { gold: 5000, wood: 5000, iron: 5000, stone: 5000, clay: 5000, sulfur: 0 } }] });
    const b = api.placeBuilding(sim, 0, 'barracks', api.centerOf(sim.findBuilding(0, 'headquarters')), { minR: 5 });
    act(sim, { type: 'recruit', building: b.id, line: 'spear', full: false });
    act(sim, { type: 'recruit', building: b.id, line: 'sword', full: false });
    sim.step();
    expect(objective(sim, 'swords').progress).toEqual([1, 2]);
    act(sim, { type: 'recruit', building: b.id, line: 'sword', full: false });
    sim.run(2);
    expect(objective(sim, 'swords').status).toBe('done');
  });

  it('survive (clock), reach region, protect (hold, defeat on loss)', () => {
    const code = [
      'goal = find_open((hq().x + 8, hq().y + 8), reachable_from=hq())',
      'make_place("goal", goal.x, goal.y, 4)',
      'centre = buildings("villageCenter")[0]',
      'objective("live", lambda: (min(30, int(time())), 30), clock=True, de="x", en="x")',
      'objective("go", lambda: len(units_in(place("goal"), who="hero")) > 0, de="x", en="x")',
      'objective("keep", lambda: centre.alive, hold=True, de="x", en="x")',
    ].join('\n');
    const sim = testSim(code);
    expect(scriptErrors(sim)).toEqual([]);
    const g = ref(sim, 'goal');
    act(sim, { type: 'order', units: [hero(sim).id], order: 'move', x: g.x, y: g.y });
    until(sim, () => objective(sim, 'go').status === 'done', 1000);
    expect(objective(sim, 'go').status).toBe('done');
    expect(sim.mission.state.result).toBeNull();
    expect(sim.mission.uiState(sim).objectives.find((o) => o.id === 'live').time).toBe(true);
    until(sim, () => sim.mission.state.result, 400);
    expect(sim.mission.state.result.won).toBe(true);
    expect(objective(sim, 'keep').status).toBe('done'); // held goals count as fulfilled on victory

    const sim2 = testSim(code);
    sim2.step();
    sim2.removeEntity(sim2.findBuilding(0, 'villageCenter'));
    sim2.step();
    expect(objective(sim2, 'keep').status).toBe('failed');
    expect(sim2.mission.state.result).toMatchObject({ won: false, reason: 'keep' });
  });

  it('hidden objectives only appear through show_objective()', () => {
    const sim = testSim([
      'objective("a", lambda: stock("gold") >= 1, hidden=True, de="x", en="x")',
      'objective("b", lambda: time() >= 100, de="x", en="x")',
      '@on_start',
      'def show():',
      '    wait(5)',
      '    show_objective("a")',
    ].join('\n'));
    sim.run(10);
    expect(objective(sim, 'a').status).toBe('hidden');
    expect(sim.mission.uiState(sim).objectives.map((o) => o.id)).toEqual(['b']);
    sim.run(45);
    expect(objective(sim, 'a').status).toBe('done');
  });

  it('castle destroyed: defeat; enemy castle destroyed: victory', () => {
    const lose = testSim('objective("s", lambda: time() >= 100, de="x", en="x")');
    const hq = lose.findBuilding(0, 'headquarters');
    lose.step();
    hq.hp = 1;
    lose.removeEntity(hq); lose.checkDefeat(0);
    lose.step();
    expect(lose.mission.state.result).toMatchObject({ won: false, reason: 'hq' });

    const win = testSim('objective("k", lambda: hq(ENEMY) is None, de="x", en="x")', {
      players: [{ kind: 'human', hero: 'nelia' }, { kind: 'ai', difficulty: 'easy', aggression: 'passive' }],
    });
    win.step();
    const ehq = win.findBuilding(1, 'headquarters');
    win.removeEntity(ehq); win.checkDefeat(1);
    win.step();
    expect(win.mission.state.result).toMatchObject({ won: true });
  });
});

describe('Mission program: events and actions', () => {
  it('time, objective, building placed; dialogue, resources, tech, weather, camera, repeated events', () => {
    const sim = testSim([
      'house = False',
      'ticks = 0',
      'objective("g", lambda: stock("gold") >= 900, primary=False, de="x", en="x")',
      '@on_start',
      'def later():',
      '    wait(2)',
      '    say("ottilie", de="Hallo", en="Hi", wait=False)',
      '    give(HUMAN, gold=1000)',
      '    give_tech(HUMAN, "alchemy")',
      '@on_objective("g", "done")',
      'def rich(id, status):',
      '    set_weather("winter", 30)',
      '    camera.jump_to(hq())',
      '@on_building_placed("residence")',
      'def placed(b):',
      '    global house',
      '    house = True',
      '@every(1)',
      'def count_up():',
      '    global ticks',
      '    if ticks < 3:',
      '        ticks += 1',
      '        give(HUMAN, wood=1)',
    ].join('\n'), { players: [{ kind: 'human', hero: 'nelia' }, { kind: 'bandits' }] });
    const wood0 = sim.players[0].stock.wood;
    sim.run(25);
    const st = sim.mission.state;
    expect(st.messages.map((m) => m.text.de)).toEqual(['Hallo']);
    expect(sim.players[0].techs.has('alchemy')).toBe(true);
    expect(objective(sim, 'g').status).toBe('done');
    expect(sim.weather.state).toBe('winter');
    expect(sim.map.frozen).toBe(true);
    expect(st.camera).toMatchObject({ x: expect.any(Number) });
    expect(py(sim, 'house')).toBe(false);
    sim.run(30);
    expect(py(sim, 'ticks')).toBe(3);
    expect(sim.players[0].stock.wood).toBe(wood0 + 3);
    build(sim, 'residence');
    sim.step();
    expect(py(sim, 'house')).toBe(true);
    sim.run(300);
    expect(sim.weather.state).not.toBe('winter'); // after 30 s the cycle again
  });

  it('attack wave with attack-move reaches the castle; once all attackers are gone the mission is won', () => {
    const sim = testSim([
      'gate = find_open((hq().x + 18, hq().y + 18), reachable_from=hq(), clear=2)',
      '@on_start',
      'def raid():',
      '    global wave',
      '    wait(1)',
      '    wave = spawn(BANDITS, "sword1", gate, count=2, soldiers=4)',
      '    attack(wave, (hq().x, hq().y))',
      '    wait_until(lambda: alive(wave) == 0)',
      '    victory()',
      'wave = []',
    ].join('\n'), { end: 'script', players: [{ kind: 'human', hero: null }, { kind: 'bandits' }] });
    sim.run(15);
    const ids = refIds(sim, 'wave');
    expect(ids.length).toBe(2);
    expect(sim.entities.get(ids[0]).order.type).toBe('attackMove');
    // the wave marches off and damages buildings at the castle (castle or village centre)
    const mine = () => [...sim.entities.values()].filter((e) => e.kind === 'building' && e.owner === 0);
    const hp0 = mine().reduce((s, b) => s + b.hp, 0);
    until(sim, () => mine().reduce((s, b) => s + b.hp, 0) < hp0, 1500);
    expect(mine().reduce((s, b) => s + b.hp, 0)).toBeLessThan(hp0);
    takeOut(sim, ids);
    sim.step();
    expect(sim.mission.state.result).toMatchObject({ won: true });
  });

  it('bandits never build, defend their camp and do not count as a winning team', () => {
    const sim = testSim([
      'guards = camp("c", toward(hq(), map_center(), 20), [("spear1", 1, 2)], reachable_from=hq())',
      'objective("c", lambda: alive(guards) == 0, de="x", en="x")',
    ].join('\n'), { players: [{ kind: 'human', hero: 'nelia' }, { kind: 'bandits' }] });
    const b = sim.mission.state.bandits;
    expect(b).toBe(1);
    expect(sim.players[b].neutral).toBe(true);
    expect(sim.findBuilding(b, 'headquarters')).toBeNull();
    const guard = sim.entities.get(refIds(sim, 'guards')[0]);
    sim.run(200);
    expect(guard.order.type).toBe('idle'); // without a reason they stay put
    // hero approaches → alarm
    const area = ref(sim, 'c');
    act(sim, { type: 'order', units: [hero(sim).id], order: 'move', x: area.x, y: area.y + 2 });
    until(sim, () => sim.mission.state.camps[0].alarm > 0, 1500);
    expect(sim.mission.state.camps[0].alarm).toBeGreaterThan(0);
    expect(guard.order.type === 'attackMove' || guard.targetId > 0).toBe(true);
    expect(sim.winner).toBeNull();
    // bandits give no commands to build: no construction sites
    expect([...sim.entities.values()].filter((e) => e.kind === 'building' && e.owner === b).length).toBe(1);
  });

  it('AI opponent: start delay and build bans from scenario.json, ai() changes difficulty and aggression', () => {
    const sim = testSim([
      '@on_start',
      'def mad():',
      '    wait(60)',
      '    ai(ENEMY, difficulty="hard", aggression="aggressive")',
    ].join('\n'), { end: 'script', players: [{ kind: 'human', hero: 'nelia' }, { kind: 'ai', difficulty: 'normal', startDelay: 30, forbid: ['residence'] }] });
    const ai = new AiPlayer(sim, 1, 'normal');
    for (let i = 0; i < 290; i++) { ai.update(); sim.step(); }
    expect([...sim.entities.values()].filter((e) => e.kind === 'building' && e.owner === 1).length).toBe(2); // still waiting
    for (let i = 0; i < 2000; i++) { ai.update(); sim.step(); }
    expect(own(sim, 'residence', 1).length).toBe(0);
    expect([...sim.entities.values()].filter((e) => e.kind === 'building' && e.owner === 1).length).toBeGreaterThan(2);
    expect(ai.difficulty).toBe('hard');
    expect(ai.cfg.firstAttack).toBeLessThan(9000);
  });
});

describe('Tutorial', () => {
  it('can be played through completely with player commands', () => {
    const { sim, log } = playTutorial();
    expect(log).toContain('fight');
    expect(log.at(-1)).toBe('result');
    expect(sim.mission.state.result).toMatchObject({ won: true, reason: 'tutorial' });
    expect(sim.mission.state.warnings).toEqual([]);
  });

  it('also works on other maps', () => {
    for (const seed of [7, 99]) {
      const { sim } = playTutorial(seed);
      expect(sim.mission.state.result?.won).toBe(true);
    }
  });

  it('"Next" only for reading steps; skipping always works and has no defeat', () => {
    const sim = createMissionSim('tutorial');
    expect(stepId(sim)).toBe('welcome');
    act(sim, { type: 'mission', action: 'next' });
    expect(stepId(sim)).toBe('camera');
    act(sim, { type: 'mission', action: 'next' }); // camera allows Next (touch devices)
    expect(stepId(sim)).toBe('select');
    const ev = act(sim, { type: 'mission', action: 'next' });
    expect(ev.some((e) => e.type === 'rejected')).toBe(true);
    expect(stepId(sim)).toBe('select');
    act(sim, { type: 'mission', action: 'skip' });
    expect(stepId(sim)).toBe('wood');
    // skip to the end: barracks, bandits etc. are built anyway
    for (let i = 0; i < 30 && !sim.mission.state.result; i++) act(sim, { type: 'mission', action: 'skip' });
    expect(sim.mission.state.result).toMatchObject({ won: true });
    expect(own(sim, 'barracks').length).toBe(1);
    expect(sim.mission.def.noDefeat).toBe(true);
  });

  it('hints resolve to UI elements, entities and regions', () => {
    const sim = createMissionSim('tutorial');
    for (const want of ['welcome', 'camera', 'select', 'wood']) {
      expect(stepId(sim)).toBe(want);
      const ui = sim.mission.uiState(sim).tutorial;
      if (want === 'select') expect(ui.hint.ui).toContain('quick-all');
      if (want === 'wood') expect(ui.hint.entity).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
      act(sim, { type: 'mission', action: 'skip' });
    }
    // clay pit: shaft as a region
    while (stepId(sim) !== 'mine') act(sim, { type: 'mission', action: 'skip' });
    expect(sim.mission.uiState(sim).tutorial.hint.area).toMatchObject({ r: expect.any(Number) });
  });
});

describe('Target places', () => {
  it('mission 1: the old tree is marked as the goal place as long as the goal is open', () => {
    const sim = createMissionSim('c1');
    // first Orrin on the village square: his goal points to him
    expect(sim.mission.uiState(sim).objectives.find((o) => o.id === 'meet').hint.entity).toMatchObject({ x: expect.any(Number) });
    meetOrrin(sim);
    const root = () => sim.mission.uiState(sim).objectives.find((o) => o.id === 'root');
    expect(root().hint.area).toMatchObject({ x: expect.any(Number), y: expect.any(Number), r: 2 });
    // send Nelia there: goal fulfilled, no marker any more
    const a = root().hint.area;
    const nelia = [...sim.entities.values()].find((e) => e.kind === 'hero' && e.hero === 'nelia');
    act(sim, { type: 'order', units: [nelia.id], order: 'move', x: Math.floor(a.x), y: Math.floor(a.y) });
    until(sim, () => root().status === 'done', 3000);
    expect(root().hint).toBeNull();
  });
});

describe('Campaign', () => {
  it('has at least 5 missions with briefing, victory/defeat text and chaining', () => {
    expect(CAMPAIGN.length).toBeGreaterThanOrEqual(5);
    CAMPAIGN.forEach((m, i) => {
      expect(m.briefing?.de && m.victoryText?.de && m.defeatText?.de).toBeTruthy();
      expect(m.next ?? null).toBe(CAMPAIGN[i + 1]?.id ?? null);
      // objectives in Python (read from the code)
      const goals = m.goals;
      expect(goals.some((o) => o.primary)).toBe(true);
      expect(goals.some((o) => !o.primary)).toBe(true); // every mission has side objectives
    });
  });

  it.each(CAMPAIGN.flatMap((m) => [m.seed, 7, 99, 31337].map((seed) => [m.id, seed])))('%s sets itself up without errors on map %i', (id, seed) => {
    const sim = createMissionSim(id, { seed });
    const st = sim.mission.state;
    expect(st.warnings).toEqual([]);
    const def = getMission(id);
    // The Python world building ran without errors; the places it made can be reached (in the matching weather) –
    // from the castle or from the start spot
    expect(sim.mission.script.state.errors, id).toEqual([]);
    const hqB = sim.findBuilding(0, 'headquarters');
    const hq = hqB ? api.centerOf(hqB) : sim.starts[0];
    const places = sim.mission.script.places;
    const WANT = {
      c1: ['clayShaft', 'oldRoot', 'orrinSeat', 'collectorFrom', 'square', 'villageArea'], c2: ['townArea', 'robbers'],
      c3: ['isle', 'gate', 'gorge', 'valley', 'ruinsArea', 'landing', 'prison', 'gateCamp', 'worksCamp', 'ford'],
      c4: ['town', 'siegeA', 'siegeB'], c5: ['moorbrookArea', 'reedhamArea', 'alderfarmArea', 'taranCamp'],
      c6: ['isle', 'worksIsle', 'shore', 'northGate'],
    };
    for (const name of WANT[id]) {
      expect(Object.hasOwn(places, name), `${id}/${name}`).toBe(true);
      expect(api.reachable(sim, hq, places[name], true), `${id}/${name}`).toBe(true);
    }
    sim.run(100);
    expect(st.result).toBeNull();
    expect(def.title.en).toBeTruthy();
  });

  it('mission 1 can be won with a command script', () => {
    const { sim, ok } = playMission1();
    expect(ok).toBe(true);
    expect(sim.mission.state.result).toMatchObject({ won: true, reason: 'objectives' });
    expect(objective(sim, 'root').status).toBe('done');
  });

  it('mission 1: Orrin (not Nelia) wins the neighbouring village, the village elder is allied', () => {
    const sim = createMissionSim('c1');
    const st = sim.mission.state;
    const nb = sim.mission.playerOf('neighbors');
    expect(sim.relation(0, nb)).toBe('neutral');
    meetOrrin(sim);
    // root reached → conversation figure stands
    const r = ref(sim, 'oldRoot');
    const nelia = heroOf(sim, 'nelia');
    nelia.px = r.x * 1000 + 500; nelia.py = r.y * 1000 + 500;
    until(sim, () => st.npcs.elder, 50);
    const elder = sim.entities.get(st.npcs.elder.entity);
    expect(elder.talk).toBe(true);
    expect(elder.owner).toBe(nb);
    // Walking past does nothing: the figure is tapped with a hero selected (order 'talk')
    const orrin = [...sim.entities.values()].find((e) => e.kind === 'hero' && e.hero === 'orrin');
    orrin.px = elder.px + 800; orrin.py = elder.py; orrin.path = [];
    sim.run(20);
    expect(st.npcs.elder.state).toBe('open');
    // Nelia: wrong hero, only a hint of the elder
    nelia.px = elder.px; nelia.py = elder.py + 800; nelia.path = [];
    talkTo(sim, [nelia.id], 'elder');
    until(sim, () => st.messages.some((m) => m.speaker === 'elder'), 3000); // after the find conversation
    expect(st.messages.at(-1).text.de).toMatch(/Schick mir den Händler/);
    expect(st.npcs.elder.state).toBe('open');
    expect(sim.relation(0, nb)).toBe('neutral');
    // Orrin: the village becomes allied, sends three serfs and wood
    talkTo(sim, [orrin.id], 'elder');
    until(sim, () => objective(sim, 'neighbors').status === 'done', 3000);
    expect(st.npcs.elder.state).toBe('closed');
    expect(sim.relation(0, nb)).toBe('allied');
    expect(st.messages.some((m) => m.speaker === 'elder' && m.text.de.startsWith('Ob Prinzessin'))).toBe(true);
  });

  it('mission 2: buy or fight for Zacke – clay delivery swaps the offer for a cheaper one', () => {
    const sim = createMissionSim('c2');
    const st = sim.mission.state;
    // nothing to buy before the milestone (first trade); then Malvor's herald comes and the offer opens
    sim.run(310);
    expect(st.tributes.buyShard).toBeUndefined();
    stepWithEvent(sim, { type: 'tradeDone', give: 'wood', take: 'gold', amount: 100 });
    expect(st.tributes.buyShard).toBe('open');
    // without enough thalers: rejected
    sim.players[0].stock.gold = 0;
    expect(act(sim, { type: 'mission', action: 'tribute', id: 'buyShard' }).some((e) => e.type === 'rejected')).toBe(true);
    // clay debt: only available after the trader's conversation
    expect(act(sim, { type: 'mission', action: 'tribute', id: 'clay' }).some((e) => e.type === 'rejected')).toBe(true);
    const merchant = sim.entities.get(st.npcs.merchant.entity);
    const orrin = heroOf(sim, 'orrin');
    orrin.px = merchant.px + 600; orrin.py = merchant.py; orrin.path = [];
    // Nelia is the wrong one: only a hint
    const nelia = heroOf(sim, 'nelia');
    nelia.px = merchant.px; nelia.py = merchant.py + 600; nelia.path = [];
    talkTo(sim, [nelia.id], 'merchant');
    until(sim, () => st.messages.some((m) => m.speaker === 'merchant'), 3000);
    expect(st.messages.at(-1).text.de).toMatch(/Ich warte auf Orrin/);
    expect(st.tributes.clay).toBeUndefined();
    talkTo(sim, [orrin.id], 'merchant');
    until(sim, () => st.tributes.clay === 'open', 300);
    expect(st.tributes.clay).toBe('open');
    sim.players[0].stock.clay = 1000;
    act(sim, { type: 'mission', action: 'tribute', id: 'clay' });
    expect(st.tributes).toMatchObject({ clay: 'paid', buyShard: 'closed', buyShardCheap: 'open' });
    sim.players[0].stock.gold = 2000; sim.players[0].stock.wood = 2000;
    act(sim, { type: 'mission', action: 'tribute', id: 'buyShardCheap' });
    sim.step();
    expect(py(sim, 'shard')).toBe(true);
    expect(sim.players[0].stock.gold).toBe(1200);
  });

  it('mission 2: storming the bandit camp brings Zacke just as well', () => {
    const sim = createMissionSim('c2');
    const st = sim.mission.state;
    stepWithEvent(sim, { type: 'tradeDone', give: 'wood', take: 'gold', amount: 100 });
    takeOut(sim, refIds(sim, 'robber_guards'));
    sim.run(5);
    expect(py(sim, 'shard')).toBe(true);
    expect(st.tributes.buyShard).toBe('closed');
  });

  it.each([3303, 7, 99, 31337])('mission 3 on map %i: valley behind the ridge – gate or frozen river, works on the island', (seed) => {
    const sim = createMissionSim('c3', { seed });
    const st = sim.mission.state, m = sim.map;
    expect(sim.mission.script.state.errors).toEqual([]);
    expect(sim.findBuilding(0, 'headquarters')).toBeNull();
    expect(sim.players[0].stock.gold).toBe(400);
    const start = sim.starts[0];
    expect(sim.entities.get(ref(sim, 'works'))?.type).toBe('weatherPlant');
    expect(sim.map.frozen).toBe(true);
    const [isle, valley, gate] = ['isle', 'valley', 'gate'].map((n) => ref(sim, n));
    // island: cut off in summer, over the ice in winter
    expect(api.reachable(sim, start, isle, false)).toBe(false);
    expect(api.reachable(sim, start, isle, true)).toBe(true);
    // the gate is a land route into the valley, the gorge only passable in winter
    expect(api.reachable(sim, start, valley, false)).toBe(true);
    const gateTiles = [];
    for (let y = gate.y - 6; y <= gate.y + 6; y++) for (let x = gate.x - 6; x <= gate.x + 6; x++) {
      if (!m.inBounds(x, y) || (m.flags[m.idx(x, y)] & 8)) continue;
      gateTiles.push(m.idx(x, y)); m.flags[m.idx(x, y)] |= 8;
    }
    m.version++;
    // without the gate: only over the ice of the gorge – the ridge has no other gap
    expect(api.reachable(sim, start, valley, false)).toBe(false);
    expect(api.reachable(sim, start, valley, true)).toBe(true);
    for (const k of gateTiles) m.flags[k] &= ~8;
    m.version++;
    // posts at the gorge and camp at the gate stand in the valley, the ruins are reachable from there
    expect(refIds(sim, 'ford_guards').length).toBe(2);
    expect(st.camps.find((c) => c.name === 'gateCamp').guards.length).toBe(5);
    expect(api.reachable(sim, valley, ref(sim, 'ruinsArea'), false)).toBe(true);
    expect(api.reachable(sim, valley, ref(sim, 'landing'), false)).toBe(true);
    sim.run(300);
    expect(st.result).toBeNull();
  });

  /** Fast-forward mission 3 to the destruction of the works, put the heroes at `where`, wait for the thaw. */
  const thawWith = (where) => {
    const sim = createMissionSim('c3');
    const st = sim.mission.state;
    // without guards and reinforcements (here it is only about the thaw)
    const bandits = () => takeOut(sim, [...sim.entities.values()].filter((e) => e.kind === 'leader' && e.owner === st.bandits).map((e) => e.id));
    bandits();
    takeOut(sim, ref(sim, 'works'));
    sim.run(3);
    expect(objective(sim, 'escape').status).toBe('active');
    for (const id of refIds(sim, 'heroes')) {
      const h = sim.entities.get(id);
      h.px = where.x * 1000 + 500; h.py = where.y * 1000 + 500; h.path = []; h.order = { type: 'hold' };
    }
    until(sim, () => objective(sim, 'escape').status !== 'active' || st.result, 700, bandits);
    return sim;
  };

  it('mission 3: after the works it thaws after 60 s – on solid ground play continues', () => {
    const sim = thawWith(ref(createMissionSim('c3'), 'landing'));
    const st = sim.mission.state;
    expect(st.result).toBeNull();
    expect(objective(sim, 'escape').status).toBe('done');
    expect(sim.weather.state).toBe('summer');
    expect(sim.map.frozen).toBe(false);
    // blueprint still to fetch: then victory
    const h = heroOf(sim, 'nelia'), ruins = ref(sim, 'ruinsArea');
    act(sim, { type: 'order', units: [h.id], order: 'move', x: ruins.x, y: ruins.y });
    until(sim, () => st.result, 1500);
    expect(st.result).toMatchObject({ won: true });
  });

  it('mission 3: whoever stands on the island or the ice during the thaw loses', () => {
    const isle = ref(createMissionSim('c3'), 'isle');
    expect(thawWith({ x: isle.x, y: isle.y + 3 }).mission.state.result).toMatchObject({ won: false, reason: 'island' });
    expect(thawWith({ x: isle.x, y: isle.y + isle.r + 3 }).mission.state.result).toMatchObject({ won: false, reason: 'ice' });
  });

  it('mission 3: Orrin bribes a squad at the post (350–400 thalers), the squad then fights for us', () => {
    const sim = createMissionSim('c3');
    const st = sim.mission.state;
    const orrin = heroOf(sim, 'orrin');
    const ford = refIds(sim, 'ford_guards');
    const guard = sim.entities.get(ford[0]);
    orrin.px = guard.px + 2000; orrin.py = guard.py; orrin.path = [];
    const ev = act(sim, { type: 'ability', hero: orrin.id, ability: 'bribe' });
    expect(ev.some((e) => e.type === 'bribed')).toBe(true);
    const turned = [...sim.entities.values()].filter((e) => e.kind === 'leader' && e.owner === 0 && ford.includes(e.id));
    expect(turned.length).toBe(1);
    expect(sim.players[0].stock.gold).toBeLessThanOrEqual(50);
    sim.run(20);
    expect(st.camps.find((c) => c.name === 'ford').guards).not.toContain(turned[0].id);
  });

  it('mission 4: Taran withdraws when he falls; the mining master hands over only after the siege', () => {
    const sim = createMissionSim('c4');
    const st = sim.mission.state;
    const taran = sim.entities.get(py(sim, 'taran_foe'));
    expect(taran.owner).toBe(st.bandits);
    taran.hp = 0; taran.down = true;
    sim.run(2);
    expect(sim.entities.has(taran.id)).toBe(false);
    expect(st.npcs.miner).toBeUndefined();
    takeOut(sim, refIds(sim, 'siege_guards'));
    sim.run(2);
    expect(st.npcs.miner?.state).toBe('open');
    // only Nelia gets the shard
    const miner = sim.entities.get(st.npcs.miner.entity), nelia = heroOf(sim, 'nelia');
    nelia.px = miner.px + 800; nelia.py = miner.py; nelia.path = [];
    talkTo(sim, [nelia.id], 'miner');
    until(sim, () => objective(sim, 'shard').status === 'done', 300);
    expect(objective(sim, 'shard').status).toBe('done');
  });

  it('mission 4: mercenary or serfs – whoever pays for one cannot have the other any more', () => {
    const sim = createMissionSim('c4');
    const st = sim.mission.state;
    const before = sim.players[0].stock.gold;
    act(sim, { type: 'mission', action: 'tribute', id: 'refugees' });
    expect(st.tributes).toMatchObject({ refugees: 'paid', mercs: 'closed' });
    expect(sim.players[0].stock.gold).toBe(before - 400);
    expect(act(sim, { type: 'mission', action: 'tribute', id: 'mercs' }).some((e) => e.type === 'rejected')).toBe(true);
  });

  it('mission 5: the herald makes the villages neutral, Taran defects and becomes playable', () => {
    const sim = createMissionSim('c5');
    const st = sim.mission.state;
    const villages = ['moorbrook', 'reedham', 'alderfarm'].map((v) => sim.mission.playerOf(v));
    expect(villages.every((v) => sim.relation(0, v) === 'allied')).toBe(true);
    const helpers = refIds(sim, 'helpers');
    expect(helpers.length).toBe(2);
    until(sim, () => py(sim, 'herald_at') !== null, 2000);
    expect(villages.every((v) => sim.relation(0, v) === 'neutral')).toBe(true);
    expect(helpers.some((id) => sim.entities.has(id))).toBe(false);
    // five minutes after the herald at the latest (or the first delivery): Taran defects with two squads
    until(sim, () => heroOf(sim, 'taran'), 3500);
    const taran = heroOf(sim, 'taran');
    expect(taran.owner).toBe(0);
    expect(refIds(sim, 'camp_guards').filter((id) => sim.entities.get(id)?.owner === 0).length).toBe(2);
    expect(py(sim, 'loyalists').length).toBe(3);
    expect(objective(sim, 'granaries').status).toBe('active');
    // delivery wins a village back
    sim.players[0].stock.wood = 2000; sim.players[0].stock.clay = 2000;
    act(sim, { type: 'mission', action: 'tribute', id: 'supplyMoorbrook' });
    expect(sim.relation(0, villages[0])).toBe('allied');
  });

  it.each([6606, 7])('mission 6 on map %i: island castle only via the ice, Malvor\'s power plant within shooting range from the shore', (seed) => {
    const sim = createMissionSim('c6', { seed });
    expect(sim.mission.script.state.errors).toEqual([]);
    const me = api.centerOf(sim.findBuilding(0, 'headquarters'));
    const castle = api.centerOf(sim.entities.get(ref(sim, 'castle')));
    expect(api.reachable(sim, me, castle, false)).toBe(false);
    expect(api.reachable(sim, me, castle, true)).toBe(true);
    // Malvor's power plant: on the works island (unreachable in summer), fully charged, reachable from the shore for archers
    const plant = sim.entities.get(ref(sim, 'malvor_plant'));
    expect(plant?.type).toBe('weatherPlant');
    expect(plant.owner).toBe(1);
    expect(api.reachable(sim, me, api.centerOf(plant), false)).toBe(false);
    expect(sim.players[1].weatherEnergy).toBe(1000);
    // distance tile centre – building edge (in half tiles, integer) at most 5 tiles
    let shore = false;
    for (const p of api.rings(plant.x + 2, plant.y + 1, 0, 8)) {
      if (!sim.map.inBounds(p.x, p.y) || !sim.map.walkable(p.x, p.y) || (sim.map.flags[sim.map.idx(p.x, p.y)] & 1)) continue;
      const cx = 2 * p.x + 1, cy = 2 * p.y + 1;
      const dx = Math.max(2 * plant.x - cx, 0, cx - 2 * (plant.x + plant.w)), dy = Math.max(2 * plant.y - cy, 0, cy - 2 * (plant.y + plant.h));
      if (dx * dx + dy * dy <= 100 && api.reachable(sim, me, p, false)) { shore = true; break; }
    }
    expect(shore).toBe(true);
  });

  /** Mission 6: bring about winter and place a serf on the ice in front of the island castle. */
  const serfOnIce = (sim) => {
    const isle = ref(sim, 'isle');
    sim.setWeather('winter', 1800);
    sim.run(2);
    const ice = [...api.rings(isle.x, isle.y, isle.r + 2, isle.r + 4)].find((p) => sim.map.inBounds(p.x, p.y) && (sim.map.flags[sim.map.idx(p.x, p.y)] & 1));
    const u = [...sim.entities.values()].find((e) => e.kind === 'unit' && e.owner === 0);
    u.job = null; u.path = []; u.px = ice.x * 1000 + 500; u.py = ice.y * 1000 + 500;
    return u;
  };

  it('mission 6: Malvor thaws the lake as soon as someone stands on the ice, then he has to reload and wait', () => {
    const sim = createMissionSim('c6');
    const u = serfOnIce(sim);
    sim.run(15);
    expect(sim.weather.state).toBe('summer');
    expect(sim.entities.has(u.id)).toBe(false); // drowned
    expect(sim.players[1].weatherEnergy).toBeLessThan(100);
    expect(py(sim, 'thawed_once')).toBe(true);
    // immediately winter again: Malvor cannot (no energy, wait time) – the lake stays frozen
    serfOnIce(sim);
    sim.run(600);
    expect(sim.weather.state).toBe('winter');
    // after loading time (like three weather technicians) and wait time he thaws again
    sim.run(1300);
    expect(sim.players[1].weatherEnergy).toBeGreaterThanOrEqual(1000 - 60);
    serfOnIce(sim);
    sim.run(15);
    expect(sim.weather.state).toBe('summer');
  });

  it('mission 6: without his power plant Malvor no longer thaws; in the storm Orrin gets wounded', () => {
    const sim = createMissionSim('c6');
    takeOut(sim, ref(sim, 'malvor_plant'));
    sim.run(3);
    expect(objective(sim, 'malvorPlant').status).toBe('done');
    serfOnIce(sim);
    sim.run(50);
    expect(sim.weather.state).toBe('winter');
    const nelia = heroOf(sim, 'nelia'), orrin = heroOf(sim, 'orrin'), isle = ref(sim, 'isle');
    nelia.px = isle.x * 1000 + 500; nelia.py = (isle.y + isle.r - 1) * 1000 + 500; nelia.path = [];
    until(sim, () => py(sim, 'orrin_wounded'), 200);
    expect(sim.entities.has(orrin.id)).toBe(false);
  });
});

describe('Determinism and save games', () => {
  function runMission(id, ticks, seed) {
    const sim = createMissionSim(id, { seed });
    const ais = sim.mission.def.players.map((p, i) => (p.kind === 'ai' ? new AiPlayer(sim, i, p.difficulty) : null)).filter(Boolean);
    const hashes = [];
    for (let i = 0; i < ticks; i++) { for (const a of ais) a.update(); sim.step(); if (i % 400 === 0) hashes.push(sim.hash()); }
    return { sim, ais, hashes };
  }

  it('same mission and same commands yield the same course', () => {
    expect(runMission('c2', 2000).hashes).toEqual(runMission('c2', 2000).hashes);
    expect(runMission('c6', 1200).hashes).toEqual(runMission('c6', 1200).hashes);
  });

  it('mission state is saved and loaded; afterwards everything continues identically', () => {
    // Morvale: villages (diplomacy), tributes, conversation figures and Taran's side change after loading
    const { sim, ais } = runMission('c5', 1600);
    const data = JSON.parse(JSON.stringify(saveGame(sim, { ais: ais.map((a) => a.getState()) })));
    expect(data.mission.id).toBe('c5');
    const sim2 = loadGame(data);
    const ais2 = data.extra.ais.map((s) => AiPlayer.fromState(sim2, s));
    expect(sim2.mission).toBeInstanceOf(MissionRuntime);
    expect(sim2.mission.state).toEqual(sim.mission.state);
    expect(sim2.hash()).toBe(sim.hash());
    for (let i = 0; i < 2500; i++) {
      for (const a of ais) a.update(); sim.step();
      for (const a of ais2) a.update(); sim2.step();
    }
    expect(sim2.hash()).toBe(sim.hash());
    expect(sim2.mission.state).toEqual(sim.mission.state);
  });

  it('tutorial progress survives saving and loading', () => {
    const sim = createMissionSim('tutorial');
    for (let i = 0; i < 4; i++) act(sim, { type: 'mission', action: 'skip' });
    const sim2 = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    expect(stepId(sim2)).toBe(stepId(sim));
    act(sim2, { type: 'mission', action: 'skip' });
    expect(sim2.mission.state.tutorial.index).toBe(sim.mission.state.tutorial.index + 1);
  });

  it('free game stays unchanged without a mission (no mission state in the save game)', () => {
    const sim = new Sim({ seed: 3 });
    sim.run(50);
    expect(sim.mission).toBeNull();
    expect(saveGame(sim).mission).toBeNull();
    expect(loadGame(JSON.parse(JSON.stringify(saveGame(sim)))).mission).toBeNull();
    expect(sim.step([{ type: 'mission', player: 0, action: 'next' }]).some((e) => e.type === 'rejected')).toBe(true);
  });
});


