// Expansion, second round: interplay with building on slopes (bridges, bridgeheads), invisibility
// without fog and with three parties, limits on stealing, developer-mode figure infos, save game.

import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/sim.js';
import { AiPlayer } from '../../src/ai/AiPlayer.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { WATER, BRIDGE, OCCUPIED, RESERVED, CLIFF } from '../../src/sim/map.js';
import { SPECIALISTS } from '../../src/sim/data/addon.js';
import { spawnSpecialist, bridgeheads } from '../../src/sim/systems/addon.js';
import { canSee } from '../../src/sim/systems/vision.js';
import { targetable, nearestEnemy, buildGrid } from '../../src/sim/systems/military.js';
import { nearestWalkable } from '../../src/sim/systems/movement.js';
import { tileCenter, toTile } from '../../src/sim/fixed.js';
import { figureInfo, FIGURE_KINDS } from '../../src/dev/figureInfo.js';
import { hqOf, runUntil } from './helpers.js';

const addonSim = (seed = 42, extra = {}) => new Sim({ seed, addon: true, ...extra });
const step = (sim, cmd) => sim.step(cmd ? [{ player: 0, ...cmd }] : []);
const specialistAt = (sim, p, spec, x, y) => {
  const k = nearestWalkable(sim.map, x, y, tileCenter(x), tileCenter(y), 12);
  return spawnSpecialist(sim, p, spec, k % sim.map.width, (k / sim.map.width) | 0);
};

/** Free 2×2 area whose transition edge touches a bridgehead. */
function siteNextToHead(sim, s) {
  const m = sim.map;
  for (const [hx, hy] of bridgeheads(s)) {
    for (let y = hy - 3; y <= hy + 2; y++) for (let x = hx - 3; x <= hx + 2; x++) {
      if (!m.rectFree(x, y, 2, 2, WATER | OCCUPIED | RESERVED | CLIFF)) continue;
      const touches = hx >= x - 1 && hx <= x + 2 && hy >= y - 1 && hy <= y + 2;
      if (touches) return { x, y, head: [hx, hy] };
    }
  }
  return null;
}

