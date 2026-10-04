// Graphics levels: 'low' | 'medium' | 'high'.
// Chosen automatically (phone/small screen → low, weak or software GPU → medium, otherwise high),
// overridable via URL (?quality=low|medium|high) and via setQuality() for a settings menu.
// An explicit choice is remembered in localStorage.

/** @typedef {'low'|'medium'|'high'} QualityTier */

const KEY = 'kronland.quality';
const URL_NAMES = { low: 'low', medium: 'medium', high: 'high' };

/** German labels for a settings menu. */
export const QUALITY_LABELS = { low: 'Niedrig', medium: 'Mittel', high: 'Hoch' };

/**
 * Settings per level.
 * @typedef {Object} QualitySettings
 * @property {QualityTier} tier
 * @property {number} maxPixelRatio
 * @property {boolean} antialias
 * @property {number} shadowMapSize
 * @property {number} shadowRadius soft shadow edge (PCF radius)
 * @property {number} textureSize edge length of the terrain textures
 * @property {number} terrainDetail subdivisions per tile in the terrain mesh
 * @property {number} scatter density of the decoration (grass, flowers, bushes, pebbles), 0…1
 * @property {boolean} treeDetail elaborate tree models (more faces)
 * @property {boolean} waterDetail foam, specular highlight and wave normals on the water
 * @property {boolean} terrainBump fine surface texture from the textures
 * @property {number} anisotropy
 * @property {number} margin tiles of border terrain outside the map
 * @property {'models'|'procedural'} characterModels figures from GLB models or procedural (both instanced)
 * @property {boolean} [shadows] shadows (default: on)
 * @property {boolean} [software] software rasterizer detected
 */

/** @type {Record<QualityTier, QualitySettings>} */
export const QUALITY_PRESETS = {
  low: {
    tier: 'low', maxPixelRatio: 1.25, antialias: false, shadowMapSize: 1024, shadowRadius: 1,
    textureSize: 256, terrainDetail: 1, scatter: 0.25, treeDetail: false, waterDetail: false, terrainBump: false, anisotropy: 1, margin: 12, characterModels: 'models',
  },
  medium: {
    tier: 'medium', maxPixelRatio: 1.5, antialias: true, shadowMapSize: 2048, shadowRadius: 2,
    textureSize: 512, terrainDetail: 2, scatter: 0.6, treeDetail: true, waterDetail: true, terrainBump: true, anisotropy: 4, margin: 18, characterModels: 'models',
  },
  high: {
    tier: 'high', maxPixelRatio: 2, antialias: true, shadowMapSize: 4096, shadowRadius: 3,
    textureSize: 1024, terrainDetail: 2, scatter: 1, treeDetail: true, waterDetail: true, terrainBump: true, anisotropy: 8, margin: 24, characterModels: 'models',
  },
};

function readStored() {
  try { return globalThis.localStorage?.getItem(KEY) ?? null; } catch { return null; }
}

function store(tier) {
  try { globalThis.localStorage?.setItem(KEY, tier); } catch { /* private mode or similar */ }
}

/** @type {string|null} */
let gpuName = null;
/** Name of the GPU (empty if the browser does not reveal it). */
export function gpuRenderer() {
  if (gpuName !== null) return gpuName;
  gpuName = '';
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    gpuName = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { /* without it the screen size applies */ }
  return gpuName;
}

/** Is WebGL running without a real graphics card (software rasterizer)? */
export const isSoftwareGpu = () => /swiftshader|llvmpipe|softpipe|software/i.test(gpuRenderer());

/** Automatic choice from screen, input device and GPU. @returns {QualityTier} */
export function detectQuality() {
  const w = globalThis.innerWidth ?? 1280, h = globalThis.innerHeight ?? 800;
  const coarse = globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;
  if (coarse || Math.min(w, h) < 700) return 'low';
  const gpu = gpuRenderer();
  if (isSoftwareGpu()) return 'low'; // without a real GPU
  if (/mali-[gt]?[1-7]\d\b|adreno \(tm\) [1-5]\d\d/i.test(gpu)) return 'medium';
  if (/intel.*(hd|uhd) graphics [1-6]\d\d\b/i.test(gpu) && w * h < 1600 * 900) return 'medium';
  return w >= 1100 ? 'high' : 'medium';
}

/** @type {QualityTier|null} */
let current = null;

/** Current level (URL > saved choice > automatic). @returns {QualityTier} */
export function getQualityTier() {
  if (current) return current;
  let fromUrl = null;
  try { fromUrl = URL_NAMES[new URLSearchParams(globalThis.location?.search ?? '').get('quality') ?? '']; } catch { /* no URL */ }
  if (fromUrl) { current = fromUrl; store(fromUrl); return current; }
  const saved = readStored();
  current = saved && QUALITY_PRESETS[saved] ? /** @type {QualityTier} */ (saved) : detectQuality();
  return current;
}

/**
 * Settings of the current level. Without a real GPU (software rasterizer) the low level is
 * relieved further: lower resolution, no shadows, hardly any decoration – otherwise the game is unplayable there.
 * @returns {QualitySettings}
 */
export function getQuality() {
  const q = QUALITY_PRESETS[getQualityTier()];
  if (q.tier === 'low' && isSoftwareGpu()) {
    return { ...q, maxPixelRatio: 0.5, shadowMapSize: 512, shadows: false, scatter: 0.08, textureSize: 256, software: true, characterModels: 'procedural' };
  }
  return q;
}

/**
 * Choose and remember the level. A running game picks up pixel density, shadows, decoration density and
 * LOD levels at once via the event 'kronland-quality' (Renderer.applyQuality); anti-aliasing,
 * textures, terrain/water/tree detail and figure models take effect from the next game start.
 * @param {QualityTier|'auto'} tier
 */
export function setQuality(tier) {
  if (tier === 'auto') {
    try { globalThis.localStorage?.removeItem(KEY); } catch { /* whatever */ }
    current = detectQuality();
  } else {
    if (!QUALITY_PRESETS[tier]) throw new Error('Unknown graphics level: ' + tier);
    current = tier;
    store(tier);
  }
  try { globalThis.dispatchEvent?.(new CustomEvent('kronland-quality', { detail: current })); } catch { /* without DOM */ }
  return current;
}
