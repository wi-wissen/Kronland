// Extension content (src/sim/systems/addon.js): bridges, thief, scout, deposits,
// heroes Falk/Morla, rifle soldiers, ornamental buildings, on/off, determinism and save games.

import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/sim.js';
import { AiPlayer } from '../../src/ai/AiPlayer.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { TileMap, WATER, BRIDGE, OCCUPIED } from '../../src/sim/map.js';
import { findPath } from '../../src/sim/pathfinding.js';
import { generateMap } from '../../src/sim/mapgen.js';
import { SPECIALISTS, ADDON } from '../../src/sim/data/addon.js';
import { BUILDINGS } from '../../src/sim/data/buildings.js';
import { HEROES } from '../../src/sim/data/units.js';
import { spawnSpecialist } from '../../src/sim/systems/addon.js';
import { canSee, isVisible } from '../../src/sim/systems/vision.js';
import { targetable, kill, combatStats } from '../../src/sim/systems/military.js';
import { nearestWalkable } from '../../src/sim/systems/movement.js';
import { maxMotivation } from '../../src/sim/systems/workers.js';
import { UNIT, toTile, tileCenter } from '../../src/sim/fixed.js';
import { quickBuild, hqOf, serfsOf, runUntil } from './helpers.js';

const addonSim = (seed = 42, extra = {}) => new Sim({ seed, addon: true, ...extra });
const rich = (sim, p = 0) => { for (const r of Object.keys(sim.players[p].stock)) sim.players[p].stock[r] += 5000; };
const step = (sim, cmd) => sim.step(cmd ? [{ player: 0, ...cmd }] : []);
const rejected = (events) => events.filter((e) => e.type === 'rejected').map((e) => e.reason);

/** Free tile near (x, y). */
function freeTile(sim, x, y) {
  const k = nearestWalkable(sim.map, x, y, tileCenter(x), tileCenter(y), 12);
  return { x: k % sim.map.width, y: (k / sim.map.width) | 0 };
}

/** Specialist for player p near (x, y). */
function specialistAt(sim, p, spec, x, y) {
  const t = freeTile(sim, x, y);
  return spawnSpecialist(sim, p, spec, t.x, t.y);
}

/** Bridge ends (land tiles before and behind the site, middle of the first row/column). */
function bridgeEnds(s) {
  return s.w >= s.h ? [{ x: s.x - 1, y: s.y }, { x: s.x + s.w, y: s.y }] : [{ x: s.x, y: s.y - 1 }, { x: s.x, y: s.y + s.h }];
}

