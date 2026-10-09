// Track model (docs/SPIELREGELN.md §14): formation and fading per ground and weather, the game option
// off / fading / permanent (start option, command setTracks, fixed by a level), saving and the state hash, cost of the
// broom on a large map – src/sim/systems/ground.js, values in BALANCE.ground.tracks.

import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/sim.js';
import { createScenarioSim, createMissionSim } from '../../src/sim/missions/runtime.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { BALANCE } from '../../src/sim/data/balance.js';
import { trackGain, walkerPercent, updateTracks, levelTrackMode, tileKind } from '../../src/sim/systems/ground.js';
import { validateScenario } from '../../src/sim/scripting/scenario.js';

const T = BALANCE.ground.tracks;
const SWEEP = T.sweepSeconds * 10; // ticks per round of the broom

function scenario(extra = {}) {
  return {
    format: 'kronland-scenario', version: 2, id: 'tracks', kind: 'adventure', end: 'script',
    world: { base: 'flat', width: extra.size ?? 24, height: extra.size ?? 16, fog: false, starts: [{ x: 4, y: 8 }], places: {}, ...(extra.world ?? {}) },
    weatherCycle: extra.weatherCycle,
    players: [{ kind: 'human', hero: 'nelia', hq: false }],
    sections: [
      { id: 'world', level: 'mission', code: extra.code ?? 'pass\n' },
      { id: 'player', level: 'player', editable: true, code: '' },
    ],
  };
}
const mk = (extra = {}, opts = {}) => createScenarioSim(scenario(extra), opts);
const hero = (sim) => [...sim.entities.values()].find((e) => e.kind === 'hero');
/** Passes on the ground of the current weather until the strength reaches `level`. */
function passesTo(ground, level) {
  let s = 0, n = 0;
  while (s < level) { s = Math.min(T.max, s + trackGain(ground, s)); n++; }
  return n;
}
/** A tile passed every `every` ticks (no figures: the gain directly, the broom of the simulation). */
function traffic(sim, k, every, ticks) {
  const ground = T[T.weather[sim.weather.state].ground];
  for (let t = 0; t < ticks; t++) {
    if (every && t % every === 0) sim.map.tracks[k] = Math.min(T.max, sim.map.tracks[k] + trackGain(ground, sim.map.tracks[k]));
    updateTracks(sim);
    sim.tick++;
  }
  return sim.map.tracks[k];
}

describe('Track model: gain per pass', () => {
  it('diminishing gain: quick at first, at least 1 below the maximum, nothing above', () => {
    expect(trackGain(T.grass, 0)).toBe(T.grass.gain);
    expect(trackGain(T.grass, 200)).toBeLessThan(T.grass.gain / 2);
    expect(trackGain(T.grass, T.max - 1)).toBe(1);
    expect(trackGain(T.grass, T.max)).toBe(0);
    expect(trackGain(T.snow, 0)).toBe(T.snow.gain);
  });

  it('summer: one pass barely visible, a few passes trodden, many a path; snow: one step leaves footprints', () => {
    expect(T.grass.gain).toBeLessThan(T.grass.trodden);
    expect(T.grass.gain).toBeGreaterThanOrEqual(T.grass.faint);
    expect(passesTo(T.grass, T.grass.trodden)).toBe(4);
    expect(passesTo(T.grass, T.grass.path)).toBe(11);
    expect(passesTo(T.snow, T.snow.trodden)).toBe(1);
    expect(passesTo(T.snow, T.snow.path)).toBe(4);
  });
});

