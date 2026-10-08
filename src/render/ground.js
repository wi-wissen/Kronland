// Tracks in the rendering (docs/SPIELREGELN.md §Spuren und Gegenstände): a data texture with one texel per tile,
// like the fog of war. R = how strongly the tile is trodden (0 = no track; from the threshold of the simulation on),
// G = axis of the footprints (from the neighbouring track tiles). The terrain shader (terrain.js) turns it into
// packed earth paths in summer and rain and into trodden snow with footprints in winter.
//
// Fog: only tiles the player currently sees take over the strength of the simulation; explored tiles keep the
// last seen state (no movements revealed through the fog), unexplored ones show nothing.
// Cheap: the texture is refilled at most every few ticks (or when a script set tracks), and only uploaded when
// a texel changed.

import * as THREE from 'three';
import { BALANCE } from '../sim/data/balance.js';
import { trackThreshold } from '../sim/systems/ground.js';
import { visionOf, fogEnabled } from '../sim/systems/vision.js';

/** Strength steps above the threshold until a track is fully trodden in the picture. */
export const TRACK_RAMP = 16;
/** Ticks between two refills of the texture (0.5 s). */
export const TRACK_REFRESH_TICKS = 5;

/** Axis of the footprints: 0 = east–west, 1 = north–south, 2 = north-east–south-west, 3 = north-west–south-east. */
const AXES = [[[-1, 0], [1, 0]], [[0, -1], [0, 1]], [[1, -1], [-1, 1]], [[-1, -1], [1, 1]]];

/**
 * Brightness of a track in the picture (0…255): 0 below the threshold, from 40 % at the threshold up to full
 * after TRACK_RAMP more steps.
 * @param {number} strength @param {number} threshold
 */
export function trackShade(strength, threshold) {
  if (strength < threshold || strength <= 0) return 0;
  const f = Math.min(1, (strength - threshold) / TRACK_RAMP);
  return Math.round(255 * (0.4 + 0.6 * f));
}

/**
 * Fill the texel bytes (RGBA per tile) from the track strengths of the simulation.
 * @param {Uint8Array} tracks strength per tile (sim.map.tracks)
 * @param {Uint8Array} out RGBA bytes per tile (kept where the player does not see: last seen state)
 * @param {{ W: number, H: number, threshold: number, visible?: Uint8Array|null, explored?: Uint8Array|null }} o
 *   visible/explored: vision of the player (null = no fog, everything counts as visible)
 * @returns {{ y0: number, y1: number }|null} rows that changed (inclusive) or null
 */
export function packTracks(tracks, out, { W, H, threshold, visible = null, explored = null }) {
  let y0 = -1, y1 = -1;
  const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && tracks[y * W + x] >= threshold;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      let r, g;
      if (explored && !explored[k]) { r = 0; g = 0; }
      else if (visible && !visible[k]) continue; // last seen state stays
      else {
        r = trackShade(tracks[k], threshold);
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
    const threshold = trackThreshold(sim);
    const vis = fogEnabled(sim) && !this.revealed ? visionOf(sim, this.player) : null;
    const key = `${m.groundVersion}|${threshold}|${sim.vision?.version ?? 0}|${vis ? 1 : 0}`;
    if (!force && key === this.key && sim.tick - this.tick < TRACK_REFRESH_TICKS) return false;
    this.key = key;
    this.tick = sim.tick;
    const changed = packTracks(m.tracks, this.data, {
      W: this.W, H: this.H, threshold: Math.max(1, Math.min(BALANCE.ground.tracks.max, threshold)),
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
