// Developer mode: instrumented A* search (same result, sim unchanged), overlay data,
// figure info, options, stats text and wireframe materials.

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Sim } from '../../src/sim/sim.js';
import { findPath, pathStats } from '../../src/sim/pathfinding.js';
import { WATER, OCCUPIED, RESERVED, CLIFF, TileMap } from '../../src/sim/map.js';
import { UNIT } from '../../src/sim/fixed.js';
import { recordSearch, searchForFigure, SearchPlayback, TILE_OPEN, TILE_CLOSED, TILE_PATH, EV_CLOSE, EV_GOAL } from '../../src/dev/astar.js';
import {
  walkLayer, heightLayer, buildLayer, visionLayer, territoryLayer, regionLayer, searchLayer, sightCircles, slopeAt, COLORS, regionColor,
} from '../../src/dev/overlayData.js';
import { figureInfo, focusFigure } from '../../src/dev/figureInfo.js';
import { sanitizeDev, isDevHotkey, devRequested, DEV_DEFAULTS } from '../../src/dev/state.js';
import { statsRows, statsText, fmtNum } from '../../src/dev/statsText.js';
import { wireClone } from '../../src/dev/wireframe.js';
import { t } from '../../src/i18n/index.js';
import { newSim, serfsOf, hqOf } from '../sim/helpers.js';

/** Deterministic random numbers for test pairs. */
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

/** Random walkable tile. */
function randomWalkable(map, rnd) {
  for (;;) {
    const x = Math.floor(rnd() * map.width), y = Math.floor(rnd() * map.height);
    if (map.walkable(x, y)) return { x, y };
  }
}

/** Walkable tile nearby (ring search). */
function walkableNear(map, x, y) {
  for (let r = 0; r < 20; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (map.walkable(x + dx, y + dy)) return { x: x + dx, y: y + dy };
  }
  throw new Error('no walkable tile');
}

const rgbaAt = (data, k) => [...data.subarray(k * 4, k * 4 + 4)];

