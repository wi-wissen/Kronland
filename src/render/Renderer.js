// Rendering: reads the state of the simulation and draws it. Never changes the game state.

import * as THREE from 'three';
import { Terrain } from './terrain.js';
import { Water } from './water.js';
import { Environment } from './environment.js';
import { getQuality } from './quality.js';
import {
  treeLodVariants, stumpVariant, scatterKinds, depositModel, shaftMarker, spotMarker, markerUniforms, rng,
} from './nature.js';
import {
  ChunkedInstances, LodCounter, LodState, ViewTracker, cameraFrustum, effectiveDistance, lodSettings, LOD_TIERS, sphereVisible, splitGridMesh,
} from './lod.js';
import { CharacterSystem, sharedCharacterRoots } from './characters.js';
import { Effects, HealthBars, GroundMarks, sharedPuffTexture } from './effects.js';
import { CameraRig, nearFactor } from './CameraRig.js';
import { BUILDINGS } from '../sim/data/buildings.js';
import { UNIT } from '../sim/fixed.js';
import { WATER, CLIFF, OCCUPIED, RESERVED, BRIDGE } from '../sim/map.js';
import { SPECIALISTS } from '../sim/data/addon.js';
import { hiddenFrom } from '../sim/systems/hidden.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import {
  buildingModel, scaffold, serfModel, mat, PROF_COLORS, campfireModel,
  unitModel, heroModel, gadgetModel, horseModel, constructionStage, ruinModel, hasConstructionStages, bridgeModel,
} from './models.js';
import { UNITS, HEROES } from '../sim/data/units.js';
import { PLAYER_COLORS, sharedModelMaterials } from './models.js';
import { sharedAssetRoots } from './assets.js';
import { sharedMarkerMaterials } from './nature.js';
import { sharedTerrainTextures } from './textures.js';
import { HintMarker } from './hints.js';
import { FogOfWar, patchFog, patchFogTree } from './fog.js';
import { knownBuildings } from '../sim/systems/vision.js';

const PLAYER_COLORS_HEX = (owner) => PLAYER_COLORS[owner % 4];

