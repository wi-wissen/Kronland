// Vision and fog of war per team (allies share their vision).
//
// Three states per tile: unexplored, explored (terrain known, enemies invisible, enemy
// buildings as last seen state), visible. Integer and deterministic:
//   explored  Uint8Array (0/1), only ever set, never cleared
//   visible   Uint8Array (0/1), restamped from all vision sources every VISION.updateTicks ticks
//   ghosts    Map building ID → snapshot of enemy buildings/ruins (last seen)
//   reveals   time-limited vision sources from missions
// The circles are cached as row widths per radius (stamp = a few fill() calls).

import { VISION, buildingSight } from '../data/vision.js';
import { UNITS } from '../data/units.js';
import { COMBAT } from '../data/combat.js';
import { combatStats } from './military.js';
import { isqrt, toTile } from '../fixed.js';

/** Row widths (half width per row dy = −r … r) per radius. */
const SPANS = [];
function spans(r) {
  let s = SPANS[r];
  if (!s) {
    s = new Int16Array(2 * r + 1);
    // r² + r: rounder circles than r² (no single spikes on the axes)
    for (let dy = -r; dy <= r; dy++) s[dy + r] = isqrt(r * r + r - dy * dy);
    SPANS[r] = s;
  }
  return s;
}

/**
 * Create the vision of a simulation (at the end of the Sim constructor or after loading).
 * @param {import('../sim.js').Sim} sim
 * @param {{ enabled?: boolean, startReveal?: number }} [opts]
 */
export function createVision(sim, opts = {}) {
  const W = sim.map.width, H = sim.map.height;
  const v = {
    enabled: opts.enabled !== false,
    startReveal: opts.startReveal ?? VISION.startReveal,
    W, H,
    /** @type {Map<number, {explored: Uint8Array, visible: Uint8Array, ghosts: Map<number, any>}>} */
    teams: new Map(),
    /** @type {{team:number, x:number, y:number, r:number, until:number}[]} */
    reveals: [],
    /** Counter per recomputation (for rendering and minimap) */
    version: 0,
  };
  sim.vision = v;
  return v;
}

/** Record of a team (creates it on demand). */
function teamRec(sim, team) {
  const v = sim.vision;
  let t = v.teams.get(team);
  if (!t) {
    const n = v.W * v.H;
    t = { explored: new Uint8Array(n), visible: new Uint8Array(n), ghosts: new Map() };
    v.teams.set(team, t);
  }
  return t;
}

/** Explore the start area around each castle (after mission setup). */
export function revealStart(sim) {
  const v = sim.vision;
  if (!v?.enabled) return;
  for (const p of sim.players) {
    if (p.neutral) continue;
    const hq = sim.findBuilding(p.id, 'headquarters');
    const c = hq ? { x: hq.x + (hq.w >> 1), y: hq.y + (hq.h >> 1) } : sim.starts[p.id];
    if (!c) continue;
    const t = teamRec(sim, p.team);
    stamp(v, null, t.explored, c.x, c.y, v.startReveal);
  }
}

/** Stamp a circle (visible and/or explored). */
function stamp(v, vis, exp, cx, cy, r) {
  const s = spans(r), W = v.W, H = v.H;
  const y0 = Math.max(0, cy - r), y1 = Math.min(H - 1, cy + r);
  for (let y = y0; y <= y1; y++) {
    const hw = s[y - cy + r];
    const x0 = Math.max(0, cx - hw), x1 = Math.min(W - 1, cx + hw);
    if (x1 < x0) continue;
    const k = y * W;
    if (vis) vis.fill(1, k + x0, k + x1 + 1);
    if (exp) exp.fill(1, k + x0, k + x1 + 1);
  }
}

/** Weather penalty in tiles. */
const weatherMalus = (sim) => VISION.weather[sim.weather?.state] ?? 0;

/**
 * Vision range of an entity in tiles (without weather) and centre point; null = no vision source.
 * @returns {{x:number, y:number, r:number}|null}
 */