describe('extension: bridges', () => {
  it('map generator delivers bridge sites made of water with shore at both ends, without changing the map', () => {
    let total = 0;
    for (const seed of [1, 2, 3, 42, 99]) {
      const g = generateMap(seed, { size: 96, players: 2 });
      const g2 = generateMap(seed, { size: 96, players: 2 });
      expect(g2.bridges).toEqual(g.bridges);
      for (const s of g.bridges) {
        total++;
        const len = Math.max(s.w, s.h);
        expect(Math.min(s.w, s.h)).toBe(2);
        expect(len).toBeGreaterThanOrEqual(ADDON.bridge.minLen);
        expect(len).toBeLessThanOrEqual(ADDON.bridge.maxLen);
        let water = 0;
        for (let j = s.y; j < s.y + s.h; j++) for (let i = s.x; i < s.x + s.w; i++) if (g.map.flags[g.map.idx(i, j)] & WATER) water++;
        expect(water).toBeGreaterThan(s.w * s.h / 2);
        for (const e of bridgeEnds(s)) expect(g.map.flags[g.map.idx(e.x, e.y)] & WATER).toBe(0);
      }
    }
    expect(total).toBeGreaterThanOrEqual(5);
  });

  it('bridge connects separated regions (region numbers and pathfinding)', () => {
    const m = new TileMap(12, 8);
    for (let y = 0; y < 8; y++) for (const x of [5, 6]) m.flags[m.idx(x, y)] = WATER;
    expect(m.regionAt(m.idx(2, 3))).not.toBe(m.regionAt(m.idx(9, 3)));
    expect(findPath(m, 2, 3, [m.idx(9, 3)])).toBeNull();
    for (const x of [5, 6]) for (const y of [3, 4]) m.flags[m.idx(x, y)] |= BRIDGE;
    m.version++;
    expect(m.walkable(5, 3)).toBe(true);
    expect(m.regionAt(m.idx(2, 3))).toBe(m.regionAt(m.idx(9, 3)));
    expect(findPath(m, 2, 3, [m.idx(9, 3)])?.length).toBeGreaterThan(5);
  });

  it('construction at a bridge site: first maths, then serfs build, afterwards a shorter path; collapse drowns', () => {
    const sim = addonSim(42);
    const site = sim.bridgeSites[0];
    expect(site).toBeTruthy();
    rich(sim);
    expect(sim.checkPlacement(0, 'bridge', site.x, site.y)).toEqual({ code: 'err.techMissing', params: { tech: 'mathematics' } });
    sim.players[0].techs.add('mathematics');
    expect(sim.checkPlacement(0, 'bridge', site.x, site.y)).toBeNull();
    expect(sim.checkPlacement(0, 'bridge', site.x + 1, site.y)).toBe('err.bridgeSiteOnly');
    const [a, b] = bridgeEnds(site);
    const before = findPath(sim.map, a.x, a.y, [sim.map.idx(b.x, b.y)]);
    // bring serfs to the site (shore A) and let them build
    const serfs = serfsOf(sim).slice(0, 4);
    for (const u of serfs) { u.px = tileCenter(a.x); u.py = tileCenter(a.y); }
    const ev = step(sim, { type: 'placeBuilding', building: 'bridge', x: site.x, y: site.y, units: serfs.map((u) => u.id) });
    const placed = ev.find((e) => e.type === 'buildingPlaced');
    expect(placed).toBeTruthy();
    const bridge = sim.entities.get(placed.building);
    expect([bridge.w, bridge.h]).toEqual([site.w, site.h]);
    expect(sim.checkPlacement(0, 'bridge', site.x, site.y)).toBe('err.spotTaken');
    const t = runUntil(sim, () => bridge.done, 4000);
    expect(t).toBeGreaterThan(0);
    for (let j = site.y; j < site.y + site.h; j++) for (let i = site.x; i < site.x + site.w; i++) {
      expect(sim.map.walkable(i, j)).toBe(true);
      expect(sim.map.flags[sim.map.idx(i, j)] & OCCUPIED).toBe(0);
    }
    const after = findPath(sim.map, a.x, a.y, [sim.map.idx(b.x, b.y)]);
    expect(after).toBeTruthy();
    expect(after.length).toBeLessThan(before ? before.length : Infinity);
    expect(after.length).toBeLessThanOrEqual(Math.max(site.w, site.h) + 2);

    // figure on the bridge, bridge destroyed: water, figure drowns, no ruin
    const u = serfs[0];
    u.job = null; u.px = tileCenter(site.x); u.py = tileCenter(site.y); u.path = [];
    kill(sim, bridge, null);
    expect(sim.map.walkable(site.x, site.y)).toBe(false);
    expect(sim.entities.has(u.id)).toBe(false);
    expect([...sim.entities.values()].some((e) => e.kind === 'ruin' && e.x === site.x && e.y === site.y)).toBe(false);
    expect(sim.checkPlacement(0, 'bridge', site.x, site.y)).toBeNull();
  });
});

