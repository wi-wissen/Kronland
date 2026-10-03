// Rendering: reads the state of the simulation and draws it. Never changes the game state.

import * as THREE from 'three';
import { Terrain } from './terrain.js';
import { Water } from './water.js';
import { Environment } from './environment.js';
import { getQuality } from './quality.js';
import {
  treeVariants, stumpVariant, scatterKinds, depositModel, shaftMarker, spotMarker, markerUniforms, rng,
} from './nature.js';
import { CameraRig } from './CameraRig.js';
import { BUILDINGS } from '../sim/data/buildings.js';
import { UNIT } from '../sim/fixed.js';
import { WATER, CLIFF, OCCUPIED, RESERVED } from '../sim/map.js';

import {
  buildingModel, scaffold, serfModel, mat, PROF_COLORS, campfireModel,
  unitModel, heroModel, gadgetModel, healthBar,
} from './models.js';
import { UNITS, HEROES } from '../sim/data/units.js';
import { instancedParts, heroAsset } from './assets.js';
import { PLAYER_COLORS } from './models.js';

const PLAYER_COLORS_HEX = (owner) => PLAYER_COLORS[owner % 4];

const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();

export class Renderer {
  /** @param {HTMLCanvasElement} canvas @param {import('../sim/sim.js').Sim} sim */
  constructor(canvas, sim) {
    this.sim = sim;
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
    this.scene.add(this.terrain.mesh, this.water.mesh);
    this.rig = new CameraRig(this.camera, { w: sim.map.width, h: sim.map.height });
    this.rig.groundAt = (x, z) => this.terrain.heightAt(x, z);

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

    const hq = sim.findBuilding(0, 'headquarters');
    if (hq) this.rig.lookAt(hq.x + hq.w / 2, hq.y + hq.h / 2 + 3);
  }

