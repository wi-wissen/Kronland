// Ground: sensor words with precedence (also on bridges), items on tiles (take/put), tracks (build, broom, threshold,
// settings of the level), saving and the state hash – src/sim/systems/ground.js.

import { describe, it, expect } from 'vitest';
import { createScenarioSim } from '../../src/sim/missions/runtime.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { WATER, BRIDGE } from '../../src/sim/map.js';
import { BALANCE } from '../../src/sim/data/balance.js';
import { tileKind, tileToward, addItem, removeItem, itemList, updateTracks, trackThreshold, trackGain, walkerPercent, TILE_WORDS } from '../../src/sim/systems/ground.js';
import { validateScenario } from '../../src/sim/scripting/scenario.js';

const run = (sim, ticks) => { for (let i = 0; i < ticks && !sim.mission.state.result; i++) sim.step(); };
const runCode = (sim, code) => sim.command({ type: 'script', player: 0, action: 'run', sections: { player: code } });
const heroOf = (sim) => [...sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === 0);
const tileOf = (e) => [Math.floor(e.px / 1000), Math.floor(e.py / 1000)];
const consoleText = (sim) => sim.mission.script.state.console.map((c) => c.text).join('\n');
const errors = (sim) => sim.mission.script.state.errors;

function scenario(world = '', extra = {}) {
  return {
    format: 'kronland-scenario', version: 2, id: 'ground', kind: 'adventure', end: 'script',
    world: { base: 'flat', width: 24, height: 16, fog: false, starts: [{ x: 4, y: 8 }], places: {}, ...(extra.world ?? {}) },
    players: extra.players ?? [{ kind: 'human', hero: 'nelia', hq: false }],
    sections: [
      { id: 'world', level: 'mission', code: world || 'pass\n' },
      { id: 'player', level: 'player', editable: true, code: '' },
    ],
  };
}

describe('tileKind: one word per tile, fixed precedence', () => {
  it('edge, cliff, tree, pile, water, coin, flower, ice, track, free', () => {
    const sim = createScenarioSim(scenario('add_tree(6, 8)\nadd_pile("stone", 7, 8)\nworld.set_cliff(8, 8)\nworld.set_water(9, 8)\nadd_item("coin", 10, 8)\nadd_item("flower", 11, 8)\nworld.set_track(12, 8)\n'));
    const k = (x, y) => tileKind(sim, x, y);
    expect([k(-1, 0), k(6, 8), k(7, 8), k(8, 8), k(9, 8), k(10, 8), k(11, 8), k(12, 8), k(13, 8)])
      .toEqual(['edge', 'tree', 'pile', 'cliff', 'water', 'coin', 'flower', 'track', 'free']);
    expect(TILE_WORDS).toEqual(expect.arrayContaining(['edge', 'cliff', 'tree', 'pile', 'ruin', 'building', 'water', 'coin', 'flower', 'ice', 'track', 'free']));
    // Winter: water becomes ice; an item on the ice comes first, a track does not hide the ice
    sim.setWeather('winter', 100);
    expect(k(9, 8)).toBe('ice');
    expect(addItem(sim, 9, 8, 'coin')).toBe(true);
    expect(k(9, 8)).toBe('coin');
    removeItem(sim, 9, 8);
    sim.map.tracks[sim.map.idx(9, 8)] = 40;
    expect(k(9, 8)).toBe('ice');
    // Thaw: items and tracks on the water are gone
    addItem(sim, 9, 8, 'flower');
    sim.setWeather('summer', 100);
    expect(k(9, 8)).toBe('water');
    expect(sim.map.items.size).toBe(2);
    expect(sim.map.tracks[sim.map.idx(9, 8)]).toBe(0);
    // A building on the tile
    sim.createBuilding(0, 'residence', 14, 4, true);
    expect(k(14, 4)).toBe('building');
  });

  it('a finished bridge is ground: the sensor does not say "water" and step() goes over it', () => {
    const sim = createScenarioSim(scenario('for y in range(world.height):\n    world.set_water(6, y)\n'));
    const m = sim.map;
    expect(tileKind(sim, 6, 8)).toBe('water');
    m.flags[m.idx(6, 8)] |= BRIDGE;
    m.version++;
    expect(tileKind(sim, 6, 8)).toBe('free');
    runCode(sim, 'nelia.step()\nprint(nelia.front(), nelia.can_step())\nnelia.step(2)\nprint(nelia.here(), nelia.x)\nnelia.turn_left()\nnelia.turn_left()\nnelia.step()\nprint(nelia.here())\n');
    run(sim, 120);
    expect(errors(sim)).toEqual([]);
    expect(consoleText(sim)).toBe('free True\nfree 7\nfree');
  });

  it('tileToward: front, left, right and here relative to the look direction', () => {
    const e = { px: 4500, py: 8500, face: 0 };
    expect([tileToward(e, 0), tileToward(e, -1), tileToward(e, 1), tileToward(e, null)]).toEqual([{ x: 4, y: 7 }, { x: 3, y: 8 }, { x: 5, y: 8 }, { x: 4, y: 8 }]);
    e.face = 2;
    expect([tileToward(e, 0), tileToward(e, -1), tileToward(e, 1)]).toEqual([{ x: 4, y: 9 }, { x: 5, y: 8 }, { x: 3, y: 8 }]);
    delete e.face; // east when nothing was set
    expect(tileToward(e, 0)).toEqual({ x: 5, y: 8 });
  });
});

