// Effects and displays: particles (dust, smoke, fire, sparks, trails), health bars and selection rings.
// All instanced: one draw call per particle kind or display kind, independent of the count.

import * as THREE from 'three';

// ---------- Particles ----------

/** Soft cloud texture (several Gaussian blobs), created once. */
let puffTex = null;
/** Shared smoke texture (for Renderer.dispose). */
export const sharedPuffTexture = () => puffTex;
function puffTexture() {
  if (puffTex) return puffTex;
  const S = 64, data = new Uint8Array(S * S * 4);
  const blobs = [[0.5, 0.5, 0.34, 1], [0.36, 0.42, 0.2, 0.7], [0.63, 0.4, 0.2, 0.7], [0.45, 0.63, 0.22, 0.75], [0.62, 0.62, 0.18, 0.6]];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x + 0.5) / S, v = (y + 0.5) / S;
    let a = 0;
    for (const [bx, by, r, w] of blobs) { const d2 = ((u - bx) ** 2 + (v - by) ** 2) / (r * r); a += w * Math.exp(-d2 * 2.2); }
    const edge = Math.max(0, 1 - Math.hypot(u - 0.5, v - 0.5) * 2);
    a = Math.min(1, a) * Math.min(1, edge * 2.5);
    const k = (y * S + x) * 4;
    data[k] = data[k + 1] = data[k + 2] = 255; data[k + 3] = Math.round(a * 255);
  }
  puffTex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  puffTex.magFilter = THREE.LinearFilter; puffTex.minFilter = THREE.LinearMipmapLinearFilter;
  puffTex.generateMipmaps = true;
  puffTex.needsUpdate = true;
  return puffTex;
}

/**
 * Billboard particles with a limited count (ring buffer).
 * Each particle: position, velocity, size (growing), colour, opacity, lifetime, rotation.
 */
