// Snow cover on buildings in winter: surfaces facing up (roofs, wall tops, scaffolding boards) turn white, walls stay
// free. Shader addition on a copy of the material (the shared model materials are also used by things that must not
// get snow: resource piles, figures). One shared uniform (`snowUniforms.uBldSnow`, 0…1) lets the snow settle and
// thaw; charred buildings lose it (`userData.snowMelt`, set by the renderer), the player colour stays free.

import * as THREE from 'three';

/** Amount of snow on all buildings, 0 (none) … 1 (winter). */
export const snowUniforms = { uBldSnow: { value: 0 } };

/** Seconds until the snow has settled or thawed after a change of weather. */
export const SNOW_SETTLE_S = 5;

const mats = new WeakMap();
const snowy = new WeakSet();
/** Copies of the materials with snow (for Renderer.dispose). */
export const snowMaterials = [];

const PARS = '\nvarying vec3 vSnowP; varying vec3 vSnowN;';
const VERT = `
vSnowP = (modelMatrix * vec4(transformed, 1.0)).xyz;
{
  // normal to world space; divided by the squared scale so that squashed models (house growing on the site) keep their slope
  mat3 sm = mat3(modelMatrix);
  vSnowN = sm * (objectNormal / max(vec3(dot(sm[0], sm[0]), dot(sm[1], sm[1]), dot(sm[2], sm[2])), 1e-6));
}`;
const FRAG_PARS = `
uniform float uBldSnow; uniform float uSnowMelt;
varying vec3 vSnowP; varying vec3 vSnowN;
float kSnowHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float kSnowNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(kSnowHash(i), kSnowHash(i + vec2(1.0, 0.0)), f.x), mix(kSnowHash(i + vec2(0.0, 1.0)), kSnowHash(i + vec2(1.0, 1.0)), f.x), f.y);
}`;
/** @param {boolean} team material with player colour (models.js teamMaterial sets kTeamW) */
const frag = (team) => `
if (uBldSnow > 0.001) {
  float up = normalize(vSnowN).y;
  // ragged edge: coarse and fine patches in world space
  float n = kSnowNoise(vSnowP.xz * 3.1 + vSnowP.y * 1.7) * 0.65 + kSnowNoise(vSnowP.xz * 9.7 - vSnowP.y * 4.3) * 0.35;
  // settles on the flattest spots first
  float k = smoothstep(0.38, 0.62, up + (n - 0.5) * 0.4 - (1.0 - uBldSnow) * 0.9);
  k *= (1.0 - uSnowMelt)${team ? ' * (1.0 - kTeamW)' : ''};
  // thinner on slopes: tiles and thatch still show through
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.96, 1.0), k * mix(0.8, 0.95, smoothstep(0.7, 0.95, up)));
}`;

/** Add the snow to a compiled shader (exported for tests). */
export function injectSnow(shader, material) {
  shader.uniforms.uBldSnow = snowUniforms.uBldSnow;
  shader.uniforms.uSnowMelt = (material.userData.snowMelt ??= { value: 0 });
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>${PARS}`)
    .replace('#include <project_vertex>', `#include <project_vertex>${VERT}`);
  // after map, vertex colour and player colour, before lighting
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>${FRAG_PARS}`)
    .replace('#include <alphatest_fragment>', `${frag(shader.fragmentShader.includes('kTeamW'))}\n#include <alphatest_fragment>`);
}

/**
 * Material with snow cover (cached per source material), or the original where snow is not possible.
 * @param {THREE.Material} src
 */
export function snowMaterial(src) {
  if (!src || snowy.has(src)) return src;
  if (!(src.isMeshStandardMaterial || src.isMeshLambertMaterial || src.isMeshPhongMaterial)) return src;
  if (mats.has(src)) return mats.get(src);
  const m = src.clone();
  const prev = src.onBeforeCompile;
  const prevKey = src.customProgramCacheKey();
  // `this`: also copies of this material (damage, fading ruins) get their own melt value
  m.onBeforeCompile = function (s, r) {
    prev.call(this, s, r);
    injectSnow(s, this);
  };
  m.customProgramCacheKey = () => `${prevKey}|ksnow1`;
  mats.set(src, m);
  snowy.add(m);
  snowMaterials.push(m);
  return m;
}

/** Replace all materials of an object with the snowy ones (geometry stays shared). */
export function snowObject(obj) {
  obj?.traverse?.((o) => {
    if (!o.isMesh || o.userData.noSnow) return;
    o.material = Array.isArray(o.material) ? o.material.map(snowMaterial) : snowMaterial(o.material);
  });
  return obj;
}

/** Let a copy of a snowy material lose its snow (0 = full snow … 1 = none), e.g. charred buildings. */
export function setSnowMelt(material, melt) {
  (material.userData.snowMelt ??= { value: 0 }).value = THREE.MathUtils.clamp(melt, 0, 1);
}

/**
 * Next amount of snow on the way to the target (linear, SNOW_SETTLE_S for the whole way).
 * @param {number} value @param {number} target @param {number} dt seconds
 */
export function settleSnow(value, target, dt) {
  const step = dt / SNOW_SETTLE_S;
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}
