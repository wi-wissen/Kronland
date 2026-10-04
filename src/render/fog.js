// Fog of war in rendering.
//
// A data texture with one texel per tile (R = visible, G = explored), lightly blurred on the CPU
// and smoothly cross-faded on changes (fading in newly seen regions). All
// world materials (terrain, water, trees, decoration, buildings, markers) get the same small
// shader addition via onBeforeCompile: explored = darkened and desaturated, unexplored = almost black with a
// cloudy edge (noise in world coordinates). Instances (trees, decoration) in unexplored territory are
// discarded in the vertex shader so that no black outlines stick out into explored territory.
//
// The uniforms are module-wide: jointly cached materials (models) must not hold
// references to an old renderer (see docs/ARCHITEKTUR.md, disposal).

import * as THREE from 'three';
import { visionOf, fogEnabled } from '../sim/systems/vision.js';

/** Shared uniforms of all materials with fog. */
export const fowUniforms = {
  kFowTex: { value: /** @type {THREE.Texture|null} */ (null) },
  kFowSize: { value: new THREE.Vector2(1, 1) },
  kFowOn: { value: 0 },
  kFowTime: { value: 0 },
};

const patched = new WeakSet();

const PARS = `
#define KFOW 1
uniform sampler2D kFowTex;
uniform vec2 kFowSize;
uniform float kFowOn;
varying vec2 kFowXZ;`;

const VERT = `
#ifdef USE_INSTANCING
  kFowXZ = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xz;
  // do not draw trees and decoration in unexplored territory (no black outlines)
  if (kFowOn > 0.5) {
    vec2 kI = (modelMatrix * instanceMatrix[3]).xz;
    vec2 kIO = max(-kI, kI - kFowSize);
    if (texture2D(kFowTex, kI / kFowSize).g * (1.0 - smoothstep(1.5, 9.0, max(kIO.x, kIO.y))) < 0.06) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
#else
  kFowXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
#endif`;

const FRAG_PARS = `${PARS}
uniform float kFowTime;
/** Brightness factor of the fog at this point (for additions such as specular highlights) */
float kFowShade = 1.0;
float kFowHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float kFowNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(kFowHash(i), kFowHash(i + vec2(1.0, 0.0)), u.x), mix(kFowHash(i + vec2(0.0, 1.0)), kFowHash(i + vec2(1.0, 1.0)), u.x), u.y);
}`;

const FRAG = `
if (kFowOn > 0.5) {
  vec4 kF = texture2D(kFowTex, kFowXZ / kFowSize);
  // outside the map: the edge state continues only a few tiles, then darkness
  vec2 kO = max(-kFowXZ, kFowXZ - kFowSize);
  kF.rg *= 1.0 - smoothstep(1.5, 9.0, max(kO.x, kO.y));
  // slowly drifting clouds at the edge
  vec2 kP = kFowXZ * 0.32 + vec2(kFowTime * 0.045, kFowTime * 0.027);
  float kN = kFowNoise(kP) * 0.62 + kFowNoise(kP * 2.7 + 5.3) * 0.38;
  float kExp = smoothstep(0.28, 0.72, kF.g + (kN - 0.5) * 0.5);
  float kVis = smoothstep(0.22, 0.78, kF.r + (kN - 0.5) * 0.22);
  vec3 kC = gl_FragColor.rgb;
  float kL = dot(kC, vec3(0.299, 0.587, 0.114));
  // explored, not visible: darker, desaturated, slightly cool
  vec3 kDim = mix(kC, vec3(kL), 0.55) * vec3(0.5, 0.52, 0.6);
  kC = mix(kDim, kC, kVis);
  // unexplored: almost black, with a faint cloud shimmer
  vec3 kDark = vec3(0.018, 0.02, 0.028) + vec3(0.035, 0.038, 0.05) * kN * kN;
  gl_FragColor.rgb = mix(kDark, kC, kExp);
  kFowShade = kExp * mix(0.35, 1.0, kVis);
}`;