export class Particles {
  /**
   * @param {THREE.Scene} scene
   * @param {{ max: number, additive?: boolean, name?: string, soft?: boolean }} opts
   */
  constructor(scene, opts) {
    this.max = opts.max;
    const quad = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute('position', quad.attributes.position);
    g.setAttribute('uv', quad.attributes.uv);
    const n = this.max;
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage); // xyz + size
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage); // rgb + opacity
    this.aRot = new THREE.InstancedBufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos); g.setAttribute('iCol', this.aCol); g.setAttribute('iRot', this.aRot);
    g.instanceCount = 0;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const additive = !!opts.additive;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: puffTexture() } },
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: /* glsl */`
attribute vec4 iPos; attribute vec4 iCol; attribute float iRot;
varying vec2 vUv; varying vec4 vCol;
void main() {
  vUv = uv; vCol = iCol;
  vec4 mv = modelViewMatrix * vec4(iPos.xyz, 1.0);
  float c = cos(iRot), s = sin(iRot);
  vec2 p = mat2(c, s, -s, c) * position.xy;
  mv.xy += p * iPos.w;
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: /* glsl */`
uniform sampler2D uTex; varying vec2 vUv; varying vec4 vCol;
void main() {
  float a = texture2D(uTex, vUv).a * vCol.a;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vCol.rgb${additive ? ' * a' : ''}, a);
  #include <colorspace_fragment>
}`,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 6 : 5;
    this.mesh.name = opts.name ?? 'particles';
    scene.add(this.mesh);
    this.geo = g;
    /** Particles as flat fields (structure of arrays) */
    this.px = new Float32Array(n); this.py = new Float32Array(n); this.pz = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n); this.vz = new Float32Array(n);
    this.size = new Float32Array(n); this.grow = new Float32Array(n);
    this.age = new Float32Array(n); this.life = new Float32Array(n);
    this.r = new Float32Array(n); this.g = new Float32Array(n); this.b = new Float32Array(n);
    this.r2 = new Float32Array(n); this.g2 = new Float32Array(n); this.b2 = new Float32Array(n);
    this.alpha = new Float32Array(n); this.rot = new Float32Array(n); this.spin = new Float32Array(n);
    this.drag = new Float32Array(n); this.lift = new Float32Array(n);
    this.alive = 0;
    this.next = 0;
    this.color = new THREE.Color();
  }

  /**
   * @param {{ x:number, y:number, z:number, vx?:number, vy?:number, vz?:number, size:number, grow?:number, life:number,
   *   color:number, color2?:number, alpha?:number, spin?:number, drag?:number, lift?:number }} p
   */
  emit(p) {
    // look for a free slot, otherwise overwrite the oldest
    let i = -1;
    if (this.alive < this.max) { i = this.alive++; } else { i = this.next; this.next = (this.next + 1) % this.max; }
    this.px[i] = p.x; this.py[i] = p.y; this.pz[i] = p.z;
    this.vx[i] = p.vx ?? 0; this.vy[i] = p.vy ?? 0; this.vz[i] = p.vz ?? 0;
    this.size[i] = p.size; this.grow[i] = p.grow ?? 0;
    this.age[i] = 0; this.life[i] = p.life;
    this.color.setHex(p.color);
    this.r[i] = this.color.r; this.g[i] = this.color.g; this.b[i] = this.color.b;
    this.color.setHex(p.color2 ?? p.color);
    this.r2[i] = this.color.r; this.g2[i] = this.color.g; this.b2[i] = this.color.b;
    this.alpha[i] = p.alpha ?? 1; this.rot[i] = Math.random() * 6.283; this.spin[i] = p.spin ?? (Math.random() - 0.5) * 1.2;
    this.drag[i] = p.drag ?? 0.8; this.lift[i] = p.lift ?? 0;
  }

  /** @param {number} dt */
  update(dt) {
    let n = this.alive;
    const P = this.aPos.array, C = this.aCol.array, R = this.aRot.array;
    for (let i = 0; i < n; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        // move the last living particle here
        n--;
        if (i !== n) this.move(n, i);
        i--;
        continue;
      }
      const k = Math.exp(-this.drag[i] * dt);
      this.vx[i] *= k; this.vz[i] *= k; this.vy[i] = this.vy[i] * k + this.lift[i] * dt;
      this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
      this.rot[i] += this.spin[i] * dt;
      const t = this.age[i] / this.life[i];
      const s = this.size[i] + this.grow[i] * this.age[i];
      P[i * 4] = this.px[i]; P[i * 4 + 1] = this.py[i]; P[i * 4 + 2] = this.pz[i]; P[i * 4 + 3] = s;
      // fade in, then fade out
      const a = this.alpha[i] * Math.min(1, t * 8) * (1 - t) * (1 - t * 0.3);
      C[i * 4] = this.r[i] + (this.r2[i] - this.r[i]) * t;
      C[i * 4 + 1] = this.g[i] + (this.g2[i] - this.g[i]) * t;
      C[i * 4 + 2] = this.b[i] + (this.b2[i] - this.b[i]) * t;
      C[i * 4 + 3] = a;
      R[i] = this.rot[i];
    }
    this.alive = n;
    if (this.next >= n) this.next = 0;
    this.geo.instanceCount = n;
    this.mesh.visible = n > 0;
    for (const a of [this.aPos, this.aCol, this.aRot]) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, n) * a.itemSize); a.needsUpdate = true; }
  }

  move(from, to) {
    for (const f of [this.px, this.py, this.pz, this.vx, this.vy, this.vz, this.size, this.grow, this.age, this.life,
      this.r, this.g, this.b, this.r2, this.g2, this.b2, this.alpha, this.rot, this.spin, this.drag, this.lift]) f[to] = f[from];
  }
}

/** Random in the range ±a. */
const jit = (a) => (Math.random() - 0.5) * 2 * a;

/**
 * Collection of the particle kinds with ready-made effects.
 */
export class Effects {
  /** @param {THREE.Scene} scene @param {import('./quality.js').QualitySettings} quality */
  constructor(scene, quality) {
    const k = quality.tier === 'low' ? 0.4 : quality.tier === 'medium' ? 0.7 : 1;
    this.density = k;
    this.smoke = new Particles(scene, { max: Math.round(2400 * k), name: 'fx-smoke' });
    this.fire = new Particles(scene, { max: Math.round(900 * k), additive: true, name: 'fx-fire' });
    // Flame tongues: opaque (barely visible on bright roofs otherwise), additive glow on top
    this.flames = new Particles(scene, { max: Math.round(700 * k), name: 'fx-flames' });
  }

  update(dt) { this.smoke.update(dt); this.fire.update(dt); this.flames.update(dt); }

  /** Probability by density of the graphics level. */
  chance(p) { return Math.random() < p * this.density; }

  /** Dust cloud (building, arrival). */
  dust(x, y, z, n = 4, size = 0.35, color = 0xc9b48e) {
    n = Math.max(1, Math.round(n * this.density));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, sp = 0.4 + Math.random() * 0.8;
      this.smoke.emit({ x: x + jit(0.3), y: y + 0.1 + Math.random() * 0.2, z: z + jit(0.3), vx: Math.cos(a) * sp, vy: 0.3 + Math.random() * 0.5, vz: Math.sin(a) * sp, size: size * (0.7 + Math.random() * 0.6), grow: size * 1.2, life: 0.9 + Math.random() * 0.6, color, color2: 0xe6dcc6, alpha: 0.75, drag: 2.2 });
    }
  }

  /** Large dust ring (construction finished, building destroyed). */
  poof(x, y, z, radius = 1.6, color = 0xf2ecdc, n = 22) {
    n = Math.max(6, Math.round(n * this.density));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + jit(0.2), sp = 2.2 + Math.random() * 1.6;
      this.smoke.emit({ x: x + Math.cos(a) * radius * 0.6, y: y + 0.15 + Math.random() * 0.3, z: z + Math.sin(a) * radius * 0.6, vx: Math.cos(a) * sp, vy: 0.4 + Math.random() * 0.8, vz: Math.sin(a) * sp, size: 0.55 + Math.random() * 0.35, grow: 0.9, life: 1.2 + Math.random() * 0.6, color, color2: 0xfffaf0, alpha: 0.9, drag: 2.8 });
    }
    // sparkle
    for (let i = 0; i < Math.round(10 * this.density); i++) {
      this.fire.emit({ x: x + jit(radius * 0.7), y: y + 0.4 + Math.random() * 1.2, z: z + jit(radius * 0.7), vy: 0.6 + Math.random(), size: 0.12, grow: -0.05, life: 0.7 + Math.random() * 0.5, color: 0xfff1b0, color2: 0xffc860, alpha: 0.9, drag: 1 });
    }
  }

  /** Smoke plume (chimney, damage). dark 0…1 */
  smokePuff(x, y, z, dark = 0, size = 0.28) {
    const c = dark > 0.5 ? 0x3a3734 : dark > 0 ? 0x7a7570 : 0xe2e0dc;
    this.smoke.emit({ x: x + jit(0.06), y, z: z + jit(0.06), vx: 0.22 + jit(0.1), vy: 0.6 + Math.random() * 0.3, vz: 0.1 + jit(0.1), size, grow: 0.5 + dark * 0.45, life: 2.6 + Math.random() * 1.4 + dark, color: c, color2: dark ? 0x75716c : 0xf4f4f4, alpha: dark ? 0.82 : 0.62, drag: 0.35, lift: 0.08 });
  }

  /** Flame (burning buildings): bright core, plus an occasional spark. */
  flame(x, y, z, size = 0.32) {
    const s = size * (0.75 + Math.random() * 0.6);
    this.flames.emit({ x: x + jit(0.15), y, z: z + jit(0.15), vx: jit(0.2), vy: 1.0 + Math.random() * 0.7, vz: jit(0.2), size: s, grow: -s * 0.8, life: 0.5 + Math.random() * 0.35, color: 0xffb030, color2: 0xc02a10, alpha: 0.95, drag: 1.1, spin: jit(2) });
    this.fire.emit({ x: x + jit(0.1), y: y + 0.1, z: z + jit(0.1), vx: jit(0.15), vy: 1.1 + Math.random() * 0.6, vz: jit(0.15), size: s * 0.7, grow: -s * 0.5, life: 0.4 + Math.random() * 0.3, color: 0xfff6c0, color2: 0xff8a30, alpha: 0.9, drag: 1.1 });
    if (Math.random() < 0.25) this.fire.emit({ x, y: y + 0.3, z, vx: jit(0.5), vy: 1.6 + Math.random(), vz: jit(0.5), size: 0.06, grow: -0.03, life: 0.9 + Math.random() * 0.6, color: 0xffe080, color2: 0xff7020, alpha: 1, drag: 0.6 });
  }

  /** Explosion (cannonball, bomb). */
  explosion(x, y, z) {
    for (let i = 0; i < Math.round(18 * this.density) + 4; i++) {
      const a = Math.random() * 6.283, sp = 1.5 + Math.random() * 2.5;
      this.fire.emit({ x, y: y + 0.2, z, vx: Math.cos(a) * sp, vy: 1 + Math.random() * 2.5, vz: Math.sin(a) * sp, size: 0.45, grow: -0.4, life: 0.35 + Math.random() * 0.3, color: 0xfff0a0, color2: 0xe0501a, alpha: 1, drag: 3 });
    }
    for (let i = 0; i < Math.round(14 * this.density) + 3; i++) {
      const a = Math.random() * 6.283, sp = 0.8 + Math.random() * 1.6;
      this.smoke.emit({ x, y: y + 0.2, z, vx: Math.cos(a) * sp, vy: 0.6 + Math.random() * 1.2, vz: Math.sin(a) * sp, size: 0.5, grow: 0.9, life: 1.4 + Math.random() * 0.8, color: 0x3e3a36, color2: 0x8c8884, alpha: 0.8, drag: 1.8, lift: 0.1 });
    }
  }

  /** Sparks on a melee hit. */
  sparks(x, y, z) {
    for (let i = 0; i < 3; i++) this.fire.emit({ x, y, z, vx: jit(1.5), vy: 0.8 + Math.random() * 1.2, vz: jit(1.5), size: 0.07, grow: -0.05, life: 0.25 + Math.random() * 0.15, color: 0xfff4c0, color2: 0xffa040, alpha: 1, drag: 2 });
  }

  /** Trail behind a projectile. */
  trail(x, y, z, kind) {
    if (kind === 'ball') this.smoke.emit({ x, y, z, size: 0.14, grow: 0.35, life: 0.7, color: 0x77726c, color2: 0xb8b4ae, alpha: 0.6, drag: 1.5, lift: 0.1 });
    else this.fire.emit({ x, y, z, size: kind === 'bolt' ? 0.11 : 0.08, grow: -0.1, life: 0.22, color: 0xfff6d8, color2: 0xa09a90, alpha: 0.55, drag: 0 });
  }

  /** Hoof dust. */
  hoofDust(x, y, z) {
    this.smoke.emit({ x: x + jit(0.15), y: y + 0.05, z: z + jit(0.15), vx: jit(0.3), vy: 0.25 + Math.random() * 0.2, vz: jit(0.3), size: 0.16, grow: 0.5, life: 0.8 + Math.random() * 0.3, color: 0xb59c74, color2: 0xd8ccb2, alpha: 0.55, drag: 1.6 });
  }
}

// ---------- Displays: health bars and rings ----------

/**
 * Health bars at fixed screen size (pixels), always facing the camera, with border and colour by fill level.
 * One draw call for all bars.
 */
export class HealthBars {
  constructor(scene, max = 512) {
    const quad = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute('position', quad.attributes.position);
    g.setAttribute('uv', quad.attributes.uv);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage); // xyz + fill
    this.aSize = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage); // width, height px, kind (0 health, 1 construction progress)
    g.setAttribute('iPos', this.aPos); g.setAttribute('iSize', this.aSize);
    g.instanceCount = 0;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.uniforms = { uViewport: { value: new THREE.Vector2(1280, 800) }, uPixelRatio: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: /* glsl */`
