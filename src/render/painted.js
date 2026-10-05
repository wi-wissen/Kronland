// Painted wood and stone texture for models without their own texture in the new style (scaffolding, construction phases, rubble from the
// KayKit pack): planks and masonry from public/textures/nature/ (scripts/asset-gen/ground.mjs, kinds planks,
// masonry), triplanar in world space (comparison without: ?nature=off). Wood tones (warm) get planks, greys masonry; the hue stays that of the
// model (bluish stones turn warm grey – blue is the player colour), the texture only brightens or darkens. At graphics level "low" or without images: unchanged.

import * as THREE from 'three';
import { natureDetailTexture } from './naturetex.js';
import { getQuality } from './quality.js';

/** Repetition per world unit (tile): planks about 0.25 wide, stone blocks about 0.3 high. */
export const PAINT_SCALE = { planks: 0.9, masonry: 0.75 };

const mats = new WeakMap();
/** Copies of the materials with texture (for Renderer.dispose). */
export const paintedMaterials = [];

/**
 * Material with painted wood/stone texture (cached per source material), or the original.
 * @param {THREE.Material} src
 */
export function paintedMaterial(src) {
  if (!src || !('color' in src)) return src;
  if (mats.has(src)) return mats.get(src);
  const q = getQuality();
  const off = typeof location !== 'undefined' && new URLSearchParams(location.search).get('nature') === 'off';
  const tex = q.tier === 'low' || off ? null : natureDetailTexture([{ kind: 'planks' }, { kind: 'masonry' }], q.anisotropy);
  if (!tex) { mats.set(src, src); return src; }
  const m = src.clone();
  const prev = src.onBeforeCompile;
  m.onBeforeCompile = (s, r) => {
    prev?.call(src, s, r);
    s.uniforms.uPaint = { value: tex };
    s.uniforms.uPaintS = { value: new THREE.Vector2(PAINT_SCALE.planks, PAINT_SCALE.masonry) };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPWorld; varying vec3 vPNormal;')
      .replace('#include <project_vertex>', `#include <project_vertex>
vPWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vPNormal = normalize(mat3(modelMatrix) * objectNormal);`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uPaint; uniform vec2 uPaintS; varying vec3 vPWorld; varying vec3 vPNormal;')
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  vec3 bw = pow(abs(vPNormal), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
  vec2 pX = texture2D(uPaint, vPWorld.zy * uPaintS.x).rg, pY = texture2D(uPaint, vPWorld.xz * uPaintS.x).rg, pZ = texture2D(uPaint, vPWorld.xy * uPaintS.x).rg;
  vec2 mX = texture2D(uPaint, vPWorld.zy * uPaintS.y).rg, mY = texture2D(uPaint, vPWorld.xz * uPaintS.y).rg, mZ = texture2D(uPaint, vPWorld.xy * uPaintS.y).rg;
  float planks = pX.r * bw.x + pY.r * bw.y + pZ.r * bw.z;
  float stone = mX.g * bw.x + mY.g * bw.y + mZ.g * bw.z;
  vec3 c = diffuseColor.rgb;
  float warm = smoothstep(0.02, 0.10, c.r - c.b);
  // bluish KayKit stones (blue is the player colour) to warm grey
  float cool = smoothstep(0.02, 0.10, c.b - c.r);
  diffuseColor.rgb = mix(c, vec3(dot(c, vec3(0.299, 0.587, 0.114))) * vec3(1.06, 1.0, 0.92), cool);
  float t = mix(stone, planks, warm);
  diffuseColor.rgb *= clamp(1.0 + (t - 0.5) * 3.2, 0.35, 1.7);
}`);
  };
  m.customProgramCacheKey = () => `${src.customProgramCacheKey?.() ?? ''}-painted`;
  mats.set(src, m);
  paintedMaterials.push(m);
  return m;
}

/** Replace all materials of an object with the painted ones (geometry stays shared). */
export function paintObject(obj) {
  obj?.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(paintedMaterial) : paintedMaterial(o.material);
  });
  return obj;
}