describe('Erweiterung: Dieb', () => {
  it('tavern recruits (cost, maximum), rejected without the extension', () => {
    const off = new Sim({ seed: 42 });
    rich(off);
    expect(off.checkPlacement(0, 'tavern', 10, 10)).toBe('err.addonOff');
    expect(rejected(step(off, { type: 'special', units: [1], action: 'move', x: 5, y: 5 }))).toEqual(['err.addonOff']);

    const sim = addonSim(42);
    rich(sim);
    const tavern = quickBuild(sim, 'tavern', 0);
    const gold = sim.players[0].stock.gold;
    const ev = step(sim, { type: 'recruitSpecial', building: tavern.id, spec: 'thief' });
    expect(ev.some((e) => e.type === 'specialistRecruited' && e.spec === 'thief')).toBe(true);
    expect(sim.players[0].stock.gold).toBe(gold - SPECIALISTS.thief.cost.gold);
    for (let i = 1; i < SPECIALISTS.thief.max; i++) step(sim, { type: 'recruitSpecial', building: tavern.id, spec: 'thief' });
    expect(rejected(step(sim, { type: 'recruitSpecial', building: tavern.id, spec: 'thief' }))).toEqual(['err.specialistMax']);
    expect(rejected(step(sim, { type: 'recruitSpecial', building: tavern.id, spec: 'constructor' }))).toEqual(['err.unknownAction']);
  });

  it('is invisible and untouchable for enemies – except near a tower', () => {
    const sim = addonSim(42);
    const hq1 = hqOf(sim, 1);
    const th = specialistAt(sim, 0, 'thief', hq1.x + 2, hq1.y + 8);
    sim.run(10);
    expect(isVisible(sim, 1, toTile(th.px), toTile(th.py))).toBe(true);
    expect(th.hidden).toBe(true);
    expect(canSee(sim, 1, th)).toBe(false);
    expect(canSee(sim, 0, th)).toBe(true);
    expect(targetable(sim, th)).toBe(false);
    // Enemy tower nearby: detected
    quickBuild(sim, 'tower', 1, { x: toTile(th.px) + 3, y: toTile(th.py) });
    sim.run(1);
    expect(th.hidden).toBe(false);
    expect(canSee(sim, 1, th)).toBe(true);
    expect(targetable(sim, th)).toBe(true);
  });

  it('Kundschafter entdecken Diebe', () => {
    const sim = addonSim(42);
    const hq1 = hqOf(sim, 1);
    const th = specialistAt(sim, 0, 'thief', hq1.x + 2, hq1.y + 8);
    specialistAt(sim, 1, 'scout', toTile(th.px) + 3, toTile(th.py));
    sim.run(1);
    expect(th.hidden).toBe(false);
  });

  it('steals from the enemy castle and brings the loot home', () => {
    const sim = addonSim(42);
    const hq1 = hqOf(sim, 1);
    sim.players[1].stock.gold = 1000;
    const th = specialistAt(sim, 0, 'thief', hq1.x + 2, hq1.y + 7);
    const ev = step(sim, { type: 'special', units: [th.id], action: 'steal', target: hq1.id });
    expect(rejected(ev)).toEqual([]);
    const stolenAt = runUntil(sim, () => !!th.carry, 600);
    expect(stolenAt).toBeGreaterThan(0);
    const ab = SPECIALISTS.thief.abilities.steal;
    expect(th.carry.gold).toBe(Math.min(ab.goldMax, Math.trunc((1000 * ab.goldPercent) / 100)));
    expect(sim.players[1].stock.gold).toBe(1000 - th.carry.gold);
    expect(sim.players[1].robbed).toBe(1);
    // Abklingzeit
    expect(rejected(step(sim, { type: 'special', units: [th.id], action: 'steal', target: hq1.id }))).toEqual(['err.notReady']);
    const loot = { ...th.carry };
    const gold0 = sim.players[0].stock.gold;
    expect(runUntil(sim, () => !th.carry, 3000)).toBeGreaterThan(0);
    expect(sim.players[0].stock.gold).toBe(gold0 + loot.gold);
  });

  it('only enemy castles/storehouses are theft targets', () => {
    const sim = addonSim(42);
    const th = specialistAt(sim, 0, 'thief', hqOf(sim).x, hqOf(sim).y + 7);
    expect(rejected(step(sim, { type: 'special', units: [th.id], action: 'steal', target: hqOf(sim).id }))).toEqual(['err.badTarget']);
    const res = quickBuild(sim, 'residence', 1);
    expect(rejected(step(sim, { type: 'special', units: [th.id], action: 'steal', target: res.id }))).toEqual(['err.badTarget']);
  });

  it('explosive charge damages the target after the fuse and destroys bridges', () => {
    const sim = addonSim(42);
    const res = quickBuild(sim, 'residence', 1);
    const th = specialistAt(sim, 0, 'thief', res.x - 2, res.y);
    const hp = res.hp;
    step(sim, { type: 'special', units: [th.id], action: 'sabotage', target: res.id });
    expect(runUntil(sim, () => [...sim.entities.values()].some((e) => e.kind === 'charge'), 300)).toBeGreaterThan(0);
    expect(res.hp).toBe(hp);
    const ab = SPECIALISTS.thief.abilities.sabotage;
    sim.run(ab.fuse + 1);
    expect(sim.entities.has(res.id) ? res.hp : 0).toBeLessThanOrEqual(hp - ab.damage);

    // Blow up the enemy's bridge
    const site = sim.bridgeSites[0];
    const bridge = sim.createBuilding(1, 'bridge', site.x, site.y, true);
    expect(sim.map.walkable(site.x, site.y)).toBe(true);
    const [a] = bridgeEnds(site);
    const th2 = specialistAt(sim, 0, 'thief', a.x, a.y);
    step(sim, { type: 'special', units: [th2.id], action: 'sabotage', target: bridge.id });
    sim.run(ab.fuse + 200);
    expect(sim.entities.has(bridge.id)).toBe(false);
    expect(sim.map.walkable(site.x, site.y)).toBe(false);
  });
});