describe('Items on tiles', () => {
  it('only on walkable ground, one per tile; trees and buildings take them away', () => {
    const sim = createScenarioSim(scenario('world.set_water(9, 8)\nprint(add_item("coin", 5, 5), add_item("coin", 5, 5), add_item("coin", 9, 8), add_item("flower", 6, 5))\nadd_item("coin", 7, 5)\n'));
    expect(consoleText(sim)).toBe('True False False True');
    expect(itemList(sim.map).map((p) => `${p.kind}@${p.x},${p.y}`)).toEqual(['coin@5,5', 'flower@6,5', 'coin@7,5']);
    sim.addNode('tree', 6, 5, 'wood', 30);
    sim.createBuilding(0, 'residence', 7, 4, true);
    expect(itemList(sim.map).map((p) => p.kind)).toEqual(['coin']);
    expect(removeItem(sim, 5, 5)).toBe('coin');
    expect(removeItem(sim, 5, 5)).toBeNull();
  });

  it('take() and put() are a lockstep command: stock, rejections, events, waiting', () => {
    const sim = createScenarioSim(scenario('add_item("coin", 5, 8)\nadd_item("flower", 6, 8)\n'));
    // No castle: the stock starts empty, coins count
    expect(sim.players[0].stock.gold).toBe(0);
    const h = heroOf(sim);
    expect(sim.applyCommand({ type: 'item', player: 0, unit: h.id, action: 'take' })).toBe(false);
    expect(sim.events.at(-1)).toMatchObject({ type: 'rejected', reason: 'err.nothingHere' });
    expect(sim.applyCommand({ type: 'item', player: 0, unit: h.id, action: 'put' })).toBe(false);
    expect(sim.events.at(-1)).toMatchObject({ reason: 'err.notEnoughGold' });
    expect(sim.applyCommand({ type: 'item', player: 1, unit: h.id, action: 'take' })).toBe(false);
    runCode(sim, 't0 = time()\nnelia.step()\nt1 = time()\nprint(nelia.take(), round(time() - t1, 1))\nnelia.step()\nprint(nelia.take(), stock("gold"))\nnelia.put()\nprint(nelia.here(), stock("gold"))\nnelia.put()\n');
    const events = [];
    for (let i = 0; i < 80; i++) events.push(...sim.step());
    expect(consoleText(sim)).toBe('coin 0.5\nflower 1\ncoin 0\n');
    expect(events.filter((e) => e.type === 'item').map((e) => `${e.action} ${e.kind}`)).toEqual(['take coin', 'take flower', 'put coin']);
    expect(errors(sim).at(-1)).toMatchObject({ kind: 'GameError', sline: 9, params: { reason: 'err.somethingHere' } });
  });

  it('items_near (nearest first), items() and the hash and save game', () => {
    const sim = createScenarioSim(scenario('for x in [9, 6, 12]:\n    add_item("coin", x, 8)\nadd_item("flower", 4, 10)\nprint(items(), items("flower"))\n'));
    runCode(sim, 'print(items_near(nelia, 6))\nprint(items_near(nelia, 6, kind="flower"))\nprint(items_near((12, 8), 0))\n');
    run(sim, 3);
    expect(consoleText(sim)).toBe('[(6, 8), (9, 8), (12, 8), (4, 10)] [(4, 10)]\n[(6, 8), (4, 10), (9, 8)]\n[(4, 10)]\n[(12, 8)]');
    const before = sim.hash();
    const copy = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    expect(copy.hash()).toBe(before);
    expect(itemList(copy.map)).toEqual(itemList(sim.map));
    removeItem(sim, 9, 8);
    expect(sim.hash()).not.toBe(before);
  });
});