attribute vec4 iPos; attribute vec3 iSize;
uniform vec2 uViewport; uniform float uPixelRatio;
varying vec2 vUv; varying float vFrac; varying vec2 vPx; varying float vKind;
void main() {
  vUv = uv; vFrac = iPos.w; vPx = iSize.xy * uPixelRatio; vKind = iSize.z;
  vec4 c = projectionMatrix * modelViewMatrix * vec4(iPos.xyz, 1.0);
  // snap to whole pixels: sharp edges
  vec2 ndc = c.xy / c.w;
  vec2 px = floor((ndc * 0.5 + 0.5) * uViewport) + 0.5 * mod(vPx, 2.0);
  px += position.xy * vPx;
  c.xy = ((px / uViewport) * 2.0 - 1.0) * c.w;
  gl_Position = c;
}`,
      fragmentShader: /* glsl */`
varying vec2 vUv; varying float vFrac; varying vec2 vPx; varying float vKind;
void main() {
  vec2 p = vUv * vPx;
  float border = 1.0;
  bool edge = p.x < border || p.y < border || p.x > vPx.x - border || p.y > vPx.y - border;
  vec3 col;
  if (edge) col = vec3(0.06, 0.05, 0.04);
  else {
    float x = (p.x - border) / (vPx.x - 2.0 * border);
    // construction progress uniformly blue, health by state green/yellow/red
    vec3 full = vKind > 0.5 ? vec3(0.4, 0.68, 0.96) : vFrac > 0.5 ? vec3(0.36, 0.82, 0.38) : vFrac > 0.25 ? vec3(0.95, 0.7, 0.2) : vec3(0.92, 0.3, 0.26);
    float shade = 0.82 + 0.18 * step(0.5, vUv.y);
    col = x <= vFrac ? full * shade : vec3(0.16, 0.14, 0.12);
  }
  gl_FragColor = vec4(col, 0.95);
  #include <colorspace_fragment>
}`,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    this.mesh.name = 'health-bars';
    scene.add(this.mesh);
    this.geo = g;
    this.max = max;
    this.n = 0;
  }
  begin() { this.n = 0; }
  /** @param {number} x @param {number} y @param {number} z @param {number} frac 0…1 @param {number} [w] width px @param {number} [h] height px @param {number} [kind] 0 health, 1 construction progress */
  add(x, y, z, frac, w = 34, h = 6, kind = 0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.aPos.setXYZW(i, x, y, z, Math.max(0, Math.min(1, frac)));
    this.aSize.setXYZ(i, w, h, kind);
  }
  end(viewport, pixelRatio) {
    this.uniforms.uViewport.value.set(viewport.w * pixelRatio, viewport.h * pixelRatio);
    this.uniforms.uPixelRatio.value = pixelRatio;
    this.geo.instanceCount = this.n;
    this.mesh.visible = this.n > 0;
    for (const a of [this.aPos, this.aSize]) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, this.n) * a.itemSize); a.needsUpdate = true; }
  }
}

/**
 * Ground markings: rings (units) and rectangle frames (buildings) with an edge-smooth line (fwidth),
 * lie just above the ground, tilted accordingly on slopes. One draw call.
 */
export class GroundMarks {
  constructor(scene, max = 512) {
    const quad = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute('position', quad.attributes.position);
    g.setAttribute('uv', quad.attributes.uv);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage); // xyz + shape (0 ring, 1 rectangle)
    this.aSize = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage); // width, depth, line width, fill
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    // Slope (dy/dx, dy/dz): rings lie tilted on the terrain on a slope instead of horizontal
    this.aTilt = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos); g.setAttribute('iSize', this.aSize); g.setAttribute('iCol', this.aCol); g.setAttribute('iTilt', this.aTilt);
    g.instanceCount = 0;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.uniforms = { uTime: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      extensions: { derivatives: true },
      vertexShader: /* glsl */`