describe('extension: scout and deposits', () => {
  it('hidden deposits only with the extension; resource search turns them into piles', () => {
    expect([...new Sim({ seed: 42 }).entities.values()].some((e) => e.kind === 'deposit')).toBe(false);
    const sim = addonSim(42);
    const deps = [...sim.entities.values()].filter((e) => e.kind === 'deposit');
    expect(deps.length).toBe(ADDON.deposits.perPlayer * 2 + ADDON.deposits.center);
    // Deposits occupy no tiles and are not a work target
    const d = deps[0];
    expect(sim.map.owner[sim.map.idx(d.x, d.y)]).toBe(0);
    expect(rejected(step(sim, { type: 'assignWork', units: [serfsOf(sim)[0].id], target: d.id }))).toEqual(['err.noWork']);
    const sc = specialistAt(sim, 0, 'scout', d.x + 2, d.y);
    const ev = step(sim, { type: 'special', units: [sc.id], action: 'findResources' });
    const found = ev.find((e) => e.type === 'resourcesFound');
    expect(found.count).toBeGreaterThanOrEqual(1);
    expect(sim.entities.has(d.id)).toBe(false);
    const pile = sim.entities.get(found.found[0].node);
    expect(pile.kind).toBe('pile');
    expect(pile.amount).toBe(ADDON.deposits.amount);
    expect(rejected(step(sim, { type: 'special', units: [sc.id], action: 'findResources' }))).toEqual(['err.notReady']);
  });

  it('torch lights up a region in the fog for a while', () => {
    const sim = addonSim(42);
    const hq = hqOf(sim);
    const sc = specialistAt(sim, 0, 'scout', hq.x + 20, hq.y + 20);
    const tx = toTile(sc.px) + 8, ty = toTile(sc.py);
    sim.run(5);
    // beyond the scout's vision (18), but in the torch's glow (8 + 11)
    const far = { x: tx + 11, y: ty };
    expect(isVisible(sim, 0, far.x, far.y)).toBe(false);
    expect(rejected(step(sim, { type: 'special', units: [sc.id], action: 'torch', x: tx + 30, y: ty }))).toEqual(['err.outOfRange']);
    expect(rejected(step(sim, { type: 'special', units: [sc.id], action: 'torch', x: tx, y: ty }))).toEqual([]);
    sim.run(5);
    expect(isVisible(sim, 0, far.x, far.y)).toBe(true);
    sim.run(SPECIALISTS.scout.abilities.torch.duration + 10);
    expect([...sim.entities.values()].some((e) => e.kind === 'torch')).toBe(false);
    expect(isVisible(sim, 0, far.x, far.y)).toBe(false);
  });
});