export function sightOf(sim, e) {
  switch (e.kind) {
    case 'building': {
      const r = buildingSight(e.type, e.level, e.done) + (Math.max(e.w, e.h) >> 1);
      return { x: e.x + (e.w >> 1), y: e.y + (e.h >> 1), r };
    }
    case 'leader': case 'soldier': {
      const st = combatStats(sim, e);
      return { x: toTile(e.px), y: toTile(e.py), r: (st.sight ?? COMBAT.sight) + (VISION.fighterExtra[UNITS[e.def]?.line] ?? 2) };
    }
    case 'hero': return { x: toTile(e.px), y: toTile(e.py), r: VISION.units.hero };
    case 'unit': return { x: toTile(e.px), y: toTile(e.py), r: e.militia ? VISION.units.militia : VISION.units.serf };
    case 'worker': return e.inside ? null : { x: toTile(e.px), y: toTile(e.py), r: VISION.units.worker };
    case 'turret': case 'trap': return { x: toTile(e.px), y: toTile(e.py), r: VISION.units[e.kind] };
    default: return null;
  }
}

/** Effective vision range incl. weather (for display and tests). */
export function effectiveSight(sim, e) {
  const s = sightOf(sim, e);
  return s ? Math.max(VISION.minRadius, s.r - weatherMalus(sim)) : 0;
}

/**
 * Recompute vision: every VISION.updateTicks ticks (or immediately with force).
 * @param {import('../sim.js').Sim} sim
 */
export function updateVision(sim, force = false) {
  const v = sim.vision;
  if (!v?.enabled) return;
  if (!force && sim.tick % VISION.updateTicks !== 0) return;
  const malus = weatherMalus(sim);
  // Team per player; eliminated players and neutrals (bandits) provide no vision
  const teamOf = [];
  for (const p of sim.players) {
    teamOf[p.id] = p.defeated || p.neutral ? null : teamRec(sim, p.team);
  }
  for (const t of v.teams.values()) t.visible.fill(0);
  for (const e of sim.entities.values()) {
    if (e.owner === undefined || e.owner < 0) continue;
    const t = teamOf[e.owner];
    if (!t) continue;
    const s = sightOf(sim, e);
    if (!s) continue;
    stamp(v, t.visible, t.explored, s.x, s.y, Math.max(VISION.minRadius, s.r - malus));
  }
  // Time-limited reveals from missions
  if (v.reveals.length) {
    v.reveals = v.reveals.filter((r) => r.until > sim.tick);
    for (const r of v.reveals) {
      const t = v.teams.get(r.team);
      if (t) stamp(v, t.visible, t.explored, r.x, r.y, r.r);
    }
  }
  updateGhosts(sim);
  v.version++;
}

/** Is any tile of the rectangle visible? */
function rectVisible(v, vis, x, y, w, h) {
  const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(v.W - 1, x + w - 1), y1 = Math.min(v.H - 1, y + h - 1);
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) if (vis[j * v.W + i]) return true;
  return false;
}

/** Snapshot of a building or ruin (only what is seen from outside); `g` is reused. */
function snapshot(e, g = {}) {
  g.id = e.id; g.kind = e.kind; g.type = e.type; g.owner = e.kind === 'ruin' ? e.formerOwner ?? -1 : e.owner;
  g.x = e.x; g.y = e.y; g.w = e.w ?? 3; g.h = e.h ?? 3; g.level = e.level ?? 0; g.done = e.kind === 'ruin' ? true : e.done;
  // Construction progress in per mille (build phase of the rendering)
  g.progress = e.kind === 'building' && e.work ? Math.trunc((e.progress * 1000) / e.work) : 1000;
  return g;
}

/** Remember enemy buildings and ruins (visible → update; seen vanished → forget). */
function updateGhosts(sim) {
  const v = sim.vision;
  for (const [team, t] of v.teams) {
    for (const e of sim.entities.values()) {
      if (e.kind !== 'building' && e.kind !== 'ruin') continue;
      if (e.kind === 'building' && sim.players[e.owner]?.team === team) continue;
      if (!rectVisible(v, t.visible, e.x, e.y, e.w ?? 3, e.h ?? 3)) continue;
      const g = t.ghosts.get(e.id);
      if (g) snapshot(e, g); else t.ghosts.set(e.id, snapshot(e));
    }
    for (const [id, g] of t.ghosts) {
      if (sim.entities.has(id)) continue;
      if (rectVisible(v, t.visible, g.x, g.y, g.w, g.h)) t.ghosts.delete(id);
    }
  }
}

// ---------- Queries ----------

/** Record of a player's team or null (fog off / unknown player). */
export function visionOf(sim, player) {
  const v = sim.vision;
  if (!v?.enabled) return null;
  const p = sim.players[player];
  return p ? v.teams.get(p.team) ?? null : null;
}

/** Is the fog of war active? */
export const fogEnabled = (sim) => !!sim.vision?.enabled;