  /**
   * Compile and bind all shader programs (incl. shadow pass) at the first frame, with all
   * objects visible. Deliberately not in the constructor so that the game start is not blocked.
   */
  warmUp() {
    try {
      this.rig.update(0);
      this.env.follow(this.rig.target, this.rig.dist);
      const r = this.renderer;
      const size = r.getSize(new THREE.Vector2());
      r.setSize(32, 32, false);
      const cull = [];
      this.scene.traverse((o) => { if (o.frustumCulled) { cull.push(o); o.frustumCulled = false; } });
      r.render(this.scene, this.camera);
      for (const o of cull) o.frustumCulled = true;
      r.setSize(Math.max(1, size.x), Math.max(1, size.y), false);
    } catch { /* without GL context */ }
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
    const variants = treeVariants(q.treeDetail, this.natureUniforms);
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

    const counts = variants.map(() => 0);
    for (const it of items) counts[it.v]++;
    variants.forEach((v, k) => {
      const m = new THREE.InstancedMesh(v.geometry, v.material, Math.max(1, counts[k]));
      m.count = 0;
      m.castShadow = true; m.receiveShadow = true;
      m.name = 'trees';
      this.scene.add(m);
      v.mesh = m;
    });
    /** @type {Map<number, {v:number, i:number, x:number, z:number, s:number}>} */
    this.treeIndex = new Map();
    this.treeVariants = variants;
    const c = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    for (const it of items) {
      const v = variants[it.v], m = v.mesh, i = m.count++;
      const s = it.s * v.scale;
      tmpP.set(it.x, this.terrain.heightAt(it.x, it.z) - 0.04, it.z);
      tmpQ.setFromAxisAngle(up, it.rot);
      tmpS.set(s, s * (0.9 + ((it.h >>> 20) % 25) / 100), s);
      tmpM.compose(tmpP, tmpQ, tmpS);
      m.setMatrixAt(i, tmpM);
      // colour variation per tree (autumn dabs on broadleaf trees)
      const r = ((it.h >>> 7) % 100) / 100;
      c.setRGB(0.88 + r * 0.22, 0.9 + r * 0.16, 0.86 + ((it.h >>> 15) % 20) / 100);
      if (v.kind !== 'conifer' && (it.h >>> 22) % 23 === 0) c.setRGB(1.35, 1.05, 0.55);
      m.setColorAt(i, c);
      if (it.id) this.treeIndex.set(it.id, { v: it.v, i, x: it.x, z: it.z, s });
    }
    for (const v of variants) {
      v.mesh.instanceMatrix.needsUpdate = true;
      if (v.mesh.instanceColor) v.mesh.instanceColor.needsUpdate = true;
      v.mesh.computeBoundingSphere();
    }
    // tree stumps (felled trees)
    const st = stumpVariant(this.natureUniforms);
    this.stumps = new THREE.InstancedMesh(st.geometry, st.material, Math.max(1, trees.length));
    this.stumps.count = 0;
    this.stumps.castShadow = true; this.stumps.receiveShadow = true;
    this.stumps.frustumCulled = false;
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
    const m = this.treeVariants[t.v].mesh;
    m.setMatrixAt(t.i, new THREE.Matrix4().makeScale(0, 0, 0));
    m.instanceMatrix.needsUpdate = true;
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
      const m = new THREE.InstancedMesh(kind.geometry, kind.material, list.length);
      const big = name.startsWith('kk') || name.startsWith('mt') || name.startsWith('rock') || name.startsWith('bush');
      m.castShadow = big; m.receiveShadow = true;
      m.name = 'scatter-' + name;
      list.forEach((it, i) => {
        // let rocks sink in a little; water lilies float on the water
        const y = it.water ? t.waterY + 0.01 : t.heightAt(it.x, it.z) - (name.startsWith('mt') ? 0.35 * it.s : big ? 0.06 * it.s : 0.01);
        tmpP.set(it.x, y, it.z);
        tmpQ.setFromAxisAngle(up, it.rot);
        tmpS.set(it.s, it.s * (name.startsWith('kk') ? 0.8 : 1), it.s);
        tmpM.compose(tmpP, tmpQ, tmpS);
        m.setMatrixAt(i, tmpM);
        if (!this.scatterByTile.has(it.tile)) this.scatterByTile.set(it.tile, []);
        this.scatterByTile.get(it.tile).push([m, i]);
      });
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
      m.userData.winter = kind.winter;
      this.scene.add(m);
      this.scatter.push(m);
    }
  }

  /** Hide decoration under a surface (new buildings). */
  hideScatter(x, y, w, h) {
    const { map } = this.sim;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let j = y - 1; j <= y + h; j++) for (let i = x - 1; i <= x + w; i++) {
      if (!map.inBounds(i, j)) continue;
      const list = this.scatterByTile.get(map.idx(i, j));
      if (!list) continue;
      for (const [m, k] of list) { m.setMatrixAt(k, zero); m.instanceMatrix.needsUpdate = true; }
      this.scatterByTile.delete(map.idx(i, j));
    }
  }

  buildMarkers() {
    for (const e of this.sim.entities.values()) {
      if (e.kind !== 'pile') continue;
      const g = new THREE.Group();
      const d = depositModel(e.res, e.id);
      d.rotation.y = (e.id * 1.7) % 6.28;
      g.add(d);
      g.position.set(e.x + 0.5, this.terrain.heightAt(e.x + 0.5, e.y + 0.5) - 0.03, e.y + 0.5);
      this.scene.add(g);
      this.piles.set(e.id, g);
    }
    for (const s of this.sim.shafts) {
      const g = shaftMarker(s.res);
      g.position.set(s.x + 1.5, this.terrain.rectHeight(s.x, s.y, 3, 3) - 0.1, s.y + 1.5);
      g.rotation.y = ((s.x * 7 + s.y * 3) % 4) * (Math.PI / 2);
      this.scene.add(g);
      this.markers.push({ g, x: s.x, y: s.y });
    }
    for (const s of this.sim.spots) {
      const g = spotMarker();
      g.position.set(s.x + 2, this.terrain.rectHeight(s.x, s.y, 4, 4) - 0.1, s.y + 2);
      this.scene.add(g);
      this.markers.push({ g, x: s.x, y: s.y });
    }
  }

  /** Adapt trampled ground and levelling to the current buildings. */
  syncGround() {
    const ids = this.buildings;
    let changed = ids.size !== this.padIds.size;
    if (!changed) for (const id of ids.keys()) if (!this.padIds.has(id)) { changed = true; break; }
    if (!changed) return;
    const rects = [];
    for (const id of this.padIds) if (!ids.has(id)) this.terrain.restorePad(id);
    for (const id of ids.keys()) {
      const e = this.sim.entities.get(id);
      if (!e) continue;
      rects.push(e);
      if (!this.padIds.has(id)) { this.terrain.flattenPad(id, e.x, e.y, e.w, e.h); this.hideScatter(e.x, e.y, e.w, e.h); }
    }
    this.padIds = new Set(ids.keys());
    this.terrain.setTrampled(rects);
  }

  // ---------- Events ----------

  onEvents(events) {
    for (const ev of events) {
      if (ev.type === 'shot') this.addProjectile(ev);
      else if (ev.type === 'hit') (this.hitAt ??= new Map()).set(ev.by, this.time ?? 0);
      else if (ev.type === 'explosion') this.addExplosion(ev.x / UNIT, ev.y / UNIT);
      else if (ev.type === 'weather') this.applyWeather(ev.state);
      if (ev.type === 'nodeDepleted') {
        this.removeTree(ev.node);
        const p = this.piles.get(ev.node);
        if (p) { this.scene.remove(p); this.piles.delete(ev.node); }
      }
    }
  }

  // ---------- Per frame ----------

  /**
   * @param {number} alpha 0…1 between last and current tick
   * @param {number} dt seconds since last frame
   * @param {Map<number,{px:number,py:number}>} prev positions before the last tick
   * @param {{ selected: Set<number>, ghost: null|{type:string,x:number,y:number,valid:boolean} }} view
   */
  frame(alpha, dt, prev, view) {
    if (!this.warmed) { this.warmed = true; this.buildWorld(); this.warmUp(); }
    const sim = this.sim;
    this.frameDt = dt;
    this.time = (this.time ?? 0) + dt;
    const seen = new Set();

    for (const e of sim.entities.values()) {
      if (e.kind === 'building') { seen.add(e.id); this.syncBuilding(e); }
      else if (e.kind === 'unit' || e.kind === 'worker') { seen.add(e.id); this.syncUnit(e, alpha, prev.get(e.id), dt); }
      else if (e.px !== undefined) { seen.add(e.id); this.syncFighter(e, alpha, prev.get(e.id)); }
      else if (e.kind === 'pile') {
        const g = this.piles.get(e.id);
        if (g) g.scale.setScalar(0.55 + 0.45 * Math.min(1, e.amount / 400));
      }
    }
    for (const [id, g] of this.buildings) if (!seen.has(id)) { this.scene.remove(g); this.buildings.delete(id); }
    for (const [id, g] of this.units) if (!seen.has(id)) {
      this.scene.remove(g);
      if (g.userData.hb) this.scene.remove(g.userData.hb);
      this.units.delete(id);
    }

    // hide markers as soon as something is built there
    for (const m of this.markers) m.g.visible = sim.map.owner[sim.map.idx(m.x, m.y)] === 0;

    this.updateEffects(dt);
    this.syncSelection(view.selected);
    this.syncGhost(view.ghost);

    this.syncGround();
    this.natureUniforms.uTime.value = this.time;
    this.water.update(this.time);
    for (const m of this.markers) {
      const b = m.g.getObjectByName('banner');
      if (b) b.rotation.y = Math.sin(this.time * 2.2 + m.x) * 0.25;
    }

    this.rig.update(dt);
    this.env.follow(this.rig.target, this.rig.dist);
    this.env.tick();
    this.renderer.render(this.scene, this.camera);
  }

  syncBuilding(e) {
    let g = this.buildings.get(e.id);
    const key = `${e.level}:${e.done}`;
    if (!g || g.userData.key !== key) {
      if (g) this.scene.remove(g);
      g = buildingModel(e.type, e.w, e.h, e.level, e.owner);
      g.userData.key = key;
      if (!e.done) {
        const sc = scaffold(e.w, e.h); sc.name = 'scaffold'; g.add(sc);
      }
      g.position.set(e.x + e.w / 2, this.terrain.rectHeight(e.x, e.y, e.w, e.h), e.y + e.h / 2);
      if (e.type === 'villageCenter' || e.type === 'headquarters') {
        const fire = campfireModel(); fire.position.set(-e.w / 2 - 0.2, 0, e.h / 2 + 0.6); g.add(fire);
      }
      g.traverse((m) => { m.userData.entity = e.id; });
      this.scene.add(g);
      this.buildings.set(e.id, g);
    }
    const rotor = g.getObjectByName('rotor');
    if (rotor) rotor.rotation.z = this.time * 1.5;
    const flame = g.getObjectByName('flame');
    if (flame) flame.scale.y = 0.8 + Math.sin(this.time * 12 + e.id) * 0.2;
    if (!e.done) {
      const body = g.getObjectByName('body');
      const p = e.work ? e.progress / e.work : 1;
      body.scale.y = 0.08 + 0.92 * p;
    }
  }

  syncUnit(e, alpha, prev, dt) {
    let g = this.units.get(e.id);
    if (!g) {
      g = e.kind === 'worker' ? serfModel(e.owner, PROF_COLORS[e.prof]) : serfModel(e.owner);
      if (e.kind === 'worker') g.userData.tool.visible = false;
      g.traverse((m) => { m.userData.entity = e.id; });
      this.scene.add(g);
      this.units.set(e.id, g);
    }
    const px = prev ? prev.px + (e.px - prev.px) * alpha : e.px;
    const py = prev ? prev.py + (e.py - prev.py) * alpha : e.py;
    const x = px / UNIT, z = py / UNIT;
    const moving = prev && (prev.px !== e.px || prev.py !== e.py);
    if (moving) g.rotation.y = Math.atan2(e.px - prev.px, e.py - prev.py);
    g.position.set(x, this.terrain.heightAt(x, z), z);
    const { body, legs, tool } = g.userData;
    const ph = this.time * 9 + e.id;
    legs[0].rotation.x = moving ? Math.sin(ph) * 0.6 : 0;
    legs[1].rotation.x = moving ? -Math.sin(ph) * 0.6 : 0;
    body.position.y = moving ? Math.abs(Math.sin(ph)) * 0.03 : 0;
    if (e.kind === 'worker') {
      g.visible = !e.inside;
      if (e.state === 'camping') { body.rotation.x = 0.35; }
      else body.rotation.x = 0;
      return;
    }
    const working = !moving && e.job && e.path.length === 0;
    tool.rotation.x = working ? -Math.max(0, Math.sin(this.time * 6 + e.id)) * 1.6 : 0;
    body.rotation.x = working ? Math.max(0, Math.sin(this.time * 6 + e.id)) * 0.2 : 0;
    if (working) {
      const t = this.sim.entities.get(e.job.target);
      if (t) {
        const cx = t.kind === 'building' ? t.x + t.w / 2 : t.x + 0.5, cz = t.kind === 'building' ? t.y + t.h / 2 : t.y + 0.5;
        g.rotation.y = Math.atan2(cx - x, cz - z);
      }
    }
  }

  /** Captains, soldiers, heroes, traps and siege weapons. */
  syncFighter(e, alpha, prev) {
    let g = this.units.get(e.id);
    if (!g) {
      const ha = e.kind === 'hero' ? heroAsset(e.hero) : null;
      if (ha) {
        g = new THREE.Group();
        ha.obj.scale.setScalar(0.5);
        g.add(ha.obj);
        g.userData = { anim: ha, current: null };
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.34, 20).rotateX(-Math.PI / 2), mat(PLAYER_COLORS_HEX(e.owner), { flatShading: false }));
        ring.position.y = 0.03; g.add(ring);
      } else if (e.kind === 'hero') g = heroModel(e.hero, e.owner);
      else if (e.kind === 'leader' || e.kind === 'soldier') g = unitModel(UNITS[e.def].line, e.owner, e.kind === 'leader');
      else g = gadgetModel(e.kind, e.owner);
      g.userData.def = e.def;
      g.traverse((m) => { m.userData.entity = e.kind === 'soldier' ? e.leader : e.id; });
      if (e.kind === 'leader' || e.kind === 'hero') { const hb = healthBar(); hb.name = 'hb'; this.scene.add(hb); g.userData.hb = hb; }
      this.scene.add(g);
      this.units.set(e.id, g);
    }
    const px = prev ? prev.px + (e.px - prev.px) * alpha : e.px;
    const py = prev ? prev.py + (e.py - prev.py) * alpha : e.py;
    const x = px / UNIT, z = py / UNIT;
    const moving = prev && (prev.px !== e.px || prev.py !== e.py);
    if (moving) g.rotation.y = Math.atan2(e.px - prev.px, e.py - prev.py);
    else if (e.targetId) {
      const t = this.sim.entities.get(e.targetId);
      if (t) {
        const tx = t.kind === 'building' ? t.x + t.w / 2 : (t.px ?? t.x * UNIT) / UNIT, tz = t.kind === 'building' ? t.y + t.h / 2 : (t.py ?? t.y * UNIT) / UNIT;
        g.rotation.y = Math.atan2(tx - x, tz - z);
      }
    }
    g.position.set(x, this.terrain.heightAt(x, z), z);
    if (g.userData.anim) { this.animateHero(g, e, moving); }
    const { body, legs, arm, horse } = g.userData;
    const ph = this.time * 9 + e.id;
    if (legs) {
      legs[0] && (legs[0].rotation.x = moving ? Math.sin(ph) * 0.6 : 0);
      legs[1] && (legs[1].rotation.x = moving ? -Math.sin(ph) * 0.6 : 0);
    }
    if (horse) horse.position.y = moving ? Math.abs(Math.sin(ph)) * 0.04 : 0;
    const hit = this.hitAt?.get(e.id);
    if (arm) arm.rotation.x = hit !== undefined && this.time - hit < 0.35 ? -Math.sin(((this.time - hit) / 0.35) * Math.PI) * 1.6 : 0;
    if (body && e.kind === 'hero') body.rotation.x = e.down ? -1.4 : 0;
    const hb = g.userData.hb;
    if (hb) {
      let frac;
      if (e.kind === 'leader') {
        const d = UNITS[e.def];
        const total = d.hp + d.soldierHp * d.soldiers;
        let cur = e.hp;
        for (const id of e.soldiers) cur += this.sim.entities.get(id)?.hp ?? 0;
        frac = Math.max(0, cur / total);
      } else frac = Math.max(0, e.hp / HEROES[e.hero].hp);
      hb.position.set(x, g.position.y + (e.kind === 'hero' ? 1.45 : 1.25), z);
      hb.quaternion.copy(this.camera.quaternion);
      const fg = hb.getObjectByName('fg');
      fg.scale.x = Math.max(0.001, frac); fg.position.x = -0.3 * (1 - frac);
      fg.material.color.setHex(frac > 0.5 ? 0x6fcf7a : frac > 0.25 ? 0xe0a93b : 0xef6b6b);
    }
  }

  /** Choose and play the hero figure animations. */
  animateHero(g, e, moving) {
    const { anim } = g.userData;
    const hit = this.hitAt?.get(e.id);
    const attacking = hit !== undefined && this.time - hit < 0.6;
    const want = e.down ? 'Death_A_Pose' : attacking ? '1H_Melee_Attack_Chop' : moving ? 'Walking_A' : 'Idle';
    if (g.userData.current !== want && anim.clips[want]) {
      const next = anim.mixer.clipAction(anim.clips[want]);
      next.reset().fadeIn(0.2).play();
      if (g.userData.action) g.userData.action.fadeOut(0.2);
      g.userData.action = next;
      g.userData.current = want;
    }
    anim.mixer.update(this.frameDt ?? 0.016);
  }

  addProjectile(ev) {
    const from = new THREE.Vector3(ev.from.x / UNIT, 0, ev.from.y / UNIT);
    const to = new THREE.Vector3(ev.to.x / UNIT, 0, ev.to.y / UNIT);
    from.y = this.terrain.heightAt(from.x, from.z) + (ev.kind === 'bolt' ? 2.6 : 0.6);
    to.y = this.terrain.heightAt(to.x, to.z) + 0.4;
    const geo = ev.kind === 'ball' ? (this.ballGeo ??= new THREE.SphereGeometry(0.08, 6, 4)) : (this.arrowGeo ??= new THREE.BoxGeometry(0.02, 0.02, 0.4));
    const m = new THREE.Mesh(geo, mat(ev.kind === 'ball' ? 0x2a2a2e : 0x5a3b22));
    m.position.copy(from); m.lookAt(to);
    this.scene.add(m);
    (this.projectiles ??= []).push({ m, from, to, t: 0, dur: Math.max(0.15, from.distanceTo(to) / 22) });
  }

  addExplosion(x, z) {
    const m = new THREE.Mesh(this.boomGeo ??= new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.85 }));
    m.position.set(x, this.terrain.heightAt(x, z) + 0.3, z);
    this.scene.add(m);
    (this.booms ??= []).push({ m, t: 0 });
  }

  updateEffects(dt) {
    for (const p of this.projectiles ?? []) {
      p.t += dt / p.dur;
      const k = Math.min(1, p.t);
      p.m.position.lerpVectors(p.from, p.to, k);
      p.m.position.y += Math.sin(k * Math.PI) * 0.8;
      if (k >= 1) this.scene.remove(p.m);
    }
    this.projectiles = (this.projectiles ?? []).filter((p) => p.t < 1);
    for (const b of this.booms ?? []) {
      b.t += dt * 2.5;
      b.m.scale.setScalar(1 + b.t * 3);
      b.m.material.opacity = Math.max(0, 0.85 * (1 - b.t));
      if (b.t >= 1) { this.scene.remove(b.m); b.m.material.dispose(); }
    }
    this.booms = (this.booms ?? []).filter((b) => b.t < 1);
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

  syncSelection(selected) {
    const marks = (this.selMarks ??= new Map());
    for (const [id, m] of marks) {
      if (!selected.has(id) || !this.sim.entities.has(id)) {
        this.selectionGroup.remove(m);
        if (!m.userData.shared) m.geometry.dispose();
        marks.delete(id);
      }
    }
    for (const id of selected) {
      const e = this.sim.entities.get(id);
      if (!e) continue;
      let m = marks.get(id);
      if (e.kind !== 'building') {
        const u = this.units.get(id);
        if (!u) continue;
        if (!m) {
          m = new THREE.Mesh(this.ringGeo ??= new THREE.RingGeometry(0.22, 0.3, 16).rotateX(-Math.PI / 2), mat(0xfff2b0, { flatShading: false }));
          m.userData.shared = true;
          marks.set(id, m); this.selectionGroup.add(m);
        }
        m.position.copy(u.position).y += 0.04;
      } else if (e.kind === 'building' && !m) {
        const pts = [[e.x, e.y], [e.x + e.w, e.y], [e.x + e.w, e.y + e.h], [e.x, e.y + e.h]]
          .map(([x, z]) => new THREE.Vector3(x, this.terrain.heightAt(x, z) + 0.06, z));
        m = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xfff2b0 }));
        marks.set(id, m); this.selectionGroup.add(m);
      }
    }
  }

  syncGhost(ghost) {
    const key = ghost ? `${ghost.type}` : '';
    if (key !== this.ghostKey) {
      if (this.ghost) this.scene.remove(this.ghost);
      this.ghost = null;
      this.ghostKey = key;
      if (ghost) {
        const def = BUILDINGS[ghost.type];
        const g = buildingModel(ghost.type, def.w, def.h, 0, 0);
        g.traverse((m) => {
          if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.55; m.castShadow = false; }
        });
        const pad = new THREE.Mesh(new THREE.PlaneGeometry(def.w, def.h).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45 }));
        pad.name = 'pad'; pad.position.y = 0.08; g.add(pad);
        this.ghost = g;
        this.scene.add(g);
      }
    }
    if (ghost && this.ghost) {
      const def = BUILDINGS[ghost.type];
      this.ghost.position.set(ghost.x + def.w / 2, this.terrain.rectHeight(ghost.x, ghost.y, def.w, def.h), ghost.y + def.h / 2);
      this.ghost.getObjectByName('pad').material.color.setHex(ghost.valid ? 0x4cd964 : 0xe5484d);
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

  /** Entity under a screen position (units and buildings via raycast). */
  pickEntity(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const objs = [...this.units.values(), ...this.buildings.values()];
    const hit = this.raycaster.intersectObjects(objs, true)[0];
    return hit ? hit.object.userData.entity ?? null : null;
  }

  /** World point in screen coordinates. */
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height, behind: v.z > 1 };
  }
}
