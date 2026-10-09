import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/sim.js';
import { MissionRuntime, createMissionSim } from '../../src/sim/missions/runtime.js';
import { CAMPAIGN, allMissions, getMission } from '../../src/sim/missions/registry.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { AiPlayer } from '../../src/ai/AiPlayer.js';
import { tr } from '../../src/i18n/tr.js';
import * as api from '../../src/sim/missions/setupApi.js';
import { act, build, own, hero, objective, stepId, until, idle, P, ref, refIds, talkTo, py, stepWithEvent, takeOut, heroOf } from './missionBot.js';
import { playTutorial, playMission1, meetOrrin } from './playthroughs.js';

/** Small test mission directly from a definition (without registry). */
function testSim(def, seed = 42) {
  const full = { id: 'test', title: { de: 'T', en: 'T' }, players: [{ kind: 'human', hero: 'nelia' }], objectives: [], events: [], ...def };
  const real = full.players.filter((p) => p.kind !== 'bandits');
  const m = new MissionRuntime(full);
  return new Sim({ seed, players: real.length, heroes: real.map((p) => p.hero ?? null), mission: m });
}

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

describe('Objectives', () => {
  it('build objective with progress; victory when all main objectives are fulfilled', () => {
    const sim = testSim({
      objectives: [
        { id: 'farm', type: 'build', building: 'farm', primary: true, text: { de: 'x', en: 'x' } },
        { id: 'opt', type: 'build', building: 'residence', count: 2, text: { de: 'x', en: 'x' } },
      ],
    });
    sim.step();
    expect(objective(sim, 'farm').progress).toEqual([0, 1]);
    const id = build(sim, 'farm');
    until(sim, () => sim.mission.state.result, 3000, (s) => { const ids = idle(s).map((u) => u.id); if (ids.length) s.command({ player: P, type: 'assignWork', units: ids, target: id }); });
    expect(objective(sim, 'farm').status).toBe('done');
    expect(objective(sim, 'opt').status).toBe('active');
    expect(sim.mission.state.result).toMatchObject({ won: true, reason: 'objectives' });
  });

  it('resource, research, workers, motivation, population', () => {
    const sim = testSim({
      players: [{ kind: 'human', hero: 'nelia', stock: { gold: 100, clay: 0, wood: 0, stone: 0, iron: 0, sulfur: 0 } }],
      objectives: [
        { id: 'gold', type: 'stock', res: 'gold', amount: 500, primary: true, text: { de: 'x', en: 'x' } },
        { id: 'edu', type: 'research', tech: 'education', primary: true, text: { de: 'x', en: 'x' } },
        { id: 'w', type: 'workers', count: 1, primary: true, text: { de: 'x', en: 'x' } },
        { id: 'mot', type: 'motivation', value: 100, primary: true, text: { de: 'x', en: 'x' } },
        { id: 'pop', type: 'population', count: 5, primary: true, text: { de: 'x', en: 'x' } },
      ],
    });
    sim.step();
    expect(objective(sim, 'gold').progress).toEqual([100, 500]);
    expect(objective(sim, 'mot').status).toBe('done'); // without workers the start motivation applies
    sim.players[0].stock.gold = 600;
    sim.players[0].techs.add('education');
    sim.step();
    expect(objective(sim, 'gold').status).toBe('done');
    expect(objective(sim, 'edu').status).toBe('done');
    expect(objective(sim, 'w').status).toBe('active');
    act(sim, { type: 'buySerf', count: 1 });
    sim.step();
    expect(objective(sim, 'pop').status).toBe('done');
  });

  it('recruiting only counts matching troops from the reveal on', () => {
    const sim = testSim({
      players: [{ kind: 'human', hero: 'nelia', techs: ['conscription'], stock: { gold: 5000, wood: 5000, iron: 5000, stone: 5000, clay: 5000, sulfur: 0 } }],
      objectives: [{ id: 'swords', type: 'recruit', line: 'sword', count: 2, primary: true, text: { de: 'x', en: 'x' } }],
    });
    const b = api.placeBuilding(sim, 0, 'barracks', api.centerOf(sim.findBuilding(0, 'headquarters')), { minR: 5 });
    act(sim, { type: 'recruit', building: b.id, line: 'spear', full: false });
    act(sim, { type: 'recruit', building: b.id, line: 'sword', full: false });
    expect(objective(sim, 'swords').progress).toEqual([1, 2]);
    act(sim, { type: 'recruit', building: b.id, line: 'sword', full: false });
    expect(objective(sim, 'swords').status).toBe('done');
  });

  it('survive, reach region, archers (defeat on loss)', () => {
    const sim = testSim({
      setup(ctx) {
        const hq = ctx.hqCenter();
        ctx.ref('goal', { ...ctx.api.findOpen(ctx.sim, hq.x + 8, hq.y + 8, { from: hq }), r: 4 });
        ctx.ref('vc', ctx.sim.findBuilding(0, 'villageCenter').id);
      },
      objectives: [
        { id: 'live', type: 'survive', seconds: 30, primary: true, text: { de: 'x', en: 'x' } },
        { id: 'go', type: 'reach', area: 'goal', who: 'hero', primary: true, text: { de: 'x', en: 'x' } },
        { id: 'keep', type: 'protect', ref: 'vc', primary: true, text: { de: 'x', en: 'x' } },
      ],
    });
    const g = sim.mission.state.refs.goal;
    act(sim, { type: 'order', units: [hero(sim).id], order: 'move', x: g.x, y: g.y });
    until(sim, () => objective(sim, 'go').status === 'done', 1000);
    expect(objective(sim, 'go').status).toBe('done');
    expect(sim.mission.state.result).toBeNull();
    until(sim, () => sim.mission.state.result, 400);
    expect(sim.mission.state.result.won).toBe(true);
    expect(objective(sim, 'keep').status).toBe('done'); // held goals count as fulfilled on victory

    const sim2 = testSim({
      setup(ctx) { ctx.ref('vc', ctx.sim.findBuilding(0, 'villageCenter').id); },
      objectives: [{ id: 'keep', type: 'protect', ref: 'vc', primary: true, text: { de: 'x', en: 'x' } }],
    });
    sim2.step();
    sim2.removeEntity(sim2.findBuilding(0, 'villageCenter'));
    sim2.step();
    expect(objective(sim2, 'keep').status).toBe('failed');
    expect(sim2.mission.state.result).toMatchObject({ won: false, reason: 'keep' });
  });

  it('hidden objectives only appear through a trigger', () => {
    const sim = testSim({
      objectives: [
        { id: 'a', type: 'stock', res: 'gold', amount: 1, primary: true, hidden: true, text: { de: 'x', en: 'x' } },
        { id: 'b', type: 'survive', seconds: 100, primary: true, text: { de: 'x', en: 'x' } },
      ],
      events: [{ id: 'show', when: { type: 'time', at: 5 }, do: { type: 'reveal', id: 'a' } }],
    });
    sim.run(10);
    expect(objective(sim, 'a').status).toBe('hidden');
    expect(sim.mission.uiState(sim).objectives.map((o) => o.id)).toEqual(['b']);
    sim.run(45);
    expect(objective(sim, 'a').status).toBe('done');
  });

  it('castle destroyed: defeat; enemy castle destroyed: victory', () => {
    const lose = testSim({ objectives: [{ id: 's', type: 'survive', seconds: 100, primary: true, text: { de: 'x', en: 'x' } }] });
    const hq = lose.findBuilding(0, 'headquarters');
    lose.step();
    hq.hp = 1;
    lose.removeEntity(hq); lose.checkDefeat(0);
    lose.step();
    expect(lose.mission.state.result).toMatchObject({ won: false, reason: 'hq' });

    const win = testSim({
      players: [{ kind: 'human', hero: 'nelia' }, { kind: 'ai', difficulty: 'easy', aggression: 'passive' }],
      objectives: [{ id: 'k', type: 'destroyHq', target: 'enemy', primary: true, text: { de: 'x', en: 'x' } }],
    });
    win.step();
    const ehq = win.findBuilding(1, 'headquarters');
    win.removeEntity(ehq); win.checkDefeat(1);
    win.step();
    expect(win.mission.state.result).toMatchObject({ won: true });
  });
});

