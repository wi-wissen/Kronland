// Data preparation of the grid overlays in developer mode: one RGBA colour per tile (Uint8Array,
// width × height × 4). Pure functions without three.js – testable and independent of rendering.
// All functions only read the state.

import { playerHex } from '../render/playerColors.js';
import { WATER, OCCUPIED, RESERVED, CLIFF, BRIDGE } from '../sim/map.js';
import { BALANCE } from '../sim/data/balance.js';
import { sightOf } from '../sim/systems/vision.js';
import { TILE_OPEN, TILE_CLOSED, TILE_PATH } from './astar.js';

/** Colours (RGBA 0–255) – the legend in the panel uses the same values. */
export const COLORS = {
  free: [96, 200, 104, 70],
  blocked: [226, 72, 60, 150],
  cliff: [150, 84, 190, 170],
  water: [52, 120, 230, 150],
  ice: [170, 220, 255, 120],
  reserved: [250, 210, 70, 130],
  bridge: [190, 140, 90, 170],
  buildable: [96, 210, 104, 120],
  steep: [255, 150, 40, 140],
  visible: [120, 230, 140, 40],
  explored: [70, 70, 80, 140],
  unexplored: [0, 0, 0, 215],
  open: [70, 210, 240, 165],
  closed: [245, 140, 60, 150],
  path: [255, 245, 120, 230],
  start: [70, 230, 90, 240],
  goal: [240, 70, 200, 240],
  current: [255, 50, 50, 255],
};

/** LOD colours (wireframe): LOD0 green, LOD1 yellow, LOD2 red, LOD3 violet. */
export const LOD_COLORS = [0x3ddc5a, 0xf2d43a, 0xf0503c, 0xb45af0];

/** Player colours for territories (like the game figures). */
/** Player colour as RGB (mapping with colour choice in render/playerColors.js). */
const teamRgb = (o) => { const h = playerHex(o); return [(h >> 16) & 255, (h >> 8) & 255, h & 255]; };

const put = (out, k, c) => { const o = k * 4; out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = c[3]; };

/**
 * Walkability per tile: free, blocked (building, tree, pile), cliff, water (ice in winter),
 * reserved (settlement spot, shaft – walkable).
 * @param {import('../sim/map.js').TileMap} map
 */
export function walkLayer(map, out = new Uint8Array(map.width * map.height * 4)) {
  const f = map.flags;
  for (let k = 0; k < f.length; k++) {
    const v = f[k];
    if (v & CLIFF) put(out, k, COLORS.cliff);
    else if (v & OCCUPIED) put(out, k, COLORS.blocked);
    else if (v & BRIDGE) put(out, k, COLORS.bridge);
    else if (v & WATER) put(out, k, map.frozen ? COLORS.ice : COLORS.water);
    else if (v & RESERVED) put(out, k, COLORS.reserved);
    else put(out, k, COLORS.free);
  }
  return out;
}

/** Colour gradient for heights (t = 0…1 above the water). */
const RAMP = [[0, [36, 128, 74]], [0.3, [120, 190, 70]], [0.55, [236, 214, 92]], [0.78, [170, 112, 60]], [1, [250, 250, 250]]];
function ramp(t) {
  for (let i = 1; i < RAMP.length; i++) {
    const [b, cb] = RAMP[i];
    if (t <= b) {
      const [a, ca] = RAMP[i - 1];
      const u = (t - a) / (b - a);
      return [ca[0] + (cb[0] - ca[0]) * u, ca[1] + (cb[1] - ca[1]) * u, ca[2] + (cb[2] - ca[2]) * u];
    }
  }
  return RAMP[RAMP.length - 1][1];
}

/**
 * Height map as a colour gradient: blue tones below the water level, above it green → yellow → brown → white.
 * The gradient reaches up to the 98 % height of the land (single peaks would otherwise squash everything into green).
 * Contour lines (slightly darker) at round intervals, about twelve across the gradient.
 * @param {import('../sim/map.js').TileMap} map @param {number} waterLevel cm
 * @param {number} [contour] spacing of the contour lines in cm (0 = automatic)
 * @returns {{ data: Uint8Array, min: number, max: number, top: number, contour: number }}
 */