describe('Tracks', () => {
  it('a figure leaving a tile leaves a track there, the broom fades it again', () => {
    const sim = createScenarioSim(scenario('', { world: { tracks: { threshold: 1 } } }));
    expect(trackThreshold(sim)).toBe(1);
    runCode(sim, 'print(nelia.here())\nnelia.step()\nprint(nelia.here())\nnelia.turn_left()\nnelia.turn_left()\nprint(nelia.front())\n');
    run(sim, 30);
    expect(consoleText(sim)).toBe('free\nfree\ntrack');
    const k = sim.map.idx(4, 8);
    // one pass on grass: the gain of the ground, doubled for a lone walker (the broom reaches this tile at tick 49)
    expect(sim.map.tracks[k]).toBe(trackGain(BALANCE.ground.tracks.grass, 0, walkerPercent(1)));
    // the broom passes every tile once in 10 s and takes 3 levels in summer: gone after two minutes
    run(sim, 1200);
    expect(sim.map.tracks[k]).toBe(0);
  });

  it('threshold per weather: the trodden level of grass, every footprint in the snow', () => {
    const T = BALANCE.ground.tracks;
    const sim = createScenarioSim(scenario('world.set_track(6, 8, 20)\n', { world: { tracks: { mode: 'permanent' } } }));
    expect(trackThreshold(sim)).toBe(T.grass.trodden);
    expect(tileKind(sim, 6, 8)).toBe('free');
    sim.setWeather('winter', 100);
    expect(trackThreshold(sim)).toBe(T.snow.trodden);
    expect(tileKind(sim, 6, 8)).toBe('track');
  });

  it('teleports leave nothing; who: "none" and mode permanent from the level', () => {
    const sim = createScenarioSim(scenario('world.set_track(10, 10)\n', { world: { tracks: { who: 'none', mode: 'permanent', threshold: 1 } } }));
    const h = heroOf(sim);
    updateTracks(sim);
    h.px += 1000;
    updateTracks(sim);
    expect(sim.map.tracks[sim.map.idx(4, 8)]).toBe(0);
    run(sim, 400);
    expect(sim.map.tracks[sim.map.idx(10, 10)]).toBe(BALANCE.ground.tracks.max);
    const sim2 = createScenarioSim(scenario('', { world: { tracks: { threshold: 1 } } }));
    const h2 = heroOf(sim2);
    updateTracks(sim2);
    h2.px += 5000;
    updateTracks(sim2);
    expect(sim2.map.tracks.some((v) => v > 0)).toBe(false);
    expect(validateScenario(scenario('', { world: { tracks: { who: 'some' } } }))[0]).toMatch(/world.tracks/);
  });

  it('tracks are saved and hashed; loading mid-walk continues identically', () => {
    const mk = () => createScenarioSim(scenario('add_item("coin", 8, 8)\n', { world: { tracks: { threshold: 1 } } }));
    const code = 'for i in range(6):\n    nelia.step()\n    if nelia.here() == "coin":\n        nelia.take()\nnelia.turn_left()\nnelia.turn_left()\nprint(nelia.front())\n';
    const ref = mk();
    runCode(ref, code);
    run(ref, 120);
    const sim = mk();
    runCode(sim, code);
    run(sim, 23);
    const loaded = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    expect(loaded.hash()).toBe(sim.hash());
    run(loaded, 97);
    expect(loaded.hash()).toBe(ref.hash());
    expect(consoleText(loaded)).toBe('track');
    expect(loaded.players[0].stock.gold).toBe(1);
    const h = ref.hash();
    ref.map.tracks[0]++;
    expect(ref.hash()).not.toBe(h);
  });

  it('soldiers and serfs leave tracks too (one loop over all figures)', () => {
    const sim = createScenarioSim(scenario('spawn(HUMAN, "sword1", (6, 4), soldiers=4)\n', { world: { tracks: { threshold: 1, mode: 'permanent' } } }));
    const L = [...sim.entities.values()].find((e) => e.kind === 'leader');
    sim.applyCommand({ type: 'order', player: 0, units: [L.id], order: 'move', x: 16, y: 4 });
    run(sim, 100);
    let n = 0;
    for (const v of sim.map.tracks) if (v) n++;
    expect(n).toBeGreaterThan(15);
  });
});
