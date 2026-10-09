// Save → (envelope, JSON, gzip) → load: the game then continues exactly as without saving.

import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/sim.js';
import { addAi } from '../../src/ai/runner.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { createMissionSim } from '../../src/sim/missions/runtime.js';
import { saveVision } from '../../src/sim/systems/vision.js';
import { SaveStore } from '../../src/save/store.js';
import { MemoryBackend } from '../../src/save/backends.js';
import { createSaveDoc, stringifyDoc, parseSaveText } from '../../src/save/format.js';
import { quickBuild } from '../sim/helpers.js';
import { readSaveFile } from '../../src/save/index.js';
import { WATER, OCCUPIED, RESERVED, CLIFF } from '../../src/sim/map.js';
import { BUILDINGS } from '../../src/sim/data/buildings.js';
import { BALANCE } from '../../src/sim/data/balance.js';
import { recordSearch } from '../../src/dev/astar.js';

/** Find a building site with a slope (height difference in [lo, hi]), row by row (deterministic). */
function slopeSite(sim, type, lo = 150, hi = BALANCE.maxSlope) {
  const def = BUILDINGS[type], m = sim.map;
  for (let y = 2; y < m.height - def.h - 2; y++) for (let x = 2; x < m.width - def.w - 2; x++) {
    if (!m.rectFree(x - 1, y - 1, def.w + 2, def.h + 2, WATER | OCCUPIED | RESERVED | CLIFF)) continue;
    const sl = m.slope(x, y, def.w, def.h);
    if (sl >= lo && sl <= hi) return { x, y };
  }
  return null;
}
const rich = (sim, p = 0) => { for (const r of Object.keys(sim.players[p].stock)) sim.players[p].stock[r] = 100000; };

/** Like an exported file (readable JSON) via the import path (file → check → trial load). */
async function viaFile(sim) {
  const text = stringifyDoc(createSaveDoc(saveGame(sim), { name: 'Datei' }));
  const doc = await readSaveFile(new Blob([text], { type: 'application/json' }));
  const sim2 = loadGame(doc.state);
  return { sim2, doc };
}

const visionOf = (sim) => JSON.stringify(saveVision(sim, (a) => Array.from(a).join(',')));

/** Save via the save-game store (compressed) and load again. */
async function viaStore(sim) {
  const store = new SaveStore(new MemoryBackend());
  const entry = await store.save(saveGame(sim), { name: 'Test' });
  const doc = await store.load(entry.id);
  const sim2 = loadGame(doc.state);
  return { sim2, entry, doc };
}