describe('Track model: trampling relative to the walkers of the player', () => {
  /** Passes to a level with the walkers of a player. */
  const passesW = (ground, level, walkers) => {
    const p = walkerPercent(walkers);
    let s = 0, n = 0;
    while (s < level) { s = Math.min(T.max, s + trackGain(ground, s, p)); n++; }
    return n;
  };

  it('gain scales with √(ref / walkers), clamped: a village treads faster than a town', () => {
    expect(walkerPercent(T.walkers.ref)).toBe(100);
    expect(walkerPercent(5)).toBe(T.walkers.maxPercent);
    expect(walkerPercent(0)).toBe(T.walkers.maxPercent);
    expect(walkerPercent(80)).toBe(50);
    expect(walkerPercent(1000)).toBe(T.walkers.minPercent);
    // table in docs/SPIELREGELN.md §14: passes to "trodden" and "path" (grass), "lane" (snow)
    const table = [5, 20, 60, 150].map((w) => [passesW(T.grass, T.grass.trodden, w), passesW(T.grass, T.grass.path, w), passesW(T.snow, T.snow.path, w)]);
    expect(table).toEqual([[2, 6, 2], [4, 11, 4], [6, 18, 8], [9, 27, 12]]);
    // footprints in the snow stay visible after one step even in a big town
    expect(passesW(T.snow, T.snow.trodden, 1000)).toBe(1);
  });

  it('census per player in the same loop: a lone hero treads harder than a crowd of the other player', () => {
    const sim = mk({}, {});
    const h = hero(sim);
    // a crowd of 80 walkers of player 1 (only counted, they stand still)
    for (let i = 0; i < 80; i++) sim.entities.set(10_000 + i, { id: 10_000 + i, kind: 'unit', owner: 1, px: 20_500, py: 14_500, tk: sim.map.idx(20, 14) });
    updateTracks(sim);
    h.px += 1000;
    updateTracks(sim);
    expect(sim.map.tracks[sim.map.idx(4, 8)]).toBe(trackGain(T.grass, 0, walkerPercent(1)));
    const crowd = [...sim.entities.values()].find((e) => e.id === 10_000);
    crowd.px += 1000;
    updateTracks(sim);
    expect(sim.map.tracks[sim.map.idx(20, 14)]).toBe(trackGain(T.grass, 0, walkerPercent(80)));
  });
});

describe('Track model: fading per weather', () => {
  it('summer: a single pass is gone after a minute, a path needs many minutes to grow over', () => {
    const sim = mk();
    const k = sim.map.idx(10, 4);
    sim.map.tracks[k] = T.grass.gain;
    expect(traffic(sim, k, 0, 6 * SWEEP)).toBe(0);
    // a path loses only pathDecay per round: after 5 minutes still a path, after 20 minutes gone
    sim.map.tracks[k] = T.max;
    expect(traffic(sim, k, 0, 30 * SWEEP)).toBeGreaterThanOrEqual(T.grass.path);
    expect(traffic(sim, k, 0, 90 * SWEEP)).toBe(0);
  });

  it('snow is covered faster than grass recovers; rain like summer', () => {
    const s = mk({ weatherCycle: [['summer', 1e9]] }), w = mk({ weatherCycle: [['winter', 1e9]] }), r = mk({ weatherCycle: [['rain', 1e9]] });
    const k = s.map.idx(10, 4);
    for (const sim of [s, w, r]) sim.map.tracks[k] = 100;
    const after = [s, w, r].map((sim) => traffic(sim, k, 0, 10 * SWEEP));
    expect(after[1]).toBeLessThan(after[0]);
    expect(after[2]).toBe(after[0]);
    // a single step in fresh snow: clear footprints for a while, gone after well under two minutes
    w.map.tracks[k] = T.snow.gain;
    expect(traffic(w, k, 0, 3 * SWEEP)).toBeGreaterThanOrEqual(T.snow.trodden);
    expect(traffic(w, k, 0, 7 * SWEEP)).toBe(0);
  });

  it('traffic decides: every 10 s a path within 3 minutes; in the long run every 30 s trodden, every minute nothing', () => {
    const run = (every, seconds, weather = 'summer') => {
      const sim = mk({ weatherCycle: [[weather, 1e9]] });
      return traffic(sim, sim.map.idx(10, 4), every * 10, seconds * 10);
    };
    expect(run(10, 180)).toBeGreaterThanOrEqual(T.grass.path);
    const t30 = run(30, 600);
    expect(t30).toBeGreaterThanOrEqual(T.grass.trodden);
    expect(t30).toBeLessThan(T.grass.path);
    expect(run(60, 600)).toBeLessThan(T.grass.trodden);
    // snow: a lane with a pass every 20 s, footprints (no lane) with one per minute
    expect(run(20, 180, 'winter')).toBeGreaterThanOrEqual(T.snow.path);
    const w60 = run(60, 600, 'winter');
    expect(w60).toBeGreaterThanOrEqual(T.snow.trodden);
    expect(w60).toBeLessThan(T.snow.path);
  });

  it('fresh snow covers the summer tracks, the thaw takes the snow tracks along; summer ↔ rain keeps them', () => {
    const sim = mk();
    const k = sim.map.idx(10, 4);
    sim.map.tracks[k] = 200;
    sim.setWeather('rain', 100);
    expect(sim.map.tracks[k]).toBe(200);
    sim.setWeather('winter', 100);
    expect(sim.map.tracks[k]).toBe(0);
    sim.map.tracks[k] = 150;
    sim.setWeather('summer', 100);
    expect(sim.map.tracks[k]).toBe(0);
  });

  it('broom cost: one round per sweepSeconds, only tiles / period per tick (large map)', () => {
    const sim = mk({ size: 256 });
    const n = sim.map.tracks.length;
    sim.map.tracks.fill(100);
    updateTracks(sim);
    let changed = 0;
    for (const v of sim.map.tracks) if (v !== 100) changed++;
    expect(changed).toBe(Math.ceil(n / SWEEP));
    // 600 ticks (one minute) on 65 536 tiles: a few milliseconds
    const t0 = performance.now();
    for (let i = 0; i < 600; i++) { updateTracks(sim); sim.tick++; }
    expect(performance.now() - t0).toBeLessThan(400);
  });
});

