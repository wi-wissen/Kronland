// Own tree and bush models (Meshy, public/models/buildings/<name>.glb) and the pure selection logic for them:
// which kind stands where, which LOD levels are drawn per graphics level. Testable without WebGL
// (tests/render/treeModels.test.js); geometry and material are built by nature.js.

/**
 * @typedef {{ name: string, cross?: boolean }} SeasonModel
 * @typedef {{ name: string, kind: 'leafy'|'birch'|'conifer', height: number, bend: number, cross?: boolean, winter: SeasonModel }} TreeModel
 */

/**
 * Tree kinds. height: height in the game at instance size 1 (tiles), measured against the buildings: house level 1/2/3
 * are 3.1 / 4.0 / 5.9 high on 3×3 tiles – broadleaf trees about as tall as the two-storey house, conifers
 * taller, birch ~3, bush ~1 (instance size varies 0.78–1.22);
 * bend: from this height the crown sways in the wind (trunk below stays fixed); cross: flat model as a cross of two
 * copies (second rotated by 90°) so it looks full from all sides. Winter: broadleaf trees bare, conifers snowy.
 * @type {TreeModel[]}
 */
export const TREE_MODELS = [
  { name: 'tree_oak', kind: 'leafy', height: 3.4, bend: 1.5, winter: { name: 'tree_oak_winter', cross: true } },
  { name: 'tree_beech', kind: 'leafy', height: 3.8, bend: 1.6, winter: { name: 'tree_beech_winter', cross: true } },
  { name: 'tree_birch', kind: 'birch', height: 3.0, bend: 1.2, cross: true, winter: { name: 'tree_birch_winter', cross: true } },
  { name: 'tree_spruce', kind: 'conifer', height: 4.4, bend: 0.9, winter: { name: 'tree_spruce_winter' } },
  { name: 'tree_pine', kind: 'conifer', height: 4.8, bend: 3.0, winter: { name: 'tree_pine_winter' } },
];

/** Bush (decoration scatter, replaces the procedural bushes). If the winter version is missing, the shader snows onto the summer bush. */
export const BUSH_MODEL = { name: 'bush', kind: 'bush', height: 0.95, bend: 0.15, winter: { name: 'bush_winter' } };

/**
 * Fraction of the height with which model trees enter the LOD choice (screen height 80/40 px): they are about
 * twice as tall as the earlier trees; with 0.5 they switch at the same distances (desktop ~30 / 62 tiles).
 * Medium and low switch to the simpler levels earlier (saves triangles, especially on the phone).
 */
export const TREE_LOD_HEIGHT = { high: 0.5, medium: 0.4, low: 0.3 };

/** Tree stumps of felled model trees: this much larger than the stump of the earlier, smaller trees. */
export const MODEL_STUMP_SCALE = 1.8;

/**
 * LOD files per graphics level (0 = original with texture, k = <name>.lod<k>.glb). Trees: close the original,
 * medium .lod2, far .lod3 (~200 triangles); on "low" close already .lod2. Bushes are small: .lod2, far .lod3.
 */
export const TREE_LOD_FILES = { detail: [0, 2, 3], simple: [2, 3] };
export const BUSH_LOD_FILES = [2, 3];

/** All LOD levels that are loaded (original for texture and material, plus the used levels). */
export const NATURE_MODEL_LODS = [2, 3];

/** Summer versions (preloaded at start) and winter versions (loaded on demand), without folder. */
export const SUMMER_NATURE_MODELS = [...TREE_MODELS.map((t) => t.name), BUSH_MODEL.name];
export const WINTER_NATURE_MODELS = [...TREE_MODELS.map((t) => t.winter.name), BUSH_MODEL.winter.name];

/** Smooth value noise 0…1 (rendering): grid hash, bilinear with soft transition. */
export function valueNoise(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const hv = (a, b) => ((Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(seed, 2147483647)) >>> 0) % 10007 / 10007;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const top = hv(ix, iy) + (hv(ix + 1, iy) - hv(ix, iy)) * sx;
  const bot = hv(ix, iy + 1) + (hv(ix + 1, iy + 1) - hv(ix, iy + 1)) * sx;
  return top + (bot - top) * sy;
}

/**
 * Forest types (share of conifers by height above the water): base in the valley, up to base+max from height from+span.
 * mixed: broadleaf and mixed forest as naturally in central Europe, conifer forest only in the mountains;
 * conifer: cold world; leafy: almost only broadleaf.
 */
export const FOREST_TYPES = {
  mixed: { base: 0.04, max: 0.6, from: 4, span: 5 },
  conifer: { base: 0.45, max: 0.5, from: 1, span: 4 },
  leafy: { base: 0, max: 0.2, from: 6, span: 4 },
};

/**
 * Forest type of a world: explicitly in the mission (def.forest), otherwise from the weather – a lot of winter (≥ 40 % of the
 * weather cycle) means cold world with conifer forest.
 * @param {{ mission?: {def?: {forest?: string}}|null, weatherCycle?: [string, number][] }} sim
 */
export function forestType(sim) {
  const def = sim.mission?.def?.forest;
  if (def && FOREST_TYPES[def]) return def;
  const cyc = sim.weatherCycle ?? [];
  const total = cyc.reduce((a, [, d]) => a + d, 0);
  const winter = cyc.reduce((a, [s, d]) => a + (s === 'winter' ? d : 0), 0);
  return total && winter / total >= 0.4 ? 'conifer' : 'mixed';
}

/** Size of the tree stands (tiles): the same kinds stand together in groups of this size. */
export const STAND_SIZE = 7;

