// Developer mode: tools on top of the running game (only loaded when switched on).
//
// - Wireframe and LOD colours (wireframe.js), triangle counts in total and per selected object
// - A*: path of the selected figure from the sim state, replay of the search with an observer
//   (open/closed list, f/g/h on hover, step-by-step animation), regions
// - Grid overlays: walkability, height, buildability/slope, vision/fog with vision circles, territories
// - Figure info above the heads, "stats for nerds" (data for src/ui/dev/DevStats.vue)
//
// Principle: read only. The simulation is never changed (not even via commands). Overlays are only
// created when they are switched on; dispose() clears everything away (restart, load, mode off).

import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { devState } from './state.js';
import { WireframeView } from './wireframe.js';
import { TileLayer } from './tileLayer.js';
import { searchForFigure, SearchPlayback } from './astar.js';
import {
  walkLayer, heightLayer, buildLayer, visionLayer, territoryLayer, regionLayer, searchLayer, sightCircles, slopeAt,
} from './overlayData.js';
import { figureInfo, focusFigure, FIGURE_KINDS } from './figureInfo.js';
import { UNIT } from '../sim/fixed.js';
import { WATER, OCCUPIED, RESERVED, CLIFF, BRIDGE } from '../sim/map.js';
import { t, has } from '../i18n/index.js';
import './dev.css';

/** Size of the ring buffer for frame times (chart). */
export const FRAME_SAMPLES = 120;
const MAX_PATH = 2048;
const MAX_LABELS = 60;