/** Does the player currently see the tile? (fog off: always) */
export function isVisible(sim, player, x, y) {
  const t = visionOf(sim, player);
  if (!t) return true;
  if (x < 0 || y < 0 || x >= sim.vision.W || y >= sim.vision.H) return false;
  return t.visible[y * sim.vision.W + x] === 1;
}

/** Has the player already explored the tile? (fog off: always) */
export function isExplored(sim, player, x, y) {
  const t = visionOf(sim, player);
  if (!t) return true;
  if (x < 0 || y < 0 || x >= sim.vision.W || y >= sim.vision.H) return false;
  return t.explored[y * sim.vision.W + x] === 1;
}

/**
 * Does the player currently see this entity? Own and allied always; buildings/ruins if a tile
 * of their area is visible; figures by their tile; trees and piles count as terrain.
 */
export function canSee(sim, player, e) {
  if (!e) return false;
  if (e.owner !== undefined && e.owner >= 0 && sim.players[e.owner] && sim.allied(player, e.owner)) return true;
  const t = visionOf(sim, player);
  if (!t) return true;
  if (e.kind === 'building' || e.kind === 'ruin') return rectVisible(sim.vision, t.visible, e.x, e.y, e.w ?? 3, e.h ?? 3);
  if (e.px !== undefined) return isVisible(sim, player, toTile(e.px), toTile(e.py));
  return isExplored(sim, player, e.x, e.y);
}

/**
 * Known enemy buildings/ruins of the player (last seen state; visible ones are current).
 * Fog off: null (everything is known, callers then read the real entities).
 * @returns {Map<number, any>|null}
 */
export function knownBuildings(sim, player) {
  return visionOf(sim, player)?.ghosts ?? null;
}

/**
 * Reveal an area for a team: permanently explored and visible for `ticks` ticks (mission action 'reveal').
 * @param {number} player player whose team gets the vision
 */
export function revealArea(sim, player, x, y, r, ticks = 0) {
  const v = sim.vision;
  if (!v?.enabled) return;
  const p = sim.players[player];
  if (!p) return;
  const t = teamRec(sim, p.team);
  r = Math.max(1, Math.min(64, r | 0));
  stamp(v, ticks > 0 ? t.visible : null, t.explored, x | 0, y | 0, r);
  if (ticks > 0) {
    v.reveals.push({ team: p.team, x: x | 0, y: y | 0, r, until: sim.tick + ticks });
    updateGhosts(sim);
  }
  v.version++;
}

// ---------- Saving ----------

/** Bitfield from 0/1 bytes. */
function packBits(a) {
  const out = new Uint8Array((a.length + 7) >> 3);
  for (let i = 0; i < a.length; i++) if (a[i]) out[i >> 3] |= 1 << (i & 7);
  return out;
}
function unpackBits(b, n) {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (b[i >> 3] >> (i & 7)) & 1;
  return out;
}

/** State for the save game (bitfields as Base64). */
export function saveVision(sim, toB64) {
  const v = sim.vision;
  if (!v) return null;
  return {
    enabled: v.enabled, startReveal: v.startReveal, version: v.version, reveals: v.reveals,
    teams: [...v.teams].map(([team, t]) => ({
      team, explored: toB64(packBits(t.explored)), visible: toB64(packBits(t.visible)), ghosts: [...t.ghosts.values()],
    })),
  };
}

/** Restore state from the save game (older saves without vision: fog off). */
export function loadVision(sim, data, fromB64) {
  if (!data) { createVision(sim, { enabled: false }); return; }
  const v = createVision(sim, { enabled: data.enabled, startReveal: data.startReveal });
  if (!v.enabled) return;
  v.teams.clear();
  v.version = data.version ?? 0;
  v.reveals = data.reveals ?? [];
  const n = v.W * v.H;
  for (const t of data.teams) {
    v.teams.set(t.team, {
      explored: unpackBits(fromB64(t.explored, Uint8Array), n),
      visible: unpackBits(fromB64(t.visible, Uint8Array), n),
      ghosts: new Map(t.ghosts.map((g) => [g.id, g])),
    });
  }
}

/** Contribution to the state hash. */
export function hashVision(sim, h) {
  const v = sim.vision;
  if (!v?.enabled) { h.int(0); return; }
  h.int(1).int(v.reveals.length);
  for (const [team, t] of v.teams) {
    let e = 0, s = 0;
    for (let i = 0; i < t.explored.length; i++) { e += t.explored[i]; s += t.visible[i]; }
    h.int(team).int(e).int(s).int(t.ghosts.size);
  }
}
