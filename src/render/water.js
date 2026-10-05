// Stylised, animated water: waves, depth colour (shallow turquoise → deep blue) from the terrain height,
// shore foam, sun glint. In winter ice: motionless, clear blue with cracks and frost (easy to tell from snow). Depth comes from a small height texture (no depth buffer needed).

import * as THREE from 'three';

export class Water {
  /**
   * @param {import('./terrain.js').Terrain} terrain
   * @param {import('./quality.js').QualitySettings} quality
   */
  constructor(terrain, quality) {
    this.terrain = terrain;
    const M = terrain.M + 30;
    const W = terrain.W + 2 * M, H = terrain.H + 2 * M;
    // Height texture: terrain height relative to the water, one value per half tile
    const res = 2;
    const tw = W * res, th = H * res;
    const data = new Float32Array(tw * th);
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const wx = x / res - M + 0.25, wz = y / res - M + 0.25;
      const inside = wx >= -terrain.M && wz >= -terrain.M && wx <= terrain.W + terrain.M && wz <= terrain.H + terrain.M;
      data[y * tw + x] = inside ? terrain.heightAt(wx, wz) - terrain.waterY : -3;
    }
    const depthTex = new THREE.DataTexture(data, tw, th, THREE.RedFormat, THREE.FloatType);
    depthTex.magFilter = THREE.LinearFilter; depthTex.minFilter = THREE.LinearFilter;
    depthTex.needsUpdate = true;
    this.depthTex = depthTex;

    const seg = quality.waterDetail ? Math.min(256, Math.round(W)) : 2;
    const g = new THREE.PlaneGeometry(W, H, seg, seg);
    g.rotateX(-Math.PI / 2);
    this.uniforms = {
      uTime: { value: 0 },
      uDepth: { value: depthTex },
      uOrigin: { value: new THREE.Vector2(-M, -M) },
      uSize: { value: new THREE.Vector2(W, H) },
      uShallow: { value: new THREE.Color(0x4fd0c8) },
      uDeep: { value: new THREE.Color(0x1d5b8f) },
      uFoam: { value: new THREE.Color(0xf4fbff) },
      uIce: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.5, 0.75, 0.3).normalize() },
      uSunColor: { value: new THREE.Color(0xfff2d6) },
      uDetail: { value: quality.waterDetail ? 1 : 0 },
      uRain: { value: 0 },
    };
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.12, metalness: 0.0, transparent: true, depthWrite: false,
    });
    const u = this.uniforms;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