describe('A* with observer', () => {
  it('yields the same route as without observer for many start/goal pairs', () => {
    for (const seed of [42, 7]) {
      const sim = newSim(seed), map = sim.map, rnd = lcg(seed);
      for (let n = 0; n < 60; n++) {
        const a = randomWalkable(map, rnd), b = randomWalkable(map, rnd);
        const goals = [map.idx(b.x, b.y)];
        const plain = findPath(map, a.x, a.y, goals);
        let events = 0;
        const observed = findPath(map, a.x, a.y, goals, 20000, () => { events++; });
        expect(observed).toEqual(plain);
        if (plain && plain.length) expect(events).toBeGreaterThan(0);
        const rec = recordSearch(map, a.x, a.y, goals);
        expect(rec.path).toEqual(plain);
        if (plain === null) expect(rec.result).toMatch(/unreachable|exhausted/);
        else expect(rec.result).toBe(plain.length ? 'found' : 'here');
      }
    }
  });

  it('identical also with several goals and a limited node count', () => {
    const sim = newSim(42), map = sim.map, rnd = lcg(3);
    for (let n = 0; n < 30; n++) {
      const a = randomWalkable(map, rnd);
      const goals = [0, 1, 2].map(() => { const b = randomWalkable(map, rnd); return map.idx(b.x, b.y); });
      for (const max of [50, 20000]) {
        expect(findPath(map, a.x, a.y, goals, max, () => {})).toEqual(findPath(map, a.x, a.y, goals, max));
      }
    }
  });

  it('does not count debug runs in pathStats', () => {
    const sim = newSim(42), map = sim.map, rnd = lcg(11);
    const before = { ...pathStats };
    for (let n = 0; n < 10; n++) {
      const a = randomWalkable(map, rnd), b = randomWalkable(map, rnd);
      recordSearch(map, a.x, a.y, [map.idx(b.x, b.y)]);
    }
    expect(pathStats.searches).toBe(before.searches);
    expect(pathStats.unreachable).toBe(before.unreachable);
    expect(pathStats.exhausted).toBe(before.exhausted);
  });

  it('recording: closed list, goal at the end, f = g + h, playback forwards and backwards', () => {
    const sim = newSim(42), map = sim.map;
    const hq = hqOf(sim);
    const s = { x: hq.x - 2, y: hq.y + 1 };
    let goal = null;
    for (let d = 14; d < 40 && !goal; d++) if (map.walkable(s.x + d, s.y + 6)) goal = map.idx(s.x + d, s.y + 6);
    expect(map.walkable(s.x, s.y)).toBe(true);
    const rec = recordSearch(map, s.x, s.y, [goal]);
    expect(rec.result).toBe('found');
    expect(rec.type[rec.steps - 1]).toBe(EV_GOAL);
    let closes = 0;
    for (let k = 0; k < rec.steps; k++) if (rec.type[k] === EV_CLOSE) closes++;
    expect(closes).toBe(rec.expanded);

    const pb = new SearchPlayback(rec, map.width * map.height);
    pb.seek(rec.steps);
    expect(pb.done).toBe(true);
    expect(pb.pathTiles).toEqual([rec.start, ...rec.path]);
    for (const k of rec.path) expect(pb.state[k]).toBe(TILE_PATH);
    const startInfo = pb.info(rec.start);
    expect(startInfo.g).toBe(0);
    const last = pb.info(goal);
    expect(last.f).toBe(last.g + last.h);
    expect(last.h).toBe(0);

    // intermediate state: identical, whether reached forwards or after seeking back
    const mid = Math.floor(rec.steps / 2);
    const fresh = new SearchPlayback(rec, map.width * map.height);
    fresh.seek(mid);
    pb.seek(mid);
    expect([...pb.state]).toEqual([...fresh.state]);
    expect([...pb.g]).toEqual([...fresh.g]);
    expect(pb.open).toBe(fresh.open);
    expect(pb.closed).toBe(fresh.closed);
    expect(pb.open + pb.closed).toBe([...pb.state].filter((v) => v === TILE_OPEN || v === TILE_CLOSED).length);
    pb.seek(0);
    expect(pb.state.every((v) => v === 0)).toBe(true);
  });

  it('unreachable goal (different region) is detected without a search', () => {
    const map = new TileMap(12, 8);
    for (let y = 0; y < 8; y++) map.flags[map.idx(6, y)] = WATER;
    const rec = recordSearch(map, 1, 1, [map.idx(10, 5)]);
    expect(rec.result).toBe('unreachable');
    expect(rec.steps).toBe(0);
    expect(rec.path).toBeNull();
  });

  it('debug runs, overlays and figure infos do not change the sim hash', () => {
    const run = (debug) => {
      const sim = new Sim({ seed: 9 });
      const hashes = [];
      const serfs = serfsOf(sim).map((e) => e.id);
      const hq = hqOf(sim);
      for (let tick = 0; tick < 400; tick++) {
        const cmds = [];
        if (tick % 60 === 5) {
          const k = (tick / 60) | 0;
          const to = walkableNear(sim.map, hq.x - 6 + (k % 3) * 6, hq.y + 8 - (k % 2) * 14);
          cmds.push({ type: 'move', player: 0, units: serfs.slice(0, 3), ...to });
        }
        sim.step(cmds);
        if (debug) {
          for (const e of sim.entities.values()) {
            if (e.px === undefined) continue;
            figureInfo(sim, e);
            if (e.path?.length) {
              const rec = searchForFigure(sim, e);
              const pb = new SearchPlayback(rec, sim.map.width * sim.map.height);
              pb.seek(rec.steps >> 1);
              searchLayer(pb);
            }
          }
          if (tick % 50 === 0) {
            walkLayer(sim.map); heightLayer(sim.map, sim.waterLevel); buildLayer(sim.map);
            visionLayer(sim, 0); territoryLayer(sim); regionLayer(sim.map, 1); sightCircles(sim, 0);
            sim.hash(); // the display computes the hash in between as well
          }
        }
        if (tick % 25 === 0) hashes.push(sim.hash());
      }
      return hashes;
    };
    expect(run(true)).toEqual(run(false));
  });

  it('searchForFigure searches from the position to the last path tile (path stays unchanged)', () => {
    const sim = newSim(42);
    const s = serfsOf(sim)[0];
    const hq = hqOf(sim);
    sim.step([{ type: 'move', player: 0, units: [s.id], ...walkableNear(sim.map, hq.x - 8, hq.y + 9) }]);
    sim.step();
    expect(s.path.length).toBeGreaterThan(2);
    const before = [...s.path];
    const rec = searchForFigure(sim, s);
    expect(s.path).toEqual(before);
    expect(rec.goals).toEqual([before[before.length - 1]]);
    expect(rec.start).toBe(Math.floor(s.py / UNIT) * sim.map.width + Math.floor(s.px / UNIT));
    expect(rec.path[rec.path.length - 1]).toBe(before[before.length - 1]);
    expect(searchForFigure(sim, { px: s.px, py: s.py, path: [] })).toBeNull();
  });
});

