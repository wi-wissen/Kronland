// Engine: connects simulation, rendering, input and UI.
// The player acts on the simulation exclusively through commands, as the AI and the network will later.

import { Sim } from '../sim/sim.js';
import { BUILDINGS } from '../sim/data/buildings.js';
import { BALANCE } from '../sim/data/balance.js';
import { RESOURCES } from '../sim/data/resources.js';
import { TECHS, researchPoints } from '../sim/data/technologies.js';
import { BLESSINGS, WORKER, professionFor } from '../sim/data/professions.js';
import { averageMotivation, workerSlots, maxMotivation } from '../sim/systems/workers.js';
import { UNITS, LINES, HEROES, unitOf, fullCost, LINE_UPGRADE_COST } from '../sim/data/units.js';
import { targetable } from '../sim/systems/military.js';
import { countWorkers, countLeaders, taxIncome } from '../sim/systems/payday.js';
import { AiPlayer } from '../ai/AiPlayer.js';
import { saveGame, loadGame } from '../sim/serialize.js';
import { createMissionSim } from '../sim/missions/runtime.js';
import { UNIT } from '../sim/fixed.js';
import { Renderer } from '../render/Renderer.js';
import { Input } from './Input.js';
import { buildingSystemsUi } from './buildingUi.js';
import { isDamaged } from '../sim/systems/damage.js';
import { hasForecast, forecast } from '../sim/systems/weather.js';
import { starsOf, EXPERIENCE } from '../sim/data/experience.js';
import { GameAudio } from '../audio/GameAudio.js';
import { Vector3 } from 'three';

const TICK_MS = 100;

/** Order in the build menu. Other modules may append types (category via BUILD_CATEGORY). */
export const BUILD_MENU = [
  'residence', 'farm', 'villageCenter', 'storehouse',
  'clayMine', 'stoneMine', 'ironMine', 'sulfurMine',
  'brickworks', 'sawmill', 'stonemason', 'smithy', 'alchemist', 'bank',
  'tower', 'barracks', 'archery', 'stable', 'foundry',
  'university', 'chapel', 'weatherTower', 'weatherPlant', 'clock', 'windwheel',
];

/** Categories of the build menu (tabs). Unknown types land under 'admin'. */
export const BUILD_CATEGORIES = ['home', 'raw', 'refine', 'military', 'admin'];
export const BUILD_CATEGORY = {
  residence: 'home', farm: 'home', villageCenter: 'home', storehouse: 'home',
  clayMine: 'raw', stoneMine: 'raw', ironMine: 'raw', sulfurMine: 'raw',
  brickworks: 'refine', sawmill: 'refine', stonemason: 'refine', smithy: 'refine', alchemist: 'refine', bank: 'refine',
  tower: 'military', barracks: 'military', archery: 'military', stable: 'military', foundry: 'military',
  university: 'admin', chapel: 'admin', clock: 'admin', windwheel: 'admin',
  weatherTower: 'admin', weatherPlant: 'admin',
};

/**
 * Extension point for the building panel: functions (engine, building) → section or null.
 * A section is drawn generically:
 *   { id, title: 'i18n.key' | { de, en }, icon?: 'symbolname',
 *     actions: [{ id, label: 'i18n.key' | { de, en }, icon?, cost?: [[res, n]], reason?: Reason|null,
 *                 active?: boolean, cmd: { type: '…', … } }] }
 * A click sends `cmd` (extended by player) as a normal command to the simulation.
 * @type {Array<(engine: Engine, building: any) => any>}
 */
export const BUILDING_SECTIONS = [];
/** @param {(engine: Engine, building: any) => any} fn */
export const registerBuildingSection = (fn) => { BUILDING_SECTIONS.push(fn); };

/** Mindestabstand (ms) zwischen zwei Angriffsmeldungen in derselben Gegend */
const ATTACK_TOAST_MS = 15000;

