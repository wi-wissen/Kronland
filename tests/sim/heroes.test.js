// Campaign heroes (Nelia, Orrin, Taran, Malvor), several heroes per player, diplomacy,
// conversation figures and tributes of the mission runtime.

import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/sim.js';
import { MissionRuntime } from '../../src/sim/missions/runtime.js';
import { HEROES, HERO_IDS } from '../../src/sim/data/units.js';
import { isVisible } from '../../src/sim/systems/vision.js';
import { isEnemy } from '../../src/sim/systems/military.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import * as api from '../../src/sim/missions/setupApi.js';

const T = { de: 'x', en: 'x' };
const heroOf = (sim, p, id) => [...sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === p && (!id || e.hero === id));
/** Free spot near the map centre and put the hero there. */
function field(sim) {
  const c = api.findOpen(sim, sim.map.width >> 1, sim.map.height >> 1, { clear: 3 });
  return c;
}
const put = (e, p) => { e.px = p.x * 1000 + 500; e.py = p.y * 1000 + 500; e.anchor = { x: e.px, y: e.py }; e.path = []; };

/** Small mission from a definition. */
function missionSim(def, seed = 42) {
  const full = { id: 'test', title: T, objectives: [], events: [], ...def };
  const real = full.players.filter((p) => p.kind !== 'bandits' && p.kind !== 'village');
  return new Sim({ seed, players: real.length, heroes: real.map((p) => p.heroes ?? p.hero ?? null), mission: new MissionRuntime(full) });
}

describe('Hero selection', () => {
  it('four own heroes with two abilities each; free game distributes them in order', () => {
    expect(HERO_IDS).toEqual(['nelia', 'orrin', 'taran', 'malvor']);
    for (const id of HERO_IDS) expect(Object.keys(HEROES[id].abilities)).toHaveLength(2);
    const sim = new Sim({ seed: 5, players: 3 });
    expect([0, 1, 2].map((p) => heroOf(sim, p).hero)).toEqual(['nelia', 'orrin', 'taran']);
  });

  it('several heroes per player, each as a reference under their name (main hero = first)', () => {
    const sim = missionSim({ players: [{ kind: 'human', heroes: ['nelia', 'orrin'] }, { kind: 'ai', hero: 'malvor' }] });
    const st = sim.mission.state;
    const n = heroOf(sim, 0, 'nelia'), o = heroOf(sim, 0, 'orrin');
    expect(n && o).toBeTruthy();
    expect(n.px !== o.px || n.py !== o.py).toBe(true);
    expect(st.refs.hero).toBe(n.id);
    expect(st.refs.nelia).toBe(n.id);
    expect(st.refs.orrin).toBe(o.id);
    expect(st.refs.malvor).toBe(heroOf(sim, 1, 'malvor').id);
  });

  it('goals and triggers know individual heroes: reach with who = hero name, heroDown with hero', () => {
    const sim = missionSim({
      players: [{ kind: 'human', heroes: ['nelia', 'orrin'] }],
      objectives: [{ id: 'goal', type: 'reach', area: 'spot', who: 'orrin', primary: true, text: T }],
      events: [{ id: 'down', when: { type: 'heroDown', hero: 'nelia' }, do: [{ type: 'flag', name: 'neliaDown' }] }],
      setup(ctx) { ctx.ref('spot', { ...field(ctx.sim), r: 2 }); },
    });
    const st = sim.mission.state;
    put(heroOf(sim, 0, 'nelia'), st.refs.spot);
    sim.run(2);
    expect(st.objectives[0].status).toBe('active'); // Nelia does not count
    put(heroOf(sim, 0, 'orrin'), st.refs.spot);
    sim.run(2);
    expect(st.result?.won).toBe(true);
    const sim2 = missionSim({ players: [{ kind: 'human', heroes: ['nelia', 'orrin'] }], events: [{ id: 'down', when: { type: 'heroDown', hero: 'nelia' }, do: [{ type: 'flag', name: 'neliaDown' }] }] });
    heroOf(sim2, 0, 'orrin').down = true;
    sim2.run(2);
    expect(sim2.mission.state.flags.neliaDown).toBeUndefined();
    heroOf(sim2, 0, 'nelia').down = true;
    sim2.run(2);
    expect(sim2.mission.state.flags.neliaDown).toBe(true);
  });

  it('action hero brings a hero in mid-mission, remove takes them out', () => {
    const sim = missionSim({
      players: [{ kind: 'human', heroes: ['nelia'] }],
      events: [
        { id: 'join', when: { type: 'time', at: 1 }, do: [{ type: 'hero', hero: 'taran', at: 'humanHq' }] },
        { id: 'leave', when: { type: 'time', at: 2 }, do: [{ type: 'remove', ref: 'taran' }] },
      ],
    });
    sim.run(12);
    expect(heroOf(sim, 0, 'taran')).toBeTruthy();
    sim.run(10);
    expect(heroOf(sim, 0, 'taran')).toBeUndefined();
  });
});

