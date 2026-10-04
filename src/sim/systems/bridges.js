// Bridges at bridge sites (model: Settlers 5 expansion "Nebelreich", see docs/ADDON.md).
// The map generator defines the sites (the shortest crossing per river section); building is only possible there.
// Finished bridges are walkable for everyone; when destroyed the tiles become water again.
// Everything deterministic and integer.

import { BRIDGE, WATER, OCCUPIED, RESERVED, CLIFF } from '../map.js';
import { toTile, tileCenter } from '../fixed.js';
import { removeWorker } from './workers.js';

/**
 * Adopt bridge sites for a new simulation (at the end of the constructor) and keep their bridgeheads free.
 * @param {import('../sim.js').Sim} sim @param {{x:number,y:number,w:number,h:number}[]} sites
 */
export function setupBridges(sim, sites) {
  sim.bridgeSites = sites ?? [];
  for (const s of sim.bridgeSites) keepBridgeheads(sim, s);
}

/** Bridgeheads: the bank tiles at both ends of a bridge site (two each). */
export function bridgeheads(s) {
  const out = [];
  if (s.w >= s.h) for (let j = s.y; j < s.y + s.h; j++) out.push([s.x - 1, j], [s.x + s.w, j]);
  else for (let i = s.x; i < s.x + s.w; i++) out.push([i, s.y - 1], [i, s.y + s.h]);
  return out;
}

/**
 * Keep the bridge site and bridgeheads free: remove trees/piles there and reserve the land tiles
 * (walkable, but not buildable). This way no building blocks the access or the site itself, and the
 * levelling when building (systems/terrain.js) leaves reserved tiles in the transition border unchanged –
 * the banks keep their height, the bridge deck stays at bank height.
 */
function keepBridgeheads(sim, s) {
  const m = sim.map;
  const tiles = bridgeheads(s);
  for (let j = s.y; j < s.y + s.h; j++) for (let i = s.x; i < s.x + s.w; i++) tiles.push([i, j]);
  for (const [x, y] of tiles) {
    if (!m.inBounds(x, y)) continue;
    const k = m.idx(x, y);
    const id = m.owner[k];
    const n = id ? sim.entities.get(id) : null;
    if (n && (n.kind === 'tree' || n.kind === 'pile')) { sim.entities.delete(n.id); m.release(x, y, 1, 1); }
    if (!(m.flags[k] & WATER)) m.flags[k] |= RESERVED;
  }
  m.version++;
}

/** Bridge site with top-left corner (x,y) or null. */
export const bridgeSiteAt = (sim, x, y) => (sim.bridgeSites ?? []).find((s) => s.x === x && s.y === y) ?? null;

/** May a bridge be built at (x,y)? @returns {string|null} */
export function checkBridgeSite(sim, x, y) {
  const s = bridgeSiteAt(sim, x, y);
  if (!s) return 'err.bridgeSiteOnly';
  const m = sim.map;
  for (let j = s.y; j < s.y + s.h; j++) for (let i = s.x; i < s.x + s.w; i++) {
    const f = m.flags[m.idx(i, j)];
    if (f & (OCCUPIED | BRIDGE | CLIFF)) return 'err.spotTaken';
  }
  return null;
}

/** Bridge finished: release the area and mark it as walkable (for all players). */
export function bridgeDone(sim, b) {
  const m = sim.map;
  m.release(b.x, b.y, b.w, b.h);
  for (let j = b.y; j < b.y + b.h; j++) for (let i = b.x; i < b.x + b.w; i++) m.flags[m.idx(i, j)] |= BRIDGE;
  m.version++;
  sim.events.push({ type: 'bridgeBuilt', player: b.owner, building: b.id, x: b.x, y: b.y, w: b.w, h: b.h });
}

/**
 * Bridge gone (destroyed, demolished): tiles become water again. Whoever stands on it falls into the water
 * (as with a thaw: heroes return to the castle, all others drown). In winter the ice carries.
 */
export function bridgeGone(sim, b) {
  const m = sim.map;
  if (!b.done) return;
  for (let j = b.y; j < b.y + b.h; j++) for (let i = b.x; i < b.x + b.w; i++) m.flags[m.idx(i, j)] &= ~BRIDGE;
  m.version++;
  sim.events.push({ type: 'bridgeCollapsed', player: b.owner, building: b.id, x: b.x, y: b.y, w: b.w, h: b.h });
  if (m.frozen) return;
  for (const e of [...sim.entities.values()]) {
    if (e.px === undefined) continue;
    const tx = toTile(e.px), ty = toTile(e.py);
    if (tx < b.x || ty < b.y || tx >= b.x + b.w || ty >= b.y + b.h || !(m.flags[m.idx(tx, ty)] & WATER)) continue;
    drown(sim, e);
  }
}

/** Figure falls into the water. */
function drown(sim, e) {
  if (e.kind === 'hero') {
    const hq = sim.findBuilding(e.owner, 'headquarters');
    if (hq) { e.px = tileCenter(hq.x + 2); e.py = tileCenter(hq.y + hq.h + 1); e.path = []; }
    return;
  }
  sim.events.push({ type: 'killed', id: e.id, kind: e.kind, owner: e.owner, by: -1, drowned: true });
  if (e.kind === 'soldier') {
    const L = sim.entities.get(e.leader);
    if (L) L.soldiers = L.soldiers.filter((x) => x !== e.id);
  } else if (e.kind === 'leader') {
    for (const s of e.soldiers) sim.entities.delete(s);
  } else if (e.kind === 'worker') {
    // Workers: via the normal removal (release workplace/home)
    removeWorker(sim, e, 'drowned');
    return;
  } else if (e.kind === 'unit' && e.job) {
    const site = sim.entities.get(e.job.target);
    if (site?.builders) site.builders = site.builders.filter((id) => id !== e.id);
  }
  sim.entities.delete(e.id);
}

/** Contribution to the state hash. */
export function hashBridges(sim, h) {
  h.int(sim.bridgeSites?.length ?? 0);
}
