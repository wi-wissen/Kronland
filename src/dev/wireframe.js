// Wireframe view (developer mode): shows the triangle meshes of terrain, water, buildings, nature and
// figures, either instead of the surfaces or as edges over the normal image, optionally coloured by
// LOD level.
//
// Technique: shortly before drawing, the affected meshes get a wireframe copy of their material,
// right after it the original again. The copy takes over the shader additions (onBeforeCompile: fog,
// wind, GPU skinning of the figures), so the wireframe figures move too. Switched off it costs
// nothing – the renderer then does not call the hook at all.

import * as THREE from 'three';
import { LOD_COLORS } from './overlayData.js';

/** Colours without LOD colouring per group. */
const CAT_COLORS = { terrain: 0xe8f0ff, water: 0x7fd4ff, buildings: 0xffe6a8, nature: 0xb6f08a, figures: 0xffffff };

/**
 * Wireframe copy of a material. Shader additions and uniforms stay shared (same program).
 * @param {THREE.Material} m @param {number|null} color line colour or null (original colours)
 */
export function wireClone(m, color) {
  const ud = m.userData;
  m.userData = {}; // userData can contain textures (figures) – do not copy via JSON
  let c;
  try { c = m.clone(); } finally { m.userData = ud; }
  c.userData = { wireOf: m };
  c.onBeforeCompile = m.onBeforeCompile;
  c.customProgramCacheKey = m.customProgramCacheKey;
  if (m.isShaderMaterial) c.uniforms = m.uniforms;
  c.wireframe = true;
  if (color !== null) {
    if (c.emissive) {
      c.emissive.setHex(color); c.emissiveIntensity = 1;
      c.color?.setRGB(0.05, 0.05, 0.05);
    } else if (c.color) c.color.setHex(color);
  }
  return c;
}

/**
 * Collect meshes with group and LOD level.
 * @param {import('../render/Renderer.js').Renderer} r
 * @param {Record<string, boolean>} cats
 * @returns {{ mesh: THREE.Mesh, cat: string, level: number }[]}
 */
export function collectMeshes(r, cats) {
  const out = [];
  const add = (root, cat, level = -1) => root?.traverse?.((o) => { if (o.isMesh && o.visible !== false) out.push({ mesh: o, cat, level }); });
  if (cats.terrain) add(r.terrainChunks, 'terrain');
  if (cats.water) add(r.waterChunks, 'water');
  if (cats.buildings) {
    for (const g of r.buildings.values()) {
      const lods = g.userData.lods;
      const levelOf = new Map();
      if (lods?.length > 1) lods.forEach((l, i) => l.traverse((o) => levelOf.set(o, i)));
      g.traverse((o) => { if (o.isMesh) out.push({ mesh: o, cat: 'buildings', level: levelOf.get(o) ?? 0 }); });
    }
    for (const g of r.simRuins?.values() ?? []) add(g, 'buildings', 0);
  }
  if (cats.nature) {
    for (const c of r.chunked) c.meshes.forEach((m, i) => out.push({ mesh: m, cat: 'nature', level: i }));
    if (r.stumps) out.push({ mesh: r.stumps, cat: 'nature', level: 0 });
  }
  if (cats.figures) {
    for (const m of r.chars.group.children) {
      if (!m.isMesh) continue;
      const lv = /-lod(\d+)$/.exec(m.name);
      out.push({ mesh: m, cat: 'figures', level: lv ? Number(lv[1]) : 0 });
    }
    for (const g of r.units.values()) add(g, 'figures', 0);
  }
  return out;
}

export class WireframeView {
  constructor() {
    /** @type {Map<THREE.Material, Map<string, THREE.Material>>} */
    this.clones = new Map();
    /** @type {[THREE.Mesh, THREE.Material|THREE.Material[]][]} */
    this.swapped = [];
    this.overlayCam = new THREE.PerspectiveCamera();
    /** Number of meshes in the last view */
    this.count = 0;
  }

  /** Copy for material and colour (cached). */
  cloneFor(m, color) {
    let byColor = this.clones.get(m);
    if (!byColor) { byColor = new Map(); this.clones.set(m, byColor); }
    const key = color === null ? 'orig' : String(color);
    let c = byColor.get(key);
    if (!c) { c = wireClone(m, color); byColor.set(key, c); }
    return c;
  }

  /**
   * Swap materials.
   * @param {{mesh: THREE.Mesh, cat: string, level: number}[]} items @param {boolean} lodColors
   */
  swap(items, lodColors) {
    for (const { mesh, cat, level } of items) {
      const color = lodColors ? (level < 0 ? CAT_COLORS[cat] : LOD_COLORS[Math.min(level, LOD_COLORS.length - 1)]) : null;
      const orig = mesh.material;
      if (!orig) continue;
      this.swapped.push([mesh, orig]);
      mesh.material = Array.isArray(orig) ? orig.map((m) => this.cloneFor(m, color)) : this.cloneFor(orig, color);
    }
    this.count = items.length;
  }

  restore() {
    for (const [mesh, orig] of this.swapped) mesh.material = orig;
    this.swapped.length = 0;
  }

  /**
   * Before the normal drawing: in "edges only" mode swap materials.
   * @param {import('../render/Renderer.js').Renderer} r
   * @param {{ cats: Record<string, boolean>, mode: 'wire'|'overlay', lodColors: boolean }} o
   */
  before(r, o) {
    if (o.mode !== 'wire') return;
    this.swap(collectMeshes(r, o.cats), o.lodColors);
  }

  /**
   * After the normal drawing: restore the originals; in "edges over image" mode a second pass
   * with only the chosen groups as wireframe (depth shifted slightly towards the camera so the lines
   * do not flicker with their own surfaces).
   * @param {import('../render/Renderer.js').Renderer} r
   */
  after(r, o) {
    this.restore();
    if (o.mode !== 'overlay') return;
    const items = collectMeshes(r, o.cats);
    if (!items.length) return;
    const keep = new Set(items.map((i) => i.mesh));
    const hidden = [];
    // Draw only the chosen meshes: briefly hide everything else
    r.scene.traverse((obj) => {
      if (obj === r.scene || !obj.visible) return;
      if (obj.isMesh || obj.isLine || obj.isPoints || obj.isSprite) {
        if (!keep.has(obj)) { obj.visible = false; hidden.push(obj); }
      }
    });
    this.swap(items, o.lodColors);
    const gl = r.renderer;
    const bg = r.scene.background, autoClear = gl.autoClear, shadows = gl.shadowMap.autoUpdate;
    r.scene.background = null;
    gl.autoClear = false;
    gl.shadowMap.autoUpdate = false;
    const cam = this.overlayCam;
    cam.copy(r.camera);
    cam.projectionMatrix.copy(r.camera.projectionMatrix);
    // Depth slightly forward (z_ndc − δ): lines lie over the same surfaces
    cam.projectionMatrix.elements[10] += 2e-5 * 1;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    try { gl.render(r.scene, cam); } finally {
      r.scene.background = bg;
      gl.autoClear = autoClear;
      gl.shadowMap.autoUpdate = shadows;
      for (const obj of hidden) obj.visible = true;
      this.restore();
    }
  }

  dispose() {
    this.restore();
    for (const byColor of this.clones.values()) for (const c of byColor.values()) c.dispose();
    this.clones.clear();
  }
}