uniform float uTime;
uniform float uDetail;
uniform float uIce;
varying vec3 vWPos;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vec4 wp0 = modelMatrix * vec4(transformed, 1.0);
// Waves only on open water: ice stands still
transformed.y += uDetail * (1.0 - uIce) * (sin(wp0.x * 0.7 + uTime * 1.1) * 0.025 + sin(wp0.z * 0.9 - uTime * 0.8) * 0.02);`)
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
uniform float uTime, uIce, uDetail, uRain;
uniform sampler2D uDepth;
uniform vec2 uOrigin, uSize;
uniform vec3 uShallow, uDeep, uFoam, uSunDir, uSunColor;
varying vec3 vWPos;
float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1, 0)), u.x), mix(wHash(i + vec2(0, 1)), wHash(i + vec2(1, 1)), u.x), u.y);
}
// Wave height from several running noise layers
float wWave(vec2 p) {
  float t = uTime;
  return wNoise(p * 0.9 + vec2(t * 0.35, t * 0.2)) * 0.5
       + wNoise(p * 2.1 - vec2(t * 0.25, -t * 0.4)) * 0.3
       + wNoise(p * 4.7 + vec2(-t * 0.6, t * 0.5)) * 0.2;
}
float wDepthAt(vec2 xz) { return texture2D(uDepth, (xz - uOrigin) / uSize).r; }
// Ice: motionless surface (without time), slightly rippled like frozen ripples
float iWave(vec2 p) { return wNoise(p * 0.8) * 0.6 + wNoise(p * 2.3 + 7.1) * 0.4; }
// Fracture lines like ice floes: distance to the nearest cell border (Worley F2 − F1), straight edges
float iCell(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = vec2(wHash(i + g), wHash(i + g + 17.3)) * 0.8 + 0.1;
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return d2 - d1;
}`)
        .replace('#include <map_fragment>', `
float ground = wDepthAt(vWPos.xz);         // terrain height above the water (negative = depth)
float depth = max(0.0, -ground);
float shore = smoothstep(0.55, 0.0, depth);
vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 1.3, depth));
col = mix(col, uDeep * 0.75, smoothstep(2.5, 6.0, depth));
float wv = uDetail > 0.5 ? wWave(vWPos.xz * 0.6) : 0.5 + 0.25 * sin(vWPos.x * 0.9 + uTime) * sin(vWPos.z * 0.7 - uTime * 0.8);
col *= 0.92 + wv * 0.16;
// Shore foam: bands that run towards the shore
float band = uDetail > 0.5 ? sin(depth * 18.0 - uTime * 2.2 + wNoise(vWPos.xz * 1.3) * 5.0) * 0.5 + 0.5 : 0.0;
float foam = smoothstep(0.16, 0.0, depth) * 0.8 + smoothstep(0.42, 0.1, depth) * smoothstep(0.75, 0.97, band) * 0.5;
foam = uDetail > 0.5 ? foam * (0.6 + 0.4 * wNoise(vWPos.xz * 3.0 + uTime * 0.3)) : smoothstep(0.15, 0.0, depth) * 0.6;
col = mix(col, uFoam, clamp(foam, 0.0, 1.0) * (1.0 - uIce));
// Ice in winter: clear and blue, clearly darker than snow – where the ice ends one must be able to see (thaw
// drowns whoever stands on it). All without time: ice does not move. Colours linear (screen colour in the comment).
if (uIce > 0.5) {
  vec2 q = vWPos.xz;
  // Depth shines through: shallow light turquoise, deep dark blue
  vec3 ice = mix(vec3(0.15, 0.36, 0.55), vec3(0.03, 0.12, 0.30), smoothstep(0.05, 1.6, depth)); // #6ba1c4 → #30628f
  ice = mix(ice, vec3(0.015, 0.06, 0.18), smoothstep(2.0, 5.0, depth));                          // #1f4676
  // matte, frosted patches next to clear spots
  float frost = smoothstep(0.5, 0.85, wNoise(q * 0.22 + 3.7)) * 0.45 + smoothstep(0.6, 0.9, wNoise(q * 0.9)) * 0.15;
  ice = mix(ice, vec3(0.5, 0.68, 0.8), frost);                                                  // #bcd8e7
  // Cracks: white fracture lines between large floes, finer ones only in places; next to them a dark edge
  vec2 qw = q + (vec2(wNoise(q * 0.8), wNoise(q * 0.8 + 4.2)) - 0.5) * 0.6; // fracture edges slightly bent
  float big = iCell(qw * 0.3), fine = iCell(qw * 1.1 + 5.0);
  float cr = max(smoothstep(0.032, 0.0, big) * (0.55 + 0.45 * wNoise(q * 0.5 + 2.0)),
                 smoothstep(0.035, 0.0, fine) * smoothstep(0.55, 0.75, wNoise(q * 0.4 + 9.0)) * 0.55);
  float crDark = smoothstep(0.16, 0.04, big) * 0.2;
  ice = mix(ice * (1.0 - crDark), vec3(0.85, 0.93, 1.0), cr * 0.85);
  // trapped air bubbles (round, scattered, only visible up close)
  vec2 bc = fract(q * 6.0) - 0.5;
  float bub = step(0.97, wHash(floor(q * 6.0))) * smoothstep(0.22, 0.12, length(bc)) * smoothstep(0.3, 0.6, depth);
  ice = mix(ice, vec3(0.8, 0.9, 1.0), bub * 0.5);
  // light, narrow ice edge at the shoreline
  ice = mix(ice, vec3(0.62, 0.8, 0.9), smoothstep(0.12, 0.02, depth) * 0.7);
  col = ice;
}
diffuseColor.rgb = col;
diffuseColor.a = mix(mix(0.62, 0.94, smoothstep(0.0, 1.6, depth)), mix(0.86, 0.98, smoothstep(0.0, 1.2, depth)), uIce) * smoothstep(-0.02, 0.06, depth + 0.05);
`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
if (uDetail > 0.5) {
  vec2 e = vec2(0.08, 0.0);
  vec2 p = vWPos.xz * 0.6;
  // Ice: motionless, flat ripple instead of running waves
  float hx = uIce > 0.5 ? (iWave(p + e.xy) - iWave(p - e.xy)) : (wWave(p + e.xy) - wWave(p - e.xy));
  float hz = uIce > 0.5 ? (iWave(p + e.yx) - iWave(p - e.yx)) : (wWave(p + e.yx) - wWave(p - e.yx));
  float strength = uIce > 0.5 ? 0.18 : 0.55 + uRain * 0.6;
  vec3 wn = normalize(vec3(-hx * strength * 6.0, 1.0, -hz * strength * 6.0));
  normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
}`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(0.1, 0.2, uIce);`)
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
// Sun glint (in addition to the PBR gloss, stylised)
vec3 V = normalize(cameraPosition - vWPos);
vec3 Hh = normalize(normalize(uSunDir) + V);
vec3 Nw = normalize((vec4(normal, 0.0) * viewMatrix).xyz); // transposed = inverse (rotation)
// Water: sparkling light points; ice: calm, broader gloss (smooth, but not moving)
float glint = uDetail > 0.5 ? mix(pow(max(dot(Nw, Hh), 0.0), 220.0), pow(max(dot(Nw, Hh), 0.0), 60.0) * 0.35, uIce) : 0.0;
#ifdef KFOW
glint *= kFowShade; // no glitter in the fog of war
#endif
gl_FragColor.rgb += uSunColor * glint * 1.6;
gl_FragColor.a = max(gl_FragColor.a, glint);`);
    };
    mat.customProgramCacheKey = () => 'kronland-water';
    this.material = mat;
    const m = new THREE.Mesh(g, mat);
    m.position.set(terrain.W / 2, terrain.waterY, terrain.H / 2);
    m.renderOrder = 2;
    m.name = 'water';
    this.mesh = m;
  }

  /** @param {number} t seconds */
  update(t) { this.uniforms.uTime.value = t; }

  /** @param {'summer'|'winter'|'rain'} state */
  setWeather(state) {
    this.uniforms.uIce.value = state === 'winter' ? 1 : 0;
    this.uniforms.uRain.value = state === 'rain' ? 1 : 0;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.depthTex.dispose();
  }
}