describe('Triggers and actions', () => {
  it('time, goal fulfilled, building built, resource reached; actions dialogue, resources, tech, weather, camera', () => {
    const sim = testSim({
      players: [{ kind: 'human', hero: 'nelia' }, { kind: 'bandits' }],
      objectives: [{ id: 'g', type: 'stock', res: 'gold', amount: 900, text: { de: 'x', en: 'x' } }],
      events: [
        { id: 't', when: { type: 'time', at: 2 }, do: [{ type: 'dialog', speaker: 'ottilie', text: { de: 'Hallo', en: 'Hi' } }, { type: 'give', res: { gold: 1000 }, techs: ['alchemy'] }] },
        { id: 'o', when: { type: 'objective', id: 'g' }, do: [{ type: 'weather', state: 'winter', seconds: 30 }, { type: 'camera', at: 'humanHq' }] },
        { id: 'r', when: { type: 'resource', res: 'gold', amount: 1400 }, do: { type: 'flag', name: 'rich' } },
        { id: 'b', when: { type: 'built', building: 'residence', placed: true }, do: { type: 'flag', name: 'house' } },
        { id: 'rep', when: { type: 'time', at: 1 }, every: 1, times: 3, do: { type: 'give', res: { wood: 1 } } },
      ],
    });
    const wood0 = sim.players[0].stock.wood;
    sim.run(25);
    const st = sim.mission.state;
    expect(st.messages.map((m) => m.text.de)).toEqual(['Hallo']);
    expect(sim.players[0].techs.has('alchemy')).toBe(true);
    expect(objective(sim, 'g').status).toBe('done');
    expect(sim.weather.state).toBe('winter');
    expect(sim.map.frozen).toBe(true);
    expect(st.camera).toMatchObject({ x: expect.any(Number) });
    expect(st.flags.rich).toBe(true);
    expect(st.flags.house).toBeUndefined();
    sim.run(30);
    expect(st.fireCount.rep).toBe(3);
    expect(sim.players[0].stock.wood).toBe(wood0 + 3);
    build(sim, 'residence');
    sim.step();
    expect(st.flags.house).toBe(true);
    sim.run(300);
    expect(sim.weather.state).not.toBe('winter'); // after 30 s the cycle again
  });

  it('attack wave with attack-move reaches the castle; death of all attackers triggers', () => {
    const sim = testSim({
      players: [{ kind: 'human', hero: null }, { kind: 'bandits' }],
      setup(ctx) {
        const hq = ctx.hqCenter();
        const p = ctx.api.findOpen(ctx.sim, hq.x + 18, hq.y + 18, { from: hq, clear: 2 });
        ctx.ref('gate', { ...p, r: 2 });
      },
      events: [
        { id: 'w', when: { type: 'time', at: 1 }, do: { type: 'spawn', owner: 'bandits', at: 'gate', units: [{ def: 'sword1', count: 2, soldiers: 4 }], order: 'attackMove', target: 'humanHq', ref: 'wave' } },
        { id: 'gone', when: { type: 'dead', ref: 'wave' }, do: { type: 'victory' } },
      ],
    });
    sim.run(15);
    const ids = sim.mission.idsOf('wave');
    expect(ids.length).toBe(2);
    expect(sim.entities.get(ids[0]).order.type).toBe('attackMove');
    // the wave marches off and damages buildings at the castle (castle or village centre)
    const mine = () => [...sim.entities.values()].filter((e) => e.kind === 'building' && e.owner === 0);
    const hp0 = mine().reduce((s, b) => s + b.hp, 0);
    until(sim, () => mine().reduce((s, b) => s + b.hp, 0) < hp0, 1500);
    expect(mine().reduce((s, b) => s + b.hp, 0)).toBeLessThan(hp0);
    for (const id of ids) { const L = sim.entities.get(id); if (!L) continue; for (const s of L.soldiers) sim.entities.delete(s); sim.entities.delete(id); }
    sim.step();
    expect(sim.mission.state.result).toMatchObject({ won: true });
  });

  it('bandits never build, defend their camp and do not count as a winning team', () => {
    const sim = testSim({
      players: [{ kind: 'human', hero: 'nelia' }, { kind: 'bandits' }],
      setup(ctx) {
        const hq = ctx.hqCenter();
        ctx.camp('c', ctx.api.toward(hq, ctx.mapCenter(), 20), [{ def: 'spear1', count: 1, soldiers: 2 }], { from: hq });
      },
      objectives: [{ id: 'c', type: 'destroy', ref: 'c', primary: true, text: { de: 'x', en: 'x' } }],
    });
    const b = sim.mission.state.bandits;
    expect(b).toBe(1);
    expect(sim.players[b].neutral).toBe(true);
    expect(sim.findBuilding(b, 'headquarters')).toBeNull();
    const guard = sim.entities.get(sim.mission.state.refs.cGuards[0]);
    const g0 = { ...guard.anchor };
    sim.run(200);
    expect(guard.order.type).toBe('idle'); // without a reason they stay put
    // hero approaches → alarm
    const area = sim.mission.state.refs.cArea;
    act(sim, { type: 'order', units: [hero(sim).id], order: 'move', x: area.x, y: area.y + 2 });
    until(sim, () => sim.mission.state.camps[0].alarm > 0, 1500);
    expect(sim.mission.state.camps[0].alarm).toBeGreaterThan(0);
    expect(guard.order.type === 'attackMove' || guard.targetId > 0).toBe(true);
    expect(g0).toBeTruthy();
    expect(sim.winner).toBeNull();
    // bandits give no commands to build: no construction sites
    expect([...sim.entities.values()].filter((e) => e.kind === 'building' && e.owner === b).length).toBe(1);
  });

  it('AI opponent: start delay, aggression and build bans from the mission', () => {
    const sim = testSim({
      players: [{ kind: 'human', hero: 'nelia' }, { kind: 'ai', difficulty: 'normal', startDelay: 30, forbid: ['residence'] }],
      events: [{ id: 'mad', when: { type: 'time', at: 60 }, do: { type: 'ai', player: 'enemy', aggression: 'aggressive', difficulty: 'hard' } }],
    });
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
      // mission files declare their objectives, level folders in Python (read from the code)
      const goals = m.objectives?.length ? m.objectives : m.goals;
      expect(goals.some((o) => o.primary)).toBe(true);
      expect(goals.some((o) => !o.primary)).toBe(true); // every mission has side objectives
    });
  });

  it.each(CAMPAIGN.flatMap((m) => [m.seed, 7, 99, 31337].map((seed) => [m.id, seed])))('%s sets itself up without errors on map %i', (id, seed) => {
    const sim = createMissionSim(id, { seed });
    const st = sim.mission.state;
    expect(st.warnings).toEqual([]);
    const def = getMission(id);
    // every reference points to something existing
    for (const [k, v] of Object.entries(st.refs)) {
      if (typeof v === 'number') expect(sim.entities.has(v), k).toBe(true);
    }
    // all target regions are reachable (in the matching weather) – from the castle or from the start spot
    const hqB = sim.findBuilding(0, 'headquarters');
    const hq = hqB ? api.centerOf(hqB) : sim.starts[0];
    for (const name of Object.keys(st.refs).filter((k) => k.endsWith('Area') || ['spot', 'isle', 'clayShaft'].includes(k))) {
      const a = st.refs[name];
      expect(api.reachable(sim, hq, a, true), `${id}/${name}`).toBe(true);
    }
    // Level folders: the Python world building ran without errors, its places can be reached
    if (sim.mission.script) {
      expect(sim.mission.script.state.errors, id).toEqual([]);
      for (const [name, p] of Object.entries(sim.mission.script.places)) {
        if (name.endsWith('Area') || ['clayShaft', 'oldRoot', 'orrinSeat', 'collectorFrom'].includes(name)) expect(api.reachable(sim, hq, p, true), `${id}/${name}`).toBe(true);
      }
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
    const nelia = sim.entities.get(st.refs.nelia);
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
    expect(st.warnings).toEqual([]);
    expect(sim.findBuilding(0, 'headquarters')).toBeNull();
    expect(sim.players[0].stock.gold).toBe(400);
    const start = sim.starts[0];
    expect(sim.entities.get(st.refs.weatherworks)?.type).toBe('weatherPlant');
    expect(sim.map.frozen).toBe(true);
    // island: cut off in summer, over the ice in winter
    expect(api.reachable(sim, start, st.refs.isle, false)).toBe(false);
    expect(api.reachable(sim, start, st.refs.isle, true)).toBe(true);
    // the gate is a land route into the valley, the gorge only passable in winter
    const valley = st.refs.valley;
    expect(api.reachable(sim, start, valley, false)).toBe(true);
    const gateTiles = [];
    for (let y = st.refs.gate.y - 6; y <= st.refs.gate.y + 6; y++) for (let x = st.refs.gate.x - 6; x <= st.refs.gate.x + 6; x++) {
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
    expect(st.refs.fordGuards.length).toBe(2);
    expect(st.refs.gateCampGuards.length).toBe(5);
    expect(api.reachable(sim, valley, st.refs.ruinsArea, false)).toBe(true);
    expect(api.reachable(sim, valley, st.refs.landing, false)).toBe(true);
    sim.run(300);
    expect(st.result).toBeNull();
  });

  /** Fast-forward mission 3 to the destruction of the works, put the heroes at `where`, wait for the thaw. */
  const thawWith = (where) => {
    const sim = createMissionSim('c3');
    const st = sim.mission.state;
    for (const ref of ['worksCampGuards', 'gateCampGuards', 'fordGuards', 'prisonGuards']) sim.mission.runAction(sim, { type: 'remove', ref });
    // without reinforcements (here it is only about the thaw)
    for (const id of ['alarm', 'cutOff']) st.fireCount[id] = 1;
    sim.mission.runAction(sim, { type: 'remove', ref: 'weatherworks' });
    sim.run(3);
    expect(objective(sim, 'escape').status).toBe('active');
    for (const id of st.refs.heroes) {
      const h = sim.entities.get(id);
      h.px = where.x * 1000 + 500; h.py = where.y * 1000 + 500; h.path = []; h.order = { type: 'hold' };
    }
    until(sim, () => objective(sim, 'escape').status !== 'active' || st.result, 700);
    return sim;
  };

  it('mission 3: after the works it thaws after 60 s – on solid ground play continues', () => {
    const sim = thawWith(createMissionSim('c3').mission.state.refs.landing);
    const st = sim.mission.state;
    expect(st.result).toBeNull();
    expect(objective(sim, 'escape').status).toBe('done');
    expect(sim.weather.state).toBe('summer');
    expect(sim.map.frozen).toBe(false);
    // blueprint still to fetch: then victory
    const h = sim.entities.get(st.refs.nelia);
    act(sim, { type: 'order', units: [h.id], order: 'move', x: st.refs.ruinsArea.x, y: st.refs.ruinsArea.y });
    until(sim, () => st.result, 1500);
    expect(st.result).toMatchObject({ won: true });
  });

  it('mission 3: whoever stands on the island or the ice during the thaw loses', () => {
    const isle = createMissionSim('c3').mission.state.refs.isle;
    expect(thawWith({ x: isle.x, y: isle.y + 3 }).mission.state.result).toMatchObject({ won: false, reason: 'island' });
    expect(thawWith({ x: isle.x, y: isle.y + isle.r + 3 }).mission.state.result).toMatchObject({ won: false, reason: 'ice' });
  });

  it('mission 3: Orrin bribes a squad at the post (350–400 thalers), the squad then fights for us', () => {
    const sim = createMissionSim('c3');
    const st = sim.mission.state;
    const orrin = sim.entities.get(st.refs.orrin);
    const guard = sim.entities.get(st.refs.fordGuards[0]);
    orrin.px = guard.px + 2000; orrin.py = guard.py; orrin.path = [];
    const ev = act(sim, { type: 'ability', hero: orrin.id, ability: 'bribe' });
    expect(ev.some((e) => e.type === 'bribed')).toBe(true);
    const turned = [...sim.entities.values()].filter((e) => e.kind === 'leader' && e.owner === 0 && st.refs.fordGuards.includes(e.id));
    expect(turned.length).toBe(1);
    expect(sim.players[0].stock.gold).toBeLessThanOrEqual(50);
    sim.run(20);
    expect(st.camps.find((c) => c.name === 'ford').guards).not.toContain(turned[0].id);
  });

  it('mission 4: Taran withdraws when he falls; the mining master hands over only after the siege', () => {
    const sim = createMissionSim('c4');
    const st = sim.mission.state;
    const taran = sim.entities.get(st.refs.taran);
    expect(taran.owner).toBe(st.bandits);
    taran.hp = 0; taran.down = true;
    sim.run(2);
    expect(sim.entities.has(taran.id)).toBe(false);
    expect(st.npcs.miner).toBeUndefined();
    for (const id of st.refs.siegeGuards) sim.mission.runAction(sim, { type: 'remove', ref: id });
    sim.run(2);
    expect(st.npcs.miner?.state).toBe('open');
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
    until(sim, () => st.fired.herald, 2000);
    expect(villages.every((v) => sim.relation(0, v) === 'neutral')).toBe(true);
    expect(st.refs.helpers.some((id) => sim.entities.has(id))).toBe(false);
    until(sim, () => st.fired.order, 3500); // five minutes after the herald at the latest (or the first delivery)
    const taran = [...sim.entities.values()].find((e) => e.kind === 'hero' && e.hero === 'taran');
    expect(taran.owner).toBe(0);
    expect(objective(sim, 'granaries').status).toBe('active');
    // delivery wins a village back
    sim.players[0].stock.wood = 2000; sim.players[0].stock.clay = 2000;
    act(sim, { type: 'mission', action: 'tribute', id: 'supplyMoorbrook' });
    expect(sim.relation(0, villages[0])).toBe('allied');
  });

  it.each([6606, 7])('mission 6 on map %i: island castle only via the ice, Malvor\'s power plant within shooting range from the shore', (seed) => {
    const sim = createMissionSim('c6', { seed });
    const st = sim.mission.state;
    expect(st.warnings).toEqual([]);
    const me = api.centerOf(sim.findBuilding(0, 'headquarters'));
    const castle = api.centerOf(sim.entities.get(st.refs.castle));
    expect(api.reachable(sim, me, castle, false)).toBe(false);
    expect(api.reachable(sim, me, castle, true)).toBe(true);
    // Malvor's power plant: on the works island (unreachable in summer), fully charged, reachable from the shore for archers
    const plant = sim.entities.get(st.refs.malvorPlant);
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
    const st = sim.mission.state, isle = st.refs.isle;
    sim.setWeather('winter', 1800);
    sim.run(2);
    const ice = [...api.rings(isle.x, isle.y, isle.r + 2, isle.r + 4)].find((p) => sim.map.inBounds(p.x, p.y) && (sim.map.flags[sim.map.idx(p.x, p.y)] & 1));
    const u = [...sim.entities.values()].find((e) => e.kind === 'unit' && e.owner === 0);
    u.job = null; u.path = []; u.px = ice.x * 1000 + 500; u.py = ice.y * 1000 + 500;
    return u;
  };

  it('mission 6: Malvor thaws the lake as soon as someone stands on the ice, then he has to reload and wait', () => {
    const sim = createMissionSim('c6');
    const st = sim.mission.state;
    const u = serfOnIce(sim);
    sim.run(15);
    expect(sim.weather.state).toBe('summer');
    expect(sim.entities.has(u.id)).toBe(false); // drowned
    expect(sim.players[1].weatherEnergy).toBeLessThan(100);
    expect(st.fired.firstThaw).toBeDefined();
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
    const st = sim.mission.state;
    sim.mission.runAction(sim, { type: 'remove', ref: 'malvorPlant' });
    sim.run(3);
    expect(objective(sim, 'malvorPlant').status).toBe('done');
    serfOnIce(sim);
    sim.run(50);
    expect(sim.weather.state).toBe('winter');
    const nelia = sim.entities.get(st.refs.nelia), isle = st.refs.isle;
    nelia.px = isle.x * 1000 + 500; nelia.py = (isle.y + isle.r - 1) * 1000 + 500; nelia.path = [];
    until(sim, () => st.flags.orrinWounded, 200);
    expect(sim.entities.has(st.refs.orrin)).toBe(false);
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
    sim.mission.state.flags.test = 1;
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