/** Insert code before the last closing brace (end of main). */
function beforeEnd(src, code) {
  const i = src.lastIndexOf('}');
  return src.slice(0, i) + code + '\n' + src.slice(i);
}

function inject(shader) {
  Object.assign(shader.uniforms, fowUniforms);
  shader.vertexShader = beforeEnd(shader.vertexShader.replace('#include <common>', `#include <common>${PARS}`), VERT);
  let f = shader.fragmentShader.replace('#include <common>', `#include <common>${FRAG_PARS}`);
  // before the distance haze: far-away unexplored regions blend into the horizon
  f = f.includes('#include <fog_fragment>') ? f.replace('#include <fog_fragment>', `${FRAG}\n#include <fog_fragment>`) : beforeEnd(f, FRAG);
  shader.fragmentShader = f;
}

/**
 * Build fog into a material (once per material; an existing onBeforeCompile is kept).
 * @param {THREE.Material} m
 */
export function patchFog(m) {
  if (!m || patched.has(m)) return;
  if (!(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshBasicMaterial)) return;
  patched.add(m);
  const prev = m.onBeforeCompile;
  // remember the key of the previous shader (default: source text of onBeforeCompile)
  const prevKey = m.customProgramCacheKey();
  m.onBeforeCompile = function (shader, renderer) {
    prev.call(this, shader, renderer);
    inject(shader);
  };
  m.customProgramCacheKey = () => `${prevKey}|kfow1`;
  m.needsUpdate = true;
}

/** Provide all materials of an object tree with fog. */
export function patchFogTree(root) {
  root?.traverse?.((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) patchFog(m);
  });
}

/** Blur 1-2-1 horizontally and vertically (per channel separately, edge clamped). */
function blur(src, tmp, W, H) {
  for (let y = 0; y < H; y++) {
    const r = y * W;
    for (let x = 0; x < W; x++) {
      const a = src[r + Math.max(0, x - 1)], b = src[r + x], c = src[r + Math.min(W - 1, x + 1)];
      tmp[r + x] = (a + 2 * b + c) * 0.25;
    }
  }
  for (let y = 0; y < H; y++) {
    const u = Math.max(0, y - 1) * W, r = y * W, d = Math.min(H - 1, y + 1) * W;
    for (let x = 0; x < W; x++) src[r + x] = (tmp[u + x] + 2 * tmp[r + x] + tmp[d + x]) * 0.25;
  }
}

/** Cross-fade speed per second: fading in faster than fading out */
const RATE_IN = 2.8, RATE_OUT = 1.4;

export class FogOfWar {
  /**
   * @param {import('../sim/sim.js').Sim} sim
   * @param {number} player point of view (human player)
   */
  constructor(sim, player) {
    this.sim = sim;
    this.player = player;
    const W = this.W = sim.map.width, H = this.H = sim.map.height;
    const n = W * H;
    this.data = new Uint8Array(n * 4);
    this.tex = new THREE.DataTexture(this.data, W, H, THREE.RGBAFormat);
    this.tex.magFilter = THREE.LinearFilter; this.tex.minFilter = THREE.LinearFilter;
    this.tex.wrapS = this.tex.wrapT = THREE.ClampToEdgeWrapping;
    this.tex.generateMipmaps = false;
    /** Target values (blurred) and displayed values per channel */
    this.tVis = new Float32Array(n); this.tExp = new Float32Array(n);
    this.cVis = new Float32Array(n); this.cExp = new Float32Array(n);
    this.tmp = new Float32Array(n);
    this.version = -1;
    this.animating = false;
    /** Rendering without fog (fog off, game over, own player eliminated) */
    this.revealed = false;
    fowUniforms.kFowTex.value = this.tex;
    fowUniforms.kFowSize.value.set(W, H);
    this.enabled = fogEnabled(sim);
    fowUniforms.kFowOn.value = this.enabled ? 1 : 0;
    if (this.enabled) { this.refresh(); this.cVis.set(this.tVis); this.cExp.set(this.tExp); this.write(); }
    else { this.data.fill(255); this.tex.needsUpdate = true; }
  }