describe('Expansion × building on slopes: bridges', () => {
  it('bridgeheads and land tiles of the site are reserved and free of trees/piles', () => {
    for (const seed of [1, 2, 3, 42]) {
      const sim = addonSim(seed);
      const m = sim.map;
      for (const s of sim.bridgeSites) {
        for (const [x, y] of bridgeheads(s)) {
          const f = m.flags[m.idx(x, y)];
          expect(f & RESERVED).toBe(RESERVED);
          expect(f & OCCUPIED).toBe(0);
          expect(m.walkable(x, y)).toBe(true);
        }
        for (let j = s.y; j < s.y + s.h; j++) for (let i = s.x; i < s.x + s.w; i++) expect(m.flags[m.idx(i, j)] & OCCUPIED).toBe(0);
      }
      // without the expansion the map stays unchanged
      const off = new Sim({ seed });
      for (const s of off.bridgeSites) for (const [x, y] of bridgeheads(s)) expect(off.map.flags[off.map.idx(x, y)] & RESERVED).toBe(0);
    }
  });

  it('bridge levels nothing; buildings next to it change neither shore nor bridge', () => {
    let checked = 0;
    for (const seed of [42, 1, 2, 3, 5, 7]) {
      const sim = addonSim(seed);
      const m = sim.map;
      for (const s of sim.bridgeSites) {
        const heads = bridgeheads(s);
        const before = [...m.heights];
        const hv = m.heightVersion;
        const b = sim.createBuilding(0, 'bridge', s.x, s.y, true);
        expect(m.heightVersion).toBe(hv);
        expect([...m.heights]).toEqual(before);
        expect(m.walkable(s.x, s.y)).toBe(true);
        // building next to a bridgehead: levelling leaves the shores and the bridge untouched
        const pos = siteNextToHead(sim, s);
        if (!pos) continue;
        const headH = heads.map(([x, y]) => m.heights[m.idx(x, y)]);
        const deck = [];
        for (let j = s.y; j < s.y + s.h; j++) for (let i = s.x; i < s.x + s.w; i++) deck.push([m.heights[m.idx(i, j)], m.flags[m.idx(i, j)]]);
        sim.createBuilding(0, 'fountain', pos.x, pos.y, true);
        expect(heads.map(([x, y]) => m.heights[m.idx(x, y)])).toEqual(headH);
        const deck2 = [];
        for (let j = s.y; j < s.y + s.h; j++) for (let i = s.x; i < s.x + s.w; i++) deck2.push([m.heights[m.idx(i, j)], m.flags[m.idx(i, j)]]);
        expect(deck2).toEqual(deck);
        expect(m.flags[m.idx(s.x, s.y)] & BRIDGE).toBe(BRIDGE);
        expect(sim.entities.has(b.id)).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(2);
  });

  it('nobody may build on bridgeheads (access stays free)', () => {
    const sim = addonSim(42);
    sim.players[0].techs.add('construction');
    for (const r of Object.keys(sim.players[0].stock)) sim.players[0].stock[r] += 5000;
    const s = sim.bridgeSites[0];
    const [hx, hy] = bridgeheads(s)[0];
    // every 2×2 area that contains the bridgehead is blocked
    for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
      expect(sim.checkPlacement(0, 'fountain', hx + dx, hy + dy)).not.toBeNull();
    }
  });
});

describe('Expansion: AI and bridges', () => {
  it('AI builds a bridge as a shortcut when a site is near the centre and it can afford it', () => {
    let built = 0, tried = 0;
    for (let seed = 1; seed <= 12 && built < 1; seed++) {
      const sim = addonSim(seed, { fog: false });
      const ai = new AiPlayer(sim, 0, 'hard');
      ai.scan();
      const near = ai.spotNear('bridge');
      if (!sim.bridgeSites.some((s) => Math.hypot(s.x - near.x, s.y - near.y) <= 20 && Math.hypot(s.x - ai.home.x, s.y - ai.home.y) <= 60)) continue;
      tried++;
      sim.players[0].techs.add('mathematics');
      for (const r of Object.keys(sim.players[0].stock)) sim.players[0].stock[r] += 5000;
      ai.cmds = [];
      expect(ai.tryBuild('bridge')).toBe(true);
      const cmd = ai.cmds.find((c) => c.type === 'placeBuilding');
      expect(sim.bridgeSites.some((s) => s.x === cmd.x && s.y === cmd.y)).toBe(true);
      const ev = sim.step([{ ...cmd, player: 0 }]);
      if (ev.some((e) => e.type === 'buildingPlaced')) built++;
    }
    expect(tried).toBeGreaterThan(0);
    expect(built).toBe(1);
  });
});

describe('Expansion: invisibility', () => {
  it('thieves stay invisible to opponents even without fog', () => {
    const sim = addonSim(42, { fog: false });
    const hq1 = hqOf(sim, 1);
    const th = specialistAt(sim, 0, 'thief', hq1.x + 2, hq1.y + 8);
    sim.run(2);
    expect(th.hidden).toBe(true);
    expect(canSee(sim, 1, th)).toBe(false);
    expect(canSee(sim, 0, th)).toBe(true);
    expect(targetable(sim, th)).toBe(false);
  });

  it('three parties: only the discovering team sees and fights the thief', () => {
    const sim = addonSim(42, { players: 3, fog: false, heroes: ['bertram', 'bertram', 'bertram'] });
    const hq1 = hqOf(sim, 1);
    const th = specialistAt(sim, 0, 'thief', hq1.x + 2, hq1.y + 8);
    // scout of player 1 next to the thief
    specialistAt(sim, 1, 'scout', toTile(th.px) + 2, toTile(th.py));
    sim.run(1);
    expect(th.hidden).toBe(false);
    expect(th.seenBy).toBe(1 << sim.players[1].team);
    expect(canSee(sim, 1, th)).toBe(true);
    expect(canSee(sim, 2, th)).toBe(false);
    // hero of player 2 right next to him does not find the thief as a target, hero of player 1 does
    const hero = (p) => [...sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === p);
    for (const p of [1, 2]) { const h = hero(p); h.px = th.px + (p === 1 ? -1000 : 1000); h.py = th.py; h.path = []; }
    buildGrid(sim);
    expect(nearestEnemy(sim, hero(2), 3000, { units: true, buildings: false })?.id).not.toBe(th.id);
    expect(nearestEnemy(sim, hero(1), 3000, { units: true, buildings: false })?.id).toBe(th.id);
  });
});

describe('Expansion: stealing has limits', () => {
  it('standing commands steal at most once per cooldown; stocks never go negative', () => {
    const sim = addonSim(42);
    const hq1 = hqOf(sim, 1);
    const v = sim.players[1];
    v.stock.gold = 300;
    for (const r of ['wood', 'clay', 'stone', 'iron', 'sulfur']) { v.stock[r] = 30; v.raw[r] = 0; }
    const th = specialistAt(sim, 0, 'thief', hq1.x + 2, hq1.y + 6);
    const ab = SPECIALISTS.thief.abilities.steal;
    const N = ab.cooldown * 3;
    let stolen = 0, carrying = 0;
    for (let t = 0; t < N; t++) {
      const ev = step(sim, { type: 'special', units: [th.id], action: 'steal', target: hq1.id });
      for (const e of ev) {
        if (e.type === 'stolen') stolen++;
        if (e.type === 'rejected' && (e.reason === 'err.carrying' || e.reason === 'err.notReady')) carrying++;
      }
      for (const r of Object.keys(v.stock)) expect(v.stock[r]).toBeGreaterThanOrEqual(0);
      for (const r of Object.keys(v.raw)) expect(v.raw[r]).toBeGreaterThanOrEqual(0);
    }
    expect(stolen).toBeGreaterThanOrEqual(1);
    expect(stolen).toBeLessThanOrEqual(Math.ceil(N / ab.cooldown) + 1);
    expect(carrying).toBeGreaterThan(0);
  });

  it('loot is lost when the thief falls (no duplication)', () => {
    const sim = addonSim(42);
    const hq1 = hqOf(sim, 1);
    sim.players[1].stock.gold = 1000;
    const th = specialistAt(sim, 0, 'thief', hq1.x + 2, hq1.y + 6);
    step(sim, { type: 'special', units: [th.id], action: 'steal', target: hq1.id });
    expect(runUntil(sim, () => !!th.carry, 600)).toBeGreaterThan(0);
    // uncovered (scout of the victim) and slain
    specialistAt(sim, 1, 'scout', toTile(th.px) + 1, toTile(th.py));
    sim.step();
    expect(targetable(sim, th)).toBe(true);
    th.hp = 1;
    const hero = [...sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === 1);
    hero.px = th.px + 800; hero.py = th.py; hero.path = [];
    const events = [];
    for (let i = 0; i < 300 && sim.entities.has(th.id); i++) events.push(...sim.step());
    expect(sim.entities.has(th.id)).toBe(false);
    for (let i = 0; i < 200; i++) events.push(...sim.step());
    expect(events.some((e) => e.type === 'lootDelivered')).toBe(false);
  });
});

describe('Expansion: developer mode and save game', () => {
  it('Figureninfos kennen Spezialisten (Auftrag, Ziel, Beute)', () => {
    const sim = addonSim(42);
    const hq1 = hqOf(sim, 1);
    expect(FIGURE_KINDS.has('specialist')).toBe(true);
    const th = specialistAt(sim, 0, 'thief', hq1.x + 2, hq1.y + 10);
    let info = figureInfo(sim, th);
    expect(info).toMatchObject({ kind: 'specialist', state: 'idle', raw: 'thief:idle', maxHp: SPECIALISTS.thief.hp });
    step(sim, { type: 'special', units: [th.id], action: 'steal', target: hq1.id });
    sim.run(2);
    info = figureInfo(sim, th);
    expect(info.raw).toBe('thief:steal');
    expect(info.target).toBe(hq1.id);
  });

  it('discovery (seenBy) and reserved bridgeheads survive save/load; AI forgets fallen thieves', () => {
    const sim = addonSim(42, { players: 3 });
    const ais = [new AiPlayer(sim, 1, 'hard'), new AiPlayer(sim, 2, 'normal')];
    const hq1 = hqOf(sim, 1);
    const th = specialistAt(sim, 0, 'thief', hq1.x + 2, hq1.y + 8);
    specialistAt(sim, 1, 'scout', toTile(th.px) + 2, toTile(th.py));
    for (let i = 0; i < 20; i++) { for (const a of ais) a.update(); sim.step(); }
    ais[0].thiefOrders = { 999999: { action: 'steal', target: 1, tick: 0, ready: 0 } };
    const data = JSON.parse(JSON.stringify(saveGame(sim, { ais: ais.map((a) => a.getState()) })));
    const sim2 = loadGame(data);
    const ais2 = data.extra.ais.map((st) => AiPlayer.fromState(sim2, st));
    expect(sim2.hash()).toBe(sim.hash());
    const s = sim2.bridgeSites[0];
    const [hx, hy] = bridgeheads(s)[0];
    expect(sim2.map.flags[sim2.map.idx(hx, hy)] & RESERVED).toBe(RESERVED);
    for (let i = 0; i < 300; i++) { for (const a of ais) a.update(); sim.step(); for (const a of ais2) a.update(); sim2.step(); }
    expect(sim2.hash()).toBe(sim.hash());
    // orders of thieves that no longer exist were forgotten (once the AI leads thieves of its own)
    if (ais[0].thiefOrders) expect(Object.keys(ais[0].thiefOrders)).not.toContain('999999');
  });
});