describe('Game option: off / fading / permanent', () => {
  it('start option from the settings; default fading', () => {
    expect(mk().trackMode).toBe('fading');
    expect(mk({}, { tracks: 'permanent' }).trackMode).toBe('permanent');
    expect(mk({}, { tracks: 'nonsense' }).trackMode).toBe('fading');
    expect(new Sim({ seed: 3, size: 48, tracks: 'off' }).trackMode).toBe('off');
  });

  it('off: figures leave nothing; permanent: nothing fades', () => {
    for (const mode of ['off', 'fading', 'permanent']) {
      const sim = mk({}, { tracks: mode });
      const h = hero(sim);
      updateTracks(sim);
      h.px += 1000;
      updateTracks(sim);
      const k = sim.map.idx(4, 8);
      expect(sim.map.tracks[k]).toBe(mode === 'off' ? 0 : trackGain(T.grass, 0, walkerPercent(1)));
      sim.map.tracks[k] = 100;
      for (let i = 0; i < 2 * SWEEP; i++) { updateTracks(sim); sim.tick++; }
      expect(sim.map.tracks[k]).toBe(mode === 'fading' ? 100 - 2 * T.weather.summer.decay : 100); // the broom only runs when fading
    }
  });

  it('permanent: weather changes keep the tracks too', () => {
    const sim = mk({}, { tracks: 'permanent' });
    const k = sim.map.idx(10, 4);
    sim.map.tracks[k] = 90;
    sim.setWeather('winter', 100);
    sim.setWeather('summer', 100);
    expect(sim.map.tracks[k]).toBe(90);
  });

  it('command setTracks: changes the mode deterministically, "off" clears all tracks, wrong modes are rejected', () => {
    const sim = mk();
    const k = sim.map.idx(10, 4);
    sim.map.tracks[k] = 120;
    sim.command({ type: 'setTracks', player: 0, mode: 'permanent' });
    let ev = sim.step();
    expect(sim.trackMode).toBe('permanent');
    expect(ev).toContainEqual({ type: 'trackMode', mode: 'permanent' });
    sim.command({ type: 'setTracks', player: 0, mode: 'sometimes' });
    ev = sim.step();
    expect(ev).toContainEqual(expect.objectContaining({ type: 'rejected', reason: 'err.badTrackMode' }));
    expect(sim.map.tracks[k]).toBe(120);
    sim.command({ type: 'setTracks', player: 0, mode: 'off' });
    sim.step();
    expect(sim.trackMode).toBe('off');
    expect(sim.map.tracks.some((v) => v > 0)).toBe(false);
  });

  it('a level fixes the mode: the setting is ignored, the command rejected; old "fade: 0" means permanent', () => {
    const sim = mk({ world: { tracks: { mode: 'permanent' } } }, { tracks: 'off' });
    expect(sim.trackMode).toBe('permanent');
    expect(sim.trackModeFixed).toBe(true);
    sim.command({ type: 'setTracks', player: 0, mode: 'off' });
    const ev = sim.step();
    expect(ev).toContainEqual(expect.objectContaining({ type: 'rejected', reason: 'err.trackModeFixed' }));
    expect(sim.trackMode).toBe('permanent');
    expect(levelTrackMode({ fade: 0 })).toBe('permanent');
    expect(levelTrackMode({ who: 'heroes' })).toBe(null);
    expect(levelTrackMode(null)).toBe(null);
    expect(mk({ world: { tracks: { who: 'heroes' } } }).trackModeFixed).toBe(false);
    expect(validateScenario(scenario({ world: { tracks: { mode: 'always' } } }))[0]).toMatch(/world.tracks/);
    expect(validateScenario(scenario({ world: { tracks: { fade: 30 } } }))[0]).toMatch(/world.tracks/);
    expect(validateScenario(scenario({ world: { tracks: { mode: 'off', threshold: 200 } } }))).toEqual([]);
  });

  it('r1-4 "Im Schneetreiben" keeps its trail whatever the player set', () => {
    const sim = createMissionSim('r1-4', { tracks: 'off' });
    expect(sim.trackMode).toBe('permanent');
    expect(sim.trackModeFixed).toBe(true);
    expect(tileKind(sim, 7, 22)).toBe('track');
  });
});