attribute vec4 iPos; attribute vec4 iSize; attribute vec4 iCol; attribute vec2 iTilt;
varying vec2 vP; varying vec4 vSize; varying vec4 vCol; varying float vShape;
void main() {
  vSize = iSize; vCol = iCol; vShape = iPos.w;
  vec3 p = position * vec3(iSize.x, 1.0, iSize.y);
  vP = p.xz;
  p.y += dot(iTilt, p.xz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(iPos.xyz + p, 1.0);
}`,
      fragmentShader: /* glsl */`
uniform float uTime;
varying vec2 vP; varying vec4 vSize; varying vec4 vCol; varying float vShape;
void main() {
  float d;
  vec2 half_ = vSize.xy * 0.5;
  if (vShape < 0.5) {
    d = abs(length(vP) - (half_.x - vSize.z));
  } else {
    vec2 q = abs(vP) - (half_ - vSize.z - 0.12);
    float box = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.12;
    d = abs(box);
  }
  float w = fwidth(d) * 1.2;
  float line = 1.0 - smoothstep(vSize.z * 0.5 - w, vSize.z * 0.5 + w, d);
  // slight shimmer inside (fill) for rings
  float fill = 0.0;
  if (vShape < 0.5) fill = vSize.w * (1.0 - smoothstep(0.0, half_.x - vSize.z, length(vP))) * 0.35;
  float a = max(line, fill) * vCol.a;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vCol.rgb, a);
  #include <colorspace_fragment>
}`,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.name = 'ground-marks';
    scene.add(this.mesh);
    this.geo = g;
    this.max = max;
    this.n = 0;
    this.c = new THREE.Color();
  }
  begin() { this.n = 0; }
  /** @param {number} [sx] slope in x direction @param {number} [sz] slope in z direction */
  ring(x, y, z, r, color, alpha = 1, line = 0.06, fill = 0, sx = 0, sz = 0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.aTilt.setXY(i, sx, sz);
    this.c.setHex(color);
    this.aPos.setXYZW(i, x, y, z, 0);
    this.aSize.setXYZW(i, r * 2, r * 2, line, fill);
    this.aCol.setXYZW(i, this.c.r, this.c.g, this.c.b, alpha);
  }
  rect(x, y, z, w, d, color, alpha = 1, line = 0.08) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.c.setHex(color);
    this.aTilt.setXY(i, 0, 0);
    this.aPos.setXYZW(i, x, y, z, 1);
    this.aSize.setXYZW(i, w, d, line, 0);
    this.aCol.setXYZW(i, this.c.r, this.c.g, this.c.b, alpha);
  }
  end() {
    this.geo.instanceCount = this.n;
    this.mesh.visible = this.n > 0;
    for (const a of [this.aPos, this.aSize, this.aCol, this.aTilt]) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, this.n) * a.itemSize); a.needsUpdate = true; }
  }
}