describe('extension: heroes Falk and Morla', () => {
  const heroOf = (sim, p) => [...sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === p);

  it('Falk: aimed shot hits the nearest enemy, eagle eye extends the shooters\' range', () => {
    const sim = addonSim(42, { heroes: ['falk', 'bertram'] });
    const h = heroOf(sim, 0);
    expect(rejected(step(sim, { type: 'ability', hero: h.id, ability: 'aimedShot' }))).toEqual(['err.noTarget']);
    const L = sim.spawnLeader(1, 'sword1', toTile(h.px) + 6, toTile(h.py), 0);
    L.order = { type: 'hold' };
    const hp = L.hp;
    expect(rejected(step(sim, { type: 'ability', hero: h.id, ability: 'aimedShot' }))).toEqual([]);
    expect(sim.entities.has(L.id) ? L.hp : 0).toBeLessThanOrEqual(hp - HEROES.falk.abilities.aimedShot.damage + 30);
    const B = sim.spawnLeader(0, 'bow1', toTile(h.px) + 1, toTile(h.py) + 1, 0);
    const r0 = combatStats(sim, B).range;
    step(sim, { type: 'ability', hero: h.id, ability: 'eagleEye' });
    expect(combatStats(sim, B).range).toBe(r0 + HEROES.falk.abilities.eagleEye.rangeBonus);
  });

  it('Morla: poison fog hurts and slows, mist veil makes squads invisible until they attack', () => {
    const sim = addonSim(42, { heroes: ['morla', 'bertram'] });
    const h = heroOf(sim, 0);
    const E = sim.spawnLeader(1, 'spear1', toTile(h.px) + 2, toTile(h.py), 4);
    E.order = { type: 'hold' };
    const total = () => [E, ...E.soldiers.map((id) => sim.entities.get(id))].reduce((s, x) => s + (x?.hp ?? 0), 0);
    const before = total();
    const sp0 = combatStats(sim, E).speed;
    step(sim, { type: 'ability', hero: h.id, ability: 'poisonFog' });
    sim.run(30);
    expect(total()).toBeLessThan(before);
    expect(combatStats(sim, E).speed).toBeLessThan(sp0);

    const sim2 = addonSim(42, { heroes: ['morla', 'bertram'] });
    const h2 = heroOf(sim2, 0);
    const own = sim2.spawnLeader(0, 'sword1', toTile(h2.px) + 1, toTile(h2.py) + 1, 2);
    own.order = { type: 'hold' };
    step(sim2, { type: 'ability', hero: h2.id, ability: 'mistVeil' });
    sim2.run(1);
    expect(own.hidden).toBe(true);
    expect(h2.hidden).toBe(true);
    expect(canSee(sim2, 1, own)).toBe(false);
    expect(targetable(sim2, own)).toBe(false);
    // Attack ends the veil
    const foe = sim2.spawnLeader(1, 'sword1', toTile(own.px) + 1, toTile(own.py), 0);
    foe.order = { type: 'hold' };
    runUntil(sim2, () => !own.hidden, 200);
    expect(own.hidden).toBe(false);
    // Without the extension Morla's abilities do not exist
    const off = new Sim({ seed: 42, heroes: ['morla', 'bertram'] });
    expect(rejected(off.step([{ player: 0, type: 'ability', hero: heroOf(off, 0).id, ability: 'mistVeil' }]))).toEqual(['err.addonOff']);
  });
});