describe('Tracks: saving and the state hash', () => {
  it('mode and fixed flag are saved and hashed; loading continues identically', () => {
    const play = (sim, ticks) => { for (let i = 0; i < ticks; i++) sim.step(); };
    const make = () => {
      const sim = new Sim({ seed: 5, size: 48, tracks: 'fading' });
      // the serfs walk back and forth over the same tiles
      const serfs = [...sim.entities.values()].filter((e) => e.kind === 'unit' && e.owner === 0).map((e) => e.id);
      const hq = [...sim.entities.values()].find((e) => e.type === 'headquarters' && e.owner === 0);
      sim.command({ type: 'move', player: 0, units: serfs, x: hq.x + 8, y: hq.y + 8 });
      return sim;
    };
    const ref = make();
    play(ref, 300);
    ref.command({ type: 'setTracks', player: 0, mode: 'permanent' });
    play(ref, 300);
    const sim = make();
    play(sim, 300);
    sim.command({ type: 'setTracks', player: 0, mode: 'permanent' });
    play(sim, 100);
    const loaded = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    expect(loaded.trackMode).toBe('permanent');
    expect(loaded.trackModeFixed).toBe(false);
    expect(loaded.hash()).toBe(sim.hash());
    play(loaded, 200);
    expect(loaded.hash()).toBe(ref.hash());
    expect(ref.map.tracks.some((v) => v > 0)).toBe(true);
    // the mode is part of the hash
    const h = ref.hash();
    ref.trackMode = 'fading';
    expect(ref.hash()).not.toBe(h);
  });

  it('older save games without the option: the mode of the level or the default', () => {
    const sim = mk({ world: { tracks: { mode: 'permanent' } } });
    const data = JSON.parse(JSON.stringify(saveGame(sim)));
    delete data.trackMode; delete data.trackModeFixed;
    const loaded = loadGame(data);
    expect(loaded.trackMode).toBe('permanent');
    expect(loaded.trackModeFixed).toBe(true);
    const free = JSON.parse(JSON.stringify(saveGame(mk())));
    delete free.trackMode; delete free.trackModeFixed;
    expect(loadGame(free)).toMatchObject({ trackMode: 'fading', trackModeFixed: false });
  });
});
