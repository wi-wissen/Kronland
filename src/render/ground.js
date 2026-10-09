// Tracks in the rendering (docs/SPIELREGELN.md §Spuren und Gegenstände): a data texture with one texel per tile,
// like the fog of war. R = stage of the track in the picture (trackShade: the thresholds of the ground in
// BALANCE.ground.tracks mapped onto fixed values the shader knows), B = the same smoothed over the neighbours,
// G/A = walking direction (packTracks). The terrain shader (terrain.js) draws organic paths from it – bicubic lookup,
// meander and frayed edges from world-space noise, no tile shapes: flattened grass and then bare earth in summer and
// rain, layers of footprints that merge into a trodden lane in the snow.
//
// Fog: only tiles the player currently sees take over the strength of the simulation; explored tiles keep the
// last seen state (no movements revealed through the fog), unexplored ones show nothing.
// Cheap: the texture is refilled at most every few ticks (or when a script set tracks), and only uploaded when
// a texel changed.

import * as THREE from 'three';
import { BALANCE } from '../sim/data/balance.js';
import { trackThreshold, trackGround } from '../sim/systems/ground.js';
import { visionOf, fogEnabled } from '../sim/systems/vision.js';

/** Ticks between two refills of the texture (0.5 s). */
export const TRACK_REFRESH_TICKS = 5;

/**
 * Values of R in the picture at the stages of a track (0…255; the shader in terrain.js uses the same numbers):
 * faint (barely visible) → trodden (counts as "track") → path (bare earth / trodden lane) → full.
 */
export const TRACK_SHADE = { faint: 16, trodden: 96, path: 176, full: 255 };

/**
 * Stages of the ground (BALANCE.ground.tracks.grass/snow) for the picture; a level threshold moves "trodden" (and
 * "faint" never lies above it).
 * @param {{faint:number, trodden:number, path:number, full:number}} ground @param {number} [threshold]
 */
export function trackStages(ground, threshold = ground.trodden) {
  const trodden = Math.max(1, Math.min(threshold, BALANCE.ground.tracks.max));
  const path = Math.max(trodden + 1, ground.path), full = Math.max(path + 1, ground.full);
  return { faint: Math.max(1, Math.min(ground.faint, trodden)), trodden, path, full };
}

/**
 * Brightness of a track in the picture (0…255): piecewise linear between the stages – 0 below "faint",
 * TRACK_SHADE.faint … trodden … path … full.
 * @param {number} strength @param {{faint:number, trodden:number, path:number, full:number}} st trackStages()
 */
export function trackShade(strength, st) {
  if (strength < st.faint || strength <= 0) return 0;
  const S = TRACK_SHADE;
  const lerp = (a, b, va, vb) => Math.round(va + (vb - va) * (Math.min(strength, b) - a) / Math.max(1, b - a));
  if (strength < st.trodden) return lerp(st.faint, st.trodden, S.faint, S.trodden);
  if (strength < st.path) return lerp(st.trodden, st.path, S.trodden, S.path);
  return lerp(st.path, st.full, S.path, S.full);
}

/** Smoothing gain: a path one tile wide keeps its strength in the middle after the blur (½ of the kernel lies on it). */
export const TRACK_SMOOTH_GAIN = 1.9;
/** Work buffers per output buffer: last seen stage per tile (fog: what the player saw last), gradient tensor. */
const bufOf = new WeakMap();

/**
 * Fill the texel bytes (RGBA per tile) from the track strengths of the simulation. Rendering only, the simulation
 * stays per tile. R = stage of the tile (trackShade, last seen state under fog), B = R smoothed over the
 * neighbours (rounded bends, diagonals as diagonals instead of staircases – the shader samples it bicubically),
 * G/A = walking direction from the neighbouring track tiles as doubled angle (cos 2θ, sin 2θ mapped to 0…255, 128 =
 * no direction): it interpolates smoothly between tiles and orients footprints and flattened blades.
 * @param {Uint8Array} tracks strength per tile (sim.map.tracks)
 * @param {Uint8Array} out RGBA bytes per tile
 * @param {{ W: number, H: number, stages: {faint:number, trodden:number, path:number, full:number},
 *   visible?: Uint8Array|null, explored?: Uint8Array|null }} o stages: trackStages(); visible/explored: vision of
 *   the player (null = no fog, everything counts as visible)
 * @returns {{ y0: number, y1: number }|null} rows that changed (inclusive) or null
 */
