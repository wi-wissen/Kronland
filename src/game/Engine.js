// Engine: connects simulation, rendering, input and UI.
// The player acts on the simulation exclusively through commands, as the AI and the network will later.

import { Sim } from '../sim/sim.js';
import { BUILDINGS } from '../sim/data/buildings.js';
import { BALANCE } from '../sim/data/balance.js';
import { RESOURCES } from '../sim/data/resources.js';
import { TECHS, researchPoints } from '../sim/data/technologies.js';
import { BLESSINGS, PROFESSIONS, WORKER } from '../sim/data/professions.js';
import { averageMotivation, workerSlots, maxMotivation } from '../sim/systems/workers.js';
import { UNIT } from '../sim/fixed.js';
import { Renderer } from '../render/Renderer.js';
import { Input } from './Input.js';

const TICK_MS = 100;

/** Order in the build menu. */
export const BUILD_MENU = [
  'residence', 'farm', 'university', 'villageCenter',
  'clayMine', 'stoneMine', 'ironMine', 'sulfurMine',
  'brickworks', 'sawmill', 'stonemason', 'smithy', 'alchemist', 'bank',
  'chapel', 'storehouse', 'clock', 'windwheel',
];

export class Engine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ seed?: number, onUi?: (state: any) => void }} opts
   */
  constructor(canvas, opts = {}) {
    this.player = 0;
    this.sim = new Sim({ seed: opts.seed ?? 1 });
    this.renderer = new Renderer(canvas, this.sim);
    this.onUi = opts.onUi ?? (() => {});
    /** @type {Set<number>} */
    this.selected = new Set();
    /** @type {null | {type: string, x: number, y: number, valid: boolean, reason: string|null, hasPos: boolean}} */
    this.placing = null;
    this.queue = [];
    this.prev = new Map();
    this.speed = 1;
    this.paused = false;
    this.acc = 0;
    this.toasts = [];
    this.toastId = 0;
    this.touch = matchMedia?.('(pointer: coarse)').matches ?? false;
    this.input = new Input(this, canvas);
    this.canvas = canvas;
    this.resize = () => this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.ro = new ResizeObserver(this.resize);
    this.ro.observe(canvas);
    this.resize();
    this.lastUi = 0;
  }

  start() {
    this.running = true;
    this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      this.frame(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.input.dispose();
  }

  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused) this.acc += dt * 1000 * this.speed;
    let steps = 0;
    while (this.acc >= TICK_MS && steps < 8) {
      this.stepOnce();
      this.acc -= TICK_MS; steps++;
    }
    if (steps === 8) this.acc = 0;
    this.renderer.frame(this.paused ? 1 : this.acc / TICK_MS, dt, this.prev, {
      selected: this.selected,
      ghost: this.placing?.hasPos ? this.placing : null,
    });
    if (now - this.lastUi > 200) { this.lastUi = now; this.emitUi(); }
  }

  stepOnce() {
    this.prev = new Map();
    for (const e of this.sim.entities.values()) if (e.kind === 'unit' || e.kind === 'worker') this.prev.set(e.id, { px: e.px, py: e.py });
    const events = this.sim.step(this.queue);
    this.queue = [];
    this.renderer.onEvents(events);
    for (const ev of events) {
      if (ev.player !== this.player) continue;
      if (ev.type === 'rejected') this.toast(ev.reason);
      if (ev.type === 'buildingDone') this.toast(`${BUILDINGS[ev.buildingType].levels[ev.level ?? 0].name} fertig`);
      if (ev.type === 'researchDone') this.toast(`„${ev.name}“ erforscht`);
      if (ev.type === 'workerLeft' && ev.reason === 'motivation') this.toast('Ein Arbeiter hat die Siedlung verlassen');
    }
    for (const id of this.selected) if (!this.sim.entities.has(id)) this.selected.delete(id);
  }

  /** Queue a command of the human player. */
  issue(cmd) { this.queue.push({ ...cmd, player: this.player }); }

  toast(text) {
    this.toasts.push({ id: ++this.toastId, text, at: performance.now() });
    if (this.toasts.length > 4) this.toasts.shift();
    this.emitUi();
  }

  // ---------- Selection ----------

  ownSerfIds() {
    return [...this.selected].filter((id) => {
      const e = this.sim.entities.get(id);
      return e?.kind === 'unit' && e.owner === this.player;
    });
  }

  clearSelection() { this.selected.clear(); this.emitUi(); }

  selectAt(cx, cy, additive = false) {
    const id = this.renderer.pickEntity(cx, cy);
    const e = id ? this.sim.entities.get(id) : null;
    if (!additive) this.selected.clear();
    if (e) {
      if (e.kind === 'unit' && e.owner === this.player) {
        if (additive && this.selected.has(id)) this.selected.delete(id); else this.selected.add(id);
      } else {
        this.selected.clear();
        this.selected.add(id);
      }
    }
    this.emitUi();
  }

  selectBox(x1, y1, x2, y2, additive = false) {
    if (!additive) this.selected.clear();
    const [l, r] = [Math.min(x1, x2), Math.max(x1, x2)], [t, b] = [Math.min(y1, y2), Math.max(y1, y2)];
    for (const e of this.sim.entities.values()) {
      if (e.kind !== 'unit' || e.owner !== this.player) continue;
      const x = e.px / UNIT, z = e.py / UNIT;
      const s = this.renderer.project(x, this.renderer.terrain.heightAt(x, z) + 0.3, z);
      if (!s.behind && s.x >= l && s.x <= r && s.y >= t && s.y <= b) this.selected.add(e.id);
    }
    this.emitUi();
  }

  selectIdleSerfs() {
    this.selected.clear();
    for (const e of this.sim.entities.values()) {
      if (e.kind === 'unit' && e.owner === this.player && !e.job && e.goal === undefined) this.selected.add(e.id);
    }
    if (!this.selected.size) this.toast('Keine untätigen Leibeigenen');
    else this.focusSelection();
    this.emitUi();
  }

  selectAllSerfs() {
    this.selected.clear();
    for (const e of this.sim.entities.values()) if (e.kind === 'unit' && e.owner === this.player) this.selected.add(e.id);
    this.emitUi();
  }

  focusSelection() {
    let sx = 0, sz = 0, n = 0;
    for (const id of this.selected) {
      const e = this.sim.entities.get(id);
      if (e?.kind === 'unit') { sx += e.px / UNIT; sz += e.py / UNIT; n++; }
    }
    if (n) this.renderer.rig.lookAt(sx / n, sz / n);
  }

  focusHeadquarters() {
    const hq = this.sim.findBuilding(this.player, 'headquarters');
    if (hq) { this.renderer.rig.lookAt(hq.x + hq.w / 2, hq.y + hq.h / 2); this.selected.clear(); this.selected.add(hq.id); this.emitUi(); }
  }

  // ---------- Commands ----------

  /** Context command for the selected serfs at a screen position. */
  commandAt(cx, cy) {
    const units = this.ownSerfIds();
    if (!units.length) return false;
    const id = this.renderer.pickEntity(cx, cy);
    const hit = id ? this.sim.entities.get(id) : null;
    if (hit?.kind === 'building') {
      if (!hit.done && hit.owner === this.player) { this.issue({ type: 'assignWork', units, target: hit.id }); return true; }
    }
    const g = this.renderer.pickGround(cx, cy);
    if (!g) return false;
    const tx = Math.floor(g.x), ty = Math.floor(g.z);
    const m = this.sim.map;
    if (!m.inBounds(tx, ty)) return false;
    // Tree or pile near the click
    let node = null, best = 2.2;
    for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) {
      if (!m.inBounds(x, y)) continue;
      const e = this.sim.entities.get(m.owner[m.idx(x, y)]);
      if (e && (e.kind === 'tree' || e.kind === 'pile')) {
        const d = Math.hypot(x + 0.5 - g.x, y + 0.5 - g.z);
        if (d < best) { best = d; node = e; }
      }
    }
    if (node) { this.issue({ type: 'assignWork', units, target: node.id }); return true; }
    const occ = this.sim.entities.get(m.owner[m.idx(tx, ty)]);
    if (occ?.kind === 'building' && !occ.done && occ.owner === this.player) { this.issue({ type: 'assignWork', units, target: occ.id }); return true; }
    if (m.walkable(tx, ty)) { this.issue({ type: 'move', units, x: tx, y: ty }); return true; }
    return false;
  }

  /** Tap on touch devices: select, give a command or choose a building spot. */
  tap(cx, cy) {
    if (this.placing) { this.hover(cx, cy); this.emitUi(); return; }
    const id = this.renderer.pickEntity(cx, cy);
    const e = id ? this.sim.entities.get(id) : null;
    const haveSerfs = this.ownSerfIds().length > 0;
    if (e?.kind === 'unit' && e.owner === this.player) {
      if (haveSerfs && this.multi) this.selected.has(id) ? this.selected.delete(id) : this.selected.add(id);
      else { this.selected.clear(); this.selected.add(id); }
      this.emitUi();
      return;
    }
    if (haveSerfs && this.commandAt(cx, cy)) return;
    this.selectAt(cx, cy);
  }

  buySerf(count = 1) { this.issue({ type: 'buySerf', count }); }
  upgrade(id) { this.issue({ type: 'upgradeBuilding', building: id, units: this.idleSerfsNear(id) }); }
  demolish(id) { this.issue({ type: 'demolish', building: id }); this.selected.delete(id); }
  research(id, tech) { this.issue({ type: 'research', building: id, tech }); }
  setOvertime(id, on) { this.issue({ type: 'setOvertime', building: id, on }); }
  bless(id, blessing) { this.issue({ type: 'bless', building: id, blessing }); }
  setTax(level) { this.issue({ type: 'setTax', level }); }

  /** Up to 4 idle serfs near a building (for extensions). */
  idleSerfsNear(id) {
    const b = this.sim.entities.get(id);
    if (!b) return [];
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    return [...this.sim.entities.values()]
      .filter((e) => e.kind === 'unit' && e.owner === this.player && !e.job && e.goal === undefined)
      .sort((a, c) => Math.hypot(a.px / UNIT - cx, a.py / UNIT - cy) - Math.hypot(c.px / UNIT - cx, c.py / UNIT - cy))
      .slice(0, 4).map((e) => e.id);
  }

  setSpeed(s) { this.speed = s; this.paused = false; this.emitUi(); }
  togglePause() { this.paused = !this.paused; this.emitUi(); }

  // ---------- Building ----------

  startPlacement(type) {
    this.placing = { type, x: 0, y: 0, valid: false, reason: null, hasPos: false };
    this.emitUi();
  }

  cancelPlacement() { if (this.placing) { this.placing = null; this.emitUi(); } }

  hover(cx, cy) {
    if (!this.placing) return;
    const g = this.renderer.pickGround(cx, cy);
    if (!g) return;
    const def = BUILDINGS[this.placing.type];
    let x = Math.round(g.x - def.w / 2), y = Math.round(g.z - def.h / 2);
    // An Siedlungsplatz bzw. Schacht einrasten
    if (def.placement !== 'free') {
      const list = def.placement === 'settlement' ? this.sim.spots : this.sim.shafts.filter((s) => s.res === def.shaftResource);
      let best = null, bd = 9;
      for (const s of list) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s; } }
      if (best) { x = best.x; y = best.y; }
    }
    const reason = this.sim.checkPlacement(this.player, this.placing.type, x, y);
    Object.assign(this.placing, { x, y, valid: !reason, reason, hasPos: true });
  }

  confirmPlacement(keep = false) {
    const p = this.placing;
    if (!p?.hasPos) return;
    if (!p.valid) { this.toast(p.reason ?? 'Hier kann nicht gebaut werden'); return; }
    this.issue({ type: 'placeBuilding', building: p.type, x: p.x, y: p.y, units: this.ownSerfIds() });
    if (!keep) this.placing = null;
    this.emitUi();
  }

  // ---------- UI ----------

  emitUi() { this.onUi(this.uiState()); }

  uiState() {
    const sim = this.sim, pl = sim.players[this.player];
    const res = {};
    for (const r of RESOURCES) res[r] = pl.stock[r] + pl.raw[r];
    const now = performance.now();
    this.toasts = this.toasts.filter((t) => now - t.at < 4000);
    const serfs = this.ownSerfIds();
    let selection = null;
    if (serfs.length) {
      const idle = serfs.filter((id) => !sim.entities.get(id).job).length;
      selection = { kind: 'serfs', count: serfs.length, idle };
    } else if (this.selected.size === 1) {
      const e = sim.entities.get([...this.selected][0]);
      if (e?.kind === 'building') {
        const lvl = BUILDINGS[e.type].levels[e.level];
        const def = BUILDINGS[e.type];
        const own = e.owner === this.player;
        const next = def.levels[e.level + 1];
        selection = {
          kind: 'building', id: e.id, type: e.type, name: lvl.name, level: e.level + 1, done: e.done,
          progress: e.work ? Math.floor((e.progress / e.work) * 100) : 100, hp: e.hp, maxHp: lvl.hp,
          own, builders: e.builders.length,
          beds: lvl.beds ? [e.residents.length, lvl.beds] : null,
          seats: lvl.seats ? [e.eaters.length, lvl.seats] : null,
          population: lvl.population,
          workers: workerSlots(e) ? [e.workers.length, workerSlots(e)] : null,
          overtime: e.overtime,
          upgrade: own && next ? { name: next.name, cost: Object.entries(next.cost), reason: sim.checkUpgrade(this.player, e) } : null,
          canDemolish: own && e.type !== 'headquarters',
          research: own && e.type === 'university' && e.done ? Object.values(TECHS).map((t) => ({
            id: t.id, name: t.name, line: t.line, tier: t.tier, cost: Object.entries(t.cost),
            done: pl.techs.has(t.id),
            running: e.research?.tech === t.id ? Math.floor((e.research.progress / researchPoints(t.id)) * 100) : null,
            reason: pl.techs.has(t.id) ? null : sim.checkResearch(this.player, e, t.id),
          })) : null,
          blessings: own && e.type === 'chapel' && e.done ? Object.entries(BLESSINGS).map(([id, b]) => ({
            id, name: b.name, who: b.professions ? b.professions.map((p) => PROFESSIONS[p].name).join(', ') : 'alle Arbeiter',
            reason: b.minLevel && e.level < b.minLevel ? 'Nur in der Kathedrale' : pl.faith < WORKER.blessingFaith ? 'Nicht genug Glaube' : null,
          })) : null,
          tax: own && e.type === 'headquarters' ? { level: pl.taxLevel, allowed: pl.techs.has('education') } : null,
        };
      } else if (e?.kind === 'unit') {
        selection = { kind: 'enemy', owner: e.owner };
      }
    }
    const buildOptions = serfs.length ? BUILD_MENU.map((type) => {
      const def = BUILDINGS[type];
      const cost = def.levels[0].cost;
      let reason = null;
      if (def.requires && !pl.techs.has(def.requires)) reason = 'Technologie fehlt';
      else if (!sim.canPay(this.player, cost)) reason = 'Zu teuer';
      return { type, name: def.levels[0].name, cost: Object.entries(cost), reason };
    }) : [];
    const ticksToPay = BALANCE.paydayTicks - (sim.tick % BALANCE.paydayTicks);
    return {
      tick: sim.tick,
      res,
      pop: [sim.popUsed(this.player), sim.popLimit(this.player)],
      motivation: averageMotivation(sim, this.player),
      maxMotivation: maxMotivation(sim, this.player),
      faith: pl.faith,
      blessingCost: WORKER.blessingFaith,
      paydayIn: Math.ceil(ticksToPay / 10),
      speed: this.speed,
      paused: this.paused,
      selection,
      buildOptions,
      placing: this.placing ? { type: this.placing.type, name: BUILDINGS[this.placing.type].levels[0].name, valid: this.placing.valid, reason: this.placing.reason, hasPos: this.placing.hasPos } : null,
      toasts: this.toasts.map((t) => ({ id: t.id, text: t.text })),
      touch: this.touch,
      serfCost: BALANCE.serf.cost.gold,
    };
  }
}