describe('extension: rifle soldiers and ornaments', () => {
  it('gunsmith trains rifle soldiers (only with the extension), shots are bullets', () => {
    const sim = addonSim(42);
    rich(sim);
    const g = quickBuild(sim, 'gunsmith', 0);
    const ev = step(sim, { type: 'recruit', building: g.id, line: 'rifle', full: true });
    const rec = ev.find((e) => e.type === 'recruited');
    expect(rec?.def).toBe('rifle1');
    const L = sim.entities.get(rec.leader);
    expect(L.soldiers.length).toBe(4);
    sim.spawnLeader(1, 'spear1', toTile(L.px) + 5, toTile(L.py), 0).order = { type: 'hold' };
    const shots = [];
    for (let i = 0; i < 80; i++) for (const e of sim.step()) if (e.type === 'shot' && e.owner === 0) shots.push(e.kind);
    expect(shots).toContain('bullet');

    const off = new Sim({ seed: 42 });
    rich(off);
    expect(off.checkPlacement(0, 'gunsmith', g.x, g.y)).toBe('err.addonOff');
    const g2 = off.createBuilding(0, 'gunsmith', g.x, g.y, true);
    expect(rejected(off.step([{ player: 0, type: 'recruit', building: g2.id, line: 'rifle', full: true }]))).toEqual(['err.addonOff']);
  });

  it('well and monument raise the maximum motivation', () => {
    const sim = addonSim(42);
    const m0 = maxMotivation(sim, 0);
    quickBuild(sim, 'fountain', 0);
    quickBuild(sim, 'statue', 0);
    expect(maxMotivation(sim, 0)).toBe(Math.min(m0 + BUILDINGS.fountain.motivationEffect + BUILDINGS.statue.motivationEffect, maxMotivation(sim, 0) + 1000));
    expect(maxMotivation(sim, 0)).toBeGreaterThan(m0);
  });
});