/**
 * Tree kind at a location (rendering, not simulation) – naturally grown instead of evenly distributed:
 * - Stands: kind per patch from smooth noise (STAND_SIZE), only a few trees break ranks (~12 %).
 * - Conifer share rises with height (patch noise instead of dice: whole slopes become conifer forest).
 * - Pine (tall bare trunk, crown on top) only in dense stands (many neighbours), otherwise spruce.
 * - Solitary trees: mostly oak (broad crown), at forest edges more often birches.
 * - Forest type of the world (FOREST_TYPES): normally broadleaf and mixed forest, conifers only in the mountains; cold worlds
 *   (forest 'conifer', e.g. a lot of winter) predominantly conifer forest.
 * Depends only on location, height, neighbour count, forest type and hash – the same tree always has the same kind.
 * @param {{x:number, z:number, alt:number, h:number, neighbors:number, forest?: string}} t neighbors: trees within 2 tiles
 * @returns {'tree_oak'|'tree_beech'|'tree_birch'|'tree_spruce'|'tree_pine'}
 */
export function treeSpecies({ x, z, alt, h, neighbors, forest = 'mixed' }) {
  const odd = (h % 1000) / 1000 < 0.12; // loner in the stand
  const r = ((h >>> 10) % 1000) / 1000;
  const f = FOREST_TYPES[forest] ?? FOREST_TYPES.mixed;
  const pc = Math.max(0, Math.min(1, (alt - f.from) / f.span)) * f.max + f.base;
  const stand = valueNoise(x / STAND_SIZE, z / STAND_SIZE, 11);
  const conifer = odd ? r < pc : stand < pc;
  const dense = neighbors >= 8, lonely = neighbors <= 2;
  if (conifer) {
    // pines only in dense stands (the bare trunk only makes sense there), there patchwise
    const pineStand = valueNoise(x / (STAND_SIZE * 0.8), z / (STAND_SIZE * 0.8), 23) > 0.45;
    return dense && pineStand ? 'tree_pine' : 'tree_spruce';
  }
  if (lonely) return r < 0.3 ? 'tree_birch' : 'tree_oak';
  const leaf = odd ? r : valueNoise(x / STAND_SIZE, z / STAND_SIZE, 37);
  if (neighbors <= 4 && ((h >>> 20) % 4 === 0)) return 'tree_birch'; // forest edge
  return leaf < 0.5 ? 'tree_beech' : 'tree_oak';
}

const KIND_OF = { tree_oak: 'leafy', tree_beech: 'leafy', tree_birch: 'birch', tree_spruce: 'conifer', tree_pine: 'conifer' };

/**
 * Variant (index) for a tree: first the kind by treeSpecies (own models), otherwise by genus
 * (procedural fallback without models).
 * @param {{x:number, z:number, alt:number, h:number, neighbors:number, forest?: string}} t
 * @param {Record<string, number[]>} byKind variant indices per genus @param {Record<string, number>} [byModel] per model name
 */
export function pickTreeVariant(t, byKind, byModel = {}) {
  const species = treeSpecies(t);
  if (byModel[species] !== undefined) return byModel[species];
  let kind = KIND_OF[species];
  if (!byKind[kind]?.length) kind = byKind.leafy?.length ? 'leafy' : 'conifer';
  const list = byKind[kind];
  return list[(t.h >>> 13) % list.length];
}

/** Trees within 2 tiles (without the own tile) from a set of occupied tiles (key y*W+x). */
export function neighborCount(set, x, y, W) {
  let n = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if ((dx || dy) && set.has((y + dy) * W + (x + dx))) n++;
  return n;
}

/** Hash of a fellable tree from ID and tile (deterministic per tree). */
export const treeHash = (id, x, y) => (Math.imul(id, 2654435761) ^ Math.imul(x * 31 + y, 40503)) >>> 0;

/**
 * LOD list for a change of season: same count as in summer (the InstancedMeshes per level
 * stay, only geometry and material change). Missing winter levels take over the next coarser one available,
 * otherwise the finer one; if the winter version is missing entirely, null (summer version with snow from the shader).
 * @template T @param {(T|null)[]} winter per summer level the winter geometry or null @returns {T[]|null}
 */
export function seasonLevels(winter) {
  if (!winter.some(Boolean)) return null;
  return winter.map((g, i) => g ?? winter.slice(i + 1).find(Boolean) ?? winter.slice(0, i).reverse().find(Boolean));
}

/**
 * Apply the season to chunk groups (ChunkedInstances): per level set geometry and material of the summer or
 * winter version; the instances (matrices, colours) stay untouched. Groups without seasons
 * (userData.summer/season) stay as they are.
 * @param {{ meshes: {geometry: any, material: any}[], userData: {summer?: {levels: any[], material: any}, season?: () => ({levels: any[], material: any}|null)} }[]} groups
 * @param {boolean} winter
 * @returns {{ missing: boolean, materials: any[] }} missing: a winter version is missing (not yet loaded)
 */
export function applySeason(groups, winter) {
  let missing = false;
  const materials = new Set();
  for (const ci of groups) {
    const { summer, season } = ci.userData;
    if (!summer || !season) continue;
    const w = winter ? season() : null;
    if (winter && !w) missing = true;
    const use = w ?? summer;
    ci.meshes.forEach((m, i) => {
      m.geometry = use.levels[Math.min(i, use.levels.length - 1)];
      m.material = use.material;
    });
    materials.add(use.material);
  }
  return { missing, materials: [...materials] };
}
