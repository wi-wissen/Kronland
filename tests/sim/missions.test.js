import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/sim.js';
import { MissionRuntime, createMissionSim } from '../../src/sim/missions/runtime.js';
import { CAMPAIGN, allMissions, getMission } from '../../src/sim/missions/registry.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { AiPlayer } from '../../src/ai/AiPlayer.js';
import { tr } from '../../src/i18n/tr.js';
import * as api from '../../src/sim/missions/setupApi.js';
import { act, build, own, hero, objective, stepId, until, idle, P } from './missionBot.js';
import { playTutorial, playMission1 } from './playthroughs.js';

/** Small test mission directly from a definition (without registry). */
function testSim(def, seed = 42) {
  const full = { id: 'test', title: { de: 'T', en: 'T' }, players: [{ kind: 'human', hero: 'bertram' }], objectives: [], events: [], ...def };
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
      players: [{ kind: 'human', hero: 'bertram', stock: { gold: 100, clay: 0, wood: 0, stone: 0, iron: 0, sulfur: 0 } }],
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
      players: [{ kind: 'human', hero: 'bertram', techs: ['conscription'], stock: { gold: 5000, wood: 5000, iron: 5000, stone: 5000, clay: 5000, sulfur: 0 } }],
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
      players: [{ kind: 'human', hero: 'bertram' }, { kind: 'ai', difficulty: 'easy', aggression: 'passive' }],
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
      players: [{ kind: 'human', hero: 'bertram' }, { kind: 'bandits' }],
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
      players: [{ kind: 'human', hero: 'bertram' }, { kind: 'bandits' }],
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
      players: [{ kind: 'human', hero: 'bertram' }, { kind: 'ai', difficulty: 'normal', startDelay: 30, forbid: ['residence'] }],
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

describe('Campaign', () => {
  it('has at least 5 missions with briefing, victory/defeat text and chaining', () => {
    expect(CAMPAIGN.length).toBeGreaterThanOrEqual(5);
    CAMPAIGN.forEach((m, i) => {
      expect(m.briefing?.de && m.victoryText?.de && m.defeatText?.de).toBeTruthy();
      expect(m.next ?? null).toBe(CAMPAIGN[i + 1]?.id ?? null);
      expect(m.objectives.some((o) => o.primary)).toBe(true);
      expect(m.objectives.some((o) => !o.primary)).toBe(true); // every mission has side objectives
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
    // All target regions are reachable (in the matching weather)
    const hq = api.centerOf(sim.findBuilding(0, 'headquarters'));
    for (const name of Object.keys(st.refs).filter((k) => k.endsWith('Area') || ['spot', 'isle', 'clayShaft'].includes(k))) {
      const a = st.refs[name];
      expect(api.reachable(sim, hq, a, true), `${id}/${name}`).toBe(true);
    }
    if (id === 'c4') expect(api.reachable(sim, hq, st.refs.isle, false)).toBe(false); // only over the ice
    sim.run(100);
    expect(st.result).toBeNull();
    expect(def.title.en).toBeTruthy();
  });

  it('mission 1 can be won with a command script', () => {
    const { sim, ok } = playMission1();
    expect(ok).toBe(true);
    expect(sim.mission.state.result).toMatchObject({ won: true, reason: 'objectives' });
  });

  it('Mission 2: waves attack the village, defeat without defence', () => {
    const sim = createMissionSim('c2');
    const st = sim.mission.state;
    until(sim, () => st.result, 9000);
    expect(st.fired.wave1).toBeDefined();
    expect(st.result?.won ?? false).toBe(false);
  });

  it.each([4404, 7, 99, 31337])('Mission 4 on map %i: island, dungeon and guards only reachable over the ice', (seed) => {
    const sim = createMissionSim('c4', { seed });
    const st = sim.mission.state;
    const hq = api.centerOf(sim.findBuilding(0, 'headquarters'));
    const { isle, prisonArea } = st.refs;
    expect(api.reachable(sim, hq, isle, false)).toBe(false);
    expect(api.reachable(sim, hq, isle, true)).toBe(true);
    // The dungeon is on the island, and so are the guards
    expect(api.dist(prisonArea, isle)).toBeLessThanOrEqual(isle.r);
    for (const id of st.refs.prisonGuards) {
      const g = api.tileOf(sim.entities.get(id));
      expect(api.reachable(sim, hq, g, false), `Wache ${id}`).toBe(false);
      expect(api.reachable(sim, hq, g, true), `Wache ${id}`).toBe(true);
    }
    // Winter raid starts reachable (over the ice) to the castle
    expect(api.reachable(sim, st.refs.raidFrom, hq, true)).toBe(true);
  });

  it('Mission 4: winter after 3 minutes, thaw after 8; whoever does not bring Hedda home loses', () => {
    const sim = createMissionSim('c4');
    const st = sim.mission.state;
    sim.run(1799);
    expect(sim.weather.state).toBe('summer');
    sim.run(2);
    expect(sim.weather.state).toBe('winter');
    expect(st.fired.freeze).toBeDefined();
    until(sim, () => st.result, 3200);
    expect(sim.weather.state).not.toBe('winter');
    expect(st.result).toMatchObject({ won: false, reason: 'thaw' });
    expect(Math.round(st.result.tick / 10)).toBe(480);
  });

  it('Mission 4: the lake is only passable in winter', () => {
    const sim = createMissionSim('c4');
    const hq = api.centerOf(sim.findBuilding(0, 'headquarters'));
    const isle = sim.mission.state.refs.isle;
    expect(sim.map.frozen).toBe(false);
    until(sim, () => sim.weather.state === 'winter', 2000);
    expect(sim.map.frozen).toBe(true);
    expect(api.reachable(sim, hq, isle)).toBe(true);
    expect(objective(sim, 'cross').status).toBe('active');
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
    expect(runMission('c3', 1200).hashes).toEqual(runMission('c3', 1200).hashes);
  });

  it('mission state is saved and loaded; afterwards everything continues identically', () => {
    const { sim, ais } = runMission('c3', 1500);
    sim.mission.state.flags.test = 1;
    const data = JSON.parse(JSON.stringify(saveGame(sim, { ais: ais.map((a) => a.getState()) })));
    expect(data.mission.id).toBe('c3');
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