describe('extension: determinism, save games, AI', () => {
  const play = (sim, ais, n) => { for (let i = 0; i < n; i++) { for (const a of ais) a.update(); sim.step(); } };

  it('same course, same hash; without the extension everything stays as before (no extension entities)', () => {
    const mk = () => { const s = addonSim(7, { heroes: ['falk', 'morla'] }); return { s, a: [new AiPlayer(s, 0, 'hard'), new AiPlayer(s, 1, 'normal')] }; };
    const x = mk(), y = mk();
    play(x.s, x.a, 3000); play(y.s, y.a, 3000);
    expect(x.s.hash()).toBe(y.s.hash());
    const base = new Sim({ seed: 7 });
    play(base, [new AiPlayer(base, 0, 'normal')], 1500);
    expect([...base.entities.values()].some((e) => ['specialist', 'deposit', 'charge', 'torch', 'cloud'].includes(e.kind))).toBe(false);
  });

  it('save game with specialists, charge, torch, poison fog and bridge continues exactly the same', () => {
    const sim = addonSim(42, { heroes: ['morla', 'falk'] });
    const ais = [new AiPlayer(sim, 0, 'hard'), new AiPlayer(sim, 1, 'normal')];
    play(sim, ais, 600);
    const site = sim.bridgeSites[0];
    sim.createBuilding(0, 'bridge', site.x, site.y, true);
    const hq1 = hqOf(sim, 1);
    const th = specialistAt(sim, 0, 'thief', hq1.x + 2, hq1.y + 7);
    const sc = specialistAt(sim, 0, 'scout', hq1.x - 6, hq1.y + 7);
    sim.command({ player: 0, type: 'special', units: [th.id], action: 'steal', target: hq1.id });
    sim.command({ player: 0, type: 'special', units: [sc.id], action: 'torch' });
    const morla = [...sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === 0);
    sim.command({ player: 0, type: 'ability', hero: morla.id, ability: 'poisonFog' });
    play(sim, ais, 30);
    const res = quickBuild(sim, 'residence', 1);
    const th2 = specialistAt(sim, 0, 'thief', res.x - 2, res.y);
    sim.command({ player: 0, type: 'special', units: [th2.id], action: 'sabotage', target: res.id });
    play(sim, ais, 40);
    expect([...sim.entities.values()].some((e) => e.kind === 'torch')).toBe(true);
    const data = JSON.parse(JSON.stringify(saveGame(sim, { ais: ais.map((a) => a.getState()) })));
    const sim2 = loadGame(data);
    const ais2 = data.extra.ais.map((st) => AiPlayer.fromState(sim2, st));
    expect(sim2.addon).toBe(true);
    expect(sim2.bridgeSites).toEqual(sim.bridgeSites);
    expect(sim2.hash()).toBe(sim.hash());
    play(sim, ais, 1500); play(sim2, ais2, 1500);
    expect(sim2.hash()).toBe(sim.hash());
  });

  it('AI vs AI with extension: hard beats easy, uses specialists, only own valid commands', () => {
    const sim = addonSim(1, { heroes: ['falk', 'morla'] });
    const ais = [new AiPlayer(sim, 0, 'hard'), new AiPlayer(sim, 1, 'easy')];
    const rejects = [], seen = {};
    for (let t = 0; t < 36000 && sim.winner === null; t++) {
      for (const a of ais) if (!sim.players[a.player].defeated) a.update();
      for (const e of sim.step()) {
        if (e.type === 'rejected') rejects.push(e.reason);
        if (['specialistRecruited', 'resourcesFound', 'torch', 'stolen'].includes(e.type)) seen[e.type] = (seen[e.type] ?? 0) + 1;
      }
    }
    expect(sim.winner).toBe(0);
    expect(seen.specialistRecruited).toBeGreaterThanOrEqual(1);
    expect(seen.resourcesFound).toBeGreaterThanOrEqual(1);
    expect(rejects.filter((r) => /notOwn|noSerfs|noUnits|noTroops|unknown|addonOff/.test(r))).toEqual([]);
    expect(rejects.length).toBeLessThan(80);
  }, 600_000);
});

describe('Erweiterung: Fuzz', () => {
  it('nonsensical extension commands are rejected without disturbing the simulation', () => {
    const sim = addonSim(42);
    const t = quickBuild(sim, 'tavern', 0);
    const bad = [
      { type: 'recruitSpecial', building: t.id, spec: '__proto__' },
      { type: 'recruitSpecial', building: 'x', spec: 'thief' },
      { type: 'special', units: 'nope', action: 'move' },
      { type: 'special', units: [hqOf(sim).id], action: 'move', x: 1, y: 1 },
      { type: 'special', unit: -1, action: 'steal', target: {} },
      { type: 'placeBuilding', building: 'bridge', x: 0.5, y: NaN },
      { type: 'ability', hero: 0, ability: 'aimedShot' },
    ];
    for (const c of bad) expect(sim.step([{ player: 0, ...c }]).some((e) => e.type === 'rejected')).toBe(true);
    const th = specialistAt(sim, 0, 'thief', hqOf(sim).x, hqOf(sim).y + 7);
    for (const c of [
      { action: 'move', x: -5, y: 3 }, { action: 'move', x: 1e9, y: 0 }, { action: 'fly' }, { action: 'torch' },
      { action: 'sabotage', target: th.id }, { action: 'steal', target: 999999 }, { action: 'constructor' },
    ]) expect(sim.step([{ player: 0, type: 'special', units: [th.id], ...c }]).some((e) => e.type === 'rejected')).toBe(true);
    sim.run(50);
    expect(Number.isInteger(sim.hash())).toBe(true);
  });
});