describe('Overlay data', () => {
  it('walkability colours free, occupied, cliff, water, ice and building spot', () => {
    const map = new TileMap(6, 1);
    map.flags.set([0, OCCUPIED, CLIFF, WATER, RESERVED, CLIFF | WATER]);
    let d = walkLayer(map);
    expect(rgbaAt(d, 0)).toEqual(COLORS.free);
    expect(rgbaAt(d, 1)).toEqual(COLORS.blocked);
    expect(rgbaAt(d, 2)).toEqual(COLORS.cliff);
    expect(rgbaAt(d, 3)).toEqual(COLORS.water);
    expect(rgbaAt(d, 4)).toEqual(COLORS.reserved);
    expect(rgbaAt(d, 5)).toEqual(COLORS.cliff);
    map.frozen = true;
    d = walkLayer(map);
    expect(rgbaAt(d, 3)).toEqual(COLORS.ice);
  });

  it('height map: range, water blue, high ground light', () => {
    const map = new TileMap(4, 1);
    map.heights.set([-200, 100, 600, 1200]);
    const { data, min, max, contour } = heightLayer(map, 0, 10000);
    expect([min, max]).toEqual([-200, 1200]);
    expect(contour).toBe(10000);
    expect(heightLayer(map, 0).contour).toBeGreaterThanOrEqual(50);
    const [r0, , b0] = rgbaAt(data, 0);
    expect(b0).toBeGreaterThan(r0);
    const top = rgbaAt(data, 3);
    expect(Math.min(top[0], top[1], top[2])).toBeGreaterThan(240);
    expect(data[3]).toBe(205);
  });

  it('buildability: flat green, steep orange, occupied red, building spot yellow', () => {
    const map = new TileMap(9, 3);
    map.heights.fill(0);
    map.heights[map.idx(7, 1)] = 900;
    map.flags[map.idx(0, 0)] = OCCUPIED;
    map.flags[map.idx(3, 1)] = RESERVED;
    const d = buildLayer(map, 300);
    expect(rgbaAt(d, map.idx(1, 1))).toEqual(COLORS.buildable);
    expect(rgbaAt(d, map.idx(0, 0))).toEqual(COLORS.blocked);
    expect(rgbaAt(d, map.idx(3, 1))).toEqual(COLORS.reserved);
    const steep = rgbaAt(d, map.idx(6, 1));
    expect(steep[0]).toBe(255);
    expect(steep[1]).toBeLessThan(170);
    expect(slopeAt(map, 6, 1)).toBe(900);
    expect(slopeAt(map, 1, 1)).toBe(0);
  });

  it('vision: start region visible, distance unexplored; without fog everything visible', () => {
    const sim = newSim(42);
    const hq = hqOf(sim), W = sim.map.width;
    const d = visionLayer(sim, 0);
    expect(rgbaAt(d, (hq.y + 1) * W + hq.x + 1)).toEqual(COLORS.visible);
    const enemy = hqOf(sim, 1);
    expect(rgbaAt(d, (enemy.y + 1) * W + enemy.x + 1)).toEqual(COLORS.unexplored);
    const open = new Sim({ seed: 42, fog: false });
    const d2 = visionLayer(open, 0);
    expect(rgbaAt(d2, (enemy.y + 1) * W + enemy.x + 1)).toEqual(COLORS.visible);
    const circles = sightCircles(sim, 0);
    expect(circles.some((c) => c.kind === 'building' && c.r >= 16)).toBe(true);
    expect(circles.every((c) => c.r > 0)).toBe(true);
  });

  it('territories: castles belong to their owner, border tiles stronger', () => {
    const sim = newSim(42);
    const { data, owner } = territoryLayer(sim);
    const W = sim.map.width;
    for (const p of [0, 1]) {
      const hq = hqOf(sim, p);
      expect(owner[(hq.y + 1) * W + hq.x + 1]).toBe(p);
    }
    const alphas = new Set();
    for (let k = 0; k < owner.length; k++) if (owner[k] >= 0) alphas.add(data[k * 4 + 3]);
    expect([...alphas].sort()).toEqual([230, 95].sort());
  });

  it('regions: count like map.regionAt, focus highlights one region', () => {
    const map = new TileMap(12, 8);
    for (let y = 0; y < 8; y++) map.flags[map.idx(6, y)] = WATER;
    const { data, count } = regionLayer(map);
    expect(count).toBe(2);
    expect(data[map.idx(6, 0) * 4 + 3]).toBe(0);
    const focus = map.regionAt(map.idx(1, 1));
    const f = regionLayer(map, focus).data;
    expect(f[map.idx(1, 1) * 4 + 3]).toBeGreaterThan(f[map.idx(10, 1) * 4 + 3]);
    expect(regionColor(1)).not.toEqual(regionColor(2));
  });

  it('A* layer: start, goal, open, closed, path', () => {
    const sim = newSim(42), map = sim.map, hq = hqOf(sim);
    const s = { x: hq.x - 2, y: hq.y + 1 };
    let goal = null;
    for (let d = 10; d < 40 && !goal; d++) if (map.walkable(s.x + d, s.y + 4)) goal = map.idx(s.x + d, s.y + 4);
    const rec = recordSearch(map, s.x, s.y, [goal]);
    const pb = new SearchPlayback(rec, map.width * map.height);
    pb.seek(Math.floor(rec.steps / 2));
    let d = searchLayer(pb);
    expect(rgbaAt(d, rec.start)).toEqual(COLORS.start);
    expect(rgbaAt(d, goal)).toEqual(COLORS.goal);
    expect(rgbaAt(d, pb.current)).toEqual(COLORS.current);
    const st = [...pb.state];
    const anyOpen = st.findIndex((v, k) => v === TILE_OPEN && k !== goal && k !== rec.start);
    const anyClosed = st.findIndex((v, k) => v === TILE_CLOSED && k !== rec.start && k !== pb.current);
    expect(rgbaAt(d, anyOpen)).toEqual(COLORS.open);
    expect(rgbaAt(d, anyClosed)).toEqual(COLORS.closed);
    pb.seek(rec.steps);
    d = searchLayer(pb);
    expect(rgbaAt(d, rec.path[0])).toEqual(COLORS.path);
  });
});