export function heightLayer(map, waterLevel, contour = 0, out = new Uint8Array(map.width * map.height * 4)) {
  const h = map.heights;
  let min = Infinity, max = -Infinity;
  const land = [];
  for (let k = 0; k < h.length; k++) {
    const v = h[k];
    if (v < min) min = v;
    if (v > max) max = v;
    if (v >= waterLevel) land.push(v);
  }
  land.sort((a, b) => a - b);
  const top = Math.max(waterLevel + 1, land.length ? land[Math.min(land.length - 1, Math.floor(land.length * 0.98))] : max);
  if (!contour) contour = Math.max(50, Math.round((top - waterLevel) / 12 / 50) * 50);
  for (let k = 0; k < h.length; k++) {
    const v = h[k];
    let c;
    if (v < waterLevel) {
      const d = Math.min(1, (waterLevel - v) / Math.max(1, waterLevel - min));
      c = [40 - d * 30, 120 - d * 70, 220 - d * 60];
    } else c = ramp(Math.min(1, (v - waterLevel) / (top - waterLevel)));
    // contour line: tile lies at a jump across a line
    const band = Math.floor(v / contour);
    const x = k % map.width;
    const right = x + 1 < map.width ? Math.floor(h[k + 1] / contour) : band;
    const down = k + map.width < h.length ? Math.floor(h[k + map.width] / contour) : band;
    const line = right !== band || down !== band;
    const s = line ? 0.62 : 1;
    put(out, k, [c[0] * s, c[1] * s, c[2] * s, 205]);
  }
  return { data: out, min, max, top, contour };
}

/**
 * Buildability and slope: free and flat enough for a 3×3 building (green), free but too steep
 * (orange, the steeper the stronger), blocked/water/cliff (red), settlement spot/shaft (yellow).
 * Slope = height difference in the 3×3 field around the tile (same rule as `map.slope`).
 * @param {import('../sim/map.js').TileMap} map
 * @param {number} [maxSlope] cm
 */
export function buildLayer(map, maxSlope = BALANCE.maxSlope, out = new Uint8Array(map.width * map.height * 4)) {
  const W = map.width, H = map.height, f = map.flags;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x, v = f[k];
    if (v & (WATER | OCCUPIED | CLIFF)) { put(out, k, COLORS.blocked); continue; }
    if (v & RESERVED) { put(out, k, COLORS.reserved); continue; }
    const x0 = Math.max(0, x - 1), y0 = Math.max(0, y - 1);
    const s = map.slope(x0, y0, Math.min(W, x + 2) - x0, Math.min(H, y + 2) - y0);
    if (s <= maxSlope) put(out, k, COLORS.buildable);
    else {
      const t = Math.min(1, (s - maxSlope) / (maxSlope * 2));
      put(out, k, [255, 170 - t * 90, 40, 110 + t * 100]);
    }
  }
  return out;
}

/** Slope of a tile (cm, 3×3 field) – for display on hover. */
export function slopeAt(map, x, y) {
  const x0 = Math.max(0, x - 1), y0 = Math.max(0, y - 1);
  return map.slope(x0, y0, Math.min(map.width, x + 2) - x0, Math.min(map.height, y + 2) - y0);
}

/**
 * Fog state per tile from a player's point of view: visible (slightly green), explored (grey), unexplored
 * (almost black). Without fog everything is visible.
 * @param {import('../sim/sim.js').Sim} sim @param {number} player
 */
export function visionLayer(sim, player, out = new Uint8Array(sim.map.width * sim.map.height * 4)) {
  const v = sim.vision, n = sim.map.width * sim.map.height;
  const team = v?.enabled ? v.teams.get(sim.players[player]?.team) : null;
  for (let k = 0; k < n; k++) {
    if (!v?.enabled) { put(out, k, COLORS.visible); continue; }
    put(out, k, team?.visible[k] ? COLORS.visible : team?.explored[k] ? COLORS.explored : COLORS.unexplored);
  }
  return out;
}

/**
 * Vision sources of a player (and allies): centre and radius in tiles (without weather).
 * @param {import('../sim/sim.js').Sim} sim @param {number} player
 * @returns {{x:number, y:number, r:number, kind:string}[]}
 */
