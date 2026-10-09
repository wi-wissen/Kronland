// Tracks in the rendering (docs/SPIELREGELN.md §Spuren und Gegenstände): a data texture with one texel per tile,
// like the fog of war. R = stage of the track in the picture (trackShade: the thresholds of the ground in
// BALANCE.ground.tracks mapped onto fixed values the shader knows), G = axis of the footprints (from the neighbouring
// track tiles). The terrain shader (terrain.js) turns it into flattened grass and then bare earth paths in summer and
// rain, into footprints and then a trodden lane in the snow.
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

/** Axis of the footprints: 0 = east–west, 1 = north–south, 2 = north-east–south-west, 3 = north-west–south-east. */
const AXES = [[[-1, 0], [1, 0]], [[0, -1], [0, 1]], [[1, -1], [-1, 1]], [[-1, -1], [1, 1]]];

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

/**
 * Fill the texel bytes (RGBA per tile) from the track strengths of the simulation.
 * @param {Uint8Array} tracks strength per tile (sim.map.tracks)
 * @param {Uint8Array} out RGBA bytes per tile (kept where the player does not see: last seen state)
 * @param {{ W: number, H: number, stages: {faint:number, trodden:number, path:number, full:number},
 *   visible?: Uint8Array|null, explored?: Uint8Array|null }} o stages: trackStages(); visible/explored: vision of
 *   the player (null = no fog, everything counts as visible)
 * @returns {{ y0: number, y1: number }|null} rows that changed (inclusive) or null
 */
export function packTracks(tracks, out, { W, H, stages, visible = null, explored = null }) {
  let y0 = -1, y1 = -1;
  const lo = stages.faint;
  const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && tracks[y * W + x] >= lo;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      let r, g;
      if (explored && !explored[k]) { r = 0; g = 0; }
      else if (visible && !visible[k]) continue; // last seen state stays
      else {
        r = trackShade(tracks[k], stages);
        g = 0;
        if (r) {
          // footprints along the path: the axis with the most track neighbours (straight before diagonal)
          let best = -1;
          for (let a = 0; a < 4; a++) {
            const [[ax, ay], [bx, by]] = AXES[a];
            const n = (on(x + ax, y + ay) ? 1 : 0) + (on(x + bx, y + by) ? 1 : 0);
            if (n > best) { best = n; g = a * 85; }
          }
        }
      }
      const o = k * 4;
      if (out[o] === r && out[o + 1] === g) continue;
      out[o] = r; out[o + 1] = g;
      if (y0 < 0) y0 = y;
      y1 = y;
    }
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
    // linear: smooth path edges; sampled at a tile centre it gives exactly that tile (footprints)
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