describe('Save game round trip', () => {
  it('free game (3 players, fog): saved and loaded continues the same as unsaved', async () => {
    const sim = new Sim({ seed: 42, players: 3, fog: true, ai: ['normal', 'normal', 'normal'] });
    for (let i = 0; i < 3000; i++) sim.step();
    const { sim2, entry } = await viaStore(sim);
    expect(entry).toMatchObject({ mode: 'free', seed: 42, players: 3, fog: true, tick: 3000 });
    expect(sim2.hash()).toBe(sim.hash());
    for (let i = 0; i < 2500; i++) { sim.step(); sim2.step(); }
    expect(sim2.hash()).toBe(sim.hash());
    expect(visionOf(sim2)).toBe(visionOf(sim));
  });

  it('mission with fog and ongoing market trade', async () => {
    const sim = createMissionSim('c2');
    expect(sim.vision.enabled).toBe(true);
    for (let i = 0; i < 1500; i++) sim.step();
    // market with traders, save with trade in progress
    const m = quickBuild(sim, 'storehouse');
    m.level = 1;
    sim.players[0].stock.gold += 5000;
    let t = 0;
    while (m.workers.length < 2 && t++ < 3000) sim.step();
    sim.step([{ type: 'trade', player: 0, building: m.id, give: 'gold', take: 'wood', amount: 100 }]);
    for (let i = 0; i < 40; i++) sim.step();
    expect(m.trade).toBeTruthy();

    const { sim2, entry } = await viaStore(sim);
    expect(entry.mode).toBe('mission');
    expect(entry.mission).toBe('c2');
    expect(sim2.mission.def.id).toBe('c2');
    expect(sim2.hash()).toBe(sim.hash());
    for (let i = 0; i < 2000; i++) { sim.step(); sim2.step(); }
    expect(sim2.hash()).toBe(sim.hash());
    expect(sim2.market.prices).toEqual(sim.market.prices);
    expect(sim2.market.prices.wood).not.toBe(createMissionSim('c2').market.prices.wood);
    expect(sim2.mission.getState()).toEqual(sim.mission.getState());
    expect(visionOf(sim2)).toBe(visionOf(sim));
  });

  it('readable and compact export yield the same state', () => {
    const sim = new Sim({ seed: 7 });
    for (let i = 0; i < 500; i++) sim.step();
    const doc = createSaveDoc(saveGame(sim), { name: 'Export' });
    const pretty = stringifyDoc(doc), compact = stringifyDoc(doc, { compact: true });
    expect(pretty.length).toBeGreaterThan(compact.length);
    expect(pretty).toContain('\n  "format": "kronland-save"');
    const a = loadGame(parseSaveText(pretty, { deep: true }).state), b = loadGame(parseSaveText(compact).state);
    expect(a.hash()).toBe(sim.hash());
    expect(b.hash()).toBe(sim.hash());
  });

  it('free game with levelled terrain: heights survive file export/import, same hash afterwards', async () => {
    const sim = new Sim({ seed: 42, players: 2, fog: true });
    addAi(sim, 1, 'normal');
    rich(sim);
    const fresh = sim.map.heights.slice();
    const site = slopeSite(sim, 'residence');
    expect(site).not.toBeNull();
    const ev = sim.step([{ type: 'placeBuilding', player: 0, building: 'residence', x: site.x, y: site.y }]);
    expect(ev.some((e) => e.type === 'terrainChanged')).toBe(true);
    for (let i = 0; i < 300; i++) sim.step();
    expect(sim.map.heights).not.toEqual(fresh);

    const { sim2, doc } = await viaFile(sim);
    expect(doc.meta).toMatchObject({ mode: 'free', fog: true, tick: sim.tick });
    expect(sim2.map.heights).toEqual(sim.map.heights);
    expect(sim2.hash()).toBe(sim.hash());
    // building on the slope after loading: both games level the same way
    const next = slopeSite(sim, 'residence');
    const cmd = { type: 'placeBuilding', player: 0, building: 'residence', x: next.x, y: next.y };
    sim.step([cmd]); sim2.step([{ ...cmd }]);
    for (let i = 0; i < 1200; i++) { sim.step(); sim2.step(); }
    expect(sim2.map.heights).toEqual(sim.map.heights);
    expect(sim2.hash()).toBe(sim.hash());
  });

  it('mission with levelled terrain via the save slot', async () => {
    const sim = createMissionSim('c2');
    rich(sim);
    for (let i = 0; i < 200; i++) sim.step();
    const site = slopeSite(sim, 'residence');
    expect(site).not.toBeNull();
    const ev = sim.step([{ type: 'placeBuilding', player: 0, building: 'residence', x: site.x, y: site.y }]);
    expect(ev.some((e) => e.type === 'terrainChanged')).toBe(true);
    for (let i = 0; i < 200; i++) sim.step();
    const { sim2, entry } = await viaStore(sim);
    expect(entry).toMatchObject({ mode: 'mission', mission: 'c2' });
    expect(sim2.map.heights).toEqual(sim.map.heights);
    for (let i = 0; i < 1500; i++) { sim.step(); sim2.step(); }
    expect(sim2.hash()).toBe(sim.hash());
    expect(sim2.mission.getState()).toEqual(sim.mission.getState());
  });

  it('developer mode (A* recording) changes neither state nor save game', () => {
    const sim = new Sim({ seed: 5 });
    for (let i = 0; i < 300; i++) sim.step();
    const before = JSON.stringify(saveGame(sim)), hash = sim.hash();
    const W = sim.map.width;
    recordSearch(sim.map, 10, 10, [(W - 10) * W + (W - 12)]);
    recordSearch(sim.map, 20, 30, [40 * W + 50]);
    expect(sim.hash()).toBe(hash);
    const after = JSON.stringify(saveGame(sim));
    expect(after).toBe(before);
    expect(after).not.toMatch(/"dev/);
  });
});