export function sightCircles(sim, player) {
  const out = [];
  for (const e of sim.entities.values()) {
    if (e.owner === undefined || e.owner < 0 || !sim.players[e.owner] || !sim.allied(e.owner, player)) continue;
    if (e.kind === 'soldier') continue; // troops: the captain stands for all
    const s = sightOf(sim, e);
    if (s) out.push({ x: s.x, y: s.y, r: s.r, kind: e.kind });
  }
  return out;
}

/**
 * Territories (rendering only – the simulation knows no borders): each tile belongs to the player
 * whose finished building covers it most strongly relative to its vision range (distance/radius
 * smallest, only within the vision range). Border tiles are coloured more strongly.
 * @param {import('../sim/sim.js').Sim} sim
 * @returns {{ data: Uint8Array, owner: Int8Array }}
 */
export function territoryLayer(sim, out = new Uint8Array(sim.map.width * sim.map.height * 4)) {
  const W = sim.map.width, H = sim.map.height, n = W * H;
  const owner = new Int8Array(n).fill(-1);
  const best = new Float32Array(n).fill(Infinity);
  for (const e of sim.entities.values()) {
    if (e.kind !== 'building' || !e.done || !sim.players[e.owner] || sim.players[e.owner].neutral) continue;
    const s = sightOf(sim, e);
    if (!s) continue;
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2, r = s.r;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.ceil(cx + r)); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
        if (d > 1) continue;
        const k = y * W + x;
        if (d < best[k]) { best[k] = d; owner[k] = e.owner; }
      }
    }
  }
  out.fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x, o = owner[k];
    if (o < 0) continue;
    const edge = (x > 0 && owner[k - 1] !== o) || (x < W - 1 && owner[k + 1] !== o) || (y > 0 && owner[k - W] !== o) || (y < H - 1 && owner[k + W] !== o);
    const c = teamRgb(o);
    put(out, k, [c[0], c[1], c[2], edge ? 230 : 95]);
  }
  return { data: out, owner };
}

/** Well distinguishable colour per region number (golden angle on the colour wheel). */
export function regionColor(id) {
  const hue = (id * 137.508) % 360;
  const s = 0.65, l = 0.55;
  const c = (1 - Math.abs(2 * l - 1)) * s, hp = hue / 60, x = c * (1 - Math.abs((hp % 2) - 1)), m = l - c / 2;
  const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/**
 * Connected walkable regions (`map.regionAt`, the same as for the reachability check of
 * pathfinding). With `focus` the figure's region is highlighted, the others paler.
 * @param {import('../sim/map.js').TileMap} map @param {number} [focus] region number or 0
 * @returns {{ data: Uint8Array, count: number }}
 */
export function regionLayer(map, focus = 0, out = new Uint8Array(map.width * map.height * 4)) {
  const n = map.width * map.height;
  let count = 0;
  for (let k = 0; k < n; k++) {
    const id = map.regionAt(k);
    if (id > count) count = id;
    if (!id) { put(out, k, [0, 0, 0, 0]); continue; }
    const c = regionColor(id);
    put(out, k, [c[0], c[1], c[2], focus ? (id === focus ? 150 : 55) : 120]);
  }
  return { data: out, count };
}

/**
 * A* playback as tile colours: open list, closed list, found path, start, goal,
 * tile currently being examined.
 * @param {import('./astar.js').SearchPlayback} pb
 */
export function searchLayer(pb, out = new Uint8Array(pb.state.length * 4)) {
  out.fill(0);
  const st = pb.state;
  for (let k = 0; k < st.length; k++) {
    const s = st[k];
    if (s === TILE_OPEN) put(out, k, COLORS.open);
    else if (s === TILE_CLOSED) put(out, k, COLORS.closed);
    else if (s === TILE_PATH) put(out, k, COLORS.path);
  }
  for (const gk of pb.rec.goals) if (gk >= 0 && gk < st.length) put(out, gk, COLORS.goal);
  put(out, pb.rec.start, COLORS.start);
  if (pb.current >= 0 && !pb.done) put(out, pb.current, COLORS.current);
  return out;
}
