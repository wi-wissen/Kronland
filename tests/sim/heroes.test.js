// Campaign heroes (Nelia, Orrin, Taran, Malvor), several heroes per player, diplomacy,
// conversation figures and tributes of the mission runtime.

import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/sim.js';
import { createScenarioSim } from '../../src/sim/missions/runtime.js';
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

/** Small level on a generated map: players and the mission program (Python). */
function missionSim(players, code = '', seed = 42) {
  return createScenarioSim({
    format: 'kronland-scenario', version: 2, id: 'test', kind: 'mission', end: 'objectives', title: T,
    world: { base: 'generate', seed, size: 64, fog: true }, players,
    sections: [{ id: 'mission', level: 'mission', code }],
  });
}
const out = (sim) => sim.mission.script.state.console.map((c) => c.text);
const errors = (sim) => sim.mission.script.state.errors.map((e) => `${e.code} ${JSON.stringify(e.params)} line ${e.sline}`);
const run = (sim, n) => { for (let i = 0; i < n && !sim.mission.state.result; i++) sim.step(); };

describe('Hero selection', () => {
  it('four own heroes with two abilities each; free game distributes them in order', () => {
    expect(HERO_IDS).toEqual(['nelia', 'orrin', 'taran', 'malvor']);
    for (const id of HERO_IDS) expect(Object.keys(HEROES[id].abilities)).toHaveLength(2);
    const sim = new Sim({ seed: 5, players: 3 });
    expect([0, 1, 2].map((p) => heroOf(sim, p).hero)).toEqual(['nelia', 'orrin', 'taran']);
  });

  it('several heroes per player, each under their name in the mission program', () => {
    const sim = missionSim([{ kind: 'human', heroes: ['nelia', 'orrin'] }, { kind: 'ai', hero: 'malvor' }],
      'print(nelia.name, nelia.owner, orrin.owner, malvor.owner, nelia.distance_to(orrin) > 0)\n');
    const n = heroOf(sim, 0, 'nelia'), o = heroOf(sim, 0, 'orrin');
    expect(n && o).toBeTruthy();
    expect(n.px !== o.px || n.py !== o.py).toBe(true);
    expect(errors(sim)).toEqual([]);
    expect(out(sim)).toEqual(['nelia 0 0 1 True']);
  });

  it('objectives and conditions know individual heroes: figures_near with kind = hero name, Hero.down', () => {
    const code = [
      'spot = find_open(map_center(), clear=3)',
      'make_place("spot", spot.x, spot.y, 2)',
      'nelia_down = False',
      'objective("goal", lambda: len(figures_near(place("spot"), 2, kind="orrin", side="own")) > 0, de="x", en="x")',
      '@on_start',
      'def watch():',
      '    global nelia_down',
      '    wait_until(lambda: nelia.down)',
      '    nelia_down = True',
    ].join('\n');
    const sim = missionSim([{ kind: 'human', heroes: ['nelia', 'orrin'] }], code);
    const st = sim.mission.state, spot = sim.mission.script.places.spot;
    put(heroOf(sim, 0, 'nelia'), spot);
    sim.run(6);
    expect(st.objectives[0].status).toBe('active'); // Nelia does not count
    put(heroOf(sim, 0, 'orrin'), spot);
    sim.run(6);
    expect(st.result?.won).toBe(true);
    const sim2 = missionSim([{ kind: 'human', heroes: ['nelia', 'orrin'] }], code);
    const vm = () => sim2.mission.script.vms.mission.globals.get('nelia_down');
    heroOf(sim2, 0, 'orrin').down = true;
    sim2.run(2);
    expect(vm()).toBe(false);
    heroOf(sim2, 0, 'nelia').down = true;
    sim2.run(2);
    expect(vm()).toBe(true);
  });

  it('add_hero brings a hero in mid-mission, remove takes them out', () => {
    const sim = missionSim([{ kind: 'human', heroes: ['nelia'] }], [
      '@on_start',
      'def story():',
      '    wait(1)',
      '    add_hero(HUMAN, "taran", hq())',
      '    wait(1)',
      '    remove(taran)',
    ].join('\n'));
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

  it('villages are their own player slots without a castle, neutral at the start, allied by the mission program', () => {
    const sim = missionSim([{ kind: 'human', hero: 'nelia' }, { kind: 'bandits' }, { kind: 'village', name: 'moor' }, { kind: 'village', name: 'heath', diplomacy: { human: 'allied' } }], [
      'print(diplomacy(HUMAN, player("moor")), diplomacy(HUMAN, player("heath")))',
      '@on_start',
      'def ally():',
      '    wait(1)',
      '    set_diplomacy(HUMAN, player("moor"), "allied")',
    ].join('\n'));
    const m = sim.mission;
    const moor = m.playerOf('moor'), heath = m.playerOf('heath');
    expect(sim.findBuilding(moor, 'headquarters')).toBeNull();
    expect(sim.relation(0, moor)).toBe('neutral');
    expect(sim.relation(0, heath)).toBe('allied');
    expect(sim.relation(m.state.bandits, moor)).toBe('neutral');
    expect(out(sim)).toEqual(['neutral allied']);
    sim.run(12);
    expect(sim.relation(0, moor)).toBe('allied');
  });
});

describe('Tributes and conversation figures', () => {
  const level = () => missionSim([{ kind: 'human', heroes: ['nelia', 'orrin'], stock: { gold: 1000, wood: 0, clay: 0, stone: 0, iron: 0, sulfur: 0 } }], [
    'bought = None',
    'talked = False',
    'offer("buy", {"gold": 800}, group="shard", de="x", en="x")',
    'offer("cheap", {"gold": 300}, group="shard", de="x", en="x")',
    'spot = find_open(map_center(), clear=3)',
    'elder = npc("elder", at=spot, speaker="elder")',
    '@on_event("tribute")',
    'def paid(id):',
    '    global bought',
    '    bought = id',
    '@on_talk("elder")',
    'def talk(visitor):',
    '    global talked',
    '    if visitor.name != "orrin":',
    '        say("elder", de="Schick mir den Händler.", en="Send me the merchant.")',
    '        return',
    '    elder.stop_talking()',
    '    talked = True',
  ].join('\n'));
  const vm = (sim, name) => sim.mission.script.vms.mission.globals.get(name);
  const talkTo = (sim, h, npc) => sim.step([{ type: 'order', player: 0, units: [h.id], order: 'talk', target: npc.id }]);

  it('tribute: paying deducts the costs, runs @on_event("tribute") and closes the other offers of the group', () => {
    const sim = level();
    const st = sim.mission.state;
    expect(sim.mission.uiState(sim).tributes.map((t) => t.id)).toEqual(['buy', 'cheap']);
    sim.step([{ type: 'mission', player: 0, action: 'tribute', id: 'buy' }]);
    expect(vm(sim, 'bought')).toBe('buy');
    expect(sim.players[0].stock.gold).toBe(200);
    expect(st.tributes).toEqual({ buy: 'paid', cheap: 'closed' });
    const ev = sim.step([{ type: 'mission', player: 0, action: 'tribute', id: 'cheap' }]);
    expect(ev.find((e) => e.type === 'rejected')?.reason).toBe('err.noTribute');
    expect(sim.mission.uiState(sim).tributes).toEqual([]);
  });

  it('tribute without enough resources is rejected; unknown IDs too', () => {
    const sim = level();
    sim.players[0].stock.gold = 100;
    expect(sim.step([{ type: 'mission', player: 0, action: 'tribute', id: 'buy' }]).find((e) => e.type === 'rejected')?.reason).toBe('err.notEnoughResources');
    expect(sim.step([{ type: 'mission', player: 0, action: 'tribute', id: 'toString' }]).find((e) => e.type === 'rejected')?.reason).toBe('err.noTribute');
    expect(sim.mission.state.tributes.buy).toBe('open');
  });

  it('conversation figure: a hero sent to it talks; the mission decides who is the right one', () => {
    const sim = level();
    const st = sim.mission.state;
    const npc = sim.entities.get(st.npcs.elder.entity);
    expect(npc).toMatchObject({ kind: 'npc', talk: true });
    const n = heroOf(sim, 0, 'nelia');
    n.px = npc.px + 500; n.py = npc.py; n.path = [];
    // walking past does nothing; sent to it (a tap with the hero selected), the talk starts
    run(sim, 10);
    expect(st.messages.length).toBe(0);
    talkTo(sim, n, npc);
    run(sim, 20);
    expect(st.npcs.elder.state).toBe('open');
    expect(st.messages.at(-1)?.speaker).toBe('elder'); // hint: wrong hero
    const o = heroOf(sim, 0, 'orrin');
    o.px = npc.px; o.py = npc.py + 500; o.path = [];
    talkTo(sim, o, npc);
    run(sim, 20);
    expect(vm(sim, 'talked')).toBe(true);
    expect(npc.talk).toBe(false);
  });
});