describe('Abilities', () => {
  it('far sight (Nelia) uncovers a large region; encourage doubles the attack of nearby troops', () => {
    const sim = new Sim({ seed: 9, heroes: ['nelia', 'orrin'] });
    const h = heroOf(sim, 0);
    const p = field(sim);
    put(h, p);
    const far = { x: p.x + 15, y: p.y };
    expect(isVisible(sim, 0, far.x, far.y)).toBe(false);
    sim.step([{ type: 'ability', player: 0, hero: h.id, ability: 'farsight' }]);
    sim.step();
    expect(isVisible(sim, 0, far.x, far.y)).toBe(true);
    const L = sim.spawnLeader(0, 'sword1', p.x + 1, p.y, 2);
    sim.step([{ type: 'ability', player: 0, hero: h.id, ability: 'courage' }]);
    expect(L.buff?.attackPercent).toBe(200);
  });

  it('bribe (Orrin): the nearest enemy troop switches sides for thalers, not without thalers', () => {
    const sim = new Sim({ seed: 9, heroes: ['orrin', 'nelia'] });
    const h = heroOf(sim, 0);
    const p = field(sim);
    put(h, p);
    const L = sim.spawnLeader(1, 'sword1', p.x + 2, p.y, 3);
    sim.players[0].stock.gold = 100; sim.players[0].raw.gold = 0;
    let ev = sim.step([{ type: 'ability', player: 0, hero: h.id, ability: 'bribe' }]);
    expect(ev.find((e) => e.type === 'rejected')?.reason).toBe('err.notEnoughGold');
    expect(L.owner).toBe(1);
    sim.players[0].stock.gold = 1000;
    ev = sim.step([{ type: 'ability', player: 0, hero: h.id, ability: 'bribe' }]);
    expect(ev.some((e) => e.type === 'bribed')).toBe(true);
    expect(L.owner).toBe(0);
    expect(L.soldiers.every((id) => sim.entities.get(id).owner === 0)).toBe(true);
    expect(sim.players[0].stock.gold).toBe(1000 - HEROES.orrin.abilities.bribe.gold - 3 * HEROES.orrin.abilities.bribe.goldPerSoldier);
    // no enemy in range: rejected, cooldown does not run
    const sim2 = new Sim({ seed: 9, heroes: ['orrin', 'nelia'] });
    const h2 = heroOf(sim2, 0);
    ev = sim2.step([{ type: 'ability', player: 0, hero: h2.id, ability: 'bribe' }]);
    expect(ev.find((e) => e.type === 'rejected')?.reason).toBe('err.noTarget');
    expect(h2.ready.bribe ?? 0).toBe(0);
  });

  it('intimidate (Taran): enemy troops flee for a while and do not attack', () => {
    const sim = new Sim({ seed: 9, heroes: ['taran', 'nelia'] });
    const h = heroOf(sim, 0);
    const p = field(sim);
    put(h, p);
    const L = sim.spawnLeader(1, 'sword1', p.x + 2, p.y, 3);
    sim.step([{ type: 'ability', player: 0, hero: h.id, ability: 'intimidate' }]);
    expect(L.fearUntil).toBeGreaterThan(sim.tick);
    const x0 = L.px, y0 = L.py;
    const hp0 = h.hp;
    sim.run(60);
    expect(Math.hypot(L.px - x0, L.py - y0)).toBeGreaterThan(3000);
    expect(h.hp).toBe(hp0);
    sim.run(120);
    expect(L.fearUntil).toBeUndefined();
  });

  it('field cannon and foot traps (Malvor) set up a cannon or trap', () => {
    const sim = new Sim({ seed: 9, heroes: ['malvor', 'nelia'] });
    const h = heroOf(sim, 0);
    sim.step([{ type: 'ability', player: 0, hero: h.id, ability: 'fieldGun' }]);
    sim.step([{ type: 'ability', player: 0, hero: h.id, ability: 'caltrops' }]);
    const kinds = [...sim.entities.values()].filter((e) => e.owner === 0).map((e) => e.kind);
    expect(kinds).toContain('turret');
    expect(kinds).toContain('trap');
  });
});