const triCount = (g) => (g ? (g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3 : 0);
const vertCount = (g) => g?.attributes.position?.count ?? 0;

/** Triangles and vertices of an object tree. */
function polyOf(root) {
  let tris = 0, verts = 0;
  root?.traverse?.((o) => { if (o.isMesh) { tris += triCount(o.geometry); verts += vertCount(o.geometry); } });
  return { tris: Math.round(tris), verts };
}

export class DevTools {
  /** @param {import('../game/Engine.js').Engine} engine */
  constructor(engine) {
    this.engine = engine;
    this.r = engine.renderer;
    this.sim = engine.sim;
    this.wire = new WireframeView();
    /** Frame times (ms) as a ring buffer */
    this.frameTimes = new Float32Array(FRAME_SAMPLES);
    this.frameIdx = 0;
    this.lastNow = performance.now();
    this.fps = 0; this.fpsFrames = 0; this.fpsT0 = this.lastNow;
    this.simMs = 0; this.aiMs = 0; this.simMax = 0;
    this.info = { calls: 0, triangles: 0, points: 0, lines: 0 };
    this.hash = null;
    this.gridKey = '';
    this.searchKey = '';
    /** own goal for the debug search (tile) or null */
    this.customGoal = null;
    this.playing = false;
    this.playAcc = 0;
    /** Pointer position for f/g/h and tile info */
    this.pointer = null;
    this.hover = null;
    /** 'goal' | 'inspect' | null – the next click/tap on the map belongs to developer mode */
    this.pickMode = null;
    this.listen();
    this.r.devHook = this;
  }

  // ---------- Events ----------

  listen() {
    const canvas = this.r.renderer.domElement;
    this.onMove = (e) => { if (e.pointerType === 'mouse') this.pointer = { x: e.clientX, y: e.clientY, at: performance.now() }; };
    this.onLeave = () => { this.pointer = null; };
    // In selection mode intercepts the next click before the game controls see it
    this.onDown = (e) => {
      if (!this.pickMode || e.target !== canvas) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const g = this.r.pickGround(e.clientX, e.clientY);
      const mode = this.pickMode;
      this.pickMode = null;
      if (!g) return;
      const x = Math.floor(g.x), y = Math.floor(g.z), m = this.sim.map;
      if (!m.inBounds(x, y)) return;
      if (mode === 'goal') { this.customGoal = m.idx(x, y); this.searchKey = ''; this.playFromStart = true; }
      else { this.pointer = { x: e.clientX, y: e.clientY, at: performance.now(), sticky: true }; this.hoverAt = 0; }
    };
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerleave', this.onLeave);
    window.addEventListener('pointerdown', this.onDown, true);
  }

  /** Use the next click as the goal of the debug search ('goal') or to inspect a tile ('inspect'). */
  pick(mode) { this.pickMode = this.pickMode === mode ? null : mode; }

  /** Discard the own goal (show the figure's path again). */
  clearGoal() { this.customGoal = null; this.searchKey = ''; }

  // ---------- Game loop hooks ----------

  /** After every simulation tick (measurements). */
  afterTick(simMs, aiMs) {
    this.simMs = this.simMs * 0.8 + simMs * 0.2;
    this.aiMs = this.aiMs * 0.8 + aiMs * 0.2;
    this.simMax = Math.max(this.simMax * 0.995, simMs);
  }

  /** Renderer: right before drawing. */
  beforeRender() {
    const o = this.wireOpts();
    if (o) this.wire.before(this.r, o);
  }

  /** Renderer: right after drawing. */
  afterRender() {
    const i = this.r.renderer.info;
    this.info = { calls: i.render.calls, triangles: i.render.triangles, points: i.render.points, lines: i.render.lines };
    const o = this.wireOpts();
    if (o) this.wire.after(this.r, o);
  }

  wireOpts() {
    const w = devState.wire;
    if (!(w.terrain || w.buildings || w.figures || w.water || w.nature)) return null;
    return { cats: w, mode: devState.wireMode, lodColors: devState.lodColors };
  }

  /** Per frame after Renderer.frame (camera and figure positions are current). */
  frame(dt) {
    const now = performance.now();
    const ms = now - this.lastNow;
    this.lastNow = now;
    this.frameTimes[this.frameIdx] = ms;
    this.frameIdx = (this.frameIdx + 1) % FRAME_SAMPLES;
    this.fpsFrames++;
    if (now - this.fpsT0 >= 500) { this.fps = (this.fpsFrames * 1000) / (now - this.fpsT0); this.fpsFrames = 0; this.fpsT0 = now; }
    try {
      this.updateSearch(dt);
      this.updateRegions();
      this.updateGrid(now);
      this.updatePathLine();
      this.updateLabels(now);
      this.updateHover(now);
    } catch (err) {
      // tools must never stop the game
      if (!this.warned) { this.warned = true; console.warn('Developer mode:', err); }
    }
  }

  // ---------- A* ----------

  /** Figure being looked at (first selection). */
  figure() { return focusFigure(this.sim, this.engine.selected); }

  updateSearch(dt) {
    const show = devState.search || devState.path;
    const e = show ? this.figure() : null;
    if (!e) {
      if (this.searchLayer) this.searchLayer.visible = false;
      this.pb = null; this.searchKey = ''; this.playing = false;
      if (!e) this.customGoal = null;
      return;
    }
    const goal = this.customGoal ?? (e.path?.length ? e.path[e.path.length - 1] : -1);
    const key = `${e.id}:${goal}`;
    if (key !== this.searchKey) {
      this.searchKey = key;
      const rec = goal >= 0 ? searchForFigure(this.sim, e, goal) : null;
      this.pb = rec ? new SearchPlayback(rec, this.sim.map.width * this.sim.map.height) : null;
      if (this.pb) {
        if (this.playFromStart) { this.pb.seek(0); this.playing = true; this.playAcc = 0; } else this.pb.seek(rec.steps);
      }
      this.playFromStart = false;
      this.searchVersion = -1;
    }
    const pb = this.pb;
    if (pb && this.playing) {
      this.playAcc += dt * devState.playSpeed;
      const n = Math.floor(this.playAcc);
      if (n > 0) { this.playAcc -= n; pb.seek(pb.step + n); }
      if (pb.done) this.playing = false;
    }
    if (!devState.search || !pb) { if (this.searchLayer) this.searchLayer.visible = false; return; }
    this.searchLayer ??= new TileLayer(this.r, { order: 7, name: 'dev-astar' });
    this.searchLayer.visible = true;
    this.searchLayer.grid(devState.gridLines);
    if (pb.version !== this.searchVersion) {
      this.searchVersion = pb.version;
      this.searchLayer.set(searchLayer(pb, this.searchLayer.data));
    }
  }

  /** Play/pause/step/restart of the A* animation (from the panel). */
  play() {
    if (!this.pb) return;
    if (this.pb.done) this.pb.seek(0);
    this.playing = true; this.playAcc = 0;
  }
  pause() { this.playing = false; }
  stepBy(n) { if (this.pb) { this.playing = false; this.pb.seek(this.pb.step + n); } }
  restart() { if (this.pb) { this.pb.seek(0); this.playing = false; } }
  toEnd() { if (this.pb) { this.pb.seek(this.pb.rec.steps); this.playing = false; } }
  /** Record the search anew (e.g. after construction work). */
  recompute() { this.searchKey = ''; }

  updateRegions() {
    if (!devState.regions) { if (this.regionLayer) this.regionLayer.visible = false; return; }
    this.regionLayer ??= new TileLayer(this.r, { order: 4, name: 'dev-regions' });
    this.regionLayer.visible = true;
    this.regionLayer.grid(devState.gridLines);
    const m = this.sim.map, e = this.figure();
    const focus = e ? m.regionAt(m.idx(Math.floor(e.px / UNIT), Math.floor(e.py / UNIT))) : 0;
    const key = `${m.version}:${m.frozen}:${focus}`;
    if (key === this.regionKey) return;
    this.regionKey = key;
    const res = regionLayer(m, focus, this.regionLayer.data);
    this.regionCount = res.count;
    this.regionLayer.set(res.data);
  }

  // ---------- Grid overlays ----------

  updateGrid(now) {
    const mode = devState.grid;
    if (mode === 'none') {
      if (this.gridLayer) this.gridLayer.visible = false;
      if (this.circles) this.circles.visible = false;
      this.gridKey = '';
      return;
    }
    this.gridLayer ??= new TileLayer(this.r, { order: 5, name: 'dev-grid' });
    this.gridLayer.visible = true;
    this.gridLayer.grid(devState.gridLines);
    const sim = this.sim, m = sim.map;
    // Rebuild only on change (occupancy, frost, vision) and at most twice per second
    // heightVersion: levelling when building on a slope changes heights and slope
    const key = mode === 'height' ? `h:${m.version}:${m.heightVersion}` : mode === 'build' ? `b:${m.version}:${m.frozen}:${m.heightVersion}` : mode === 'vision' ? `v:${sim.vision?.version}:${m.version}` : mode === 'territory' ? `t:${m.version}:${this.buildingKey()}` : `${mode}:${m.version}:${m.frozen}`;
    if (key !== this.gridKey && now - (this.gridAt ?? 0) > 450) {
      this.gridKey = key; this.gridAt = now;
      const out = this.gridLayer.data;
      if (mode === 'walk') walkLayer(m, out);
      else if (mode === 'height') this.heightRange = heightLayer(m, sim.waterLevel ?? 0, 0, out);
      else if (mode === 'build') buildLayer(m, undefined, out);
      else if (mode === 'vision') { visionLayer(sim, this.engine.player, out); this.updateCircles(); }
      else if (mode === 'territory') territoryLayer(sim, out);
      this.gridLayer.set(out);
    }
    if (this.circles) this.circles.visible = mode === 'vision';
  }

  /** Key over finished buildings (territories change with them). */
  buildingKey() {
    let n = 0, s = 0;
    for (const e of this.sim.entities.values()) if (e.kind === 'building' && e.done) { n++; s = (s + e.id * 31 + e.level) | 0; }
    return `${n}:${s}`;
  }

  /** Vision circles of own figures and buildings as lines on the terrain. */
  updateCircles() {
    const list = sightCircles(this.sim, this.engine.player).slice(0, 400);
    const SEG = 40;
    const arr = new Float32Array(Math.max(1, list.length * SEG * 6));
    const ter = this.r.terrain;
    let k = 0;
    for (const c of list) {
      const cx = c.x + 0.5, cz = c.y + 0.5;
      for (let i = 0; i < SEG; i++) {
        for (const j of [i, i + 1]) {
          const a = (j / SEG) * Math.PI * 2, x = cx + Math.cos(a) * c.r, z = cz + Math.sin(a) * c.r;
          arr[k++] = x; arr[k++] = ter.heightAt(x, z) + 0.25; arr[k++] = z;
        }
      }
    }
    if (!this.circles) {
      this.circleMat = new LineMaterial({ color: 0xbff7c8, linewidth: 2, transparent: true, opacity: 0.85, depthTest: true });
      this.circles = new LineSegments2(new LineSegmentsGeometry(), this.circleMat);
      this.circles.frustumCulled = false;
      this.circles.renderOrder = 8;
      this.r.scene.add(this.circles);
    }
    const old = this.circles.geometry;
    const geo = new LineSegmentsGeometry();
    geo.setPositions(arr.subarray(0, Math.max(6, k)));
    this.circles.geometry = geo;
    old.dispose();
    this.circleCount = list.length;
  }

  // ---------- Path ----------

  updatePathLine() {
    const e = devState.path ? this.figure() : null;
    const path = e?.path ?? [];
    if (!e || (!path.length && !this.pb?.pathTiles)) { if (this.pathGroup) this.pathGroup.visible = false; return; }
    if (!this.pathGroup) this.buildPathObjects();
    this.pathGroup.visible = true;
    const r = this.r, ter = r.terrain, W = this.sim.map.width;
    const rec = r.chars.records.get(e.id);
    const fx = rec ? rec.position.x : e.px / UNIT, fz = rec ? rec.position.z : e.py / UNIT;
    // Real path from the sim state; with an own goal the route of the debug search
    const tiles = this.customGoal !== null && this.pb?.pathTiles ? this.pb.pathTiles : path;
    const n = Math.min(tiles.length, MAX_PATH - 1);
    const seg = this.pathLine.geometry.attributes.instanceStart.data;
    const pts = this.pathPoints.geometry.attributes.position;
    let px = fx, pz = fz, py = ter.heightAt(fx, fz) + 0.3;
    for (let i = 0; i < n; i++) {
      const k = tiles[i], x = (k % W) + 0.5, z = ((k / W) | 0) + 0.5, y = ter.heightAt(x, z) + 0.3;
      const o = i * 6;
      seg.array[o] = px; seg.array[o + 1] = py; seg.array[o + 2] = pz;
      seg.array[o + 3] = x; seg.array[o + 4] = y; seg.array[o + 5] = z;
      pts.setXYZ(i, x, y, z);
      px = x; py = y; pz = z;
    }
    seg.needsUpdate = true;
    this.pathLine.geometry.instanceCount = n;
    pts.needsUpdate = true;
    this.pathPoints.geometry.setDrawRange(0, n);
    const v = r.viewport ?? { w: 1280, h: 800 };
    this.pathMat.resolution.set(v.w, v.h);
    this.pathMat.color.setHex(this.customGoal !== null ? 0xff8af0 : 0xffffff);
  }

  buildPathObjects() {
    this.pathGroup = new THREE.Group();
    this.pathGroup.name = 'dev-path';
    const geo = new LineSegmentsGeometry();
    geo.setPositions(new Float32Array(MAX_PATH * 6));
    geo.instanceCount = 0;
    this.pathMat = new LineMaterial({ color: 0xffffff, linewidth: 3.5, transparent: true, depthTest: false, depthWrite: false });
    this.pathLine = new LineSegments2(geo, this.pathMat);
    this.pathLine.frustumCulled = false;
    this.pathLine.renderOrder = 20;
    // waypoints: round dots of fixed screen size
    const cv = document.createElement('canvas');
    cv.width = cv.height = 32;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(16, 16, 13, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#3a2a10'; ctx.stroke();
    this.dotTex = new THREE.CanvasTexture(cv);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_PATH * 3), 3).setUsage(THREE.DynamicDrawUsage));
    pg.setDrawRange(0, 0);
    this.dotMat = new THREE.PointsMaterial({ size: 9, sizeAttenuation: false, map: this.dotTex, color: 0xffffff, transparent: true, alphaTest: 0.3, depthTest: false, depthWrite: false });
    this.pathPoints = new THREE.Points(pg, this.dotMat);
    this.pathPoints.frustumCulled = false;
    this.pathPoints.renderOrder = 21;
    this.pathGroup.add(this.pathLine, this.pathPoints);
    this.r.scene.add(this.pathGroup);
  }

  // ---------- Figure info ----------

  updateLabels(now) {
    const mode = devState.labels;
    if (mode === 'off') { if (this.labelBox) this.labelBox.hidden = true; return; }
    if (!this.labelBox) {
      this.labelBox = document.createElement('div');
      this.labelBox.className = 'dev-labels';
      this.labelBox.dataset.testid = 'dev-labels';
      this.labelPool = [];
      this.r.renderer.domElement.parentElement?.appendChild(this.labelBox);
    }
    this.labelBox.hidden = false;
    const r = this.r, sim = this.sim;
    // selection of the figures
    let ids;
    if (mode === 'all') {
      const cam = r.rig.target;
      const list = [];
      for (const rec of r.chars.records.values()) {
        if (!rec.visible || rec.dying || rec.lod.level < 0 || rec.lod.level > 1) continue;
        const e = sim.entities.get(rec.id);
        if (!e || e.kind === 'soldier' || !FIGURE_KINDS.has(e.kind)) continue;
        list.push([rec.id, (rec.position.x - cam.x) ** 2 + (rec.position.z - cam.z) ** 2]);
      }
      list.sort((a, b) => a[1] - b[1]);
      ids = list.slice(0, MAX_LABELS).map((x) => x[0]);
    } else ids = [...this.engine.selected].filter((id) => FIGURE_KINDS.has(sim.entities.get(id)?.kind)).slice(0, MAX_LABELS);
    const refresh = now - (this.labelAt ?? 0) > 200;
    if (refresh) this.labelAt = now;
    const rect = r.renderer.domElement.getBoundingClientRect();
    let used = 0;
    for (const id of ids) {
      const rec = r.chars.records.get(id);
      if (!rec || !rec.visible) continue;
      const p = r.project(rec.position.x, rec.position.y + 1.25 + (rec.variant?.seat ?? 0), rec.position.z);
      if (p.behind || p.x < rect.left - 50 || p.x > rect.right + 50 || p.y < rect.top - 30 || p.y > rect.bottom + 30) continue;
      let el = this.labelPool[used];
      if (!el) { el = document.createElement('div'); el.className = 'dev-label'; this.labelBox.appendChild(el); this.labelPool.push(el); }
      el.hidden = false;
      el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
      if (refresh || el.dataset.id !== String(id)) {
        el.dataset.id = String(id);
        const info = figureInfo(sim, sim.entities.get(id));
        if (info) {
          el.dataset.state = info.state;
          el.textContent = labelText(info);
        }
      }
      used++;
    }
    for (let i = used; i < this.labelPool.length; i++) this.labelPool[i].hidden = true;
  }

  // ---------- Tile info on hover ----------

  layersShown() { return devState.search && this.pb || devState.grid !== 'none' || devState.regions; }

  updateHover(now) {
    const p = this.pointer;
    const sticky = p?.sticky && now - p.at < 5000;
    if (!p || (!sticky && !this.layersShown()) || (p.sticky && !sticky)) { this.hover = null; this.showTip(null); return; }
    if (now - (this.hoverAt ?? 0) < 90) { this.placeTip(p); return; }
    this.hoverAt = now;
    const g = this.r.pickGround(p.x, p.y);
    const m = this.sim.map;
    if (!g) { this.hover = null; this.showTip(null); return; }
    const x = Math.floor(g.x), y = Math.floor(g.z);
    if (!m.inBounds(x, y)) { this.hover = null; this.showTip(null); return; }
    const k = m.idx(x, y), f = m.flags[k];
    const h = {
      x, y, height: m.heights[k], slope: slopeAt(m, x, y), region: m.regionAt(k),
      walk: f & CLIFF ? 'cliff' : f & OCCUPIED ? 'blocked' : f & BRIDGE ? 'bridge' : f & WATER ? (m.frozen ? 'ice' : 'water') : f & RESERVED ? 'reserved' : 'free',
      search: this.pb && devState.search ? this.pb.info(k) : null,
    };
    this.hover = h;
    this.showTip(h, p);
  }

  showTip(h, p) {
    if (!h) { if (this.tip) this.tip.hidden = true; return; }
    if (!this.tip) {
      this.tip = document.createElement('div');
      this.tip.className = 'dev-tip';
      this.tip.dataset.testid = 'dev-tip';
      this.r.renderer.domElement.parentElement?.appendChild(this.tip);
    }
    this.tip.hidden = false;
    const lines = [`${t('dev.tile')} ${h.x}, ${h.y}  ·  ${t('dev.walk.' + h.walk)}`,
      `${t('dev.heightShort')} ${h.height} cm  ·  ${t('dev.slopeShort')} ${h.slope} cm  ·  ${t('dev.regionShort')} ${h.region || '–'}`];
    if (h.search) lines.unshift(`f = g + h = ${h.search.g} + ${h.search.h} = ${h.search.f}   (${t('dev.as.' + h.search.state)})`);
    this.tip.textContent = lines.join('\n');
    this.tip.classList.toggle('has-search', !!h.search);
    this.placeTip(p);
  }

  placeTip(p) {
    if (!this.tip || this.tip.hidden) return;
    const vw = window.innerWidth;
    const x = Math.min(p.x + 16, vw - 300);
    this.tip.style.transform = `translate(${Math.max(4, x)}px, ${Math.max(4, p.y + 18)}px)`;
  }

  // ---------- Data for the UI ----------

  /** Polygons of the selected object at the current LOD level (and of all levels). */
  selectedPoly() {
    const id = [...this.engine.selected][0];
    if (!id) return null;
    const r = this.r, e = this.sim.entities.get(id);
    if (!e) return null;
    if (e.kind === 'building') {
      const g = r.buildings.get(id);
      if (!g) return null;
      const lods = g.userData.lods;
      if (lods?.length > 1) {
        const levels = lods.map((l) => polyOf(l));
        const lvl = g.userData.lodLevel ?? 0;
        return { id, kind: 'building', level: lvl, ...levels[lvl], levels };
      }
      return { id, kind: 'building', level: 0, ...polyOf(g), levels: null };
    }
    const fid = e.kind === 'leader' || FIGURE_KINDS.has(e.kind) ? id : null;
    const rec = fid ? r.chars.records.get(fid) : null;
    const v = rec?.variant;
    if (!v) return null;
    const levels = v.levels.map((geo, i) => {
      let tris = triCount(geo), verts = vertCount(geo);
      for (const a of v.attach) { const ag = a.variant.levels[Math.min(i, a.variant.levels.length - 1)]; tris += triCount(ag); verts += vertCount(ag); }
      return { tris: Math.round(tris), verts };
    });
    // The mesh min(level, meshes − 1) is drawn; from level 1 the animation is throttled, level 3 is rigid
    const lod = rec.lod.level;
    const lvl = Math.min(Math.max(0, lod), levels.length - 1);
    return { id, kind: e.kind, level: lvl, ...levels[lvl], levels, anim: lod <= 0 ? 'full' : lod >= 3 ? 'rigid' : 'reduced' };
  }

  /** GPU name (determined once). */
  gpu() {
    if (this.gpuName !== undefined) return this.gpuName;
    try {
      const gl = this.r.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      this.gpuName = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    } catch { this.gpuName = '?'; }
    return this.gpuName;
  }

  /** State hash (recomputed at most twice per second). */
  stateHash() {
    const now = performance.now();
    if (!this.hash || (now - this.hash.at > 500 && this.hash.tick !== this.sim.tick)) {
      this.hash = { value: this.sim.hash(), tick: this.sim.tick, at: now };
    }
    return this.hash;
  }

  /** All numbers of the "stats for nerds". */
  stats() {
    const r = this.r, gl = r.renderer, sim = this.sim, eng = this.engine;
    const times = this.frameTimes;
    let sum = 0, max = 0, n = 0;
    for (const v of times) if (v > 0) { sum += v; n++; if (v > max) max = v; }
    const entities = {};
    for (const e of sim.entities.values()) entities[e.kind] = (entities[e.kind] ?? 0) + 1;
    const mem = /** @type {any} */ (performance).memory;
    const h = this.stateHash();
    const v = r.viewport ?? { w: 0, h: 0 };
    return {
      fps: this.fps, frameMs: n ? sum / n : 0, frameMax: max,
      simMs: this.simMs, simMax: this.simMax, aiMs: this.aiMs,
      tick: sim.tick, speed: eng.speed, paused: eng.paused,
      hash: h.value.toString(16).padStart(8, '0'), hashTick: h.tick,
      calls: this.info.calls, triangles: this.info.triangles, lines: this.info.lines, points: this.info.points,
      geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, programs: gl.info.programs?.length ?? 0,
      heap: mem ? { used: mem.usedJSHeapSize / 1048576, limit: mem.jsHeapSizeLimit / 1048576 } : null,
      entities,
      width: v.w, height: v.h, dpr: gl.getPixelRatio(), tier: r.quality.tier,
      gpu: this.gpu(),
      camera: { x: r.rig.target.x, z: r.rig.target.z, yaw: r.rig.yaw, pitch: r.rig.pitch, dist: r.rig.dist },
      lod: structuredClone(r.lodCounter.groups),
      chars: r.chars.info(),
      music: eng.audio?.musicInfo?.() ?? null,
    };
  }

  /** State for the panel (queried a few times per second). */
  snapshot() {
    const e = this.figure();
    const pb = this.pb;
    return {
      figure: e ? figureInfo(this.sim, e) : null,
      poly: this.selectedPoly(),
      search: pb ? {
        steps: pb.rec.steps, step: pb.step, result: pb.rec.result, expanded: pb.rec.expanded,
        open: pb.open, closed: pb.closed, pathLen: pb.rec.path?.length ?? 0, playing: this.playing, custom: this.customGoal !== null,
      } : null,
      pickMode: this.pickMode,
      regions: devState.regions ? this.regionCount ?? 0 : null,
      heightRange: devState.grid === 'height' && this.heightRange ? { min: this.heightRange.min, max: this.heightRange.max, step: this.heightRange.contour } : null,
      circles: devState.grid === 'vision' ? this.circleCount ?? 0 : null,
      fog: !!this.sim.vision?.enabled,
      wireMeshes: this.wireOpts() ? this.wire.count : 0,
      triangles: this.info.triangles,
      hover: this.hover,
    };
  }

  // ---------- Cleanup ----------

  dispose() {
    const canvas = this.r.renderer.domElement;
    canvas.removeEventListener('pointermove', this.onMove);
    canvas.removeEventListener('pointerleave', this.onLeave);
    window.removeEventListener('pointerdown', this.onDown, true);
    if (this.r.devHook === this) this.r.devHook = null;
    this.wire.dispose();
    for (const l of [this.gridLayer, this.searchLayer, this.regionLayer]) l?.dispose();
    if (this.circles) { this.r.scene.remove(this.circles); this.circles.geometry.dispose(); this.circleMat.dispose(); }
    if (this.pathGroup) {
      this.r.scene.remove(this.pathGroup);
      this.pathLine.geometry.dispose(); this.pathMat.dispose();
      this.pathPoints.geometry.dispose(); this.dotMat.dispose(); this.dotTex.dispose();
    }
    this.labelBox?.remove();
    this.tip?.remove();
    this.gridLayer = this.searchLayer = this.regionLayer = this.circles = this.pathGroup = this.labelBox = this.tip = null;
    this.pb = null;
  }
}

/** Two-line text above a figure. */
export function labelText(info) {
  const name = t('dev.kind.' + info.kind);
  const state = has('dev.state.' + info.state) ? t('dev.state.' + info.state) : info.state;
  const l1 = `#${info.id} ${name} · ${state}${info.raw && info.raw !== info.state ? ` (${info.raw})` : ''}`;
  const parts = [`${t('dev.hp')} ${Math.max(0, Math.round(info.hp))}/${info.maxHp}`];
  if (info.job) parts.push(`${t('dev.job')} ${info.job}${info.target ? ' #' + info.target : ''}`);
  else if (info.target) parts.push(`${t('dev.target')} #${info.target}`);
  if (info.goal) parts.push(`${t('dev.goal')} ${info.goal.x},${info.goal.y}`);
  return `${l1}\n${parts.join(' · ')}`;
}