const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas @param {import('../sim/sim.js').Sim} sim
   * @param {{ player?: number }} [opts] player: from whose point of view it is drawn (fog of war)
   */
  constructor(canvas, sim, opts = {}) {
    this.sim = sim;
    /** Point of view for the fog of war */
    this.viewer = opts.player ?? 0;
    /** Graphics level (pixel density, shadows, textures, decoration density, water) */
    const q = this.quality = getQuality();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: q.antialias, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.maxPixelRatio));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.3, 700);
    this.env = new Environment(this.renderer, this.scene, q);
    this.sun = this.env.sun;
    /** Shared uniforms of nature (wind, snow) */
    this.natureUniforms = { uTime: { value: 0 }, uSnow: { value: 0 } };

    this.terrain = new Terrain(sim.map, sim.waterLevel, q);
    this.water = new Water(this.terrain, q);
    this.terrain.water = this.water.mesh; // compatibility for older accesses
    // Fog of war: data texture and shader addition for all world materials
    this.fog = new FogOfWar(sim, this.viewer);
    patchFog(this.terrain.mesh.material);
    patchFog(this.water.material);
    // Draw terrain and water in tiles: areas outside the screen drop out
    this.terrainChunks = splitGridMesh(this.terrain.mesh, 24);
    this.waterChunks = splitGridMesh(this.water.mesh, 32);
    this.scene.add(this.terrainChunks, this.waterChunks);
    this.rig = new CameraRig(this.camera, { w: sim.map.width, h: sim.map.height });
    this.rig.groundAt = (x, z) => this.terrain.heightAt(x, z);
    this.rig.obstacleAt = (x, z) => this.buildingTopAt(x, z);

    // Trees, decoration and markers are only created at the first frame (see buildWorld)
    this.piles = new Map();
    this.markers = [];
    /** @type {Map<number, {v:number, i:number, x:number, z:number, s:number}>} */
    this.treeIndex = new Map();
    this.scatter = [];
    /** @type {Map<number, THREE.Group>} */
    this.buildings = new Map();
    /** Building surfaces for which the ground is trampled/levelled */
    this.padIds = new Set();
    /** @type {Map<number, THREE.Group>} */
    this.units = new Map();
    this.lastPos = new Map();
    this.selectionGroup = new THREE.Group();
    this.scene.add(this.selectionGroup);
    this.ghost = null;
    this.ghostKey = '';
    this.raycaster = new THREE.Raycaster();

    // LOD levels, visibility check, figures, effects
    this.lodTier = LOD_TIERS[q.tier] ?? LOD_TIERS.high;
    this.lodCounter = new LodCounter();
    this.frustum = new THREE.Frustum();
    this.view = new ViewTracker();
    /** @type {ChunkedInstances[]} */
    this.chunked = [];
    this.chars = new CharacterSystem(this.scene, q, { procedural: proceduralFigures() });
    this.fx = new Effects(this.scene, q);
    this.bars = new HealthBars(this.scene);
    this.marks = new GroundMarks(this.scene);
    /** Destroyed buildings as ruins (rendering only) */
    this.ruins = [];
    /** Construction values from the last frame (dust clouds on progress) */
    this.buildProgress = new Map();
    /** Developer-mode hooks (src/dev/DevTools.js): beforeRender/afterRender, otherwise null */
    this.devHook = null;

    const hq = sim.findBuilding(0, 'headquarters');
    if (hq) this.rig.lookAt(hq.x + hq.w / 2, hq.y + hq.h / 2 + 3);
  }

  /**
   * Free GPU resources (game end, new game, loading). The canvas and with it the WebGL context
   * are reused for the next game; without disposal buffers, textures and programs of
   * every game would stay in the context. Jointly cached models are re-uploaded by three.js on demand.
   */
  dispose() {
    this.devHook = null;
    const seen = new Set();
    const free = (x) => { if (x && !seen.has(x)) { seen.add(x); x.dispose?.(); } };
    const props = this.renderer.properties;
    const freeMaterial = (m) => {
      // three.js r186 attaches a listener per renderer to its global DFG table (PBR materials)
      const lut = props.get(m)?.uniforms?.dfgLUT?.value;
      if (lut?.isTexture) free(lut);
      for (const v of Object.values(m)) if (v?.isTexture) free(v);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) free(u.value);
      free(m);
    };
    const freeTree = (root) => root?.traverse?.((o) => {
      free(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) freeMaterial(m);
      if (o.isInstancedMesh) free(o);
    });
    freeTree(this.scene);
    // Also module-wide cached resources: three.js attaches a 'dispose' listener of this renderer to every used geometry,
    // material and texture. If they stay, the
    // cache holds on to the old renderer including context, canvas, UI and simulation.
    for (const root of [...sharedAssetRoots(), ...sharedCharacterRoots(), this.ghost]) freeTree(root);
    for (const m of [...sharedModelMaterials(), ...sharedMarkerMaterials(), this.arrowMat].filter(Boolean)) freeMaterial(m);
    for (const x of [...sharedTerrainTextures(), sharedPuffTexture(), this.ballGeo, this.arrowGeo, this.boomGeo]) free(x);
    this.env?.dispose?.();
    this.fog?.dispose();
    this.terrain?.dispose?.();
    this.water?.dispose?.();
    this.scene.environment = null;
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    // No forceContextLoss(): when loading from within the game the same canvas (and with it the same
    // context) stays in use for the next renderer. Without references the browser collects old contexts.
  }

  /**
   * Compile and bind all shader programs (incl. shadow pass) at the first frame, with all
   * objects visible. Deliberately not in the constructor so that the game start is not blocked.
   */
  warmUp() {
    try {
      this.rig.update(0);
      this.env.follow(this.rig.target, this.rig.dist, nearFactor(this.rig.dist), this.rig.yaw);
      const r = this.renderer;
      const size = r.getSize(new THREE.Vector2());
      r.setSize(32, 32, false);
      const cull = [], hidden = [];
      this.chars.prewarm(true);
      for (const lv of this.buildingLods?.values() ?? []) for (const m of lv) if (!m.visible) { hidden.push(m); m.visible = true; }
      for (const c of this.chunked) for (const m of c.meshes) if (!m.visible) { hidden.push(m); m.visible = true; }
      for (const m of [this.fx.smoke.mesh, this.fx.fire.mesh, this.fx.flames.mesh, this.bars.mesh, this.marks.mesh]) if (!m.visible) { hidden.push(m); m.visible = true; }
      this.scene.traverse((o) => { if (o.frustumCulled) { cull.push(o); o.frustumCulled = false; } });
      r.render(this.scene, this.camera);
      for (const o of cull) o.frustumCulled = true;
      for (const o of hidden) o.visible = false;
      this.chars.prewarm(false);
      r.setSize(Math.max(1, size.x), Math.max(1, size.y), false);
    } catch { /* without GL context */ }
  }

  /**
   * Take over the graphics level in the running game: pixel density, shadows (on/off, map size), decoration density,
   * LOD thresholds (trees, decoration, buildings, figures). Anti-aliasing (WebGL context), texture size,
   * terrain/water/tree detail and figure models need a restart.
   * @param {import('./quality.js').QualitySettings} [q]
   * @returns {string[]} parts that only take effect at the next game start
   */
  applyQuality(q = getQuality()) {
    const old = this.quality;
    this.quality = q;
    this.lodTier = LOD_TIERS[q.tier] ?? LOD_TIERS.high;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.maxPixelRatio));
    if (this.viewport) this.renderer.setSize(this.viewport.w, this.viewport.h, false);
    if (this.env.setQuality(q)) {
      // shadows on/off: recompile the shaders of all materials
      this.scene.traverse((o) => {
        for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) m.needsUpdate = true;
      });
    }
    this.chars.setQuality(q);
    if (old.scatter !== q.scatter && this.scatter.length) this.rebuildScatter();
    // choose LOD levels and chunks anew at the next frame
    this.view.pos.set(Infinity, 0, 0);
    const later = [];
    for (const k of ['antialias', 'textureSize', 'terrainDetail', 'margin', 'treeDetail', 'waterDetail', 'terrainBump', 'anisotropy', 'characterModels']) {
      if (old[k] !== q[k]) later.push(k);
    }
    this.pendingQuality = later.length ? later : null;
    return later;
  }

  /** Build decoration with new density (same arrangement, fade-outs under buildings stay). */
  rebuildScatter() {
    const old = new Set(this.scatter);
    // Decoration geometries and materials are created anew per build (scatterKinds) and are disposed with it
    for (const ci of this.scatter) for (const m of ci.meshes) { m.parent?.remove(m); m.geometry.dispose(); m.material.dispose(); m.dispose(); }
    this.chunked = this.chunked.filter((c) => !old.has(c));
    this.buildScatter();
    for (const id of this.padIds) {
      const e = this.sim.entities.get(id);
      if (e) this.hideScatter(e.x, e.y, e.w, e.h);
    }
    const snow = this.weather === 'winter';
    for (const m of this.scatter) m.visible = snow ? m.userData.winter : true;
  }

  setSize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 55 : 40;
    this.camera.updateProjectionMatrix();
    this.viewport = { w, h };
  }

  // ---------- Static objects ----------

  /**
   * Build trees, decoration and markers. Runs at the first frame instead of in the constructor: the game loop
   * thus starts without a long block before it (otherwise game time only slowly catches up).
   */
  buildWorld() {
    this.buildTrees();
    this.buildScatter();
    this.buildMarkers();
    if (this.weather && this.weather !== 'summer') this.applyWeather(this.weather);
  }

  /** Height above the water level in world units. */
  altitude(x, z) { return this.terrain.heightAt(x, z) - this.terrain.waterLevelY; }

  /**
   * Trees as InstancedMesh per variant: broadleaf trees and birches in the valley, conifers at altitude.
   * In addition non-fellable ornamental trees outside the map and on mountain slopes.
   */
  buildTrees() {
    const q = this.quality;
    const trees = [...this.sim.entities.values()].filter((e) => e.kind === 'tree');
    const variants = treeLodVariants(q.treeDetail, this.natureUniforms);
    const byKind = { leafy: [], birch: [], conifer: [] };
    variants.forEach((v, i) => byKind[v.kind].push(i));
    const pickVariant = (x, z, h) => {
      const alt = this.altitude(x, z);
      const r = h % 1000 / 1000;
      // share of conifers rises with altitude
      const pc = Math.max(0, Math.min(1, (alt - 2.2) / 4.5)) * 0.9 + 0.1;
      let kind = r < pc ? 'conifer' : (h >>> 10) % 5 === 0 ? 'birch' : 'leafy';
      const list = byKind[kind];
      return list[(h >>> 13) % list.length];
    };
    /** @type {{x:number,z:number,v:number,s:number,rot:number,h:number,id:number}[]} */
    const items = [];
    for (const t of trees) {
      const h = (Math.imul(t.id, 2654435761) ^ Math.imul(t.x * 31 + t.y, 40503)) >>> 0;
      const x = t.x + 0.5 + ((h >>> 4) % 36 - 18) / 100, z = t.y + 0.5 + ((h >>> 12) % 36 - 18) / 100;
      items.push({ x, z, v: pickVariant(x, z, h), s: 0.78 + (h % 45) / 100, rot: (h % 628) / 100, h, id: t.id });
    }
    // ornamental trees: map edge (outside) and walkable slopes without game value stay empty; cliff ledges get conifers
    const deco = this.decorTreeSpots();
    for (const d of deco) items.push({ ...d, v: pickVariant(d.x, d.z, d.h), id: 0 });

    // per variant a chunk grid with LOD levels (near: full geometry, far: few faces)
    const groups = variants.map((v, k) => new ChunkedInstances({
      name: `trees-${k}`, chunkSize: 8, colors: true, kind: 'tree',
      // farthest level without shadow casting: saves the expensive shadow pass for the horizon
      levels: v.levels.map((g, i) => ({ geometry: g, material: v.material, castShadow: i < v.levels.length - 1 || v.levels.length === 1, receiveShadow: i === 0 })),
    }));
    /** @type {Map<number, {v:number, h:any, x:number, z:number, s:number}>} */
    this.treeIndex = new Map();
    this.treeVariants = variants;
    const c = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    for (const it of items) {
      const v = variants[it.v];
      const s = it.s * v.scale;
      tmpP.set(it.x, this.terrain.heightAt(it.x, it.z) - 0.04, it.z);
      tmpQ.setFromAxisAngle(up, it.rot);
      tmpS.set(s, s * (0.9 + ((it.h >>> 20) % 25) / 100), s);
      tmpM.compose(tmpP, tmpQ, tmpS);
      // colour variation per tree (autumn dabs on broadleaf trees)
      const r = ((it.h >>> 7) % 100) / 100;
      c.setRGB(0.88 + r * 0.22, 0.9 + r * 0.16, 0.86 + ((it.h >>> 15) % 20) / 100);
      if (v.kind !== 'conifer' && (it.h >>> 22) % 23 === 0) c.setRGB(1.35, 1.05, 0.55);
      const handle = groups[it.v].add(it.x, it.z, tmpM, c);
      if (it.id) this.treeIndex.set(it.id, { v: it.v, h: handle, x: it.x, z: it.z, s });
    }
    for (const g of groups) { g.finalize(this.scene); this.chunked.push(g); for (const m of g.meshes) patchFog(m.material); }
    this.treeGroups = groups;
    // tree stumps (felled trees)
    const st = stumpVariant(this.natureUniforms);
    this.stumps = new THREE.InstancedMesh(st.geometry, st.material, Math.max(1, trees.length));
    this.stumps.count = 0;
    this.stumps.castShadow = true; this.stumps.receiveShadow = true;
    this.stumps.frustumCulled = false;
    patchFog(st.material);
    this.scene.add(this.stumps);
  }

  /** Spots for ornamental trees outside the map and on forestable cliff ledges. */
  decorTreeSpots() {
    const { map } = this.sim;
    const W = map.width, H = map.height, M = this.terrain.M;
    const out = [];
    const r = rng(this.sim.seed * 7 + 3);
    const dens = this.quality.tier === 'low' ? 0.5 : 1;
    for (let z = -M + 1; z < H + M - 1; z++) for (let x = -M + 1; x < W + M - 1; x++) {
      const inside = x >= 0 && z >= 0 && x < W && z < H;
      const h = (Math.imul(x + 1000, 73856093) ^ Math.imul(z + 1000, 19349663)) >>> 0;
      const n = (Math.sin(x * 0.21 + this.sim.seed) + Math.sin(z * 0.17 + x * 0.05) + 2) / 4; // forest patches
      if (!inside) {
        const d = Math.max(-x, -z, x - W + 1, z - H + 1);
        if (d < 2) continue;
        if (this.altitude(x + 0.5, z + 0.5) < 0.4) continue;
        if (r() > (n > 0.45 ? 0.55 : 0.12) * dens) continue;
      } else {
        const f = map.flags[map.idx(x, z)];
        if (!(f & CLIFF) || f & WATER) continue;
        // only moderately steep cliffs at medium height
        const alt = this.altitude(x + 0.5, z + 0.5);
        if (alt > 7.2 || this.slopeAt(x + 0.5, z + 0.5) > 0.9) continue;
        if (r() > 0.22 * dens) continue;
      }
      out.push({ x: x + 0.2 + r() * 0.6, z: z + 0.2 + r() * 0.6, s: 0.7 + r() * 0.5, rot: r() * 6.28, h });
    }
    return out;
  }

  /** Slope of the terrain (height change per unit). */
  slopeAt(x, z) {
    const t = this.terrain;
    const dx = t.heightAt(x + 0.5, z) - t.heightAt(x - 0.5, z), dz = t.heightAt(x, z + 0.5) - t.heightAt(x, z - 0.5);
    return Math.hypot(dx, dz);
  }

  removeTree(id) {
    const t = this.treeIndex.get(id);
    if (!t) return;
    this.treeGroups[t.v].hide(t.h);
    this.view.pos.set(Infinity, 0, 0); // collect chunks anew
    this.treeIndex.delete(id);
    // leave stump standing
    if (this.stumps.count < this.stumps.instanceMatrix.count) {
      const s = 0.8 + t.s * 0.25;
      tmpP.set(t.x, this.terrain.heightAt(t.x, t.z) - 0.02, t.z);
      tmpQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (id % 628) / 100);
      tmpS.set(s, s, s);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.stumps.setMatrixAt(this.stumps.count++, tmpM);
      this.stumps.instanceMatrix.needsUpdate = true;
    }
  }

  /** Non-blocking decoration: grass, flowers, bushes, pebbles, reeds, rocks (density per graphics level). */
  buildScatter() {
    const { map } = this.sim;
    const W = map.width, H = map.height;
    const t = this.terrain;
    const kinds = scatterKinds(this.natureUniforms);
    const dens = this.quality.scatter;
    const r = rng(this.sim.seed * 13 + 1);
    /** @type {Record<string, {x:number,z:number,s:number,rot:number,tile:number}[]>} */
    const lists = Object.fromEntries(Object.keys(kinds).map((k) => [k, []]));
    const kk = Object.keys(kinds).filter((k) => k.startsWith('kk'));
    const mt = Object.keys(kinds).filter((k) => k.startsWith('mt'));
    const lily = Object.keys(kinds).filter((k) => k.startsWith('lily'));
    const splat = (x, z) => {
      const gx = Math.round((x + t.M) * t.R), gz = Math.round((z + t.M) * t.R);
      const k = Math.max(0, Math.min(t.GH - 1, gz)) * t.GW + Math.max(0, Math.min(t.GW - 1, gx));
      return [t.splatA[k * 4], t.splatA[k * 4 + 1], t.splatA[k * 4 + 2], t.splatA[k * 4 + 3], t.splatB[k * 4]];
    };
    const near = (x, y, mask) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (map.inBounds(x + dx, y + dy) && map.flags[map.idx(x + dx, y + dy)] & mask) return true;
      }
      return false;
    };
    const add = (kind, x, z, s, tile) => lists[kind]?.push({ x, z, s, rot: r() * 6.283, tile });
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = map.idx(x, y), f = map.flags[k];
      if (f & WATER) {
        // water lilies on calm, moderately deep water
        const depth = -this.altitude(x + 0.5, y + 0.5);
        if (lily.length && depth > 0.35 && depth < 1.6 && r() < 0.05 * dens) {
          for (let i = 0; i < 3; i++) lists[lily[(r() * lily.length) | 0]].push({ x: x + r(), z: y + r(), s: 1.6 + r() * 1.2, rot: r() * 6.283, tile: k, water: true });
        }
        // reeds in shallow water at the shore
        if (near(x, y, 0xff) && this.altitude(x + 0.5, y + 0.5) > -0.45 && r() < 0.35 * dens) {
          let shore = false;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (map.inBounds(x + dx, y + dy) && !(map.flags[map.idx(x + dx, y + dy)] & WATER)) shore = true;
          if (shore) add('reeds', x + r(), y + r(), 0.8 + r() * 0.6, k);
        }
        continue;
      }
      if (f & CLIFF) {
        // boulders at cliffs and peaks
        // on steep flanks more scree than on the peak surfaces
        const steep = this.slopeAt(x + 0.5, y + 0.5);
        // rock peaks (KayKit) scattered on high ridges
        const mh = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
        if (mt.length && this.altitude(x + 0.5, y + 0.5) > 6.5 && mh % 61 === 0) {
          add(mt[(r() * mt.length) | 0], x + 0.5, y + 0.5, 1.2 + r() * 0.9, k);
          continue;
        }
        const chance = (steep > 0.7 ? 0.42 : 0.14) * Math.max(0.5, dens);
        if (r() < chance) {
          const kind = kk.length && r() < 0.6 ? kk[(r() * kk.length) | 0] : r() < 0.5 ? 'rock' : 'rockB';
          add(kind, x + r(), y + r(), kind.startsWith('kk') ? 2.2 + r() * 2.5 : 0.8 + r() * 0.9, k);
        }
        continue;
      }
      const occupied = (f & (OCCUPIED | RESERVED)) !== 0;
      const n = Math.round((4 + r() * 3) * dens);
      for (let i = 0; i < n; i++) {
        const px = x + r(), pz = y + r();
        const [meadow, dirt, sand, rock, snow] = splat(px, pz);
        if (snow > 0.5) continue;
        if (occupied && r() < 0.85) continue; // under trees and on spots only a little
        const roll = r();
        if (sand > 0.5) { if (roll < 0.25) add('pebbles', px, pz, 0.6 + r() * 0.6, k); else if (roll < 0.4) add('grassDry', px, pz, 0.8 + r() * 0.4, k); continue; }
        if (rock > 0.45) { if (roll < 0.2) add(r() < 0.5 ? 'rock' : 'pebbles', px, pz, 0.4 + r() * 0.5, k); else if (roll < 0.5) add('grassDry', px, pz, 0.8, k); continue; }
        if (dirt > 0.55) { if (roll < 0.15) add('pebbles', px, pz, 0.5 + r() * 0.5, k); else if (roll < 0.5) add('grassDry', px, pz, 0.8 + r() * 0.4, k); continue; }
        if (roll < 0.62) add(r() < 0.2 ? 'grassDry' : 'grass', px, pz, 0.75 + r() * 0.7, k);
        else if (meadow > 0.4 && roll < 0.82) add(['flowerW', 'flowerY', 'flowerP', 'flowerR'][(r() * 4) | 0], px, pz, 0.8 + r() * 0.5, k);
        else if (roll < 0.86 && near(x, y, OCCUPIED) && !occupied) add(r() < 0.5 ? 'bush' : 'bushB', px, pz, 0.7 + r() * 0.6, k);
        else if (roll < 0.868) add('pebbles', px, pz, 0.5 + r() * 0.4, k);
        else if (roll < 0.88) add('rock', px, pz, 0.35 + r() * 0.3, k);
      }
    }
    /** Per tile the instances (for fading out under buildings) */
    this.scatterByTile = new Map();
    this.scatter = [];
    const up = new THREE.Vector3(0, 1, 0);
    for (const [name, list] of Object.entries(lists)) {
      if (!list.length) continue;
      const kind = kinds[name];
      const big = name.startsWith('kk') || name.startsWith('mt') || name.startsWith('rock') || name.startsWith('bush');
      // small decoration (grass, flowers, pebbles) in tight chunks that drop out entirely in the distance
      const ci = new ChunkedInstances({
        name: 'scatter-' + name, chunkSize: kind.small ? 6 : 12, kind: kind.small ? 'scatterSmall' : 'scatterLarge',
        levels: [{ geometry: kind.geometry, material: kind.material, castShadow: big, receiveShadow: true }],
      });
      for (const it of list) {
        // let rocks sink in a little; water lilies float on the water
        const y = it.water ? t.waterY + 0.01 : t.heightAt(it.x, it.z) - (name.startsWith('mt') ? 0.35 * it.s : big ? 0.06 * it.s : 0.01);
        tmpP.set(it.x, y, it.z);
        tmpQ.setFromAxisAngle(up, it.rot);
        tmpS.set(it.s, it.s * (name.startsWith('kk') ? 0.8 : 1), it.s);
        tmpM.compose(tmpP, tmpQ, tmpS);
        const h = ci.add(it.x, it.z, tmpM);
        if (!this.scatterByTile.has(it.tile)) this.scatterByTile.set(it.tile, []);
        this.scatterByTile.get(it.tile).push([ci, h]);
      }
      ci.finalize(this.scene);
      for (const m of ci.meshes) patchFog(m.material);
      ci.userData.winter = kind.winter;
      this.chunked.push(ci);
      this.scatter.push(ci);
    }
  }

  /** Hide decoration under a surface (new buildings). */
  hideScatter(x, y, w, h) {
    const { map } = this.sim;
    for (let j = y - 1; j <= y + h; j++) for (let i = x - 1; i <= x + w; i++) {
      if (!map.inBounds(i, j)) continue;
      const list = this.scatterByTile.get(map.idx(i, j));
      if (!list) continue;
      for (const [ci, handle] of list) ci.hide(handle);
      this.scatterByTile.delete(map.idx(i, j));
    }
    this.view.pos.set(Infinity, 0, 0);
  }

  /** Create resource piles (also later: deposits uncovered by the scout). */
  addPileMarker(e) {
    const g = new THREE.Group();
    const d = depositModel(e.res, e.id);
    d.rotation.y = (e.id * 1.7) % 6.28;
    g.add(d);
    g.position.set(e.x + 0.5, this.terrain.heightAt(e.x + 0.5, e.y + 0.5) - 0.03, e.y + 0.5);
    patchFogTree(g);
    this.scene.add(g);
    this.piles.set(e.id, g);
    return g;
  }

  buildMarkers() {
    for (const e of this.sim.entities.values()) if (e.kind === 'pile') this.addPileMarker(e);
    // add-on: bridge sites (posts at both banks, weak board over the water)
    if (this.sim.addon) for (const s of this.sim.bridgeSites ?? []) {
      const g = bridgeSiteMarker(s, this.bridgeDeckY(s));
      patchFogTree(g);
      this.scene.add(g);
      this.markers.push({ g, x: s.x, y: s.y, cx: s.x + s.w / 2, cz: s.y + s.h / 2, free: true, bridge: true });
    }
    for (const s of this.sim.shafts) {
      const g = shaftMarker(s.res);
      g.position.set(s.x + 1.5, this.terrain.rectHeight(s.x, s.y, 3, 3) - 0.1, s.y + 1.5);
      g.rotation.y = ((s.x * 7 + s.y * 3) % 4) * (Math.PI / 2);
      patchFogTree(g);
      this.scene.add(g);
      this.markers.push({ g, x: s.x, y: s.y, cx: s.x + 1.5, cz: s.y + 1.5, free: true });
    }
    for (const s of this.sim.spots) {
      const g = spotMarker();
      g.position.set(s.x + 2, this.terrain.rectHeight(s.x, s.y, 4, 4) - 0.1, s.y + 2);
      patchFogTree(g);
      this.scene.add(g);
      this.markers.push({ g, x: s.x, y: s.y, cx: s.x + 2, cz: s.y + 2, free: true });
    }
  }

  /** Adapt trampled ground and building surfaces (exactly flat edge corners) to the current buildings. */
  syncGround() {
    const ids = this.buildings;
    let changed = ids.size !== this.padIds.size;
    if (!changed) for (const id of ids.keys()) if (!this.padIds.has(id)) { changed = true; break; }
    if (!changed) return;
    const rects = [];
    for (const id of this.padIds) if (!ids.has(id)) { const r = this.terrain.pads.get(id); if (r) this.reshapeGround(r, () => this.terrain.clearPad(id)); }
    for (const [id, g] of ids) {
      // rectangle from the rendering (also last seen buildings in the fog that no longer exist)
      const e = g.userData.rect;
      if (!e || g.userData.noPad) continue;
      rects.push(e);
      if (!this.padIds.has(id)) { this.reshapeGround(e, () => this.terrain.setPad(id, e.x, e.y, e.w, e.h)); this.hideScatter(e.x, e.y, e.w, e.h); }
    }
    this.padIds = new Set(ids.keys());
    this.terrain.setTrampled(rects);
  }

  /**
   * Rebuild terrain in a tile area and put everything standing on it (trees, decoration, stumps,
   * piles, markers) onto the new ground. Figures and buildings read the height every frame anyway.
   * @param {{x:number,y:number,w:number,h:number}} r @param {() => void} update changes the terrain
   */
  reshapeGround(r, update) {
    const t = this.terrain;
    // area of influence: corners of the rectangle act two corners far (Catmull-Rom)
    const x0 = r.x - 3, z0 = r.y - 3, x1 = r.x + r.w + 3, z1 = r.y + r.h + 3;
    const before = new Map();
    const key = (x, z) => `${Math.round(x * 1000)}:${Math.round(z * 1000)}`;
    const old = (x, z) => { const k = key(x, z); let v = before.get(k); if (v === undefined) { v = t.heightAt(x, z); before.set(k, v); } return v; };
    // remember old heights of the affected instances
    const groups = [...(this.treeGroups ?? []), ...(this.scatter ?? [])];
    for (const g of groups) g.shiftY(x0, z0, x1, z1, (x, z) => (old(x, z), 0));
    const st = this.stumps, sm = st?.instanceMatrix.array;
    if (st) for (let i = 0; i < st.count; i++) old(sm[i * 16 + 12], sm[i * 16 + 14]);
    update();
    const dy = (x, z) => t.heightAt(x, z) - old(x, z);
    for (const g of groups) g.shiftY(x0, z0, x1, z1, (x, z) => (before.has(key(x, z)) ? dy(x, z) : 0));
    if (st) {
      let any = false;
      for (let i = 0; i < st.count; i++) {
        const x = sm[i * 16 + 12], z = sm[i * 16 + 14];
        if (x < x0 || x > x1 || z < z0 || z > z1) continue;
        const d = dy(x, z);
        if (d) { sm[i * 16 + 13] += d; any = true; }
      }
      if (any) st.instanceMatrix.needsUpdate = true;
    }
    for (const g of this.piles.values()) {
      if (g.position.x < x0 || g.position.x > x1 || g.position.z < z0 || g.position.z > z1) continue;
      g.position.y = t.heightAt(g.position.x, g.position.z) - 0.03;
    }
    for (const m of this.markers) {
      if (m.cx < x0 || m.cx > x1 || m.cz < z0 || m.cz > z1) continue;
      if (m.bridge) continue; // bridge sites: deck between the banks, banks are not levelled
      const w = (m.cx - m.x) * 2;
      m.g.position.y = t.rectHeight(m.x, m.y, w, w) - 0.1;
    }
    if (this.view) this.view.pos.set(Infinity, 0, 0); // collect chunks anew
  }

  /**
   * Take over levelling from the simulation. In fog only when the player sees the area
   * (otherwise the ground would reveal enemy construction sites).
   */
  syncTerrain() {
    const list = this.pendingTerrain;
    if (!list?.length) return;
    const fog = this.fog;
    this.pendingTerrain = list.filter((r) => {
      if (fog.active && !fog.rectVisible(r.x, r.y, r.w, r.h)) return true;
      this.reshapeGround(r, () => this.terrain.updateArea(r.x, r.y, r.w, r.h));
      return false;
    });
  }

  // ---------- Events ----------

  onEvents(events) {
    const fog = this.fog;
    for (const ev of events) {
      // fog: show shots, hits and explosions only where the player is looking
      if (ev.type === 'shot') { if (fog.visibleAt(ev.from.x / UNIT, ev.from.y / UNIT) || fog.visibleAt(ev.to.x / UNIT, ev.to.y / UNIT)) this.addProjectile(ev); }
      else if (ev.type === 'hit') {
        (this.hitAt ??= new Map()).set(ev.by, this.time ?? 0);
        const t = this.sim.entities.get(ev.target);
        if (t?.px !== undefined && fog.visibleAt(t.px / UNIT, t.py / UNIT) && this.fx.chance(0.5)) {
          const x = t.px / UNIT, z = t.py / UNIT;
          this.fx.sparks(x, this.terrain.heightAt(x, z) + 0.55, z);
        }
      }
      else if (ev.type === 'explosion') { if (fog.visibleAt(ev.x / UNIT, ev.y / UNIT)) this.addExplosion(ev.x / UNIT, ev.y / UNIT); }
      else if (ev.type === 'weather') this.applyWeather(ev.state);
      else if (ev.type === 'killed') this.onKilled(ev);
      else if (ev.type === 'buildingDestroyed' || ev.type === 'demolished') this.onBuildingGone(ev);
      else if (ev.type === 'buildingDone') this.onBuildingDone(ev);
      else if (ev.type === 'terrainChanged') (this.pendingTerrain ??= []).push({ x: ev.x, y: ev.y, w: ev.w, h: ev.h });
      if (ev.type === 'nodeDepleted') {
        this.removeTree(ev.node);
        const p = this.piles.get(ev.node);
        if (p) { this.scene.remove(p); this.piles.delete(ev.node); }
      }
    }
  }

  /** Unit died: death animation at its last position. */
  onKilled(ev) {
    if (ev.kind === 'building' || ev.kind === 'hero') return;
    this.chars.kill(ev.id);
  }

  /** Destroyed/demolished building: dust cloud and (if the simulation keeps no ruin) a fading ruin. */
  onBuildingGone(ev) {
    const g = this.buildings.get(ev.building);
    const e = g?.userData.rect;
    if (!e) return;
    // in fog: show nothing, the building stays as the last seen state
    if (!this.fog.rectVisible(e.x, e.y, e.w, e.h)) return;
    const cx = e.x + e.w / 2, cz = e.y + e.h / 2, y = g.position.y;
    this.fx.poof(cx, y, cz, Math.max(e.w, e.h) * 0.6, 0xb8ab94, 30);
    if (ev.type === 'buildingDestroyed') {
      for (let i = 0; i < 6; i++) this.fx.smokePuff(cx + (Math.random() - 0.5) * e.w * 0.6, y + 0.4, cz + (Math.random() - 0.5) * e.h * 0.6, 1, 0.5);
      // a ruin from the simulation (kind 'ruin') takes precedence
      const simRuin = [...this.sim.entities.values()].some((r) => r.kind === 'ruin' && r.x === e.x && r.y === e.y);
      if (!simRuin) {
        const r = ruinModel(e.w - 0.6, e.h - 0.6);
        r.position.set(cx, y, cz);
        r.rotation.y = (ev.building % 4) * (Math.PI / 2);
        r.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; } });
        patchFogTree(r);
        this.scene.add(r);
        this.ruins.push({ g: r, t: 0, x: cx, y, z: cz, w: e.w });
      }
    }
  }

  /** Construction finished: dust ring and sparkle. */
  onBuildingDone(ev) {
    const e = this.sim.entities.get(ev.building);
    if (!e) return;
    const g = this.buildings.get(e.id);
    if (!g || !this.fog.rectVisible(e.x, e.y, e.w, e.h)) return;
    this.fx.poof(e.x + e.w / 2, g?.position.y ?? this.terrain.heightAt(e.x, e.y), e.y + e.h / 2, Math.max(e.w, e.h) * 0.55);
  }

  // ---------- Per frame ----------

  /**
   * @param {number} alpha 0…1 between last and current tick
   * @param {number} dt seconds since last frame
   * @param {Map<number,{px:number,py:number}>} prev positions before the last tick
   * @param {{ selected: Set<number>, ghost: null|{type:string,x:number,y:number,valid:boolean} }} view
   */
  frame(alpha, dt, prev, view) {
    if (!this.warmed) {
      this.warmed = true;
      const t0 = performance.now();
      this.buildWorld();
      const t1 = performance.now();
      this.prepareFigures();
      const t2 = performance.now();
      this.warmUp();
      this.startupMs = { world: Math.round(t1 - t0), figures: Math.round(t2 - t1), warmUp: Math.round(performance.now() - t2) };
    }
    const sim = this.sim;
    this.frameDt = dt;
    this.time = (this.time ?? 0) + dt;
    // camera first: LOD levels and visibility check refer to the current frame
    this.rig.update(dt);
    this.camera.updateMatrixWorld();
    cameraFrustum(this.camera, this.frustum);
    this.chars.begin(this.time);
    this.lodCounter.groups = {};
    this.bars.begin();
    this.marks.begin();
    this.selectedIds = view.selected;
    const seen = new Set();
    // fog of war: game end or eliminated player sees everything
    const fog = this.fog;
    if (view.revealAll) fog.revealAll();
    fog.update(dt);
    const fogOn = fog.active, me = this.viewer;
    const mine = (o) => o !== undefined && o >= 0 && !!sim.players[o] && sim.allied(o, me);

    for (const e of sim.entities.values()) {
      if (e.kind === 'building') {
        // enemy buildings only if visible; otherwise as last seen state (below)
        if (fogOn && !mine(e.owner) && !fog.rectVisible(e.x, e.y, e.w, e.h)) continue;
        seen.add(e.id); this.syncBuilding(e);
      } else if (e.px !== undefined) {
        // enemy figures, traps and projectiles only in visible tiles; invisible ones (thief, fog veil) never
        if (fogOn && !mine(e.owner) && !fog.visibleAt(e.px / UNIT, e.py / UNIT)) continue;
        if (!mine(e.owner) && !view.revealAll && (e.hidden || (e.seenBy !== undefined && hiddenFrom(sim, me, e)))) continue;
        seen.add(e.id);
        if (e.kind === 'unit' || e.kind === 'worker') this.syncUnit(e, alpha, prev.get(e.id), dt);
        else this.syncFighter(e, alpha, prev.get(e.id));
      } else if (e.kind === 'ruin') {
        if (fogOn && !fog.rectVisible(e.x, e.y, e.w ?? 3, e.h ?? 3)) continue;
        seen.add(e.id); this.syncRuin(e);
      } else if (e.kind === 'pile') {
        const g = this.piles.get(e.id) ?? (this.warmed ? this.addPileMarker(e) : null);
        if (g) {
          g.visible = fog.exploredAt(e.x + 0.5, e.y + 0.5);
          if (!fogOn || fog.visibleAt(e.x + 0.5, e.y + 0.5)) g.scale.setScalar(0.55 + 0.45 * Math.min(1, e.amount / 400));
        }
      }
    }
    // last seen enemy buildings and ruins (darkened by the fog, without smoke and fire)
    const ghosts = fogOn ? knownBuildings(sim, me) : null;
    if (ghosts) {
      for (const gh of ghosts.values()) {
        if (seen.has(gh.id)) continue;
        // just disappeared from sight (destroyed, demolished): do not keep showing until the next vision computation
        if (!sim.entities.has(gh.id) && fog.rectVisible(gh.x, gh.y, gh.w, gh.h)) continue;
        seen.add(gh.id);
        if (gh.kind === 'ruin') this.syncRuin(gh);
        else this.syncBuilding(this.ghostEntity(gh), true);
      }
    }
    for (const [id, g] of this.buildings) if (!seen.has(id)) { this.scene.remove(g); this.buildings.delete(id); this.buildProgress.delete(id); }
    for (const [id, g] of this.units) if (!seen.has(id)) { this.scene.remove(g); this.units.delete(id); }
    for (const [id, g] of this.simRuins ?? []) if (!seen.has(id)) { this.scene.remove(g); this.simRuins.delete(id); }
    // clean up per-unit markers (occasionally is enough)
    if ((this.frameNo = (this.frameNo ?? 0) + 1) % 120 === 0) {
      for (const m of [this.unitYaw, this.hitAt, this.shotAt]) if (m) for (const id of m.keys()) if (!seen.has(id)) m.delete(id);
    }
    this.chars.prune();

    // hide markers as soon as something is built there (in fog the last seen state stays)
    for (const m of this.markers) {
      if (m.bridge) { if (fog.visibleAt(m.cx, m.cz)) m.free = !(sim.map.flags[sim.map.idx(m.x, m.y)] & (OCCUPIED | BRIDGE)); }
      else if (fog.visibleAt(m.cx, m.cz)) m.free = sim.map.owner[sim.map.idx(m.x, m.y)] === 0;
      m.g.visible = m.free && fog.exploredAt(m.cx, m.cz);
    }

    this.updateEffects(dt);
    this.syncSelection(view.selected);
    this.syncGhost(view.ghost);
    (this.hintMarker ??= new HintMarker(this.scene, this.terrain)).update(view.hint, dt);

    this.syncTerrain();
    this.syncGround();
    this.natureUniforms.uTime.value = this.time;
    this.water.update(this.time);
    for (const m of this.markers) {
      const b = m.g.getObjectByName('banner');
      if (b) b.rotation.y = Math.sin(this.time * 2.2 + m.x) * 0.25;
    }

    this.updateLod();
    this.chars.render(this.camera, this.frustum, this.lodCounter);
    this.fx.update(dt);
    this.bars.end(this.viewport ?? { w: 1280, h: 800 }, this.renderer.getPixelRatio());
    this.marks.end();
    this.env.follow(this.rig.target, this.rig.dist, nearFactor(this.rig.dist), this.rig.yaw);
    this.env.tick();
    this.devHook?.beforeRender();
    this.renderer.render(this.scene, this.camera);
    this.devHook?.afterRender();
  }

  /**
   * Top edge of the buildings at (x, z) for the camera (never into a house): above the footprint the house height
   * (under construction the height of the shell), outside a soft edge so that the camera rises steadily instead of jumping.
   * @returns {number} −∞ if there is no building
   */
  buildingTopAt(x, z) {
    let top = -Infinity;
    for (const g of this.buildings.values()) {
      const r = g.userData.rect;
      if (!r) continue;
      const h = (g.userData.height ?? 2) * (g.userData.body?.scale.y ?? 1);
      const edge = 0.8 + 0.35 * h;
      const dx = Math.max(r.x - x, 0, x - (r.x + r.w)), dz = Math.max(r.y - z, 0, z - (r.y + r.h));
      if (dx >= edge || dz >= edge) continue;
      const s = Math.min(1, Math.hypot(dx, dz) / edge);
      top = Math.max(top, g.position.y + h * (1 - s * s * (3 - 2 * s)));
    }
    return top;
  }

  /** Choose LOD levels of trees, decoration and buildings by camera. */
  updateLod() {
    const cam = this.camera;
    const bias = this.lodTier.bias;
    const eff = (d) => effectiveDistance(d, cam.fov, bias);
    // small decoration: fade out with distance in the shader (matching the chunk cut-off limit)
    const fade = this.natureUniforms.uFade;
    if (fade) {
      const cut = lodSettings('scatterSmall', this.quality.tier).cull * bias / (Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) / Math.tan(THREE.MathUtils.degToRad(20)));
      fade.value.set(cut * 0.72, cut * 0.97);
    }
    if (this.view.changed(cam)) {
      for (const c of this.chunked) {
        c.update(this.frustum, cam.position, eff, lodSettings(c.kind, this.quality.tier), this.lodCounter);
      }
      this.lastChunkCounts = structuredClone(this.lodCounter.groups);
    } else if (this.lastChunkCounts) {
      for (const [k, v] of Object.entries(this.lastChunkCounts)) v.forEach((n, i) => this.lodCounter.add(k, i, n));
    }
    // buildings: one level per building (group with userData.lods)
    const bs = lodSettings('building', this.quality.tier);
    for (const g of this.buildings.values()) {
      const lods = g.userData.lods;
      if (!lods || lods.length < 2) { this.lodCounter.add('building', 0); continue; }
      const st = (g.userData.lodState ??= new LodState());
      const d = eff(cam.position.distanceTo(g.position));
      const lvl = Math.min(st.update(d, bs), lods.length - 1);
      if (lvl !== g.userData.lodLevel) {
        lods.forEach((m, i) => { m.visible = i === lvl; });
        g.userData.lodLevel = lvl;
      }
      this.lodCounter.add('building', lvl);
    }
  }

  /** Numbers for the debug display and measurements. */
  debugStats() {
    const info = this.renderer.info;
    const particles = this.fx.smoke.alive + this.fx.fire.alive + this.fx.flames.alive;
    return {
      tier: this.quality.tier, calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries,
      chars: this.chars.info(), particles, projectiles: this.projectiles?.length ?? 0, lod: this.lodCounter.groups,
    };
  }

  /** LOD counters (for tests and measurements). */
  lodStats() { return { ...this.debugStats(), lod: structuredClone(this.lodCounter.groups) }; }

  /** Pre-bake frequent figures (avoids hitches at first appearance). */
  prepareFigures() {
    for (const k of ['serf', 'worker', 'soldier.sword', 'soldier.sword.leader', 'soldier.bow', 'soldier.spear', `hero.${[...this.sim.entities.values()].find((e) => e.kind === 'hero')?.hero ?? 'bertram'}`]) this.chars.variantFor(k);
  }

  /**
   * Last seen state of an enemy building as an entity-like object for syncBuilding.
   * @param {any} gh snapshot from src/sim/systems/vision.js
   */
  ghostEntity(gh) {
    const def = BUILDINGS[gh.type];
    return {
      id: gh.id, kind: 'building', type: gh.type, owner: gh.owner, x: gh.x, y: gh.y, w: gh.w, h: gh.h, level: gh.level,
      done: gh.done, progress: gh.progress, work: 1000, hp: def?.levels[gh.level]?.hp ?? 1, burning: false, workers: [],
    };
  }

  /** @param {any} e building (or ghostEntity) @param {boolean} [ghost] last seen state: no effects */
  syncBuilding(e, ghost = false) {
    let g = this.buildings.get(e.id);
    const stages = !e.done && e.type !== 'bridge' && hasConstructionStages();
    const p = e.work ? e.progress / e.work : 1;
    // construction phase: foundation → walls → roof truss (KayKit), afterwards the finished house growing under the scaffolding
    const stage = !stages ? -1 : e.level > 0 ? 3 : p < 0.22 ? 0 : p < 0.45 ? 1 : p < 0.68 ? 2 : 3;
    const key = `${e.level}:${e.done}:${stage}`;
    if (!g || g.userData.key !== key) {
      const old = g;
      g = buildingModel(e.type, e.w, e.h, e.level, e.owner);
      g.userData.key = key;
      g.userData.rect = { x: e.x, y: e.y, w: e.w, h: e.h };
      if (!e.done) {
        if (stage >= 0 && stage < 3) {
          const body = g.getObjectByName('body');
          body.visible = false;
          g.userData.lods = null;
          const st = constructionStage(stage, e.w - 0.4, e.h - 0.4);
          if (st) { st.name = 'stage'; g.add(st); }
        }
        if (e.type !== 'bridge') { const sc = scaffold(e.w, e.h); sc.name = 'scaffold'; g.add(sc); }
      }
      g.position.set(e.x + e.w / 2, e.type === 'bridge' ? this.bridgeDeckY(e) : this.footY(e.x, e.y, e.w, e.h), e.y + e.h / 2);
      // bridge: do not level the terrain below
      if (e.type === 'bridge') g.userData.noPad = true;
      if (e.type === 'villageCenter' || e.type === 'headquarters') {
        const fire = campfireModel(); fire.position.set(-e.w / 2 - 0.2, 0, e.h / 2 + 0.6); g.add(fire);
      }
      // height of the house (for smoke, fire, health bars, camera)
      const body = g.getObjectByName('body');
      g.userData.body = body;
      const bb = new THREE.Box3().setFromObject(body);
      g.userData.height = Number.isFinite(bb.max.y) ? Math.max(0.6, bb.max.y) : 2;
      // chimneys: smoke while working (position relative to half the footprint, height relative to house size)
      const cp = CHIMNEY[e.type];
      g.userData.chimney = cp ? new THREE.Vector3(cp[0] * e.w / 2, cp[1] * g.userData.height, cp[2] * e.h / 2) : null;
      g.traverse((m) => { m.userData.entity = e.id; });
      patchFogTree(g);
      this.scene.add(g);
      this.buildings.set(e.id, g);
      if (old) {
        this.scene.remove(old);
        // phase change: dust
        if (!e.done && !ghost) this.fx.dust(g.position.x, g.position.y, g.position.z, 10, 0.5);
      }
    }
    const rotor = g.getObjectByName('rotor');
    if (rotor) rotor.rotation.z = this.time * 1.5;
    const spin = g.getObjectByName('spinY');
    if (spin) spin.rotation.y = this.time * 2.2;
    const flame = g.getObjectByName('flame');
    if (flame) flame.scale.y = 0.8 + Math.sin(this.time * 12 + e.id) * 0.2;
    g.userData.ghost = ghost;
    const near = sphereVisible(this.frustum, g.position.x, g.position.y + 1, g.position.z, Math.max(e.w, e.h));
    if (ghost) {
      if (!e.done && (stage === 3 || stage < 0)) g.getObjectByName('body').scale.y = 0.08 + 0.92 * (stage === 3 ? Math.min(1, (p - 0.68) / 0.32 * 0.85 + 0.15) : p);
      return;
    }
    if (!e.done) {
      const body = g.getObjectByName('body');
      if (stage === 3 || stage < 0) body.scale.y = 0.08 + 0.92 * (stage === 3 ? Math.min(1, (p - 0.68) / 0.32 * 0.85 + 0.15) : p);
      // progress: small dust clouds while building
      const last = this.buildProgress.get(e.id) ?? e.progress;
      if (near && e.progress > last && this.fx.chance(0.35)) {
        this.fx.dust(g.position.x + (Math.random() - 0.5) * e.w * 0.7, g.position.y + 0.1, g.position.z + (Math.random() - 0.5) * e.h * 0.7, 2, 0.28);
      }
      this.buildProgress.set(e.id, e.progress);
    }
    if (!near) return;
    // damage: below 50 % smoke, below 25 % (or e.burning) fire
    const maxHp = BUILDINGS[e.type]?.levels[e.level]?.hp ?? e.hp;
    const frac = e.done ? e.hp / maxHp : 1;
    const burning = e.burning || (e.done && frac < 0.25);
    const dt = this.frameDt ?? 0.016;
    if (e.done && (frac < 0.5 || e.burning)) {
      const H = g.userData.height ?? 2;
      const k = (1 - Math.min(1, frac / 0.5)) * 0.8 + (burning ? 0.5 : 0.35);
      if (Math.random() < dt * 9 * k * this.fx.density) {
        const sx = g.position.x + (Math.random() - 0.5) * e.w * 0.45, sz = g.position.z + (Math.random() - 0.5) * e.h * 0.45;
        this.fx.smokePuff(sx, g.position.y + H * (0.75 + Math.random() * 0.25), sz, burning ? 1 : 0.6, burning ? 0.55 : 0.45);
      }
      if (burning && Math.random() < dt * 40 * this.fx.density) {
        // flames on roof and walls: on the edge of the footprint or at the top
        const top = Math.random() < 0.5;
        const a = Math.random() * Math.PI * 2;
        const rx = top ? (Math.random() - 0.5) * e.w * 0.5 : Math.cos(a) * e.w * 0.34;
        const rz = top ? (Math.random() - 0.5) * e.h * 0.5 : Math.sin(a) * e.h * 0.34;
        this.fx.flame(g.position.x + rx, g.position.y + (top ? H * (0.6 + Math.random() * 0.35) : H * (0.15 + Math.random() * 0.5)), g.position.z + rz, 0.55);
      }
    }
    // chimney smoke when the building works (workers inside) or castle/village centre
    const ch = g.userData.chimney;
    if (ch && e.done && frac >= 0.5 && Math.random() < dt * 2.2 * this.fx.density) {
      const working = e.type === 'headquarters' || e.type === 'villageCenter' || e.workers?.some((id) => this.sim.entities.get(id)?.state === 'working');
      if (working) this.fx.smokePuff(g.position.x + ch.x, g.position.y + ch.y, g.position.z + ch.z, 0, 0.22);
    }
  }

  /** Ground height of a building surface: the plane from the simulation, otherwise (older save games) from the mesh. */
  footY(x, y, w, h) {
    const m = this.sim.map;
    if (m.inBounds(x, y) && m.inBounds(x + w - 1, y + h - 1) && m.slope(x, y, w, h) === 0) return this.terrain.padY(m.heights[m.idx(x, y)]);
    return this.terrain.rectHeight(x, y, w, h);
  }

  /** Ruin from the simulation (if present). */
  syncRuin(e) {
    const m = (this.simRuins ??= new Map());
    if (m.has(e.id)) return;
    const w = e.w ?? 3, h = e.h ?? 3;
    const g = ruinModel(w - 0.6, h - 0.6);
    g.position.set(e.x + w / 2, this.footY(e.x, e.y, w, h), e.y + h / 2);
    patchFogTree(g);
    this.scene.add(g);
    m.set(e.id, g);
  }

  /** Role of a serf/worker/fighter for the figure manifest. */
  roleOf(e) {
    if (e.kind === 'unit') return e.militia ? 'soldier.spear' : 'serf';
    if (e.kind === 'worker') return 'worker';
    if (e.kind === 'hero') return `hero.${e.hero}`;
    if (e.kind === 'specialist') return `specialist.${e.spec}`;
    const line = UNITS[e.def]?.line ?? 'sword';
    if (this.sim.players[e.owner]?.neutral) return line === 'bow' ? 'bandit.bow' : 'bandit';
    return `soldier.${line}${e.kind === 'leader' ? '.leader' : ''}`;
  }

  syncUnit(e, alpha, prev, dt) {
    const px = prev ? prev.px + (e.px - prev.px) * alpha : e.px;
    const py = prev ? prev.py + (e.py - prev.py) * alpha : e.py;
    const x = px / UNIT, z = py / UNIT;
    const moving = prev && (prev.px !== e.px || prev.py !== e.py);
    const st = (this.unitYaw ??= new Map());
    let yaw = st.get(e.id) ?? 0;
    if (moving) yaw = Math.atan2(e.px - prev.px, e.py - prev.py);
    let clip = moving ? 'walk' : 'idle';
    let visible = true;
    if (e.kind === 'worker') {
      visible = !e.inside;
      if (e.state === 'camping') clip = 'sit';
    } else {
      const working = !moving && e.job && e.path.length === 0;
      if (working) {
        const t = this.sim.entities.get(e.job.target);
        if (t) {
          const cx = t.kind === 'building' ? t.x + t.w / 2 : t.x + 0.5, cz = t.kind === 'building' ? t.y + t.h / 2 : t.y + 0.5;
          yaw = Math.atan2(cx - x, cz - z);
          clip = t.kind === 'building' ? 'build' : t.kind === 'tree' ? 'chop' : 'mine';
        }
      } else if (moving && e.carry) clip = 'carry';
    }
    st.set(e.id, yaw);
    const tint = e.kind === 'worker' ? PROF_COLORS[e.prof] ?? null : null;
    this.chars.set(e.id, this.roleOf(e), { x, y: this.groundY(x, z), z, yaw, clip, team: PLAYER_COLORS_HEX(e.owner), tint, visible, speed: 1 });
  }

  /** Captains, soldiers, heroes, traps and siege weapons. */
  syncFighter(e, alpha, prev) {
    const px = prev ? prev.px + (e.px - prev.px) * alpha : e.px;
    const py = prev ? prev.py + (e.py - prev.py) * alpha : e.py;
    const x = px / UNIT, z = py / UNIT;
    const y = this.groundY(x, z);
    const moving = prev && (prev.px !== e.px || prev.py !== e.py);
    const st = (this.unitYaw ??= new Map());
    let yaw = st.get(e.id) ?? 0;
    if (moving) yaw = Math.atan2(e.px - prev.px, e.py - prev.py);
    else if (e.targetId) {
      const t = this.sim.entities.get(e.targetId);
      if (t) {
        const tx = t.kind === 'building' ? t.x + t.w / 2 : (t.px ?? t.x * UNIT) / UNIT, tz = t.kind === 'building' ? t.y + t.h / 2 : (t.py ?? t.y * UNIT) / UNIT;
        yaw = Math.atan2(tx - x, tz - z);
      }
    }
    st.set(e.id, yaw);
    // traps, bombs, self-firing: small static objects (few)
    if (e.kind !== 'hero' && e.kind !== 'leader' && e.kind !== 'soldier' && e.kind !== 'specialist') {
      let g = this.units.get(e.id);
      if (!g) {
        g = gadgetModel(e.kind, e.owner);
        g.traverse((m) => { m.userData.entity = e.id; });
        this.scene.add(g);
        this.units.set(e.id, g);
      }
      g.position.set(x, y, z);
      g.rotation.y = g.userData.spin ? (this.time ?? 0) * 0.3 : yaw;
      const flame = g.getObjectByName('flame');
      if (flame) flame.scale.y = 0.8 + Math.sin((this.time ?? 0) * 13 + e.id) * 0.25;
      return;
    }
    const hit = this.hitAt?.get(e.id);
    const shotAt = this.shotAt?.get(e.id);
    const attacking = (hit !== undefined && this.time - hit < 0.7) || (shotAt !== undefined && this.time - shotAt < 0.7);
    const line = e.kind === 'hero' ? null : UNITS[e.def]?.line;
    const ranged = line === 'bow' || line === 'lightCav' || line === 'rifle' || (e.kind === 'hero' && !!HEROES[e.hero]?.ranged);
    const clip = e.down ? 'die' : attacking ? (ranged ? 'shoot' : 'attack') : moving ? (line === 'lightCav' || line === 'heavyCav' ? 'run' : 'walk') : 'idle';
    const role = this.roleOf(e);
    const rec = this.chars.set(e.id, role, { x, y, z, yaw, clip, team: PLAYER_COLORS_HEX(e.owner), speed: line === 'cannon' ? 0.6 : 1 });
    // hoof dust
    if (moving && (line === 'lightCav' || line === 'heavyCav') && this.fx.chance(0.22) && rec.lod.level >= 0 && rec.lod.level <= 1) this.fx.hoofDust(x, y, z);
    // health bars: captains (squad as a whole) and heroes
    if (e.kind === 'soldier' || rec.lod.level < 0 || rec.lod.level > 2) return;
    let frac;
    if (e.kind === 'leader') {
      const d = UNITS[e.def];
      const total = d.hp + d.soldierHp * d.soldiers;
      let cur = e.hp;
      for (const id of e.soldiers) cur += this.sim.entities.get(id)?.hp ?? 0;
      frac = Math.max(0, cur / total);
    } else if (e.kind === 'specialist') {
      frac = Math.max(0, e.hp / (SPECIALISTS[e.spec]?.hp ?? 1));
      // eigener unsichtbarer Dieb: schwacher Schleier-Ring
      if (e.hidden && rec.lod.level <= 1) this.marks.ring(x, y + 0.04, z, 0.34, 0xb0a4d0, 0.55, 0.04, 0.15);
    } else frac = Math.max(0, e.hp / HEROES[e.hero].hp);
    const sel = this.selectedIds?.has(e.id);
    if (frac < 0.999 || sel || e.kind === 'hero') this.bars.add(x, y + (e.kind === 'hero' ? 1.55 : 1.3) + (rec.variant?.seat ?? 0), z, frac, e.kind === 'hero' ? 40 : 32, 6);
  }

  addProjectile(ev) {
    const from = new THREE.Vector3(ev.from.x / UNIT, 0, ev.from.y / UNIT);
    const to = new THREE.Vector3(ev.to.x / UNIT, 0, ev.to.y / UNIT);
    from.y = this.terrain.heightAt(from.x, from.z) + (ev.kind === 'bolt' ? 2.6 : 0.6);
    to.y = this.terrain.heightAt(to.x, to.z) + 0.4;
    // shooter: shot animation
    const shooter = this.nearestFighter(ev.from.x, ev.from.y, ev.owner);
    if (shooter) (this.shotAt ??= new Map()).set(shooter, this.time ?? 0);
    const geo = ev.kind === 'ball' ? (this.ballGeo ??= new THREE.SphereGeometry(0.08, 8, 6)) : (this.arrowGeo ??= arrowGeometry());
    const m = new THREE.Mesh(geo, ev.kind === 'ball' ? mat(0x2a2a2e) : (this.arrowMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })));
    m.position.copy(from); m.lookAt(to);
    m.castShadow = true;
    this.scene.add(m);
    const dist = from.distanceTo(to);
    (this.projectiles ??= []).push({ m, from, to, t: 0, dur: Math.max(0.15, dist / (ev.kind === 'ball' ? 16 : 22)), arc: ev.kind === 'ball' ? 0.25 + dist * 0.06 : 0.15 + dist * 0.05, kind: ev.kind, trail: 0 });
    if (ev.kind === 'ball') this.fx.smokePuff(from.x, from.y + 0.1, from.z, 0.3, 0.3);
    else if (ev.kind === 'bullet') this.fx.smokePuff(from.x, from.y + 0.35, from.z, 0.15, 0.18);
  }

  /** Fighter at the firing position (for the shot animation). */
  nearestFighter(px, py, owner) {
    let best = 0, bd = 400 * 400;
    for (const e of this.sim.entities.values()) {
      if (e.owner !== owner || (e.kind !== 'leader' && e.kind !== 'soldier' && e.kind !== 'hero')) continue;
      const d = (e.px - px) ** 2 + (e.py - py) ** 2;
      if (d < bd) { bd = d; best = e.id; }
    }
    return best;
  }

  addExplosion(x, z) {
    const m = new THREE.Mesh(this.boomGeo ??= new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.85 }));
    m.position.set(x, this.terrain.heightAt(x, z) + 0.3, z);
    this.scene.add(m);
    (this.booms ??= []).push({ m, t: 0 });
    this.fx.explosion(x, this.terrain.heightAt(x, z), z);
  }

  updateEffects(dt) {
    const tmp = new THREE.Vector3();
    for (const p of this.projectiles ?? []) {
      p.t += dt / p.dur;
      const k = Math.min(1, p.t);
      tmp.copy(p.m.position);
      p.m.position.lerpVectors(p.from, p.to, k);
      p.m.position.y += Math.sin(k * Math.PI) * p.arc;
      // align to the flight direction
      if (k < 1) { const dir = p.m.position.clone().sub(tmp); if (dir.lengthSq() > 1e-8) p.m.lookAt(p.m.position.clone().add(dir)); }
      // trail
      p.trail += dt;
      if (p.trail > 0.016) { p.trail = 0; this.fx.trail(p.m.position.x, p.m.position.y, p.m.position.z, p.kind); }
      if (k >= 1) {
        this.scene.remove(p.m);
        if (p.kind === 'ball') this.fx.dust(p.to.x, p.to.y - 0.3, p.to.z, 6, 0.4, 0x8c7a5e);
      }
    }
    this.projectiles = (this.projectiles ?? []).filter((p) => p.t < 1);
    for (const b of this.booms ?? []) {
      b.t += dt * 2.5;
      b.m.scale.setScalar(1 + b.t * 3);
      b.m.material.opacity = Math.max(0, 0.85 * (1 - b.t));
      if (b.t >= 1) { this.scene.remove(b.m); b.m.material.dispose(); }
    }
    this.booms = (this.booms ?? []).filter((b) => b.t < 1);
    // ruins: smoke, sink after a while and disappear
    for (const r of this.ruins) {
      r.t += dt;
      if (r.t < 8 && Math.random() < dt * 4 * this.fx.density) this.fx.smokePuff(r.x + (Math.random() - 0.5) * r.w * 0.5, r.y + 0.5, r.z + (Math.random() - 0.5) * r.w * 0.5, 1, 0.4);
      if (r.t < 3 && Math.random() < dt * 10 * this.fx.density) this.fx.flame(r.x + (Math.random() - 0.5) * r.w * 0.4, r.y + 0.3, r.z + (Math.random() - 0.5) * r.w * 0.4, 0.3);
      const fade = Math.max(0, Math.min(1, (r.t - RUIN_TIME) / 2.5));
      if (fade > 0) {
        r.g.position.y = r.y - fade * 0.8;
        r.g.traverse((m) => { if (m.isMesh) m.material.opacity = 1 - fade; });
      }
      if (fade >= 1) { this.scene.remove(r.g); r.g.traverse((m) => { if (m.isMesh) m.material.dispose(); }); }
    }
    this.ruins = this.ruins.filter((r) => r.t < RUIN_TIME + 2.5);
    if (this.rain) {
      const pos = this.rain.geometry.attributes.position;
      const t = this.rig.target;
      for (let i = 0; i < pos.count; i += 2) {
        let y = pos.getY(i) - dt * 18;
        if (y < t.y - 2) {
          y = t.y + 18;
          const x = t.x + (Math.random() - 0.5) * 50, z = t.z + (Math.random() - 0.5) * 50;
          pos.setX(i, x); pos.setZ(i, z); pos.setX(i + 1, x); pos.setZ(i + 1, z);
        }
        pos.setY(i, y); pos.setY(i + 1, y + 0.5);
      }
      pos.needsUpdate = true;
    }
  }

  /** Make weather visible: rain as falling streaks, winter with snow on terrain, trees and ice. */
  applyWeather(state) {
    if (this.rain) { this.scene.remove(this.rain); this.rain.geometry.dispose(); this.rain = null; }
    const snow = state === 'winter';
    this.weather = state;
    this.env.setMood(state);
    this.terrain.uniforms.uSnow.value = snow ? 1 : 0;
    this.terrain.uniforms.uWet.value = state === 'rain' ? 1 : 0;
    this.natureUniforms.uSnow.value = snow ? 1 : 0;
    markerUniforms.uSnow.value = snow ? 1 : 0;
    this.water.setWeather(state);
    // hide grass and flowers in winter
    for (const m of this.scatter ?? []) m.visible = snow ? m.userData.winter : true;
    if (state === 'rain') {
      const n = this.quality.tier === 'low' ? 600 : 1400, pos = new Float32Array(n * 6);
      const c = this.rig.target;
      for (let i = 0; i < n; i++) {
        const x = c.x + (Math.random() - 0.5) * 50, z = c.z + (Math.random() - 0.5) * 50, y = c.y + Math.random() * 20;
        pos.set([x, y, z, x + 0.06, y + 0.5, z + 0.03], i * 6);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xd0dce8, transparent: true, opacity: 0.45 }));
      this.rain.frustumCulled = false;
      this.scene.add(this.rain);
    }
  }

  // ---------- Add-on: bridges ----------

  /** Deck height of a bridge (rectangle in tiles): shore height at both ends. */
  bridgeDeckY(r) {
    const t = this.terrain, horiz = r.w >= r.h;
    const a = horiz ? t.heightAt(r.x - 0.5, r.y + r.h / 2) : t.heightAt(r.x + r.w / 2, r.y - 0.5);
    const b = horiz ? t.heightAt(r.x + r.w + 0.5, r.y + r.h / 2) : t.heightAt(r.x + r.w / 2, r.y + r.h + 0.5);
    return Math.max(t.waterLevelY + 0.25, Math.min(a, b) + 0.05);
  }

  /** Ground height for figures: on bridges the deck instead of the riverbed. */
  groundY(x, z) {
    const h = this.terrain.heightAt(x, z);
    const m = this.sim.map, tx = Math.floor(x), tz = Math.floor(z);
    if (!this.sim.addon || !m.inBounds(tx, tz) || !(m.flags[m.idx(tx, tz)] & BRIDGE)) return h;
    const b = this.sim.entities.get(m.owner[m.idx(tx, tz)]) ?? (this.sim.bridgeSites ?? []).find((s) => tx >= s.x && tz >= s.y && tx < s.x + s.w && tz < s.y + s.h);
    return Math.max(h, b ? this.bridgeDeckY(b) : this.terrain.waterLevelY + 0.25);
  }

  /** Selection: rings under units, frames around buildings, health bars for selected buildings. */
  syncSelection(selected) {
    const t = this.time ?? 0;
    const pulse = 0.85 + Math.sin(t * 5) * 0.15;
    for (const id of selected) {
      const e = this.sim.entities.get(id);
      if (!e) continue;
      if (e.kind === 'building') {
        const g = this.buildings.get(id);
        const y = g ? g.position.y : this.terrain.rectHeight(e.x, e.y, e.w, e.h);
        this.marks.rect(e.x + e.w / 2, y + 0.06, e.y + e.h / 2, e.w + 0.2, e.h + 0.2, 0xfff2b0, 0.95 * pulse, 0.09);
        const maxHp = BUILDINGS[e.type]?.levels[e.level]?.hp ?? e.hp;
        if (e.done) this.bars.add(e.x + e.w / 2, y + (g?.userData.height ?? 2.5) + 0.45, e.y + e.h / 2, e.hp / maxHp, 64, 8);
        continue;
      }
      const ids = e.kind === 'leader' ? [e.id, ...e.soldiers] : [e.id];
      for (const k of ids) {
        const r = this.chars.records.get(k);
        if (!r || !r.visible) continue;
        const big = r.variant?.attach.length ? 0.5 : 0.32;
        // fit the ring to the slope (slope from the height field over the ring diameter)
        const px = r.position.x, pz = r.position.z, hf = this.terrain;
        const sx = (hf.heightAt(px + big, pz) - hf.heightAt(px - big, pz)) / (2 * big);
        const sz = (hf.heightAt(px, pz + big) - hf.heightAt(px, pz - big)) / (2 * big);
        const gy = Math.max(r.position.y, hf.heightAt(px, pz));
        this.marks.ring(px, gy + 0.05, pz, big, k === e.id ? 0xfff2b0 : 0xe8dca0, k === e.id ? pulse : 0.7, 0.05, 0.4, sx, sz);
      }
    }
  }

  syncGhost(ghost) {
    const key = ghost ? `${ghost.type}:${ghost.w ?? ''}x${ghost.h ?? ''}` : '';
    if (key !== this.ghostKey) {
      if (this.ghost) this.scene.remove(this.ghost);
      this.ghost = null;
      this.ghostKey = key;
      if (ghost) {
        const def = BUILDINGS[ghost.type];
        const gw = ghost.w ?? def.w, gh = ghost.h ?? def.h;
        const g = buildingModel(ghost.type, gw, gh, 0, 0);
        g.traverse((m) => {
          if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.55; m.castShadow = false; }
        });
        const pad = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45 }));
        pad.name = 'pad'; pad.position.y = 0.08; g.add(pad);
        this.ghost = g;
        this.scene.add(g);
      }
    }
    if (ghost && this.ghost) {
      const def = BUILDINGS[ghost.type];
      const gw = ghost.w ?? def.w, gh = ghost.h ?? def.h;
      // Building on a slope: ghost stands on the future plane; green = flat, yellow = will be levelled, red = not possible.
      // bridge: deck height between the banks (is not levelled)
      const lvl = ghost.slope?.state;
      const y = ghost.type === 'bridge' ? this.bridgeDeckY({ x: ghost.x, y: ghost.y, w: gw, h: gh })
        : ghost.valid && ghost.slope ? this.terrain.padY(ghost.slope.target) : this.terrain.rectHeight(ghost.x, ghost.y, gw, gh);
      this.ghost.position.set(ghost.x + gw / 2, y, ghost.y + gh / 2);
      const pad = this.ghost.getObjectByName('pad');
      pad.material.color.setHex(!ghost.valid ? 0xe5484d : lvl === 'level' ? 0xf4bd4f : 0x4cd964);
      pad.position.y = lvl === 'level' && ghost.valid ? 0.03 : 0.08;
    }
  }

  // ---------- Picking ----------

  /** Ground point under a screen position. @returns {{x:number,z:number}|null} */
  pickGround(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    // let the ray run over the height field (faster than a raycast against the fine mesh)
    const { origin, direction } = this.raycaster.ray;
    const t = this.terrain;
    const above = (d) => origin.y + direction.y * d - t.heightAt(origin.x + direction.x * d, origin.z + direction.z * d);
    let prev = 0, step = 0.35;
    if (above(0) < 0) return null;
    for (let d = step; d < 700; d += step) {
      if (above(d) <= 0) {
        let lo = prev, hi = d;
        for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (above(mid) > 0) lo = mid; else hi = mid; }
        return { x: origin.x + direction.x * hi, z: origin.z + direction.z * hi };
      }
      prev = d;
      step = Math.min(2, step * 1.04);
    }
    return null;
  }

  /**
   * Entity under a screen position. Figures are instanced: selection via the screen distance
   * to the body (capsule from foot to head point); buildings and small items via raycast. The nearer one wins.
   */
  pickEntity(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    // last seen buildings in fog are not selectable (otherwise they would reveal the current state)
    const objs = [...this.units.values(), ...[...this.buildings.values()].filter((g) => !g.userData.ghost)];
    const hit = this.raycaster.intersectObjects(objs, true)[0];
    let best = null, bestScore = Infinity, bestDepth = Infinity;
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    const px = clientX - rect.left, py = clientY - rect.top;
    const touch = matchMedia?.('(pointer: coarse)').matches;
    for (const r of this.chars.records.values()) {
      if (!r.visible || r.dying || r.lod.level < 0) continue;
      a.copy(r.position).project(this.camera);
      b.copy(r.position); b.y += 0.95 + (r.variant?.seat ?? 0);
      b.project(this.camera);
      if (a.z > 1 || b.z > 1) continue;
      const ax = (a.x + 1) / 2 * rect.width, ay = (1 - a.y) / 2 * rect.height;
      const bx = (b.x + 1) / 2 * rect.width, by = (1 - b.y) / 2 * rect.height;
      // Abstand Punkt–Strecke
      const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L));
      const d = Math.hypot(ax + dx * t - px, ay + dy * t - py);
      const radius = Math.max(touch ? 16 : 9, Math.sqrt(L) * 0.32);
      if (d > radius) continue;
      // figure closest to the pointer (in groups otherwise always the frontmost, e.g. a soldier in front of
      // the hero); at equal distance the front one
      const score = d + a.z * 1e-3;
      if (score < bestScore) { bestScore = score; bestDepth = a.z; best = r; }
    }
    if (best && (!hit || bestDepth <= new THREE.Vector3().copy(hit.point).project(this.camera).z)) {
      const e = this.sim.entities.get(best.id);
      return e?.kind === 'soldier' ? e.leader : best.id;
    }
    return hit ? hit.object.userData.entity ?? null : null;
  }

  /**
   * Last seen enemy building (fog) under a screen position: centre in tiles
   * for an attack move, or null.
   */
  pickGhost(clientX, clientY) {
    const ghosts = [...this.buildings.values()].filter((g) => g.userData.ghost);
    if (!ghosts.length) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(ghosts, true)[0];
    let o = hit?.object;
    while (o && !o.userData.rect) o = o.parent;
    const r = o?.userData.rect;
    return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2, id: o.userData.entity ?? null } : null;
  }

  /** World point in screen coordinates. */
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height, behind: v.z > 1 };
  }
}