  /** Fog active (for this rendering)? */
  get active() { return this.enabled && !this.revealed; }

  /** Show everything (game end, spectating). */
  revealAll() {
    if (this.revealed) return;
    this.revealed = true;
    fowUniforms.kFowOn.value = 0;
  }

  /** Target values from the simulation (after every recomputation of vision). */
  refresh() {
    const t = visionOf(this.sim, this.player);
    this.version = this.sim.vision.version;
    if (!t) { this.tVis.fill(1); this.tExp.fill(1); return; }
    const n = this.W * this.H, vis = t.visible, exp = t.explored;
    for (let i = 0; i < n; i++) { this.tVis[i] = vis[i]; this.tExp[i] = exp[i]; }
    blur(this.tVis, this.tmp, this.W, this.H);
    blur(this.tExp, this.tmp, this.W, this.H);
    blur(this.tExp, this.tmp, this.W, this.H);
  }

  write() {
    const d = this.data, n = this.W * this.H;
    for (let i = 0; i < n; i++) {
      d[i * 4] = this.cVis[i] * 255;
      d[i * 4 + 1] = this.cExp[i] * 255;
    }
    this.tex.needsUpdate = true;
  }

  /** Per frame: take over the new vision and cross-fade. @param {number} dt seconds */
  update(dt) {
    fowUniforms.kFowTime.value += dt;
    if (!this.active) return;
    this.team = visionOf(this.sim, this.player);
    if (this.sim.vision.version !== this.version) { this.refresh(); this.animating = true; }
    if (!this.animating) return;
    const n = this.W * this.H, up = RATE_IN * dt, down = RATE_OUT * dt;
    const tv = this.tVis, te = this.tExp, cv = this.cVis, ce = this.cExp;
    let moving = false;
    for (let i = 0; i < n; i++) {
      let d = tv[i] - cv[i];
      if (d !== 0) {
        cv[i] = d > up ? cv[i] + up : d < -down ? cv[i] - down : tv[i];
        moving = true;
      }
      d = te[i] - ce[i];
      if (d !== 0) {
        ce[i] = d > up ? ce[i] + up : d < -down ? ce[i] - down : te[i];
        moving = true;
      }
    }
    this.write();
    this.animating = moving;
  }

  /** Is the tile (world coordinates) currently visible? Always without fog. */
  visibleAt(x, z) {
    if (!this.active) return true;
    const t = this.team ?? visionOf(this.sim, this.player);
    const i = Math.floor(x), j = Math.floor(z);
    if (!t || i < 0 || j < 0 || i >= this.W || j >= this.H) return !t;
    return t.visible[j * this.W + i] === 1;
  }

  /** Is the tile explored? Always without fog. */
  exploredAt(x, z) {
    if (!this.active) return true;
    const t = this.team ?? visionOf(this.sim, this.player);
    const i = Math.floor(x), j = Math.floor(z);
    if (!t) return true;
    if (i < 0 || j < 0 || i >= this.W || j >= this.H) return false;
    return t.explored[j * this.W + i] === 1;
  }

  /** Is any tile of the rectangle visible? */
  rectVisible(x, y, w, h) {
    if (!this.active) return true;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.visibleAt(i, j)) return true;
    return false;
  }

  /** Is any tile of the rectangle explored? */
  rectExplored(x, y, w, h) {
    if (!this.active) return true;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.exploredAt(i, j)) return true;
    return false;
  }

  dispose() {
    this.tex.dispose();
    if (fowUniforms.kFowTex.value === this.tex) { fowUniforms.kFowTex.value = null; fowUniforms.kFowOn.value = 0; }
  }
}