export function packTracks(tracks, out, { W, H, stages, visible = null, explored = null }) {
  // Work buffers per output buffer: last seen stage with a border of one empty tile (no bounds checks), gradient
  // tensor, rows that hold something in the output (empty rows far from any track are skipped: cheap on big maps)
  const PW = W + 2;
  let buf = bufOf.get(out);
  if (!buf || buf.W !== W || buf.H !== H) {
    buf = { W, H, seen: new Uint8Array(PW * (H + 2)), jc: new Float32Array(PW * (H + 2)), js: new Float32Array(PW * (H + 2)), rowUsed: new Uint8Array(H), rowAny: new Uint8Array(H + 4) };
    bufOf.set(out, buf);
  }
  const { seen, jc, js, rowUsed, rowAny } = buf;
  rowAny.fill(0);
  for (let y = 0; y < H; y++) {
    let any = 0;
    for (let x = 0, k = y * W, q = (y + 1) * PW + 1; x < W; x++, k++, q++) {
      if (explored && !explored[k]) seen[q] = 0;
      else if (!visible || visible[k]) seen[q] = trackShade(tracks[k], stages);
      any |= seen[q];
    }
    rowAny[y + 2] = any ? 1 : 0;
  }
  // Rows near a track (±2 for the 3×3 tensor sum of the 3×3 gradient)
  const near = (y) => rowAny[y] | rowAny[y + 1] | rowAny[y + 2] | rowAny[y + 3] | rowAny[y + 4];
  // Walking direction: structure tensor of the gradient (doubled angle, so that opposite directions add up), summed
  // over the neighbours; the path runs across the gradient. Works for paths one tile wide and wide trodden areas.
  for (let y = 0; y < H; y++) {
    if (!near(y)) continue;
    for (let x = 0, q = (y + 1) * PW + 1; x < W; x++, q++) {
      const a = seen[q - PW - 1], b = seen[q - PW], c = seen[q - PW + 1];
      const d = seen[q - 1], f = seen[q + 1];
      const g = seen[q + PW - 1], h = seen[q + PW], i = seen[q + PW + 1];
      const gx = c + 2 * f + i - a - 2 * d - g;
      const gy = g + 2 * h + i - a - 2 * b - c;
      jc[q] = gx * gx - gy * gy; js[q] = 2 * gx * gy;
    }
  }
  let y0 = -1, y1 = -1;
  const gain = TRACK_SMOOTH_GAIN / 16;
  for (let y = 0; y < H; y++) {
    const hot = near(y);
    if (!hot && !rowUsed[y]) continue;
    let used = 0;
    for (let x = 0, k = y * W, q = (y + 1) * PW + 1; x < W; x++, k++, q++) {
      let r = 0, g = 128, b = 0, a = 128;
      if (hot) {
        r = seen[q];
        const n = q - PW, sN = q + PW;
        const sum = seen[n - 1] + 2 * seen[n] + seen[n + 1] + 2 * seen[q - 1] + 4 * r + 2 * seen[q + 1] + seen[sN - 1] + 2 * seen[sN] + seen[sN + 1];
        if (sum) {
          // along the line (best of the four axes): a diagonal path of corner-touching tiles keeps the same strength
          // as a straight one, the blur only widens it sideways
          const line = Math.max(seen[q - 1] + seen[q + 1], seen[n] + seen[sN], seen[n - 1] + seen[sN + 1], seen[n + 1] + seen[sN - 1]);
          b = Math.min(255, Math.round(Math.max(sum * gain, (2 * r + line) / 4)));
          const dc = -(jc[n - 1] + 2 * jc[n] + jc[n + 1] + 2 * jc[q - 1] + 4 * jc[q] + 2 * jc[q + 1] + jc[sN - 1] + 2 * jc[sN] + jc[sN + 1]);
          const ds = -(js[n - 1] + 2 * js[n] + js[n + 1] + 2 * js[q - 1] + 4 * js[q] + 2 * js[q + 1] + js[sN - 1] + 2 * js[sN] + js[sN + 1]);
          const len = Math.sqrt(dc * dc + ds * ds);
          if (len > 1e-6) { g = Math.round(128 + 127 * dc / len); a = Math.round(128 + 127 * ds / len); }
          used = 1;
        }
      }
      const o = k * 4;
      if (out[o] === r && out[o + 1] === g && out[o + 2] === b && out[o + 3] === a) continue;
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a;
      if (y0 < 0) y0 = y;
      y1 = y;
    }
    rowUsed[y] = used;
  }
  return y0 < 0 ? null : { y0, y1 };
}

export class TrackLayer {
  /**
   * @param {import('../sim/sim.js').Sim} sim
   * @param {number} player point of view (fog of war)
   * @param {Record<string, {value:any}>} uniforms terrain uniforms (tTrack, uTrackOn)
   */
  constructor(sim, player, uniforms) {
    this.sim = sim;
    this.player = player;
    this.uniforms = uniforms;
    const W = this.W = sim.map.width, H = this.H = sim.map.height;
    this.data = new Uint8Array(W * H * 4);
    this.tex = new THREE.DataTexture(this.data, W, H, THREE.RGBAFormat);
    // linear: the shader samples B bicubically from four linear taps, the direction G/A interpolates between tiles
    this.tex.magFilter = THREE.LinearFilter; this.tex.minFilter = THREE.LinearFilter;
    this.tex.wrapS = this.tex.wrapT = THREE.ClampToEdgeWrapping;
    this.tex.generateMipmaps = false;
    this.tex.needsUpdate = true;
    uniforms.tTrack.value = this.tex;
    uniforms.uTrackOn.value = 1;
    this.tick = -Infinity;
    this.key = '';
    /** Rendering without fog (game end, editor) */
    this.revealed = false;
    this.update(true);
  }

  /** Show all tracks (game end, spectating). */
  revealAll() { if (!this.revealed) { this.revealed = true; this.key = ''; } }

  /** Per frame: refill the texture when the simulation went on a few ticks or a script set tracks. */
  update(force = false) {
    const sim = this.sim, m = sim.map;
    const stages = trackStages(trackGround(sim), trackThreshold(sim));
    const vis = fogEnabled(sim) && !this.revealed ? visionOf(sim, this.player) : null;
    const key = `${m.groundVersion}|${stages.faint}|${stages.trodden}|${stages.path}|${sim.vision?.version ?? 0}|${vis ? 1 : 0}`;
    if (!force && key === this.key && sim.tick - this.tick < TRACK_REFRESH_TICKS) return false;
    this.key = key;
    this.tick = sim.tick;
    const changed = packTracks(m.tracks, this.data, {
      W: this.W, H: this.H, stages,
      visible: vis?.visible ?? null, explored: vis?.explored ?? null,
    });
    if (changed) this.tex.needsUpdate = true;
    return !!changed;
  }

  dispose() {
    this.tex.dispose();
    if (this.uniforms.tTrack.value === this.tex) { this.uniforms.tTrack.value = null; this.uniforms.uTrackOn.value = 0; }
  }
}