export class Engine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ seed?: number, onUi?: (state: any) => void, difficulty?: string, players?: number, hero?: string }} opts
   */
  constructor(canvas, opts = {}) {
    this.player = 0;
    const players = opts.players ?? 2;
    const heroes = ['bertram', 'hedda', 'gerold', 'bertram'];
    if (opts.hero) { const i = heroes.indexOf(opts.hero); if (i > 0) [heroes[0], heroes[i]] = [heroes[i], heroes[0]]; }
    if (opts.load) {
      this.sim = loadGame(opts.load);
      this.ais = (opts.load.extra?.ais ?? []).map((st) => AiPlayer.fromState(this.sim, st));
    } else if (opts.mission) {
      // Mission: players, opponents and starting setup come from the mission file
      this.sim = createMissionSim(opts.mission.id, { seed: opts.mission.seed });
      this.ais = this.sim.mission.def.players
        .map((p, i) => (p.kind === 'ai' ? new AiPlayer(this.sim, i, p.difficulty ?? 'normal') : null)).filter(Boolean);
    } else {
      this.sim = new Sim({ seed: opts.seed ?? 1, players, heroes });
      /** AI opponents for all other players */
      this.ais = [];
      for (let p = 1; p < players; p++) this.ais.push(new AiPlayer(this.sim, p, opts.difficulty ?? 'normal'));
    }
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
    const cam = opts.load?.extra?.camera;
    if (cam) { this.renderer.rig.lookAt(cam.x, cam.z); this.renderer.rig.yaw = cam.yaw; this.renderer.rig.dist = cam.dist; }
    // make weather visible after loading
    if (this.sim.weather.state !== 'summer') this.renderer.applyWeather(this.sim.weather.state);
    /** Mission-related UI state (camera jumps, tutorial checks) */
    this.missionView = { cameraSeq: this.sim.mission?.state.camera?.seq ?? 0, hint: null, checks: {} };
    // audio (a silent no-op without Web Audio; errors in the audio system must never disturb the game)
    try { this.audio = new GameAudio(this); } catch { this.audio = null; }
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
    this.audio?.dispose();
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
    this.input.edgeScroll(dt);
    this.renderer.frame(this.paused ? 1 : this.acc / TICK_MS, dt, this.prev, {
      selected: this.selected,
      ghost: this.placing?.hasPos ? this.placing : null,
      hint: this.missionView.hint,
    });
    this.audio?.frame(dt);
    if (now - this.lastUi > 200) { this.lastUi = now; this.emitUi(); }
  }

  stepOnce() {
    this.prev = new Map();
    for (const e of this.sim.entities.values()) if (e.px !== undefined) this.prev.set(e.id, { px: e.px, py: e.py });
    for (const ai of this.ais) ai.update();
    const events = this.sim.step(this.queue);
    this.queue = [];
    this.renderer.onEvents(events);
    if (this.audio) { this.audio.onEvents(events, this.prev); this.audio.onTick(); }
    this.eventToasts(events);
    for (const id of this.selected) if (!this.sim.entities.has(id)) this.selected.delete(id);
  }

  /** Queue a command of the human player. */
  issue(cmd) { this.queue.push({ ...cmd, player: this.player }); }

  /**
   * Notice into the message stream. Texts are i18n keys with parameters; parameters like
   * `building`, `tech`, `line`, `weather` are IDs and are translated in the UI.
   * An unknown key is displayed unchanged (for finished texts of other modules).
   * @param {string} key
   * @param {Record<string, any>} [params]
   * @param {{ icon?: string, tone?: 'info'|'good'|'warn'|'bad', pos?: {x:number,y:number}|null, ttl?: number }} [opts]
   */
  toast(key, params = null, opts = {}) {
    const t = { id: ++this.toastId, key, params, icon: opts.icon ?? 'info', tone: opts.tone ?? 'info', pos: opts.pos ?? null, at: performance.now(), ttl: opts.ttl ?? 5000 };
    this.toasts.push(t);
    if (this.toasts.length > 5) this.toasts.shift();
    this.emitUi();
    return t.id;
  }

  /** Dismiss a notice early. */
  dismissToast(id) { this.toasts = this.toasts.filter((t) => t.id !== id); this.emitUi(); }

  /** Tile centre of an entity (for click-to-jump). */
  entityPos(e) {
    if (!e) return null;
    if (e.kind === 'building') return { x: e.x + e.w / 2, y: e.y + e.h / 2 };
    if (e.px !== undefined) return { x: e.px / UNIT, y: e.py / UNIT };
    return null;
  }

  /** Translate simulation events into notices (display only, no game logic). */
  eventToasts(events) {
    const sim = this.sim, me = this.player;
    // weather change by a power plant has its own notice
    const machine = events.some((e) => e.type === 'weatherChanged');
    for (const ev of events) {
      if (ev.type === 'weather' && !machine) this.toast('toast.weather', { weather: ev.state }, { icon: `weather-${ev.state}` });
      if (ev.type === 'buildingDestroyed' && ev.owner === me) this.toast('toast.buildingDestroyed', { building: ev.buildingType }, { icon: 'demolish', tone: 'bad', pos: this.lastPos?.get(ev.building) ?? null });
      if (ev.type === 'killed' && ev.kind === 'hero' && ev.owner === me) this.toast('toast.heroDown', null, { icon: 'skull', tone: 'bad', pos: this.entityPos(sim.entities.get(ev.id)) });
      if (ev.type === 'victory' || (ev.type === 'defeated' && ev.player === me)) this.emitUi();
      if (ev.type === 'missionWon' || ev.type === 'missionLost') { this.paused = true; this.emitUi(); }
      if (ev.type === 'dialog' || ev.type === 'tutorialStep' || ev.type === 'objective') this.emitUi();
      if (ev.type === 'hit') this.attackToast(ev);
      if (ev.type === 'weatherChanged' && ev.player !== me) this.toast('toast.weatherChangedEnemy', { weather: ev.state }, { icon: `weather-${ev.state}`, tone: 'warn' });
      if (ev.type === 'payday' && ev.player === me) this.lastPayday = { income: ev.income, wages: ev.wages, tick: sim.tick };
      if (ev.player !== me) continue;
      if (ev.type === 'rejected') this.toast(ev.reason, ev.params ?? null, { icon: 'warning', tone: 'warn', ttl: 3500 });
      if (ev.type === 'buildingDone') {
        const b = sim.entities.get(ev.building);
        this.toast(ev.level ? 'toast.upgradeDone' : 'toast.buildingDone', { building: ev.buildingType, level: ev.level ?? 0 }, { icon: `b-${ev.buildingType}`, tone: 'good', pos: this.entityPos(b) });
      }
      if (ev.type === 'researchDone') {
        // building technology (smithy, …): with building name and jump target
        const b = ev.building ? sim.entities.get(ev.building) : null;
        if (b) this.toast('toast.buildingResearchDone', { tech: ev.tech, building: b.type, level: b.level }, { icon: `b-${b.type}`, tone: 'good', pos: this.entityPos(b) });
        else this.toast('toast.researchDone', { tech: ev.tech }, { icon: 'research', tone: 'good' });
      }
      if (ev.type === 'buildingBurning') {
        const b = sim.entities.get(ev.building);
        if (b) this.toast('toast.buildingBurning', { building: b.type, level: b.level }, { icon: 'fire', tone: 'bad', pos: this.entityPos(b), ttl: 8000 });
      }
      if (ev.type === 'repaired') {
        const b = sim.entities.get(ev.building);
        if (b) this.toast('toast.repaired', { building: b.type, level: b.level }, { icon: 'repair', tone: 'good', pos: this.entityPos(b), ttl: 3500 });
      }
      if (ev.type === 'tradeDone') this.toast('toast.tradeDone', { amount: ev.amount, res: ev.take }, { icon: ev.take, tone: 'good', pos: this.entityPos(sim.entities.get(ev.building)) });
      if (ev.type === 'promoted') {
        const L = sim.entities.get(ev.leader);
        this.toast('toast.promoted', { unit: L?.def ?? null, rank: ev.stars, stars: ev.stars }, { icon: 'star', tone: 'good', pos: this.entityPos(L) });
      }
      if (ev.type === 'weatherChanged') this.toast('toast.weatherChanged', { weather: ev.state }, { icon: `weather-${ev.state}`, tone: 'good' });
      if (ev.type === 'lineUpgraded') this.toast('toast.lineUpgraded', { line: ev.line, tier: ev.tier }, { icon: `u-${ev.line}`, tone: 'good' });
      if (ev.type === 'heroRevived') this.toast('toast.heroRevived', null, { icon: 'heal', tone: 'good', pos: this.entityPos(sim.entities.get(ev.id)) });
      if (ev.type === 'workerLeft' && ev.reason === 'motivation') this.toast('toast.workerLeft', null, { icon: 'motivationLow', tone: 'warn' });
      if (ev.type === 'recruited') this.toast('toast.recruited', { unit: UNITS[ev.def] ? ev.def : null }, { icon: `u-${UNITS[ev.def]?.line}`, pos: this.entityPos(sim.entities.get(ev.leader)) });
      if (ev.type === 'nodeDepleted' && ev.res !== 'wood') this.toast('toast.nodeDepleted', { res: ev.res }, { icon: ev.res, ttl: 3500 });
    }
    // remember positions of buildings so destruction notices can jump
    if (events.some((e) => e.type === 'buildingDone' || e.type === 'buildingPlaced') || !this.lastPos) {
      this.lastPos = new Map();
      for (const e of sim.entities.values()) if (e.kind === 'building' && e.owner === me) this.lastPos.set(e.id, this.entityPos(e));
    }
  }

  /** “Attack on …!” – own buildings, workers or troops are hit by enemies (throttled per region). */
  attackToast(ev) {
    const t = this.sim.entities.get(ev.target), a = this.sim.entities.get(ev.by);
    if (!t || t.owner !== this.player || !a || a.owner === this.player || this.sim.allied(a.owner, this.player)) return;
    const pos = this.entityPos(t);
    if (!pos) return;
    const now = performance.now();
    this.attackSeen ??= [];
    this.attackSeen = this.attackSeen.filter((s) => now - s.at < ATTACK_TOAST_MS);
    if (this.attackSeen.some((s) => Math.hypot(s.x - pos.x, s.y - pos.y) < 18)) return;
    this.attackSeen.push({ ...pos, at: now });
    const what = t.kind === 'building' ? { key: 'toast.attackBuilding', params: { building: t.type, level: t.level } }
      : t.kind === 'worker' || t.kind === 'unit' ? { key: 'toast.attackSettlers', params: null }
        : { key: 'toast.attackTroops', params: null };
    this.toast(what.key, what.params, { icon: 'attack', tone: 'bad', pos, ttl: 7000 });
  }

  /** Point the camera at a tile position (notices, minimap). */
  jumpTo(x, y) { this.renderer.rig.lookAt(x, y); this.emitUi(); }

  // ---------- Selection ----------

  ownSerfIds() {
    return [...this.selected].filter((id) => {
      const e = this.sim.entities.get(id);
      return e?.kind === 'unit' && e.owner === this.player && !e.militia;
    });
  }

  /** Own military selection: captains, heroes, militia. */
  ownArmyIds() {
    return [...this.selected].filter((id) => {
      const e = this.sim.entities.get(id);
      return e && e.owner === this.player && (e.kind === 'leader' || e.kind === 'hero' || (e.kind === 'unit' && e.militia));
    });
  }

  /** Selectable entity for an ID (soldier → his captain). */
  selectable(id) {
    let e = id ? this.sim.entities.get(id) : null;
    if (e?.kind === 'soldier') e = this.sim.entities.get(e.leader);
    return e;
  }

  clearSelection() { this.selected.clear(); this.attackMode = false; this.emitUi(); }

  selectAt(cx, cy, additive = false) {
    const e = this.selectable(this.renderer.pickEntity(cx, cy));
    const id = e?.id;
    if (!additive) this.selected.clear();
    if (e) {
      if ((e.kind === 'unit' || e.kind === 'leader' || e.kind === 'hero') && e.owner === this.player) {
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
      if (!(e.kind === 'unit' || e.kind === 'leader' || e.kind === 'hero') || e.owner !== this.player) continue;
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
    if (!this.selected.size) this.toast('toast.noIdleSerfs', null, { icon: 'idle', ttl: 2500 });
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
  commandAt(cx, cy, attackMove = false) {
    const army = this.ownArmyIds();
    let done = false;
    if (army.length) done = this.armyCommandAt(army, cx, cy, attackMove || this.attackMode);
    this.attackMode = false;
    const units = this.ownSerfIds();
    if (!units.length) { this.emitUi(); return done; }
    const id = this.renderer.pickEntity(cx, cy);
    const hit = id ? this.sim.entities.get(id) : null;
    if (hit?.kind === 'building') {
      if (hit.owner === this.player && (!hit.done || isDamaged(this.sim, hit))) { this.issue({ type: 'assignWork', units, target: hit.id }); return true; }
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
    if (occ?.kind === 'building' && occ.owner === this.player && (!occ.done || isDamaged(this.sim, occ))) { this.issue({ type: 'assignWork', units, target: occ.id }); return true; }
    if (m.walkable(tx, ty)) { this.issue({ type: 'move', units, x: tx, y: ty }); return true; }
    return false;
  }

  armyCommandAt(units, cx, cy, attackMove) {
    const hit = this.selectable(this.renderer.pickEntity(cx, cy));
    if (hit && hit.owner !== this.player && hit.owner !== undefined && targetable(this.sim, hit.kind === 'leader' && hit.soldiers.length ? this.sim.entities.get(hit.soldiers[0]) : hit)) {
      const target = hit.kind === 'leader' && hit.soldiers.length ? hit.soldiers[0] : hit.id;
      this.issue({ type: 'order', units, order: 'attack', target });
      return true;
    }
    const g = this.renderer.pickGround(cx, cy);
    if (!g) return false;
    this.issue({ type: 'order', units, order: attackMove ? 'attackMove' : 'move', x: Math.floor(g.x), y: Math.floor(g.z) });
    return true;
  }

  /** Military commands from the UI. */
  armyOrder(order) {
    const units = this.ownArmyIds();
    if (!units.length) return;
    if (order === 'attackMove') { this.attackMode = !this.attackMode; this.emitUi(); return; }
    this.issue({ type: 'order', units, order });
  }
  refillSoldiers() {
    for (const id of this.ownArmyIds()) {
      const e = this.sim.entities.get(id);
      if (e?.kind === 'leader' && e.soldiers.length < UNITS[e.def].soldiers) this.issue({ type: 'buySoldiers', leader: id });
    }
  }
  ability(hero, ability) { this.issue({ type: 'ability', hero, ability }); }
  recruit(building, line, full) { this.issue({ type: 'recruit', building, line, full }); }
  upgradeLine(line) { this.issue({ type: 'upgradeLine', line }); }
  militia(on) { this.issue({ type: 'militia', on }); }

  /** Tap on touch devices: select, give a command or choose a building spot. */
  tap(cx, cy) {
    if (this.placing) { this.hover(cx, cy); this.emitUi(); return; }
    const e = this.selectable(this.renderer.pickEntity(cx, cy));
    const id = e?.id;
    const haveSerfs = this.ownSerfIds().length > 0 || this.ownArmyIds().length > 0;
    if ((e?.kind === 'unit' || e?.kind === 'leader' || e?.kind === 'hero') && e.owner === this.player) {
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
  /** Research a building technology (smithy, sawmill, …). */
  researchBuilding(id, tech) { this.issue({ type: 'research', building: id, tech }); }
  /** Market: trade `amount` units of `take` for `give`. */
  trade(id, give, take, amount) { this.issue({ type: 'trade', building: id, give, take, amount }); }
  /** Weather power plant: change the weather. */
  changeWeather(id, state) { this.issue({ type: 'changeWeather', building: id, state }); }
  /** Repair a damaged building: send selected serfs, otherwise nearby idle ones. */
  repair(id, units = null) {
    const list = units ?? (this.ownSerfIds().length ? this.ownSerfIds() : this.idleSerfsNear(id));
    if (!list.length) { this.toast('toast.noIdleNear', null, { icon: 'idle', tone: 'warn', ttl: 3000 }); return; }
    this.issue({ type: 'assignWork', units: list, target: id });
  }

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

  /** Save game as a JSON-capable object. */
  save() {
    return saveGame(this.sim, { ais: this.ais.map((a) => a.getState()), camera: { ...this.renderer.rig.target, yaw: this.renderer.rig.yaw, dist: this.renderer.rig.dist } });
  }
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
    if (!p.valid) { const r = p.reason ?? 'err.notFree'; this.toast(typeof r === 'string' ? r : r.code, typeof r === 'string' ? null : r.params, { icon: 'warning', tone: 'warn', ttl: 3000 }); return; }
    this.issue({ type: 'placeBuilding', building: p.type, x: p.x, y: p.y, units: this.ownSerfIds() });
    if (!keep) this.placing = null;
    this.emitUi();
  }

  /** Recruit and upgrade options of a military building (IDs and reason codes, texts made by the UI). */
  recruitOptions(b) {
    const lines = Object.entries(LINES).filter(([, L]) => L.building === b.type);
    if (!lines.length) return null;
    const sim = this.sim, pl = sim.players[this.player];
    const free = sim.popLimit(this.player) - sim.popUsed(this.player);
    return lines.map(([line]) => {
      const tier = pl.unitTier[line];
      const def = unitOf(line, tier);
      const full = fullCost(def);
      const popFull = def.pop * (1 + def.soldiers);
      const nextCost = LINE_UPGRADE_COST[`${line}${tier}`];
      const next = unitOf(line, tier + 1);
      let upReason = null;
      if (nextCost) upReason = sim.checkLineTier(this.player, line, tier + 1) ?? (sim.canPay(this.player, nextCost) ? null : 'err.notEnoughResources');
      const maxTier = Object.values(UNITS).filter((u) => u.line === line).length;
      return {
        line, unit: def.id, tier, maxTier, soldiers: def.soldiers, pop: def.pop,
        stats: { attack: def.attack, armor: def.armor, hp: def.hp, range: Math.round(def.range / 100) / 10 },
        leaderCost: Object.entries(def.leaderCost), fullCost: Object.entries(full),
        leaderReason: free < def.pop ? 'err.popLimit' : sim.canPay(this.player, def.leaderCost) ? null : 'err.notEnoughResources',
        fullReason: free < popFull ? 'err.popLimit' : sim.canPay(this.player, full) ? null : 'err.notEnoughResources',
        upgrade: nextCost && next ? { unit: next.id, tier: tier + 1, cost: Object.entries(nextCost), reason: upReason } : null,
      };
    });
  }

  // ---------- Minimap ----------

  /**
   * Terrain image of the minimap as RGBA (1 pixel per tile). Cached; recomputed on frost/thaw
   * or when trees have been felled (checked every few seconds).
   * @returns {{ w: number, h: number, data: Uint8ClampedArray, key: string }}
   */
  minimapTerrain() {
    const m = this.sim.map, W = m.width, H = m.height;
    let trees = 0;
    for (const e of this.sim.entities.values()) if (e.kind === 'tree') trees++;
    const key = `${m.frozen ? 1 : 0}:${trees >> 3}`;
    if (this.mmCache?.key === key) return this.mmCache;
    const data = new Uint8ClampedArray(W * H * 4);
    const wl = this.sim.waterLevel ?? 0;
    let hmax = wl + 1;
    for (let k = 0; k < W * H; k++) if (m.heights[k] > hmax) hmax = m.heights[k];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x, f = m.flags[k], h = m.heights[k];
      let c;
      if (f & 1) {
        const depth = Math.min(1, (wl - h) / 400);
        c = m.frozen ? [196 - depth * 30, 222 - depth * 20, 236] : [74 - depth * 30, 142 - depth * 40, 196 - depth * 30];
      } else if (f & 8) {
        c = [128, 116, 104];
      } else {
        const t = Math.max(0, Math.min(1, (h - wl) / Math.max(1, hmax - wl)));
        // meadow → hill → rock; snow-covered in winter
        c = t < 0.55 ? [118 + t * 60, 164 + t * 10, 82 + t * 20] : [150 + (t - 0.55) * 120, 158 - (t - 0.55) * 40, 110 + (t - 0.55) * 60];
        if (m.frozen) c = [c[0] * 0.3 + 160, c[1] * 0.3 + 168, c[2] * 0.3 + 172];
        // slight shading by slope direction
        const hx = m.heights[Math.min(W - 1, x + 1) + y * W] - h, hy = m.heights[x + Math.min(H - 1, y + 1) * W] - h;
        const shade = Math.max(-26, Math.min(26, -(hx + hy) / 6));
        c = c.map((v) => v + shade);
      }
      const ent = this.sim.entities.get(m.owner[k]);
      if (ent?.kind === 'tree') c = m.frozen ? [120, 140, 128] : [62, 110, 58];
      else if (ent?.kind === 'pile') c = [200, 170, 120];
      data.set([c[0], c[1], c[2], 255], k * 4);
    }
    this.mmCache = { w: W, h: H, data, key };
    return this.mmCache;
  }

  /**
   * Moving contents of the minimap: buildings, units (owner colour), shafts and camera field of view.
   * @returns {{ w:number, h:number, me:number, buildings: Array<{x:number,y:number,w:number,h:number,owner:number}>,
   *   units: Array<{x:number,y:number,owner:number,big:boolean}>, shafts: Array<{x:number,y:number,res:string}>,
   *   view: Array<{x:number,y:number}>|null, hint: {x:number,y:number}|null }}
   */
  minimapDynamic() {
    const sim = this.sim, buildings = [], units = [];
    for (const e of sim.entities.values()) {
      if (e.kind === 'building') buildings.push({ x: e.x, y: e.y, w: e.w, h: e.h, owner: e.owner });
      else if (e.kind === 'leader' || e.kind === 'hero') units.push({ x: e.px / UNIT, y: e.py / UNIT, owner: e.owner, big: true });
      else if (e.kind === 'unit' || e.kind === 'worker' && !e.inside) units.push({ x: e.px / UNIT, y: e.py / UNIT, owner: e.owner, big: false });
    }
    const h = this.missionView.hint;
    const hint = h?.entity ? { x: h.entity.x, y: h.entity.y } : h?.area ? { x: h.area.x, y: h.area.y } : null;
    return {
      w: sim.map.width, h: sim.map.height, me: this.player, buildings, units,
      shafts: sim.shafts.map((s) => ({ x: s.x + 1.5, y: s.y + 1.5, res: s.res })), view: this.cameraFootprint(), hint,
    };
  }

  /** Ground quadrilateral the camera sees (tile coordinates), for the field of view on the minimap. */
  cameraFootprint() {
    const cam = this.renderer.camera, rig = this.renderer.rig;
    const gy = rig.target.y ?? 0;
    const out = [];
    for (const [nx, ny] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) {
      const v = new Vector3(nx, ny, 0.5).unproject(cam);
      const d = v.sub(cam.position).normalize();
      // limit a ray that goes over the horizon to a sensible distance
      const dy = Math.min(d.y, -0.08);
      const t = Math.min(160, (gy - cam.position.y) / dy);
      out.push({ x: cam.position.x + d.x * t, y: cam.position.z + d.z * t });
    }
    return out;
  }

  // ---------- Mission ----------

  /** Tutorial: "Weiter", skip step. */
  missionNext() { this.issue({ type: 'mission', action: 'next' }); }
  missionSkip() { this.issue({ type: 'mission', action: 'skip' }); }

  /**
   * Mission data for the UI; incidentally checks tutorial steps that only the
   * UI can see (camera moved, serfs selected), and follows camera hints.
   */
  missionUi() {
    const m = this.sim.mission;
    if (!m) { this.missionView.hint = null; return null; }
    const ui = m.uiState(this.sim);
    const mv = this.missionView;
    if (ui.camera && ui.camera.seq !== mv.cameraSeq) {
      mv.cameraSeq = ui.camera.seq;
      this.renderer.rig.lookAt(ui.camera.x + 0.5, ui.camera.y + 0.5);
    }
    const step = m.currentStep();
    const check = step?.done?.type === 'ui' ? step.done.check : null;
    if (check && !mv.checks[`${step.id}`]) {
      const rig = this.renderer.rig;
      if (!mv.camStart || mv.camStart.step !== step.id) mv.camStart = { step: step.id, x: rig.target.x, z: rig.target.z, yaw: rig.yaw, dist: rig.dist };
      const c = mv.camStart;
      const moved = Math.hypot(rig.target.x - c.x, rig.target.z - c.z) > 3 || Math.abs(rig.yaw - c.yaw) > 0.35 || Math.abs(rig.dist - c.dist) > 6;
      const ok = check === 'camera' ? moved : check === 'selectSerfs' ? this.ownSerfIds().length > 0 : false;
      if (ok) { mv.checks[step.id] = true; this.issue({ type: 'mission', action: 'ui', check }); }
    }
    mv.hint = ui.tutorial?.hint && (ui.tutorial.hint.entity || ui.tutorial.hint.area) ? ui.tutorial.hint : null;
    return ui;
  }

  // ---------- UI ----------

  emitUi() { this.onUi(this.uiState()); }

  /**
   * Reactive excerpt for Vue. Contains only IDs, numbers and reason codes – names and texts arise
   * in the UI (src/i18n), so a language switch takes effect immediately.
   */
  uiState() {
    const sim = this.sim, pl = sim.players[this.player];
    const res = {}, stock = {}, raw = {};
    for (const r of RESOURCES) { res[r] = pl.stock[r] + pl.raw[r]; stock[r] = pl.stock[r]; raw[r] = pl.raw[r]; }
    const now = performance.now();
    this.toasts = this.toasts.filter((t) => now - t.at < t.ttl);
    const serfs = this.ownSerfIds();
    const army = this.ownArmyIds().map((id) => sim.entities.get(id));
    let selection = null;
    if (army.length) {
      const groups = new Map();
      let soldiers = 0, refill = false, militia = 0;
      const heroes = [], leaders = [];
      for (const e of army) {
        if (e.kind === 'leader') {
          const d = UNITS[e.def];
          const stars = starsOf(e.xp);
          const g = groups.get(e.def) ?? { unit: e.def, line: d.line, tier: d.tier, count: 0, soldiers: 0, maxSoldiers: 0, hp: 0, maxHp: 0, stars: 0 };
          g.count++; g.soldiers += e.soldiers.length; g.maxSoldiers += d.soldiers;
          g.hp += e.hp; g.maxHp += d.hp; g.stars = Math.max(g.stars, stars);
          groups.set(e.def, g);
          // Experience: stars, rank (index 0–5, name made by the UI) and progress to the next star
          const th = EXPERIENCE.thresholds, xp = e.xp ?? 0;
          const lo = stars ? th[stars - 1] : 0, hi = th[stars] ?? null;
          leaders.push({
            id: e.id, unit: e.def, line: d.line, stars, rank: stars, xp, next: hi,
            frac: hi === null ? 1 : Math.max(0, Math.min(1, (xp - lo) / (hi - lo))),
            soldiers: e.soldiers.length, maxSoldiers: d.soldiers, hp: e.hp, maxHp: d.hp,
          });
          soldiers += e.soldiers.length;
          if (e.soldiers.length < d.soldiers) refill = true;
        } else if (e.kind === 'hero') {
          const h = HEROES[e.hero];
          heroes.push({
            id: e.id, hero: e.hero, hp: e.hp, maxHp: h.hp, down: e.down,
            abilities: Object.entries(h.abilities).map(([id, a]) => {
              const left = Math.max(0, (e.ready[id] ?? 0) - sim.tick);
              return { id, readyIn: Math.ceil(left / 10), cooldown: a.cooldown / 10, frac: a.cooldown ? Math.min(1, left / a.cooldown) : 0 };
            }),
          });
        } else militia++;
      }
      selection = {
        kind: 'army', serfs: serfs.length, soldiers, refill, heroes, militia, leaders,
        groups: [...groups.values()], attackMode: !!this.attackMode,
      };
    } else if (serfs.length) {
      let idle = 0, wood = 0, mining = 0, building = 0;
      for (const id of serfs) {
        const j = sim.entities.get(id).job;
        if (!j) idle++;
        else if (j.kind === 'build') building++;
        else if (sim.entities.get(j.target)?.kind === 'tree') wood++;
        else mining++;
      }
      selection = { kind: 'serfs', count: serfs.length, idle, jobs: { wood, mining, building } };
    } else if (this.selected.size === 1) {
      const e = sim.entities.get([...this.selected][0]);
      if (e?.kind === 'building') {
        const def = BUILDINGS[e.type];
        const lvl = def.levels[e.level];
        const own = e.owner === this.player;
        const next = def.levels[e.level + 1];
        const prof = workerSlots(e) ? professionFor(e.type) : null;
        let motivation = null;
        if (e.workers?.length) {
          let sum = 0;
          for (const id of e.workers) sum += sim.entities.get(id)?.motivation ?? 0;
          motivation = Math.round(sum / e.workers.length);
        }
        selection = {
          kind: 'building', id: e.id, type: e.type, levelIndex: e.level, level: e.level + 1, maxLevel: def.levels.length, done: e.done,
          owner: e.owner, progress: e.work ? Math.floor((e.progress / e.work) * 100) : 100, hp: e.hp, maxHp: lvl.hp,
          own, builders: e.builders.length, profession: prof, motivation,
          beds: lvl.beds ? [e.residents.length, lvl.beds] : null,
          seats: lvl.seats ? [e.eaters.length, lvl.seats] : null,
          population: lvl.population ?? null,
          workers: workerSlots(e) ? [e.workers.length, workerSlots(e)] : null,
          overtime: e.overtime,
          upgrade: own && next ? { level: e.level + 1, cost: Object.entries(next.cost), reason: sim.checkUpgrade(this.player, e) } : null,
          canDemolish: own && e.type !== 'headquarters' && e.type !== 'banditCamp',
          research: own && e.type === 'university' && e.done ? Object.values(TECHS).map((t) => ({
            id: t.id, line: t.line, tier: t.tier, prev: t.prev, cost: Object.entries(t.cost), time: t.time,
            done: pl.techs.has(t.id),
            running: e.research?.tech === t.id ? Math.floor((e.research.progress / researchPoints(t.id)) * 100) : null,
            elsewhere: !pl.techs.has(t.id) && e.research?.tech !== t.id && [...sim.entities.values()].some((o) => o.kind === 'building' && o.owner === this.player && o.research?.tech === t.id),
            reason: pl.techs.has(t.id) ? null : sim.checkResearch(this.player, e, t.id),
          })) : null,
          researching: own && e.research && TECHS[e.research.tech] ? { tech: e.research.tech, progress: Math.floor((e.research.progress / researchPoints(e.research.tech)) * 100) } : null,
          blessings: own && e.type === 'chapel' && e.done ? Object.entries(BLESSINGS).map(([id, b]) => ({
            id, professions: b.professions ?? null,
            reason: b.minLevel && e.level < b.minLevel ? 'err.cathedralOnly' : pl.faith < WORKER.blessingFaith ? 'err.notEnoughFaith' : null,
          })) : null,
          tax: own && e.type === 'headquarters' ? { level: pl.taxLevel, allowed: pl.techs.has('education'), percent: BALANCE.tax.factorsPercent, motivation: BALANCE.tax.motivation } : null,
          militia: own && e.type === 'headquarters' ? [...sim.entities.values()].some((u) => u.kind === 'unit' && u.owner === this.player && u.militia) : null,
          recruit: own && e.done ? this.recruitOptions(e) : null,
          ...buildingSystemsUi(sim, this.player, e),
          sections: own ? BUILDING_SECTIONS.map((fn) => { try { return fn(this, e); } catch { return null; } }).filter(Boolean) : [],
        };
      } else if (e) {
        const kind = e.kind === 'leader' ? 'leader' : e.kind;
        selection = { kind: 'foreign', entity: kind, owner: e.owner ?? -1, unit: e.def ?? null, hero: e.hero ?? null, prof: e.prof ?? null, type: e.kind === 'ruin' ? e.type : null, level: e.kind === 'ruin' ? e.level : null };
      }
    }
    const buildOptions = serfs.length ? BUILD_MENU.filter((type) => BUILDINGS[type]).map((type) => {
      const def = BUILDINGS[type];
      const cost = def.levels[0].cost;
      let reason = null;
      if (def.requires && !pl.techs.has(def.requires)) reason = { code: 'err.techMissing', params: { tech: def.requires } };
      else if (!sim.canPay(this.player, cost)) reason = 'err.notEnoughResources';
      return { type, category: BUILD_CATEGORY[type] ?? 'admin', cost: Object.entries(cost), reason, requires: def.requires ?? null };
    }) : [];
    const ticksToPay = BALANCE.paydayTicks - (sim.tick % BALANCE.paydayTicks);
    const mission = this.missionUi();
    // In missions the mission decides victory and defeat (own screen)
    const gameOver = mission ? null : pl.defeated ? { won: false } : sim.winner !== null ? { won: sim.winner === pl.team } : null;
    const wDur = sim.weatherCycle[sim.weather.index]?.[1] ?? 1;
    const nextWeather = sim.weatherCycle[(sim.weather.index + 1) % sim.weatherCycle.length]?.[0] ?? null;
    return {
      tick: sim.tick,
      res, stock, raw,
      pop: [sim.popUsed(this.player), sim.popLimit(this.player)],
      motivation: averageMotivation(sim, this.player),
      maxMotivation: maxMotivation(sim, this.player),
      workers: countWorkers(sim, this.player),
      faith: pl.faith,
      blessingCost: WORKER.blessingFaith,
      paydayIn: Math.ceil(ticksToPay / 10),
      paydayFrac: ticksToPay / BALANCE.paydayTicks,
      payday: { income: taxIncome(countWorkers(sim, this.player), pl.taxLevel), wages: countLeaders(sim, this.player) * BALANCE.wagePerLeader, last: this.lastPayday ?? null },
      speed: this.speed,
      paused: this.paused,
      selection,
      buildOptions,
      placing: this.placing ? { type: this.placing.type, valid: this.placing.valid, reason: this.placing.reason, hasPos: this.placing.hasPos } : null,
      toasts: this.toasts.map((t) => ({ id: t.id, key: t.key, params: t.params, icon: t.icon, tone: t.tone, pos: t.pos })),
      touch: this.touch,
      weather: {
        state: sim.weather.state, in: Math.max(0, Math.ceil((sim.weather.until - sim.tick) / 10)), frac: Math.max(0, Math.min(1, (sim.weather.until - sim.tick) / wDur)), next: nextWeather,
        // Forecast only with weather tower or weather power plant
        forecast: hasForecast(sim, this.player) ? forecast(sim).map((f) => ({ state: f.state, in: Math.ceil(f.inTicks / 10) })) : null,
        energy: pl.weatherEnergy ?? 0,
      },
      gameOver,
      mission,
      serfCost: BALANCE.serf.cost.gold,
      camera: { x: this.renderer.rig.target.x, y: this.renderer.rig.target.z },
    };
  }
}