describe('Figure info', () => {
  it('serf: idle, after a move command "walks" with a path goal', () => {
    const sim = newSim(42);
    const s = serfsOf(sim)[0], hq = hqOf(sim);
    let info = figureInfo(sim, s);
    expect(info.state).toBe('idle');
    expect(info.hp).toBe(info.maxHp);
    sim.step([{ type: 'move', player: 0, units: [s.id], ...walkableNear(sim.map, hq.x - 8, hq.y + 9) }]);
    sim.step();
    info = figureInfo(sim, s);
    expect(info.state).toBe('walk');
    expect(info.goal).toEqual({ x: s.path[s.path.length - 1] % sim.map.width, y: Math.floor(s.path[s.path.length - 1] / sim.map.width) });
    expect(info.pathLen).toBe(s.path.length);
  });

  it('hero and focus figure (soldier → captain), building without figure info', () => {
    const sim = newSim(42);
    const hero = [...sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === 0);
    expect(figureInfo(sim, hero).state).toBe('idle');
    expect(figureInfo(sim, hqOf(sim))).toBeNull();
    const L = sim.spawnLeader(0, 'sword1', hqOf(sim).x - 3, hqOf(sim).y + 2);
    expect(focusFigure(sim, [L.soldiers[0]]).id).toBe(L.id);
    expect(focusFigure(sim, [hqOf(sim).id])).toBeNull();
    expect(figureInfo(sim, sim.entities.get(L.soldiers[0])).raw).toBe('follow');
  });
});

