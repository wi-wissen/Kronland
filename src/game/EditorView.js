// World editor: shows a preview simulation with the game renderer and applies tools.
// The simulation never runs (no tick); changes go through src/sim/editor/edit.js and report the same
// events to the renderer as in the game. Changing start spots and size: rebuild the world.
//
// Input:    mouse left = tool (with the "Kamera" tool: pan), right drag = rotate,
//           middle drag = pan, wheel = zoom, WASD/arrows, Q/E.
//           Touch: 1 finger = tool (or pan), 2 fingers = zoom, rotate, pan.
//           Double-click (touch: long press) = code for what is there (onCode), the tool's clicks are undone.

import * as THREE from 'three';
import { Renderer } from '../render/Renderer.js';
import { applyEdit, editorSim, withTerrain, tileInfo, deriveFlags, groundSnapshot, restoreGround } from '../sim/editor/edit.js';
import { createScenarioSim } from '../sim/missions/runtime.js';
import { fromB64 } from '../sim/world.js';
import { OCCUPIED, RESERVED } from '../sim/map.js';
import { BALANCE } from '../sim/data/balance.js';

const PAINT_TOOLS = new Set(['raise', 'lower', 'flatten', 'smooth', 'water', 'land', 'forest', 'erase', 'item', 'track']);
/** Tools that work on exactly the tile under the pointer (brush size does not apply) */
const ONE_TILE = new Set(['item']);
const CLICK_TOOLS = new Set(['pile', 'shaft', 'spot', 'start', 'place']);
const UNDO_MAX = 30;
/** Holding these keeps working on touch: no long press for code with them */
const REPEAT_TOOLS = new Set(['raise', 'lower', 'smooth', 'flatten']);
/** Long press on touch (ms) and allowed finger movement (px), as in the code editor */
const PRESS_MS = 550;
const PRESS_SLOP = 10;
/** Strokes this young (ms) belong to a double-click and are undone by it */
const DOUBLE_MS = 800;