/** Time after which a ruin (without simulation ruin) begins to fade (seconds). */
const RUIN_TIME = 14;

/** Chimney positions per building type: x/z relative to half the footprint, y relative to house height. */
const CHIMNEY = {
  smithy: [0.25, 0.95, -0.35], brickworks: [0.45, 0.95, 0.4], alchemist: [0.35, 0.95, -0.4], residence: [0.12, 1.0, -0.05],
  bank: [-0.3, 0.95, -0.3], villageCenter: [0.3, 0.9, -0.4], foundry: [0.5, 0.95, -0.4], headquarters: [0.15, 0.85, 0.1],
  sawmill: [-0.3, 0.9, -0.4], stonemason: [0.3, 0.95, -0.3], university: [-0.3, 0.95, -0.2], farm: [-0.45, 0.9, -0.2],
};

/** Arrow with tip and fletching (corners coloured). */
function arrowGeometry() {
  const parts = [];
  const shaft = new THREE.CylinderGeometry(0.012, 0.012, 0.42, 4).rotateX(Math.PI / 2);
  const tip = new THREE.ConeGeometry(0.03, 0.08, 4).rotateX(Math.PI / 2).translate(0, 0, 0.25);
  const fl = new THREE.BoxGeometry(0.06, 0.004, 0.08).translate(0, 0, -0.18);
  const fl2 = new THREE.BoxGeometry(0.004, 0.06, 0.08).translate(0, 0, -0.18);
  for (const [g, c] of [[shaft, 0x8a6a42], [tip, 0x9aa0a8], [fl, 0xe8e2d4], [fl2, 0xe8e2d4]]) {
    const n = g.index ? g.toNonIndexed() : g;
    const col = new Float32Array(n.attributes.position.count * 3);
    const cc = new THREE.Color(c);
    for (let i = 0; i < col.length; i += 3) { col[i] = cc.r; col[i + 1] = cc.g; col[i + 2] = cc.b; }
    n.setAttribute('color', new THREE.BufferAttribute(col, 3));
    n.deleteAttribute('uv');
    parts.push(n);
  }
  return mergeGeometries(parts);
}