describe('Diplomacy', () => {
  it('neutral: no attack, no shared vision; allied and hostile like teams', () => {
    const sim = new Sim({ seed: 9, players: 2 });
    expect(sim.relation(0, 1)).toBe('hostile');
    expect(isEnemy(sim, 0, 1)).toBe(true);
    sim.setDiplomacy(0, 1, 'neutral');
    expect(isEnemy(sim, 0, 1)).toBe(false);
    expect(sim.allied(0, 1)).toBe(false);
    const p = field(sim);
    const A = sim.spawnLeader(0, 'sword1', p.x, p.y, 2), B = sim.spawnLeader(1, 'sword1', p.x + 1, p.y, 2);
    sim.run(40);
    expect(A.soldiers.length + B.soldiers.length).toBe(4);
    sim.setDiplomacy(0, 1, 'hostile');
    sim.run(300);
    expect(A.soldiers.length + B.soldiers.length).toBeLessThan(4);
    // diplomacy belongs to the save game and to the hash
    sim.setDiplomacy(0, 1, 'allied');
    const sim2 = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    expect(sim2.relation(0, 1)).toBe('allied');
    expect(sim2.hash()).toBe(sim.hash());
  });

  it('villages are their own player slots without a castle, neutral at the start, allied via action', () => {
    const sim = missionSim({
      players: [{ kind: 'human', hero: 'nelia' }, { kind: 'bandits' }, { kind: 'village', name: 'moor' }, { kind: 'village', name: 'heath', diplomacy: { human: 'allied' } }],
      events: [{ id: 'ally', when: { type: 'time', at: 1 }, do: [{ type: 'diplomacy', b: 'moor', state: 'allied' }] }],
    });
    const m = sim.mission;
    const moor = m.playerOf('moor'), heath = m.playerOf('heath');
    expect(sim.findBuilding(moor, 'headquarters')).toBeNull();
    expect(sim.relation(0, moor)).toBe('neutral');
    expect(sim.relation(0, heath)).toBe('allied');
    expect(sim.relation(m.state.bandits, moor)).toBe('neutral');
    expect(m.check(sim, { type: 'diplomacy', b: 'moor', state: 'neutral' })).toBe(true);
    sim.run(12);
    expect(sim.relation(0, moor)).toBe('allied');
  });
});

describe('Tributes and conversation figures', () => {
  const def = () => ({
    players: [{ kind: 'human', heroes: ['nelia', 'orrin'], stock: { gold: 1000, wood: 0, clay: 0, stone: 0, iron: 0, sulfur: 0 } }],
    tributes: {
      buy: { group: 'shard', cost: { gold: 800 }, text: T, onPaid: [{ type: 'flag', name: 'bought' }] },
      cheap: { group: 'shard', cost: { gold: 300 }, text: T, onPaid: [{ type: 'flag', name: 'cheap' }] },
    },
    npcs: { elder: { at: 'spot', hero: 'orrin', wrongHero: T, speaker: 'elder', onTalk: [{ type: 'flag', name: 'talked' }] } },
    start: [{ type: 'tribute', id: 'buy' }, { type: 'tribute', id: 'cheap' }, { type: 'npc', id: 'elder' }],
    setup(ctx) { ctx.ref('spot', { ...field(ctx.sim), r: 1 }); },
  });

  it('tribute: paying deducts the costs, triggers onPaid and closes the other offers of the group', () => {
    const sim = missionSim(def());
    const st = sim.mission.state;
    expect(sim.mission.uiState(sim).tributes.map((t) => t.id)).toEqual(['buy', 'cheap']);
    sim.step([{ type: 'mission', player: 0, action: 'tribute', id: 'buy' }]);
    expect(st.flags.bought).toBe(true);
    expect(sim.players[0].stock.gold).toBe(200);
    expect(st.tributes).toEqual({ buy: 'paid', cheap: 'closed' });
    const ev = sim.step([{ type: 'mission', player: 0, action: 'tribute', id: 'cheap' }]);
    expect(ev.find((e) => e.type === 'rejected')?.reason).toBe('err.noTribute');
    expect(sim.mission.uiState(sim).tributes).toEqual([]);
  });

  it('tribute without enough resources is rejected; unknown IDs too', () => {
    const sim = missionSim(def());
    sim.players[0].stock.gold = 100;
    expect(sim.step([{ type: 'mission', player: 0, action: 'tribute', id: 'buy' }]).find((e) => e.type === 'rejected')?.reason).toBe('err.notEnoughResources');
    expect(sim.step([{ type: 'mission', player: 0, action: 'tribute', id: 'toString' }]).find((e) => e.type === 'rejected')?.reason).toBe('err.noTribute');
    expect(sim.mission.state.tributes.buy).toBe('open');
  });

  it('conversation figure: only the named hero talks to it (the wrong one gets a hint)', () => {
    const sim = missionSim(def());
    const st = sim.mission.state;
    const npc = sim.entities.get(st.npcs.elder.entity);
    expect(npc).toMatchObject({ kind: 'npc', talk: true });
    const n = heroOf(sim, 0, 'nelia');
    n.px = npc.px + 500; n.py = npc.py;
    sim.run(10);
    expect(st.npcs.elder.state).toBe('open');
    expect(st.messages.at(-1)?.speaker).toBe('elder'); // hint: wrong hero
    const o = heroOf(sim, 0, 'orrin');
    o.px = npc.px; o.py = npc.py + 500;
    sim.run(10);
    expect(st.flags.talked).toBe(true);
    expect(npc.talk).toBe(false);
  });
});