export class EditorView {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {any} scenario
   * @param {{ onUi?: (ui: any) => void, onPick?: (tool: string, x: number, y: number) => void,
   *   onCode?: (target: any, client: { x: number, y: number }) => void }} [opts]
   *   onCode: double-click/long press on the map, target see targetAt()
   */
  constructor(canvas, scenario, opts = {}) {
    this.canvas = canvas;
    this.onUi = opts.onUi ?? (() => {});
    this.onPick = opts.onPick ?? (() => {});
    this.onCode = opts.onCode ?? (() => {});
    /** Recent strokes { t, snap, moved } – a double-click undoes its own clicks */
    this.recent = [];
    this.tool = { tool: 'raise', r: 2, strength: 60, res: 'stone', amount: BALANCE.pile.amount, player: 0, item: 'coin', level: BALANCE.ground.tracks.max };
    this.undoStack = [];
    this.redoStack = [];
    this.preview = false;
    this.hoverTile = null;
    this.pointers = new Map();
    this.load(scenario);
    this.resize = () => this.renderer.setSize(canvas.clientWidth || 1, canvas.clientHeight || 1);
    this.ro = new ResizeObserver(this.resize);
    this.ro.observe(canvas);
    this.resize();
    this.bindInput();
    this.running = true;
    this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      this.frame(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Load a scenario (anew): build the preview simulation and renderer. */
  load(scenario, keepCamera = false) {
    const cam = keepCamera && this.renderer ? { x: this.renderer.rig.target.x, z: this.renderer.rig.target.z, yaw: this.renderer.rig.yaw, dist: this.renderer.rig.dist } : null;
    this.disposeRenderer();
    this.scenario = scenario;
    // Preview runs the mission sections in the world chosen in the panel (world.id, docs/SKRIPTE.md#welten)
    this.sim = this.preview ? createScenarioSim(scenario, this.world ? { world: this.world } : {}) : editorSim(scenario);
    this.renderer = new Renderer(this.canvas, this.sim, { player: 0 });
    if (cam) { this.renderer.rig.lookAt(cam.x, cam.z); this.renderer.rig.yaw = cam.yaw; this.renderer.rig.dist = cam.dist; }
    else this.renderer.rig.lookAt(this.sim.map.width / 2, this.sim.map.height / 2);
    this.brush = this.makeBrush();
    this.renderer.scene.add(this.brush);
    if (this.gridOn) this.renderer.setGrid(true);
    this.resize?.();
  }

  /** Tile grid on/off (kept when the world is rebuilt). */
  setGrid(on) {
    this.gridOn = !!on;
    this.renderer?.setGrid(this.gridOn);
  }

  disposeRenderer() {
    if (!this.renderer) return;
    try { this.renderer.dispose(); } catch { /* disposal must never prevent switching */ }
    this.renderer = null;
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.pressTimer);
    this.ro?.disconnect();
    for (const f of this.off ?? []) f();
    this.disposeRenderer();
  }

  // ---------- Szenario ----------

  /** Scenario with the edited map (for saving and test playing). */
  scenarioWithTerrain(meta = this.scenario) {
    if (this.preview) return meta;
    return withTerrain(meta, this.sim);
  }

  /** Run the world-building script as a preview (view only) or back to editing. */
  setPreview(on, meta) {
    if (on === this.preview) return;
    const sc = on ? this.scenarioWithTerrain(meta) : this.editScenario ?? meta;
    if (on) this.editScenario = sc;
    this.preview = on;
    this.load(sc, true);
    this.emit();
  }

  /** Adopt the result of the preview as the new basis for editing ("burn in" the script world). */
  bakePreview(meta) {
    if (!this.preview) return null;
    const places = { ...(meta.world?.places ?? {}), ...(this.sim.mission?.script?.state.places ?? {}) };
    const baked = withTerrain({ ...meta, world: { ...meta.world, places } }, this.sim);
    this.preview = false;
    this.editScenario = null;
    this.load(baked, true);
    this.emit();
    return baked;
  }

  // ---------- Werkzeuge ----------

  setTool(patch) { Object.assign(this.tool, patch); this.updateBrush(); this.emit(); }

  snapshot() {
    const m = this.sim.map;
    return {
      heights: m.heights.slice(), flags: m.flags.slice(),
      nodes: [...this.sim.entities.values()].filter((e) => e.kind === 'tree' || e.kind === 'pile').map((e) => ({ kind: e.kind, x: e.x, y: e.y, res: e.res, amount: e.amount })),
      spots: this.sim.spots.map((s) => ({ ...s })), shafts: this.sim.shafts.map((s) => ({ ...s })),
      ground: groundSnapshot(m),
    };
  }

  /** Restore the saved map state (undo/redo) – in the same simulation. */
  restore(snap) {
    const sim = this.sim, m = sim.map;
    for (const e of [...sim.entities.values()]) if (e.kind === 'tree' || e.kind === 'pile') sim.removeEntity(e);
    m.heights.set(snap.heights);
    // occupancy by buildings stays; trees and piles come anew
    for (let k = 0; k < m.flags.length; k++) m.flags[k] = (snap.flags[k] & ~OCCUPIED) | (m.flags[k] & OCCUPIED);
    for (const n of snap.nodes) {
      const e = sim.addNode(n.kind, n.x, n.y, n.res, n.amount);
      if (e && n.kind === 'pile') m.reserve(n.x, n.y, 1, 1);
    }
    restoreGround(m, snap.ground);
    sim.spots = snap.spots.map((s) => ({ ...s }));
    sim.shafts = snap.shafts.map((s) => ({ ...s }));
    m.heightVersion++;
    m.version++;
    this.renderer.onEvents([{ type: 'terrainChanged', x: 0, y: 0, w: m.width, h: m.height }, { type: 'natureChanged' }]);
  }

  undo() {
    const s = this.undoStack.pop();
    if (!s) return;
    this.redoStack.push(this.snapshot());
    this.restore(s);
    this.emit();
  }

  redo() {
    const s = this.redoStack.pop();
    if (!s) return;
    this.undoStack.push(this.snapshot());
    this.restore(s);
    this.emit();
  }

  beginStroke() {
    const snap = this.snapshot();
    this.undoStack.push(snap);
    if (this.undoStack.length > UNDO_MAX) this.undoStack.shift();
    this.redoStack = [];
    this.recent = [...this.recent.slice(-2), { t: performance.now(), snap, moved: false }];
  }

  /** Undo the strokes of the last `ms` milliseconds (the clicks of a double-click, a long press). */
  undoRecent(ms = DOUBLE_MS) {
    const now = performance.now();
    const young = this.recent.filter((r) => now - r.t < ms);
    this.recent = [];
    if (!young.length || young.some((r) => r.moved)) return;
    const k = this.undoStack.indexOf(young[0].snap);
    if (k < 0) return;
    this.undoStack.length = k;
    this.restore(young[0].snap);
    this.emit();
  }

  /**
   * What is at a screen point / tile, for code: a figure, a place, the own castle, a building, a start spot, a
   * settlement spot, a shaft, a tree, a pile, an item, a track – or a free tile.
   * @returns {{ kind: string, x: number, y: number, name?: string, hero?: string, npc?: string }|null}
   */
  targetAt(clientX, clientY, g) {
    const sim = this.sim, x = g.x, y = g.y;
    if (!sim.map.inBounds(x, y)) return null;
    let e = null;
    try { e = sim.entities.get(this.renderer.pickEntity(clientX, clientY)) ?? null; } catch { /* no picking (tests) */ }
    if (e?.kind === 'hero') return { kind: 'hero', hero: e.hero, x, y };
    if (e?.kind === 'npc') return { kind: 'npc', npc: e.npc, x, y };
    const d2 = (p) => (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
    const places = Object.entries(this.preview ? sim.mission?.script?.state.places ?? {} : this.scenario.world?.places ?? {})
      .map(([name, p]) => ({ name, ...p })).filter((p) => d2(p) <= Math.max(1, p.r ?? 0) ** 2).sort((a, b) => d2(a) - d2(b));
    if (places.length) return { kind: 'place', name: places[0].name, x, y };
    if (e?.kind === 'building') return { kind: e.type === 'headquarters' && e.owner === 0 ? 'hq' : 'building', x, y };
    if (e && e.kind !== 'tree' && e.kind !== 'pile') return { kind: 'unit', x, y };
    if (sim.starts.some((s) => s.x === x && s.y === y)) return { kind: 'start', x, y };
    const info = tileInfo(sim, x, y);
    if (info.kind === 'building') {
      const b = sim.entities.get(sim.map.owner[sim.map.idx(x, y)]);
      return { kind: b?.type === 'headquarters' && b.owner === 0 ? 'hq' : 'building', x, y };
    }
    if (sim.spots.some((s) => d2(s) <= 4)) return { kind: 'spot', x, y };
    if (sim.shafts.some((s) => d2(s) <= 2)) return { kind: 'shaft', x, y };
    if (['tree', 'pile', 'coin', 'flower', 'track'].includes(info.kind)) return { kind: info.kind, x, y };
    return { kind: 'free', x, y };
  }

  /** Code for the point: undo the tool's clicks, report the target. */
  codeAt(clientX, clientY) {
    const g = this.renderer.pickGround(clientX, clientY);
    if (!g) return;
    const t = this.targetAt(clientX, clientY, { x: Math.floor(g.x), y: Math.floor(g.z) });
    if (t) this.onCode(t, { x: clientX, y: clientY });
  }

  /** Apply a tool to a tile. */
  applyAt(x, y) {
    if (this.preview) return;
    const t = this.tool;
    if (CLICK_TOOLS.has(t.tool) && (t.tool === 'start' || t.tool === 'place')) { this.onPick(t.tool, x, y); return; }
    const r = applyEdit(this.sim, { tool: t.tool, x, y, r: t.r, strength: t.strength, res: t.res, amount: t.amount, seed: (x * 31 + y) | 0, item: t.item, level: t.level });
    if (r.events.length) this.renderer.onEvents(r.events);
    if (r.changed) this.dirty = true;
  }

  // ---------- Eingabe ----------

  bindInput() {
    const c = this.canvas;
    const on = (target, type, fn, o) => { target.addEventListener(type, fn, o); (this.off ??= []).push(() => target.removeEventListener(type, fn, o)); };
    on(c, 'pointerdown', (e) => this.down(e));
    on(window, 'pointermove', (e) => this.move(e));
    on(window, 'pointerup', (e) => this.up(e));
    on(window, 'pointercancel', (e) => this.up(e));
    on(c, 'wheel', (e) => { e.preventDefault(); const d = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY; this.renderer.rig.zoom(Math.exp(Math.max(-300, Math.min(300, d)) * 0.001)); }, { passive: false });
    on(c, 'contextmenu', (e) => e.preventDefault());
    on(c, 'dblclick', (e) => {
      // Touch has its long press (some browsers turn a double tap into dblclick)
      if (this.lastPointerType === 'touch') return;
      e.preventDefault();
      if (!['start', 'place'].includes(this.tool.tool)) this.undoRecent();
      this.codeAt(e.clientX, e.clientY);
    });
    on(window, 'keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) this.redo(); else this.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); this.redo(); return; }
      this.renderer.rig.keys.add(e.key.toLowerCase());
    });
    on(window, 'keyup', (e) => this.renderer?.rig.keys.delete(e.key.toLowerCase()));
    on(window, 'blur', () => this.renderer?.rig.keys.clear());
  }

  ground(e) {
    const g = this.renderer.pickGround(e.clientX, e.clientY);
    return g ? { x: Math.floor(g.x), y: Math.floor(g.z), fx: g.x, fz: g.z } : null;
  }

  painting(p) { return this.tool.tool !== 'camera' && !this.preview && (p.type === 'touch' ? this.pointers.size === 1 : p.button === 0); }

  down(e) {
    this.canvas.setPointerCapture?.(e.pointerId);
    const p = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button, type: e.pointerType, moved: false };
    this.pointers.set(e.pointerId, p);
    this.lastPointerType = e.pointerType;
    clearTimeout(this.pressTimer);
    if (e.pointerType !== 'mouse' && this.pointers.size === 1 && (this.preview || !REPEAT_TOOLS.has(this.tool.tool))) {
      // Long press: code for the point (the tool's touch is undone)
      this.pressTimer = setTimeout(() => {
        if (this.pointers.get(e.pointerId) !== p || p.moved || this.pointers.size !== 1) return;
        p.pressed = true;
        if (this.stroke) { clearInterval(this.stroke.timer); this.stroke = null; }
        this.clickTool = null;
        if (!['start', 'place'].includes(this.tool.tool)) this.undoRecent(PRESS_MS + 400);
        this.codeAt(p.x, p.y);
      }, PRESS_MS);
    }
    if (e.pointerType === 'touch' && this.pointers.size === 2) {
      // second finger: abort the brush, gesture begins
      this.stroke = null;
      const [a, b] = [...this.pointers.values()];
      this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), angle: Math.atan2(b.y - a.y, b.x - a.x), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      return;
    }
    if (!this.painting(p)) return;
    const g = this.ground(e);
    if (!g) return;
    if (CLICK_TOOLS.has(this.tool.tool)) { this.clickTool = g; return; }
    this.beginStroke();
    this.stroke = { last: `${g.x},${g.y}`, g, timer: setInterval(() => this.repeat(), 90) };
    this.applyAt(g.x, g.y);
  }

  /** Hold pressed: raise/lower/smooth keeps working (like a brush with paint). */
  repeat() {
    const s = this.stroke;
    if (!s || !['raise', 'lower', 'smooth', 'flatten'].includes(this.tool.tool)) return;
    this.applyAt(s.g.x, s.g.y);
  }

  move(e) {
    const p = this.pointers.get(e.pointerId);
    const g = e.target === this.canvas || p ? this.ground(e) : null;
    if (g && e.target === this.canvas) this.hover(g);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(p.x - p.sx, p.y - p.sy) > (p.type === 'mouse' ? 6 : PRESS_SLOP)) p.moved = true;
    const rig = this.renderer.rig, H = this.canvas.clientHeight || 600;
    if (p.type === 'touch' && this.pointers.size >= 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y), angle = Math.atan2(b.y - a.y, b.x - a.x);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      rig.zoom(this.pinch.dist / Math.max(1, dist));
      rig.rotate(angle - this.pinch.angle, 0);
      rig.pan(mid.x - this.pinch.mid.x, mid.y - this.pinch.mid.y, H);
      this.pinch = { dist, angle, mid };
      return;
    }
    if (this.stroke && g) {
      const key = `${g.x},${g.y}`;
      this.stroke.g = g;
      if (key !== this.stroke.last) {
        this.stroke.last = key;
        if (this.recent.length) this.recent[this.recent.length - 1].moved = true;
        this.applyAt(g.x, g.y);
      }
      return;
    }
    if (this.clickTool) return;
    if (p.type === 'touch' || p.button === 1 || (p.button === 0 && (this.tool.tool === 'camera' || this.preview))) rig.pan(dx, dy, H);
    else if (p.button === 2) rig.rotate(-dx * 0.006, dy * 0.004);
  }

  up(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    clearTimeout(this.pressTimer);
    if (this.pointers.size < 2) this.pinch = null;
    if (p.pressed) { this.clickTool = null; return; }
    if (this.stroke) { clearInterval(this.stroke.timer); this.stroke = null; this.emit(); }
    if (this.clickTool && !p.moved) {
      const g = this.clickTool;
      if (this.tool.tool === 'start' || this.tool.tool === 'place') this.onPick(this.tool.tool, g.x, g.y);
      else { this.beginStroke(); this.applyAt(g.x, g.y); this.emit(); }
    }
    this.clickTool = null;
  }

  hover(g) {
    const changed = !this.hoverTile || this.hoverTile.x !== g.x || this.hoverTile.y !== g.y;
    this.hoverTile = { x: g.x, y: g.y };
    this.updateBrush();
    if (changed) this.emit();
  }

  // ---------- Brush display ----------

  makeBrush() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(65 * 3), 3));
    const line = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95, depthTest: false }));
    line.renderOrder = 999;
    line.frustumCulled = false;
    line.visible = false;
    return line;
  }

  updateBrush() {
    const b = this.brush, h = this.hoverTile;
    if (!b || !h || this.preview || this.tool.tool === 'camera') { if (b) b.visible = false; return; }
    const r = ONE_TILE.has(this.tool.tool) ? 0.5 : PAINT_TOOLS.has(this.tool.tool) ? this.tool.r + 0.5 : this.tool.tool === 'shaft' ? 1.5 : this.tool.tool === 'spot' ? 2 : 0.5;
    const cx = h.x + 0.5, cz = h.y + 0.5;
    const pos = b.geometry.attributes.position;
    for (let i = 0; i < 65; i++) {
      const a = (i / 64) * Math.PI * 2;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      pos.setXYZ(i, x, this.renderer.terrain.heightAt(x, z) + 0.08, z);
    }
    pos.needsUpdate = true;
    b.visible = true;
  }

  // ---------- Frame ----------

  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.renderer.frame(1, dt, new Map(), { selected: new Set(), ghost: null, hint: null, revealAll: true });
    if (now - (this.lastUi ?? 0) > 120) { this.lastUi = now; this.emit(); }
  }

  /** Screen position of a tile (labels for places and start spots). */
  screenOf(x, y) {
    const r = this.renderer;
    const p = r.project?.(x + 0.5, r.terrain.heightAt(x + 0.5, y + 0.5) + 0.3, y + 0.5);
    return p ?? null;
  }

  emit() {
    const sim = this.sim;
    const h = this.hoverTile;
    this.onUi({
      tool: { ...this.tool },
      hover: h ? tileInfo(sim, h.x, h.y) : null,
      size: { w: sim.map.width, h: sim.map.height },
      canUndo: this.undoStack.length > 0, canRedo: this.redoStack.length > 0,
      preview: this.preview,
      errors: this.preview ? sim.mission?.script?.state.errors ?? [] : [],
      console: this.preview ? (sim.mission?.script?.state.console ?? []).slice(-40) : [],
      hints: this.preview ? sim.mission?.script?.state.missionHints ?? [] : [],
      counts: {
        trees: [...sim.entities.values()].filter((e) => e.kind === 'tree').length,
        piles: [...sim.entities.values()].filter((e) => e.kind === 'pile').length,
        items: sim.map.items.size,
        spots: sim.spots.length, shafts: sim.shafts.length,
      },
      starts: sim.starts.map((s, i) => ({ i, x: s.x, y: s.y, screen: this.screenOf(s.x, s.y) })),
      places: Object.entries(this.preview ? sim.mission?.script?.state.places ?? {} : this.scenario.world?.places ?? {})
        .map(([name, p]) => ({ name, ...p, screen: this.screenOf(p.x, p.y) })),
    });
  }
}

export { deriveFlags, fromB64, RESERVED };