/**
 * Procedural figures (fallback without models) for the figure system.
 * Keys as in the manifest: 'serf', 'worker', 'sword', 'sword:leader', 'heavyCav', 'cannon', 'hero:bertram', 'horse' …
 */
function proceduralFigures() {
  const TEAM = 0xff00ff, TINT = 0x00ffff; // detection colours for the masks
  const swapColors = (g, from, to) => g.traverse((m) => { if (m.isMesh && m.material.color?.getHex() === from) m.material = mat(to); });
  const fig = (make, opts = {}) => (kind) => {
    const g = make(kind);
    // mark colour of player 0 as mask
    swapColors(g, PLAYER_COLORS[0], TEAM);
    return { group: g, team: TEAM, tint: opts.tint ? TINT : undefined, tintDefault: opts.tintDefault, saddle: opts.saddle, radius: opts.radius ?? 0.3 };
  };
  const unit = (line) => fig((kind) => unitModel(line, 0, kind.endsWith(':leader')), { radius: line.endsWith('Cav') ? 0.5 : line === 'cannon' ? 0.5 : 0.3 });
  const out = {
    serf: fig(() => serfModel(0), {}),
    worker: fig(() => { const g = serfModel(0, TINT); g.userData.tool.visible = false; return g; }, { tint: true, tintDefault: 0xc39a5e }),
    horse: fig(() => { const h = horseModel(0x8a6a4a, 0, 1); const g = new THREE.Group(); g.add(h); g.userData = { horse: h, horseLegs: h.userData.legs }; return g; }, { saddle: 0.62, radius: 0.5 }),
  };
  for (const line of ['sword', 'spear', 'bow', 'lightCav', 'heavyCav', 'cannon', 'rifle']) out[line] = unit(line);
  for (const hero of ['bertram', 'hedda', 'gerold', 'falk', 'morla']) out['hero:' + hero] = fig(() => heroModel(hero, 0), {});
  // add-on: thief (dark), scout (green)
  out.thief = fig(() => serfModel(0, 0x34373d), {});
  out.scout = fig(() => serfModel(0, 0x6f7f4a), {});
  out.hero = out['hero:bertram'];
  return out;
}

/** Marker of a free bridge site: posts at both banks, weak board above (add-on). */
function bridgeSiteMarker(s, deckY) {
  const g = new THREE.Group();
  const horiz = s.w >= s.h, len = Math.max(s.w, s.h), wid = Math.min(s.w, s.h);
  const post = new THREE.CylinderGeometry(0.06, 0.07, 0.7, 6).translate(0, 0.35, 0);
  const pm = mat(0x6a4a2a);
  for (const end of [-1, 1]) for (const side of [-1, 1]) {
    const m = new THREE.Mesh(post, pm);
    const a = end * (len / 2 + 0.35), b = side * (wid / 2 - 0.2);
    m.position.set(horiz ? a : b, -0.1, horiz ? b : a);
    g.add(m);
  }
  const plank = new THREE.Mesh(new THREE.PlaneGeometry(horiz ? len : wid - 0.3, horiz ? wid - 0.3 : len).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xe8d29a, transparent: true, opacity: 0.22, depthWrite: false }));
  plank.position.y = 0.02;
  g.add(plank);
  g.position.set(s.x + s.w / 2, deckY, s.y + s.h / 2);
  return g;
}