describe('Options, stats, wireframe', () => {
  it('sanitizeDev discards unknown values and wrong types', () => {
    const o = sanitizeDev({ grid: 'nonsense', labels: 'all', wire: { terrain: true, foo: true, water: 'yes' }, playSpeed: 99999, extra: 1, stats: 'nope' });
    expect(o.grid).toBe('none');
    expect(o.labels).toBe('all');
    expect(o.wire).toEqual({ ...DEV_DEFAULTS.wire, terrain: true });
    expect(o.playSpeed).toBe(400);
    expect(o.stats).toBe(DEV_DEFAULTS.stats);
    expect('extra' in o).toBe(false);
  });

  it('hotkeys and address', () => {
    expect(isDevHotkey({ key: 'F3' })).toBe(true);
    expect(isDevHotkey({ key: 'D', ctrlKey: true, shiftKey: true })).toBe(true);
    expect(isDevHotkey({ key: 'd', ctrlKey: true })).toBe(false);
    expect(isDevHotkey({ key: 'F3', ctrlKey: true })).toBe(false);
    expect(devRequested('?seed=1&dev=1')).toBe(true);
    expect(devRequested('?debug=1')).toBe(true);
    expect(devRequested('?dev=0')).toBe(false);
  });

  it('stats as text: all rows, numbers formatted', () => {
    const s = {
      fps: 59.94, frameMs: 16.7, frameMax: 33, simMs: 0.42, simMax: 1.2, aiMs: 0.1, tick: 1234, speed: 2, paused: false,
      hash: '00c0ffee', hashTick: 1230, calls: 88, triangles: 123456, geometries: 40, textures: 12, programs: 9,
      heap: { used: 52.3, limit: 4096 }, entities: { tree: 900, unit: 6, building: 3 }, chars: { drawn: 5, culled: 2 },
      lod: { building: [2, 1], tree: [100, 50, 20] }, width: 1280, height: 720, dpr: 1.5, tier: 'high', gpu: 'TestGPU',
      camera: { x: 10, z: 20, yaw: Math.PI / 2, pitch: 0.95, dist: 28 },
      music: { mode: 'build', intensity: 0.3, need: 0.45, engaged: true, want: 'build', playing: 'build' },
    };
    const rows = statsRows(s, (k) => t(k, null, 'de'));
    expect(rows.length).toBeGreaterThan(14);
    const text = statsText(s, (k) => t(k, null, 'de'), 'Title');
    expect(text.split('\n')[0]).toBe('Title');
    expect(text).toContain('00c0ffee @1230');
    expect(text).toContain('123.5 k');
    expect(text).toContain('1280×720 @1.50 = 1920×1080');
    expect(text).toContain('909: unit 6, building 3, tree 900');
    expect(text).toContain('TestGPU');
    expect(text).toContain('yaw 90°');
    expect(text).toContain('build · 0.30/0.45 · Spieler kämpft · build → build');
    expect(fmtNum(2_500_000)).toBe('2.50 M');
    expect(fmtNum(950)).toBe('950');
  });

  it('wireframe copy: shader addition stays, wireframe on, LOD colour as emissive colour', () => {
    const m = new THREE.MeshStandardMaterial({ color: 0x336699 });
    const hook = () => {};
    m.onBeforeCompile = hook;
    m.customProgramCacheKey = () => 'test-key';
    m.userData.big = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    const c = wireClone(m, 0x3ddc5a);
    expect(c).not.toBe(m);
    expect(c.wireframe).toBe(true);
    expect(m.wireframe).toBe(false);
    expect(c.onBeforeCompile).toBe(hook);
    expect(c.customProgramCacheKey()).toBe('test-key');
    expect(c.emissive.getHex()).toBe(0x3ddc5a);
    expect(m.userData.big).toBeInstanceOf(THREE.DataTexture);
    expect(c.userData.wireOf).toBe(m);
    const plain = wireClone(m, null);
    expect(plain.color.getHex()).toBe(0x336699);
    const sh = new THREE.ShaderMaterial({ uniforms: { a: { value: 1 } } });
    expect(wireClone(sh, 0xff0000).uniforms).toBe(sh.uniforms);
  });
});
