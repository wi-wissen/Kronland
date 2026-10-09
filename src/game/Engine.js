// Engine: connects simulation, rendering, input and UI.
// The player acts on the simulation exclusively through commands, as the AI and the network will later.

import { Sim } from '../sim/sim.js';
import { BUILDINGS } from '../sim/data/buildings.js';
import { BALANCE } from '../sim/data/balance.js';
import { RESOURCES } from '../sim/data/resources.js';
import { TECHS, researchPoints } from '../sim/data/technologies.js';
import { BUILDING_TECHS } from '../sim/data/buildingTechs.js';
import { BLESSINGS, WORKER, professionFor } from '../sim/data/professions.js';
import { averageMotivation, workerSlots, maxMotivation } from '../sim/systems/workers.js';
import { UNITS, LINES, HEROES, HERO_IDS, unitOf, fullCost, LINE_UPGRADE_COST } from '../sim/data/units.js';
import { targetable, isEnemy } from '../sim/systems/military.js';
import { countWorkers, countLeaders, taxIncome } from '../sim/systems/payday.js';
import { AiPlayer } from '../ai/AiPlayer.js';
import { saveGame, loadGame } from '../sim/serialize.js';
import { createMissionSim, createScenarioSim } from '../sim/missions/runtime.js';
import { StageSnapshot } from '../sim/stage.js';
import { resetSpeech, stopSpeech } from '../audio/speech.js';
import { UNIT } from '../sim/fixed.js';
import { Renderer } from '../render/Renderer.js';
import { clearView, figureTargets, angleDelta } from '../render/sightline.js';
import { cursorCss } from './cursors.js';
import { characterManifest } from '../render/characters.js';
import { figureRole, figureSex } from '../render/variants.js';
import { getQuality } from '../render/quality.js';
import { get as setting, applyPlayerColor, onChange as onSettingChange } from '../ui/settings.js';
import { Input } from './Input.js';
import { ControlGroups } from './groups.js';
import { visibleSameType } from './sameType.js';
import { dragRect, unitsInBox } from './boxSelect.js';
import { COMBAT } from '../sim/data/combat.js';
import { buildingSystemsUi } from './buildingUi.js';
import { relationOf, showsInterior } from './relation.js';
import { noteAlert, activeAlerts } from './alerts.js';
import { addNotice, expireNotices, pickVisible, attackInfo, attackNotices } from './notices.js';
import { isDamaged } from '../sim/systems/damage.js';
import { hasForecast, forecast } from '../sim/systems/weather.js';
import { starsOf, EXPERIENCE } from '../sim/data/experience.js';
import { GameAudio } from '../audio/GameAudio.js';
import { canSee, isExplored, isVisible, knownBuildings, fogEnabled } from '../sim/systems/vision.js';
import { Vector3 } from 'three';
import { padPreview } from '../sim/systems/terrain.js';
import { TICK_MS, runSteps, frameTimes, FaultGuard } from './loop.js';

/** Entity kinds with a figure (sex in the selection) */
const FIGURE_KINDS = new Set(['unit', 'worker', 'soldier', 'leader', 'hero', 'npc']);
/** Figure role → key figure.* (singular of the squad type): 'soldier.bow' → 'bow', 'bandit.bow' → 'banditBow' */
const figureLook = (role) => (role === 'bandit.bow' ? 'banditBow' : role === 'bandit' ? 'bandit' : role.replace(/^soldier\./, '').replace(/\.leader$/, ''));

/** Dialogue camera: distance close to the figure, duration of the move, pause before the return move (ms) */
const DIALOG_DIST = 8, DIALOG_FLY_MS = 1100, DIALOG_BACK_MS = 1200;
/** Figures checked for the clear view of a scripted camera move: kinds, search radius (tiles), at most this many. */
const VIEW_FIGURES = new Set(['unit', 'worker', 'soldier', 'leader', 'hero', 'npc']);
const VIEW_RADIUS = 2.5, VIEW_MAX = 6;
/** Phone "watch game": after a manual camera move the camera stops following the figure this long (ms). */
const WATCH_MANUAL_MS = 5000;

/** Build preview yellow ("will be levelled") if a tile deviates from the plane by more than this many cm. */
export const LEVEL_NOTICE = 40;

/** Order in the build menu. Other modules may append types (category via BUILD_CATEGORY). */
export const BUILD_MENU = [
  'residence', 'farm', 'villageCenter', 'storehouse',
  'clayMine', 'stoneMine', 'ironMine', 'sulfurMine',
  'brickworks', 'sawmill', 'stonemason', 'smithy', 'alchemist', 'bank',
  'tower', 'barracks', 'archery', 'stable', 'foundry',
  'university', 'chapel', 'weatherTower', 'weatherPlant', 'clock', 'windwheel', 'fountain', 'statue', 'bridge',
];

/** Categories of the build menu (tabs). Unknown types land under 'admin'. */
export const BUILD_CATEGORIES = ['home', 'raw', 'refine', 'military', 'admin'];
export const BUILD_CATEGORY = {
  residence: 'home', farm: 'home', villageCenter: 'home', storehouse: 'home',
  clayMine: 'raw', stoneMine: 'raw', ironMine: 'raw', sulfurMine: 'raw',
  brickworks: 'refine', sawmill: 'refine', stonemason: 'refine', smithy: 'refine', alchemist: 'refine', bank: 'refine',
  tower: 'military', barracks: 'military', archery: 'military', stable: 'military', foundry: 'military',
  university: 'admin', chapel: 'admin', clock: 'admin', windwheel: 'admin', fountain: 'admin', statue: 'admin', bridge: 'admin',
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

/** Minimum gap (ms) between two alarm bells in the same region (the notice itself stays while the attack lasts) */
const ATTACK_TOAST_MS = 15000;
/** How long a notify() notice stays (ms; each further notify refreshes it) */
const NOTIFY_TOAST_MS = 6000;
/** At most this many notices at once (desktop / touch) */
const MAX_TOASTS = 5, MAX_TOASTS_TOUCH = 4;
/** Figures that attack serfs on command (not buildings) */
const FIGHT_TARGETS = new Set(['unit', 'worker', 'leader', 'soldier', 'hero']);

export class Engine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ seed?: number, onUi?: (state: any) => void, difficulty?: string, players?: number, hero?: string, fog?: boolean }} opts
   */
  constructor(canvas, opts = {}) {
    this.player = 0;
    const players = opts.players ?? 2;
    const heroes = [...HERO_IDS, ...HERO_IDS];
    if (opts.hero && HEROES[opts.hero]) { const i = heroes.indexOf(opts.hero); if (i > 0) [heroes[0], heroes[i]] = [heroes[i], heroes[0]]; }
    // Game option "tracks" from the settings (a level may fix it, src/sim/systems/ground.js)
    const tracks = setting('tracks');
    if (opts.load) {
      this.sim = loadGame(opts.load);
      this.ais = (opts.load.extra?.ais ?? []).map((st) => AiPlayer.fromState(this.sim, st));
    } else if (opts.mission || opts.scenario) {
      // Mission or scenario (world editor, file): players, opponents and setup come from the definition
      this.sim = opts.scenario ? createScenarioSim(opts.scenario, { seed: opts.seed, tracks }) : createMissionSim(opts.mission.id, { seed: opts.mission.seed, tracks });
      this.ais = this.sim.mission.def.players
        .map((p, i) => (p.kind === 'ai' ? new AiPlayer(this.sim, i, p.difficulty ?? 'normal') : null)).filter(Boolean);
    } else {
      this.sim = new Sim({ seed: opts.seed ?? 1, players, heroes, fog: opts.fog ?? true, tracks });
      /** AI opponents for all other players */
      this.ais = [];
      for (let p = 1; p < players; p++) this.ais.push(new AiPlayer(this.sim, p, opts.difficulty ?? 'normal'));
    }
    // Setting changed during the game: a command (lockstep-safe), never a direct write into the simulation
    this.offSettings = onSettingChange(({ key }) => { if (key === 'tracks') this.syncTracks(); });
    applyPlayerColor(this.player); // player colour (pure rendering, no sim state)
    this.renderer = new Renderer(canvas, this.sim, { player: this.player });
    this.onUi = opts.onUi ?? (() => {});
    /** Game halted after a permanent error (error dialogue) */
    this.onCrash = opts.onCrash ?? (() => {});
    /** Fault guard of the game loop (src/game/loop.js) */
    this.faults = new FaultGuard();
    /** @type {null | { area: string, message: string, stack: string, tick: number }} */
    this.crash = null;
    /** Dropped ticks (simulation slower than the clock) – for developer mode */
    this.droppedTicks = 0;
    /** @type {Set<number>} */
    this.selected = new Set();
    /** Control groups 1–9 (UI only, no sim state) */
    this.groups = new ControlGroups();
    /** @type {null | {type: string, x: number, y: number, valid: boolean, reason: string|null, hasPos: boolean}} */
    this.placing = null;
    this.queue = [];
    // A save game keeps its mode unless the setting differs: then the same command as a change in the menu
    if (opts.load) this.syncTracks();
    this.prev = new Map();
    this.speed = 1;
    this.paused = false;
    this.acc = 0;
    /** Transient notices (src/game/notices.js); persistent notices arise in persistentNotices() */
    this.toasts = [];
    this.toastId = 0;
    /** Own burning buildings (IDs, from buildingBurning/-Extinguished; scanned once on first access) */
    this.burning = null;
    /** Dismissed persistent notices: fires (building IDs), unconscious heroes (IDs) */
    this.mutedFires = new Set();
    this.mutedHeroes = new Set();
    this.touch = matchMedia?.('(pointer: coarse)').matches ?? false;
    this.input = new Input(this, canvas);
    this.canvas = canvas;
    this.resize = () => this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.ro = new ResizeObserver(this.resize);
    this.ro.observe(canvas);
    this.resize();
    this.lastUi = 0;
    const cam = opts.load?.extra?.camera;
    if (cam) { this.renderer.rig.lookAt(cam.x, cam.z); this.renderer.rig.yaw = cam.yaw; this.renderer.rig.dist = cam.dist; if (cam.pitch !== undefined) this.renderer.rig.pitch = cam.pitch; this.renderer.rig.clamp(); }
    // make weather visible after loading
    if (this.sim.weather.state !== 'summer') this.renderer.applyWeather(this.sim.weather.state);
    /** Mission-related UI state (camera jumps, tutorial checks) */
    this.missionView = { cameraSeq: this.sim.mission?.state.camera?.seq ?? 0, hint: null, checks: {} };
    // adopt the graphics level in the running game (setQuality() reports 'kronland-quality')
    this.onQuality = () => { try { this.renderer.applyQuality(getQuality()); this.emitUi(); } catch { /* rendering must never stop the game */ } };
    window.addEventListener('kronland-quality', this.onQuality);
    // audio (a silent no-op without Web Audio; errors in the audio system must never disturb the game)
    try { this.audio = new GameAudio(this); } catch { this.audio = null; }
    /** Developer mode (src/dev/DevTools.js), only loaded when switched on */
    this.dev = null;
    /** Running camera move (script, dialogue camera): { fx, fz, tx, tz, fd?, td?, t0, ms } */
    this.camFly = null;
    /** Dialogue camera: camera before the dialogue { x, z, dist, taken } (taken: player took over) */
    this.dialogCam = null;
    /** Halt of the mission script in the debugger has paused the game */
    this.debugHalt = false;
    /** Snapshot of the current stage: "Run" starts it over (src/sim/stage.js); travels in the save game envelope */
    this.stage = new StageSnapshot(opts.load?.extra?.stage ?? null);
    /** Number of stage restarts (the UI resets what it remembers of the old world) */
    this.restarts = 0;
    resetSpeech();
  }

  /**
   * Switch developer mode on/off. The tools are only loaded now; they only read.
   * @param {boolean} on
   * @returns {Promise<void>}
   */
  async setDevMode(on) {
    this.devWanted = !!on;
    if (!on) { this.dev?.dispose(); this.dev = null; return; }
    if (this.dev) return;
    const { DevTools } = await import('../dev/DevTools.js');
    if (this.devWanted && !this.dev && !this.stopped) this.dev = new DevTools(this);
  }

  start() {
    this.running = true;
    this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      // request the next frame first: even an unexpected exception does not halt the picture forever
      this.raf = requestAnimationFrame(loop);
      try { this.frame(now); } catch (err) { this.fault('ui', err); }
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    this.stopped = true;
    this.dev?.dispose();
    this.dev = null;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    window.removeEventListener('kronland-quality', this.onQuality);
    this.offSettings?.();
    this.input.dispose();
    this.audio?.dispose();
    clearTimeout(this.dialogCamBack);
    stopSpeech();
    // release WebGL resources: the canvas is reused for the next game
    try { this.renderer.dispose(); } catch { /* disposal must never prevent ending */ }
  }

  frame(now) {
    // dt for animations, simMs for game time (clamped separately: slow frames must not slow down the game)
    const { dt, simMs } = frameTimes(now, this.last);
    this.last = now;
    if (this.crash) this.paused = true;
    if (!this.paused) this.acc += simMs * this.speed;
    if (this.acc >= TICK_MS) {
      // ticks with a time budget; if the simulation is too slow, the game runs slower (no snowballing)
      const r = runSteps(this.acc, () => {
        if (this.paused) return;
        try { this.stepOnce(); this.faults.ok('sim'); } catch (err) { this.fault('sim', err); }
      });
      this.acc = this.paused ? 0 : r.acc;
      this.droppedTicks += r.dropped;
    }
    const g = this.faults;
    g.run('ui', () => { this.input.edgeScroll(dt); this.followFocus(now); this.followWatched(now, dt); this.flyCamera(now); }, (f) => f && this.fault('ui'));
    g.run('render', () => this.renderer.frame(this.paused ? 1 : this.acc / TICK_MS, dt, this.prev, {
      selected: this.selected,
      ghost: this.placing?.hasPos ? this.placing : null,
      hint: this.missionView.hint,
      landmarks: this.missionView.landmarks ?? null,
      revealAll: this.fogLifted(),
      // paused: figures freeze in their current pose (clip and walking speed stay as in the last tick)
      paused: this.paused,
      speed: this.speed,
    }), (f) => f && this.fault('render'));
    if (this.dev) g.run('dev', () => this.dev?.frame(dt));
    if (this.audio) g.run('audio', () => this.audio?.frame(dt));
    if (now - this.lastUi > 200) { this.lastUi = now; g.run('ui', () => this.emitUi(), (f) => f && this.fault('ui')); }
  }

  /**
   * Errors from the loop: log (FaultGuard) and, if an area fails permanently (simulation
   * several ticks in a row, rendering many frames in a row), halt the game and show the error dialogue
   * (onCrash; load a save game or reload the page). Without `err` the error has already been counted.
   * @param {string} area @param {unknown} [err]
   */
  fault(area, err) {
    if (err !== undefined && !this.faults.fail(area, err)) return;
    if (!this.faults.fatal || this.crash) return;
    this.crash = { ...this.faults.fatal, tick: this.sim.tick };
    this.paused = true;
    this.acc = 0;
    try { this.onCrash(this.crash); } catch { /* the UI then simply does not show the dialogue */ }
  }

  stepOnce() {
    this.prev = new Map();
    for (const e of this.sim.entities.values()) if (e.px !== undefined) this.prev.set(e.id, { px: e.px, py: e.py });
    const t0 = this.dev ? performance.now() : 0;
    // Eliminated AI opponents stop thinking; an error in one AI does not halt the game
    for (const ai of this.ais) {
      if (this.sim.players[ai.player]?.defeated) continue;
      try { ai.update(); } catch (err) { this.faults.fail('ai', err); }
    }
    const t1 = this.dev ? performance.now() : 0;
    const events = this.sim.step(this.queue);
    if (this.dev) this.dev.afterTick(performance.now() - t1, t1 - t0);
    this.queue = [];
    // Read-only consequences of the tick: count errors there, but do not abort the tick
    const g = this.faults;
    g.run('render', () => this.renderer.onEvents(events), (f) => f && this.fault('render'));
    if (this.audio) g.run('audio', () => { this.audio.onEvents(events, this.prev); this.audio.onTick(); });
    g.run('ui', () => {
      this.eventToasts(events);
      // Selection: deselect what has vanished and foreign things that vanish into the fog
      for (const id of this.selected) if (!this.canSee(this.sim.entities.get(id))) this.selected.delete(id);
    });
  }

  // ---------- Fog of war ----------

  /** Is the fog lifted for display (fog off, game over, own player eliminated)? */
  fogLifted() {
    const sim = this.sim;
    return !fogEnabled(sim) || sim.players[this.player]?.defeated || sim.winner !== null || !!sim.mission?.state?.result;
  }

  /** Does the human player see this entity (own/allied always)? */
  canSee(e) { return !!e && (this.fogLifted() || canSee(this.sim, this.player, e)); }

  /** Tile visible or explored (tile coordinates)? */
  tileVisible(x, y) { return this.fogLifted() || isVisible(this.sim, this.player, Math.floor(x), Math.floor(y)); }
  tileExplored(x, y) { return this.fogLifted() || isExplored(this.sim, this.player, Math.floor(x), Math.floor(y)); }

  /** Queue a command of the human player. */
  issue(cmd) {
    this.queue.push({ ...cmd, player: this.player });
    try { this.audio?.onCommand(cmd); } catch { /* audio is a side issue */ }
  }

  /**
   * Notice into the message stream. Texts are i18n keys with parameters; parameters like
   * `building`, `tech`, `line`, `weather` are IDs and are translated in the UI.
   * An unknown key is displayed unchanged (for finished texts of other modules).
   * @param {string} key
   * @param {Record<string, any>} [params]
   * @param {{ icon?: string, tone?: 'info'|'good'|'warn'|'bad', pos?: {x:number,y:number}|null, ttl?: number }} [opts]
   */
  toast(key, params = null, opts = {}) {
    const now = performance.now();
    const t = addNotice(this.toasts, { id: ++this.toastId, key, params, icon: opts.icon ?? 'info', tone: opts.tone ?? 'info', pos: opts.pos ?? null, at: now, ttl: opts.ttl ?? 5000, cat: opts.cat }, now);
    this.emitUi();
    return t.id;
  }

  /**
   * Close a notice early. Persistent notices (attack, fire, hero) then stay away until their cause ends
   * or a new one is added (new attack place, another burning building).
   */
  dismissToast(id) {
    if (typeof id === 'string') {
      if (id.startsWith('attack-')) { const z = (this.alerts ?? []).find((a) => `attack-${a.id}` === id); if (z) z.muted = true; }
      if (id === 'fire') for (const b of this.burning ?? []) this.mutedFires.add(b);
      if (id === 'hero') for (const e of this.sim.entities.values()) if (e.kind === 'hero' && e.owner === this.player && e.down) this.mutedHeroes.add(e.id);
    } else this.toasts = this.toasts.filter((t) => t.id !== id);
    this.emitUi();
  }

  /**
   * Persistent notices from the current state (not from individual events): attack places (until ALERT_MS after the
   * last hit), burning buildings (merged), unconscious heroes (merged). Costs only the small lists,
   * no scan over all entities; `heroes` comes from quickInfo().
   * @param {{ id: number, down: boolean }[]} heroes
   */
  persistentNotices(heroes) {
    const sim = this.sim, now = performance.now();
    this.alerts = activeAlerts(this.alerts, now);
    const out = attackNotices(this.alerts);
    const down = heroes.filter((h) => h.down);
    for (const id of this.mutedHeroes) if (!down.some((h) => h.id === id)) this.mutedHeroes.delete(id);
    const showHeroes = down.filter((h) => !this.mutedHeroes.has(h.id));
    if (showHeroes.length) {
      const e = sim.entities.get(showHeroes[0].id);
      out.push({ id: 'hero', key: showHeroes.length > 1 ? 'toast.heroesDown' : 'toast.heroDown', params: { n: showHeroes.length }, icon: 'skull', tone: 'bad', pos: this.entityPos(e), at: 0, ttl: Infinity, cat: 'alarm', count: 1, many: null, sticky: true });
    }
    if (!this.burning) {
      this.burning = new Set();
      for (const e of sim.entities.values()) if (e.kind === 'building' && e.owner === this.player && e.burning) this.burning.add(e.id);
    }
    const fires = [];
    for (const id of this.burning) {
      const b = sim.entities.get(id);
      if (!b || !b.burning || b.owner !== this.player) { this.burning.delete(id); this.mutedFires.delete(id); } else fires.push(b);
    }
    if (fires.some((b) => !this.mutedFires.has(b.id))) {
      const b = fires[fires.length - 1]; // most recently caught fire: jump there
      out.push({
        id: 'fire', key: fires.length > 1 ? 'toast.buildingsBurning' : 'toast.buildingBurning', params: { building: b.type, level: b.level, n: fires.length },
        icon: 'fire', tone: 'bad', pos: this.entityPos(b), at: 0, ttl: Infinity, cat: 'fire', count: 1, many: null, sticky: true,
      });
    }
    return out;
  }

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
      // hero unconscious: persistent notice (persistentNotices) while he lies down
      if (ev.type === 'killed' && ev.kind === 'hero' && ev.owner === me) this.emitUi();
      if (ev.type === 'victory' || (ev.type === 'defeated' && ev.player === me)) this.emitUi();
      if (ev.type === 'missionWon' || ev.type === 'missionLost') { this.paused = true; this.emitUi(); }
      if (ev.type === 'dialog' || ev.type === 'tutorialStep' || ev.type === 'objective') this.emitUi();
      // melee and ranged combat (arrows, bolts, bullets) report alike
      if (ev.type === 'hit' || (ev.type === 'shot' && ev.target)) this.attackToast(ev);
      if (ev.type === 'weatherChanged' && ev.player !== me) this.toast('toast.weatherChangedEnemy', { weather: ev.state }, { icon: `weather-${ev.state}`, tone: 'warn' });
      if (ev.type === 'payday' && ev.player === me) this.lastPayday = { income: ev.income, wages: ev.wages, tick: sim.tick };
      if (ev.type === 'bridgeBuilt' && ev.player === me) this.toast('toast.bridgeBuilt', null, { icon: 'b-bridge', tone: 'good', pos: { x: ev.x + ev.w / 2, y: ev.y + ev.h / 2 } });
      if (ev.type === 'bridgeCollapsed' && this.tileVisible(ev.x + ev.w / 2, ev.y + ev.h / 2)) this.toast('toast.bridgeCollapsed', null, { icon: 'b-bridge', tone: 'warn', pos: { x: ev.x + ev.w / 2, y: ev.y + ev.h / 2 } });
      if (ev.player !== me) continue;
      if (ev.type === 'rejected') this.toast(ev.reason, ev.params ?? null, { icon: 'warning', tone: 'warn', ttl: 3500 });
      if (ev.type === 'buildingDone' && ev.buildingType !== 'bridge') { // bridge: own notice (bridgeBuilt)
        const b = sim.entities.get(ev.building);
        this.toast(ev.level ? 'toast.upgradeDone' : 'toast.buildingDone', { building: ev.buildingType, level: ev.level ?? 0 }, { icon: `b-${ev.buildingType}`, tone: 'good', pos: this.entityPos(b) });
      }
      if (ev.type === 'researchDone') {
        // building technology (smithy, …): with building name and jump target
        const b = ev.building ? sim.entities.get(ev.building) : null;
        if (b) this.toast('toast.buildingResearchDone', { tech: ev.tech, building: b.type, level: b.level }, { icon: `b-${b.type}`, tone: 'good', pos: this.entityPos(b) });
        else this.toast('toast.researchDone', { tech: ev.tech }, { icon: 'research', tone: 'good' });
      }
      // fire: persistent notice (persistentNotices) while the building burns; a new fire shows it again
      if (ev.type === 'buildingBurning') { (this.burning ??= new Set()).delete(ev.building); this.burning.add(ev.building); this.mutedFires.delete(ev.building); this.emitUi(); }
      if (ev.type === 'buildingExtinguished') this.burning?.delete(ev.building);
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
      if (ev.type === 'noMoreNodes' && ev.player === me && !(this.noNodesToast?.[ev.res] > performance.now())) {
        // at most every 15 s per resource, otherwise every serf reports individually
        (this.noNodesToast ??= {})[ev.res] = performance.now() + 15000;
        this.toast('toast.noMoreNodes', { res: ev.res }, { icon: 'idle', tone: 'warn', pos: this.entityPos(sim.entities.get(ev.unit)), ttl: 6000 });
      }
      if (ev.type === 'campLit' && ev.player === me && !(this.campToast > performance.now())) {
        // at most every 60 s: fires go on and off depending on who currently has a bed
        this.campToast = performance.now() + 60000;
        this.toast('toast.campLit', null, { icon: 'b-residence', tone: 'warn', pos: { x: ev.x + 0.5, y: ev.y + 0.5 }, ttl: 7000 });
      }
      if (ev.type === 'nodeDepleted' && ev.res !== 'wood') this.toast('toast.nodeDepleted', { res: ev.res }, { icon: ev.res, ttl: 3500 });
    }
    // notify() of a program: one notice, the newest text wins, further calls only count up (print() stays in the console)
    const notes = events.filter((e) => e.type === 'scriptNotify' && e.player === me);
    if (notes.length) {
      const id = this.toast('toast.notify', { text: notes[notes.length - 1].text }, { icon: 'scroll', ttl: NOTIFY_TOAST_MS });
      const t = this.toasts.find((x) => x.id === id);
      if (t) t.count += notes.reduce((n, e) => n + (e.n ?? 1), 0) - 1;
    }
    // remember positions of buildings so destruction notices can jump
    if (events.some((e) => e.type === 'buildingDone' || e.type === 'buildingPlaced') || !this.lastPos) {
      this.lastPos = new Map();
      for (const e of sim.entities.values()) if (e.kind === 'building' && e.owner === me) this.lastPos.set(e.id, this.entityPos(e));
    }
  }

  /**
   * "Angriff auf …!" – own buildings, workers or squads are hit by enemies. The place (alerts.js) carries the
   * minimap pulse and persistent notice until no hit has come for ALERT_MS; the alarm bell is throttled per region.
   */
  attackToast(ev) {
    const t = this.sim.entities.get(ev.target), a = this.sim.entities.get(ev.by);
    if (!t || t.owner !== this.player || !a || a.owner === this.player || this.sim.allied(a.owner, this.player)) return;
    const pos = this.entityPos(t);
    if (!pos) return;
    const now = performance.now();
    const fresh = !activeAlerts(this.alerts, now).length;
    this.alerts = noteAlert(this.alerts, pos, now, attackInfo(t, pos));
    if (fresh) this.emitUi(); // show the first place immediately, afterwards the 200 ms tick suffices
    this.attackSeen ??= [];
    this.attackSeen = this.attackSeen.filter((s) => now - s.at < ATTACK_TOAST_MS);
    if (this.attackSeen.some((s) => Math.hypot(s.x - pos.x, s.y - pos.y) < 18)) return;
    this.attackSeen.push({ ...pos, at: now });
    try { this.audio?.alarm(t); } catch { /* audio is a side issue */ }
  }

  /**
   * Point the camera at a tile position (notices, minimap). `visible`: on phones/portrait place it in the free area above the
   * context panel instead of the screen centre (notices, mission jumps).
   */
  jumpTo(x, y, visible = false) { if (visible) this.focusPoint(x, y); else this.renderer.rig.lookAt(x, y); this.emitUi(); }

  /**
   * Camera jump that keeps the target visible: on small or tall screens the
   * context panel (height from the CSS variable --bottom-h) covers the lower third of the picture; the target is then placed
   * in the middle of the free area between header bar (--top-total) and panel.
   */
  focusPoint(x, z) {
    const rig = this.renderer.rig, vp = this.renderer.viewport;
    const { top, bottom } = this.hudInsets();
    const small = vp && (vp.h > vp.w || vp.w < 900);
    if (small && bottom > vp.h * 0.15) {
      const y = (Math.min(top, vp.h * 0.3) + vp.h - bottom) / 2;
      rig.lookAtScreen(x, z, Math.max(vp.h * 0.15, y), vp.h);
    } else rig.lookAt(x, z);
    // The panel often changes its height right afterwards (selection opens it): follow up briefly
    this.pendingFocus = small ? { x, z, bottom, until: performance.now() + 1500, tx: rig.target.x, tz: rig.target.z } : null;
  }

  /**
   * Phone, "watch game" of the code panel: keep the own hero in view. If it is already visible in the free area
   * (below the header, above the run strip of `bottomPx` pixels), the view stays; otherwise the camera centres on it.
   * @param {number} [bottomPx] covered height at the bottom (run strip)
   * @returns {boolean} true if the camera moved
   */
  watchFocus(bottomPx = 0) {
    const r = this.renderer, vp = r?.viewport;
    if (!vp) return false;
    let hero = null;
    for (const e of this.sim.entities.values()) if (e.kind === 'hero' && e.owner === this.player) { hero = e; break; }
    if (!hero) return false;
    const rec = r.chars?.records.get(hero.id);
    const x = rec ? rec.position.x : hero.px / UNIT, z = rec ? rec.position.z : hero.py / UNIT;
    const top = Math.min(this.hudInsets().top, vp.h * 0.3);
    const bottom = vp.h - Math.max(bottomPx, 0);
    const s = r.project(x, r.terrain.heightAt(x, z) + 0.3, z);
    const c = r.renderer.domElement.getBoundingClientRect();
    const sx = s.x - c.left, sy = s.y - c.top, m = 24;
    if (!s.behind && sx >= m && sx <= vp.w - m && sy >= top + m && sy <= bottom - m) return false;
    r.rig.lookAtScreen(x, z, (top + bottom) / 2, vp.h);
    this.pendingFocus = null;
    if (this.watchFollow) this.watchFollow.cam = null; // our own move, not the player's
    return true;
  }

  /**
   * Phone, "watch game" of the code panel: the camera keeps following the figure the player program controlled last
   * (step, turn, take …; otherwise the own hero). bottomPx: height covered by the run strip; null switches it off.
   */
  setWatchFollow(bottomPx) {
    this.watchFollow = bottomPx === null || bottomPx === undefined ? null : { bottom: Math.max(0, bottomPx), manualUntil: 0, cam: null, moving: false };
  }

  /** Figure the player program controls (last command), else the own hero. */
  watchedFigure() {
    const id = this.sim.mission?.script?.focus;
    const e = id ? this.sim.entities.get(id) : null;
    if (e && e.owner === this.player && e.px !== undefined) return e;
    for (const h of this.sim.entities.values()) if (h.kind === 'hero' && h.owner === this.player) return h;
    return null;
  }

  /**
   * Per frame while watching on the phone: when the figure leaves the free area (below the header, above the strip),
   * the camera glides after it until it is in the middle again. A manual camera move (pan, zoom, rotate) pauses this
   * for a few seconds – the player's view wins.
   */
  followWatched(now, dt) {
    const f = this.watchFollow, r = this.renderer, rig = r?.rig, vp = r?.viewport;
    if (!f || !rig || !vp) return;
    // scripted moves and the dialogue camera have the view; their return is not a manual move
    if (this.camFly || this.dialogCam) { f.cam = null; f.moving = false; return; }
    const cam = { x: rig.target.x, z: rig.target.z, yaw: rig.yaw, dist: rig.dist, pitch: rig.pitch };
    const same = (a, b) => a && Math.abs(a.x - b.x) < 1e-3 && Math.abs(a.z - b.z) < 1e-3 && Math.abs(a.yaw - b.yaw) < 1e-4 && Math.abs(a.dist - b.dist) < 1e-3 && Math.abs(a.pitch - b.pitch) < 1e-4;
    if (f.cam && !same(f.cam, cam)) { f.manualUntil = now + WATCH_MANUAL_MS; f.moving = false; }
    f.cam = cam;
    if (now < f.manualUntil) return;
    const e = this.watchedFigure();
    if (!e) return;
    const rec = r.chars?.records.get(e.id);
    const x = rec ? rec.position.x : e.px / UNIT, z = rec ? rec.position.z : e.py / UNIT;
    const top = Math.min(this.hudInsets().top, vp.h * 0.3), bottom = vp.h - f.bottom;
    if (!f.moving) {
      const s = r.project(x, r.terrain.heightAt(x, z) + 0.3, z);
      const c = r.renderer.domElement.getBoundingClientRect();
      const sx = s.x - c.left, sy = s.y - c.top, mx = vp.w * 0.18, my = (bottom - top) * 0.18;
      if (!s.behind && sx >= mx && sx <= vp.w - mx && sy >= top + my && sy <= bottom - my) return;
      f.moving = true;
    }
    // glide: where the camera would have to look, approached smoothly
    const from = { x: rig.target.x, z: rig.target.z };
    rig.lookAtScreen(x, z, (top + bottom) / 2, vp.h);
    const k = Math.min(1, dt * 4), tx = rig.target.x, tz = rig.target.z;
    rig.target.x = from.x + (tx - from.x) * k;
    rig.target.z = from.z + (tz - from.z) * k;
    rig.clamp();
    if (Math.abs(tx - rig.target.x) < 0.05 && Math.abs(tz - rig.target.z) < 0.05) f.moving = false;
    f.cam = { x: rig.target.x, z: rig.target.z, yaw: rig.yaw, dist: rig.dist, pitch: rig.pitch };
    this.pendingFocus = null;
  }

  /** After a camera jump: if the panel height changes, place the target in the free area again. */
  followFocus(now) {
    const f = this.pendingFocus, rig = this.renderer.rig;
    if (!f) return;
    // expired or moved on by the player
    if (now > f.until || Math.abs(rig.target.x - f.tx) > 0.01 || Math.abs(rig.target.z - f.tz) > 0.01) { this.pendingFocus = null; return; }
    if (this.hudInsets().bottom === f.bottom) return;
    const until = f.until;
    this.focusPoint(f.x, f.z);
    if (this.pendingFocus) this.pendingFocus.until = until;
  }

  /** Edges covered by the UI at top/bottom in CSS pixels. */
  hudInsets() {
    try {
      const cs = getComputedStyle(this.canvas);
      return { top: parseFloat(cs.getPropertyValue('--top-total')) || 0, bottom: parseFloat(cs.getPropertyValue('--bottom-h')) || 0 };
    } catch { return { top: 0, bottom: 0 }; }
  }

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
    // Fog: foreign things outside vision are neither selectable nor attackable
    return e && this.canSee(e) ? e : null;
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
    const r = this.renderer;
    // drawn position (with rendering offset), otherwise that of the simulation
    const ids = unitsInBox(this.sim.entities.values(), this.player, (e) => {
      const rec = r.chars?.records.get(e.id);
      const x = rec ? rec.position.x : e.px / UNIT, z = rec ? rec.position.z : e.py / UNIT;
      return r.project(x, r.terrain.heightAt(x, z) + 0.3, z);
    }, dragRect(x1, y1, x2, y2));
    for (const id of ids) this.selected.add(id);
    this.emitUi();
  }

  /**
   * Double-click/double-tap: all own figures of the same kind as the one under (cx, cy) that are in the visible
   * map area (without the edges covered by the UI). additive adds.
   * @returns {boolean} false if no own figure is there (then the normal click applies)
   */
  selectSameTypeAt(cx, cy, additive = false) {
    const ref = this.selectable(this.renderer.pickEntity(cx, cy));
    if (!ref || ref.owner !== this.player) return false;
    const r = this.canvas.getBoundingClientRect();
    const { top, bottom } = this.hudInsets();
    const rect = { left: r.left, right: r.right, top: r.top + top, bottom: r.bottom - bottom };
    const ids = visibleSameType(this.sim.entities.values(), this.player, ref, (e) => {
      const x = e.px / UNIT, z = e.py / UNIT;
      return this.renderer.project(x, this.renderer.terrain.heightAt(x, z) + 0.3, z);
    }, rect);
    if (!ids.length) return false;
    if (!additive) this.selected.clear();
    for (const id of ids) this.selected.add(id);
    this.attackMode = false;
    this.emitUi();
    return true;
  }

  selectIdleSerfs() {
    this.selected.clear();
    for (const e of this.sim.entities.values()) {
      if (e.kind === 'unit' && e.owner === this.player && !e.militia && !e.job && e.goal === undefined) this.selected.add(e.id);
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

  /** Select all own squads (captains and heroes). */
  selectAllArmy() {
    this.selected.clear();
    for (const e of this.sim.entities.values()) if ((e.kind === 'leader' || e.kind === 'hero') && e.owner === this.player) this.selected.add(e.id);
    if (!this.selected.size) this.toast('toast.noArmy', null, { icon: 'soldiers', ttl: 2500 });
    this.emitUi();
  }

  /** Hero portrait: select the hero and move the camera to him. */
  selectHero(id) {
    const e = this.sim.entities.get(id);
    if (e?.kind !== 'hero' || e.owner !== this.player) return;
    this.selected.clear();
    this.selected.add(id);
    this.focusPoint(e.px / UNIT, e.py / UNIT);
    this.emitUi();
  }

  /** Own selectable figures of the current selection (for control groups). */
  ownUnitIds() {
    return [...this.selected].filter((id) => {
      const e = this.sim.entities.get(id);
      return e && e.owner === this.player && (e.kind === 'leader' || e.kind === 'hero' || e.kind === 'unit');
    });
  }

  /** Assign control group n the current own selection (Shift/Ctrl+number, button in the squad panel). */
  assignGroup(n) {
    const ids = this.ownUnitIds();
    if (!ids.length || !n) return;
    this.groups.assign(n, ids);
    this.toast('toast.groupSaved', { n }, { icon: 'banner', ttl: 2000 });
    this.emitUi();
  }

  /** Select control group n; on a second recall in quick succession the camera jumps there. */
  selectGroup(n) {
    const list = this.groups.members(n, (id) => this.sim.entities.get(id)?.owner === this.player);
    if (!list.length) return false;
    this.selected.clear();
    for (const id of list) this.selected.add(id);
    this.attackMode = false;
    if (this.groups.recall(n, performance.now())) this.focusIds(list);
    this.emitUi();
    return true;
  }

  /** Place the camera on the centroid of the figures. */
  focusIds(ids) {
    let sx = 0, sz = 0, k = 0;
    for (const id of ids) {
      const e = this.sim.entities.get(id);
      if (e?.px !== undefined) { sx += e.px / UNIT; sz += e.py / UNIT; k++; }
    }
    if (k) this.focusPoint(sx / k, sz / k);
  }

  /** Control groups for quick access: number, icon, count, selected. */
  groupsInfo() {
    const sim = this.sim, out = [];
    for (const n of this.groups.numbers()) {
      const list = this.groups.members(n, (id) => sim.entities.get(id)?.owner === this.player);
      if (!list.length) continue;
      const lines = new Map();
      let heroes = 0, serfs = 0, hero = null;
      for (const id of list) {
        const e = sim.entities.get(id);
        if (e.kind === 'hero') { heroes++; hero = e.hero; } else if (e.kind === 'leader') { const l = UNITS[e.def].line; lines.set(l, (lines.get(l) ?? 0) + 1); } else serfs++;
      }
      const top = [...lines.entries()].sort((a, b) => b[1] - a[1])[0];
      const icon = top ? 'u-' + top[0] : heroes ? 'hero-' + hero : 'serf';
      const selected = list.length === this.selected.size && list.every((id) => this.selected.has(id));
      out.push({ n, icon, count: list.length, selected });
    }
    return out;
  }

  /** Own heroes and idle serfs for quick access. */
  quickInfo() {
    const sim = this.sim, heroes = [];
    let idle = 0;
    for (const e of sim.entities.values()) {
      if (e.owner !== this.player) continue;
      if (e.kind === 'unit' && !e.militia && !e.job && e.goal === undefined) idle++;
      else if (e.kind === 'hero') {
        const h = HEROES[e.hero];
        const ready = !e.down && Object.keys(h.abilities).some((a) => (e.ready[a] ?? 0) <= sim.tick);
        // Unconscious: recovers after heroReviveTicks without enemies nearby (counter stands still while enemies are near)
        const left = e.down ? Math.max(0, COMBAT.heroReviveTicks - (e.downTimer ?? 0)) : 0;
        heroes.push({
          id: e.id, hero: e.hero, hp: e.hp, maxHp: h.hp, down: !!e.down, ready, selected: this.selected.has(e.id),
          reviveIn: Math.ceil(left / 10), reviveFrac: e.down ? 1 - left / COMBAT.heroReviveTicks : 0, threatened: !!e.down && !(e.downTimer > 0),
        });
      }
    }
    const sel = this.ownUnitIds();
    return { idleSerfs: idle, heroes, groups: this.groupsInfo(), group: { current: this.groups.find(sel), next: this.groups.nextFree() }, alarm: activeAlerts(this.alerts, performance.now()).length > 0 };
  }

  focusSelection() {
    let sx = 0, sz = 0, n = 0;
    for (const id of this.selected) {
      const e = this.sim.entities.get(id);
      if (e?.kind === 'unit') { sx += e.px / UNIT; sz += e.py / UNIT; n++; }
    }
    if (n) this.focusPoint(sx / n, sz / n);
  }

  focusHeadquarters() {
    const hq = this.sim.findBuilding(this.player, 'headquarters');
    if (hq) { this.focusPoint(hq.x + hq.w / 2, hq.y + hq.h / 2); this.selected.clear(); this.selected.add(hq.id); this.emitUi(); }
  }

  // ---------- Commands ----------

  /** Context command for the selected figures at a screen position. */
  commandAt(cx, cy, attackMove = false) {
    const plan = this.planCommandAt(cx, cy, attackMove || this.attackMode);
    this.attackMode = false;
    for (const c of plan.cmds) this.issue(c);
    // click confirmation only for walking: work and attack show their target through the cursor beforehand
    if (plan.walk) this.renderer?.orderMarker?.(plan.walk.x, plan.walk.y);
    this.emitUi();
    return plan.cmds.length > 0;
  }

  /**
   * What a right click at a screen position would do with the current selection, without issuing anything:
   * the commands, the walk target (click marker) and the cursor that announces it.
   * @returns {{ cmds: object[], walk: {x:number, y:number}|null, cursor: import('./cursors.js').CursorKind|null }}
   */
  planCommandAt(cx, cy, attackMove = false) {
    const plan = { cmds: [], walk: null, cursor: null };
    const army = this.ownArmyIds(), units = this.ownSerfIds();
    if (!army.length && !units.length) return plan;
    const hitId = this.renderer.pickEntity(cx, cy);
    const g = this.renderer.pickGround(cx, cy);
    if (army.length) this.planArmy(plan, army, hitId, g, cx, cy, attackMove);
    if (units.length) this.planSerfs(plan, units, hitId ? this.sim.entities.get(hitId) : null, g);
    return plan;
  }

  planArmy(plan, units, hitId, g, cx, cy, attackMove) {
    const hit = this.selectable(hitId);
    // Talk figure with an exclamation mark: heroes go there and talk, the others walk to the spot
    if (hit?.kind === 'npc' && hit.talk && !attackMove) {
      const heroes = units.filter((id) => this.sim.entities.get(id)?.kind === 'hero');
      if (heroes.length) {
        plan.cmds.push({ type: 'order', units: heroes, order: 'talk', target: hit.id });
        const rest = units.filter((id) => !heroes.includes(id));
        if (rest.length && g) plan.cmds.push({ type: 'order', units: rest, order: 'move', x: Math.floor(g.x), y: Math.floor(g.z) });
        plan.walk = { x: hit.px / UNIT, y: hit.py / UNIT };
        return;
      }
    }
    if (hit && hit.owner !== this.player && hit.owner !== undefined && targetable(this.sim, hit.kind === 'leader' && hit.soldiers.length ? this.sim.entities.get(hit.soldiers[0]) : hit)) {
      const target = hit.kind === 'leader' && hit.soldiers.length ? hit.soldiers[0] : hit.id;
      plan.cmds.push({ type: 'order', units, order: 'attack', target });
      plan.cursor = 'attack';
      return;
    }
    // Last seen building in the fog: attack-move there (the target itself is unknown)
    const ghost = !hit && !this.fogLifted() ? this.renderer.pickGhost(cx, cy) : null;
    if (ghost) {
      plan.cmds.push({ type: 'order', units, order: 'attackMove', x: Math.floor(ghost.x), y: Math.floor(ghost.y) });
      plan.cursor = 'attack';
      return;
    }
    if (!g) return;
    plan.cmds.push({ type: 'order', units, order: attackMove ? 'attackMove' : 'move', x: Math.floor(g.x), y: Math.floor(g.z), avoid: true });
    plan.walk = { x: g.x, y: g.z };
    if (attackMove) plan.cursor = 'attack';
  }

  planSerfs(plan, units, hit, g) {
    const work = (target, cursor) => { plan.cmds.push({ type: 'assignWork', units, target: target.id }); plan.cursor ??= cursor; };
    const buildSite = (e) => e?.kind === 'building' && e.owner === this.player && (!e.done || isDamaged(this.sim, e));
    if (hit?.kind === 'building') {
      if (buildSite(hit)) return work(hit, 'build');
    }
    // Enemy instead of tree: the serfs attack it (as in the model, with bare fists)
    if (hit && FIGHT_TARGETS.has(hit.kind) && isEnemy(this.sim, this.player, hit.owner) && targetable(this.sim, hit)) return work(hit, 'attack');
    if (!g) return;
    const tx = Math.floor(g.x), ty = Math.floor(g.z);
    const m = this.sim.map;
    if (!m.inBounds(tx, ty)) return;
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
    if (node) return work(node, node.kind === 'tree' ? 'chop' : 'mine');
    const occ = this.sim.entities.get(m.owner[m.idx(tx, ty)]);
    if (buildSite(occ)) return work(occ, 'build');
    if (m.walkable(tx, ty)) {
      plan.cmds.push({ type: 'move', units, x: tx, y: ty, avoid: true });
      plan.walk ??= { x: g.x, y: g.z };
    }
  }

  /** Cursor over the map (glove): announces what a right click would do with the selection (desktop, mouse only). */
  updateCursor(cx, cy) {
    const now = performance.now();
    if (now - (this.cursorAt ?? 0) < 60) return;
    this.cursorAt = now;
    let kind = null;
    if (!this.placing && (this.attackMode || this.hasOrderable())) kind = this.planCommandAt(cx, cy, this.attackMode).cursor;
    if (kind === this.cursorKind) return;
    this.cursorKind = kind;
    const el = this.renderer?.renderer?.domElement;
    if (el) el.style.cursor = cursorCss(kind);
  }

  /**
   * Command to a tile without a screen target (minimap): squads walk or attack in passing,
   * serfs walk there. Returns the target tile if a command was given, otherwise null.
   */
  commandTile(tx, ty, attackMove = false) {
    const m = this.sim.map;
    attackMove = attackMove || this.attackMode;
    this.attackMode = false;
    // Minimap is imprecise: on water or rock take the nearest walkable tile
    const t = nearestWalkable(m, tx, ty, 6);
    if (!t) { this.emitUi(); return null; }
    tx = t.x; ty = t.y;
    let done = false;
    const army = this.ownArmyIds();
    if (army.length) { this.issue({ type: 'order', units: army, order: attackMove ? 'attackMove' : 'move', x: tx, y: ty, avoid: true }); done = true; }
    const serfs = this.ownSerfIds();
    if (serfs.length) { this.issue({ type: 'move', units: serfs, x: tx, y: ty, avoid: true }); done = true; }
    if (done) this.renderer?.orderMarker?.(tx + 0.5, ty + 0.5);
    this.emitUi();
    return done ? t : null;
  }

  /** Are own figures selected that accept walk commands? */
  hasOrderable() { return this.ownArmyIds().length > 0 || this.ownSerfIds().length > 0; }

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
  /** "To arms" for the selected serfs or "Back to work" for the selected militia. */
  armSelected(on) {
    const units = [...this.selected].filter((id) => { const e = this.sim.entities.get(id); return e?.kind === 'unit' && e.owner === this.player && !!e.militia !== on; });
    if (units.length) this.issue({ type: 'militia', on, units });
  }

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
  /** Upgrade: runs on its own, no serfs are sent. */
  upgrade(id) { this.issue({ type: 'upgradeBuilding', building: id }); }
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

  /** Up to 4 idle serfs near a building (for repairs). */
  idleSerfsNear(id) {
    const b = this.sim.entities.get(id);
    if (!b) return [];
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    return [...this.sim.entities.values()]
      .filter((e) => e.kind === 'unit' && e.owner === this.player && !e.militia && !e.job && e.goal === undefined)
      .sort((a, c) => Math.hypot(a.px / UNIT - cx, a.py / UNIT - cy) - Math.hypot(c.px / UNIT - cx, c.py / UNIT - cy))
      .slice(0, 4).map((e) => e.id);
  }

  setSpeed(s) { this.speed = s; this.paused = false; this.emitUi(); }

  /**
   * Save game as a JSON-capable object.
   * @param {{ clone?: boolean }} [opts] clone: false – without deep copy, convert to text immediately (saveGame)
   */
  save({ clone = true } = {}) {
    const stage = this.stage?.toJSON() ?? null;
    return saveGame(this.sim, {
      ais: this.ais.map((a) => a.getState()),
      camera: { ...this.renderer.rig.target, yaw: this.renderer.rig.yaw, dist: this.renderer.rig.dist, pitch: this.renderer.rig.pitch },
      ...(stage ? { stage } : {}),
    }, { clone });
  }

  /**
   * Swap the simulation without a loading screen (stage restart, src/sim/stage.js): renderer and computer opponents
   * are built anew for the new world; camera, grid, code panel, code and breakpoints stay.
   * @param {import('../sim/sim.js').Sim} sim @param {{ ais?: any[] }} [extra] extra data of the save game
   */
  restart(sim, extra = {}) {
    const rig = this.renderer.rig;
    const cam = { x: rig.target.x, z: rig.target.z, yaw: rig.yaw, dist: rig.dist, pitch: rig.pitch };
    const grid = !!this.renderer.grid;
    try { this.renderer.dispose(); } catch { /* disposal must never prevent the restart */ }
    this.sim = sim;
    this.ais = (extra.ais ?? []).map((st) => AiPlayer.fromState(sim, st));
    this.renderer = new Renderer(this.canvas, sim, { player: this.player });
    const r = this.renderer.rig;
    r.lookAt(cam.x, cam.z); r.yaw = cam.yaw; r.dist = cam.dist; r.pitch = cam.pitch; r.clamp();
    this.input.rig = r;
    this.resize();
    if (grid) this.renderer.setGrid(true);
    if (sim.weather.state !== 'summer') this.renderer.applyWeather(sim.weather.state);
    this.prev = new Map();
    this.acc = 0;
    this.placing = null;
    this.selected = new Set([...this.selected].filter((id) => sim.entities.has(id)));
    this.burning = null;
    this.mmCache = null;
    this.mmFog = null;
    // The remembered camera of the old world is no order to jump
    this.missionView = { ...this.missionView, cameraSeq: sim.mission?.state.camera?.seq ?? 0, hint: null };
    this.camFly = null;
    this.debugHalt = false;
    this.restarts++;
    this.syncTracks();
    if (this.dev) { this.dev.dispose(); this.dev = null; this.setDevMode(true); }
    this.emitUi();
  }
  togglePause() { this.paused = !this.paused; this.emitUi(); }

  /** Game option "tracks": send the setting as a command when it differs and the level does not fix the mode. */
  syncTracks() {
    const mode = setting('tracks');
    if (!this.sim.trackModeFixed && this.sim.trackMode !== mode) this.issue({ type: 'setTracks', mode });
  }

  // ---------- Building ----------

  startPlacement(type) {
    this.placing = { type, x: 0, y: 0, valid: false, reason: null, hasPos: false };
    this.emitUi();
  }

  /**
   * Test and diagnostic aid (building on a slope): height difference of an area in the simulation (cm) and
   * in the rendered terrain (world units, measured at the corners and inside the area).
   */
  groundProbe(x, y, w, h) {
    const t = this.renderer.terrain;
    let lo = Infinity, hi = -Infinity;
    for (let j = 0; j <= h * 2; j++) for (let i = 0; i <= w * 2; i++) {
      const v = t.heightAt(x + i / 2, y + j / 2);
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
    return { simSlope: this.sim.map.slope(x, y, w, h), meshSpread: hi - lo, meshY: lo, simHeight: this.sim.map.heights[this.sim.map.idx(x, y)] };
  }

  cancelPlacement() { if (this.placing) { this.placing = null; this.emitUi(); } }

  hover(cx, cy) {
    if (!this.placing) return;
    const g = this.renderer.pickGround(cx, cy);
    if (!g) return;
    const def = BUILDINGS[this.placing.type];
    let x = Math.round(g.x - def.w / 2), y = Math.round(g.z - def.h / 2);
    // snap to settlement spot, shaft or bridge site
    let w = def.w, h = def.h;
    if (def.placement !== 'free') {
      const list = def.placement === 'settlement' ? this.sim.spots : def.placement === 'bridge' ? this.sim.bridgeSites ?? [] : this.sim.shafts.filter((s) => s.res === def.shaftResource);
      let best = null, bd = def.placement === 'bridge' ? 12 : 9;
      for (const s of list) { const d = Math.hypot(s.x + (s.w ?? def.w) / 2 - g.x, s.y + (s.h ?? def.h) / 2 - g.z); if (d < bd) { bd = d; best = s; } }
      if (best) { x = best.x; y = best.y; w = best.w ?? w; h = best.h ?? h; }
    }
    let reason = this.sim.checkPlacement(this.player, this.placing.type, x, y);
    // Fog: do not build into the unexplored (centre of the area counts)
    if (!reason && !this.tileExplored(x + (w >> 1), y + (h >> 1))) reason = 'err.unexplored';
    // Building on a slope: 'flat' (even), 'level' (will be levelled), 'steep' (too steep); target = future height (cm).
    // Bridges are not levelled (no slope preview).
    let slope = null;
    if (def.placement !== 'bridge' && this.sim.map.inBounds(x, y) && this.sim.map.inBounds(x + w - 1, y + h - 1)) {
      const pv = padPreview(this.sim.map, x, y, w, h);
      slope = { state: reason === 'err.tooSteep' ? 'steep' : pv.maxCut > LEVEL_NOTICE ? 'level' : 'flat', target: pv.target, cut: pv.maxCut };
    }
    Object.assign(this.placing, { x, y, w, h, valid: !reason, reason, hasPos: true, slope });
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
      const tier = pl.unitTier[line] ?? 1;
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
    let bridges = 0;
    for (const e of this.sim.entities.values()) { if (e.kind === 'tree') trees++; else if (e.type === 'bridge' && e.done) bridges++; }
    const key = `${m.frozen ? 1 : 0}:${trees >> 3}:${bridges}:${m.heightVersion}`;
    if (this.mmCache?.key === key) return this.mmCache;
    const data = new Uint8ClampedArray(W * H * 4);
    const wl = this.sim.waterLevel ?? 0;
    let hmax = wl + 1;
    for (let k = 0; k < W * H; k++) if (m.heights[k] > hmax) hmax = m.heights[k];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x, f = m.flags[k], h = m.heights[k];
      let c;
      if (f & 16) c = [150, 104, 60]; // bridge (extension)
      else if (f & 1) {
        const depth = Math.min(1, (wl - h) / 400);
        c = m.frozen ? [196 - depth * 30, 222 - depth * 20, 236] : [74 - depth * 30, 142 - depth * 40, 196 - depth * 30];
      } else if (f & 8) {
        c = [128, 116, 104];
      } else {
        // Minimum span: a flat meadow (coding adventure, editor) stays green instead of rock-coloured
        const t = Math.max(0, Math.min(1, (h - wl) / Math.max(2500, hmax - wl)));
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
    const sim = this.sim, buildings = [], units = [], camps = [];
    const fog = !this.fogLifted();
    const seeAll = !fog;
    for (const e of sim.entities.values()) {
      if (e.kind === 'building') {
        // enemy buildings: visible ones current, otherwise as last seen state (below)
        if (seeAll || this.canSee(e)) buildings.push({ x: e.x, y: e.y, w: e.w, h: e.h, owner: e.owner });
      } else if (e.kind === 'leader' || e.kind === 'hero') {
        if (seeAll || this.canSee(e)) units.push({ x: e.px / UNIT, y: e.py / UNIT, owner: e.owner, big: true });
      } else if (e.kind === 'unit' || e.kind === 'worker' && !e.inside) {
        if (seeAll || this.canSee(e)) units.push({ x: e.px / UNIT, y: e.py / UNIT, owner: e.owner, big: false });
      } else if (e.kind === 'camp' && e.owner === this.player) {
        // own campfires: houses or farms are missing here
        camps.push({ x: e.x + 0.5, y: e.y + 0.5 });
      }
    }
    if (fog) {
      for (const g of knownBuildings(sim, this.player)?.values() ?? []) {
        if (g.kind !== 'building') continue;
        const live = sim.entities.get(g.id);
        // visible: already entered current above or just destroyed
        if (canSee(sim, this.player, live ?? g)) continue;
        buildings.push({ x: g.x, y: g.y, w: g.w, h: g.h, owner: g.owner, ghost: true });
      }
    }
    const h = this.missionView.hint;
    const hint = h?.entity ? { x: h.entity.x, y: h.entity.y } : h?.area ? { x: h.area.x, y: h.area.y } : null;
    return {
      w: sim.map.width, h: sim.map.height, me: this.player, buildings, units, camps,
      shafts: sim.shafts.filter((s) => this.tileExplored(s.x + 1, s.y + 1)).map((s) => ({ x: s.x + 1.5, y: s.y + 1.5, res: s.res })),
      view: this.cameraFootprint(), hint,
      // Attacks on own things: place and age in ms (pulses red until ALERT_MS without a hit have passed)
      alerts: activeAlerts(this.alerts, performance.now()).map((a) => ({ x: a.x, y: a.y, age: performance.now() - a.last })),
    };
  }

  /**
   * Fog layer of the minimap as RGBA (1 pixel per tile): unexplored black, explored darkened,
   * visible transparent. null without fog. Cached per recomputation of the vision.
   * @returns {{ w: number, h: number, data: Uint8ClampedArray, key: string }|null}
   */
  minimapFog() {
    if (this.fogLifted()) return null;
    const sim = this.sim, v = sim.vision;
    const key = `${v.version}`;
    if (this.mmFog?.key === key) return this.mmFog;
    const t = v.teams.get(sim.players[this.player].team);
    const n = v.W * v.H;
    const data = this.mmFog?.data?.length === n * 4 ? this.mmFog.data : new Uint8ClampedArray(n * 4);
    for (let k = 0; k < n; k++) {
      const exp = t?.explored[k], vis = t?.visible[k];
      const o = k * 4;
      if (vis) { data[o + 3] = 0; continue; }
      data[o] = 10; data[o + 1] = 11; data[o + 2] = 16;
      data[o + 3] = exp ? 135 : 255;
    }
    this.mmFog = { w: v.W, h: v.H, data, key };
    return this.mmFog;
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
  /** Pay the tribute of the mission (offer in the mission field). */
  payTribute(id) { this.issue({ type: 'mission', action: 'tribute', id }); }

  // ---------- Python scripts (scenarios, coding adventure) ----------

  /**
   * Start the player program. The code goes into the simulation as a command (deterministic).
   * @param {Record<string, string>} sections code of the editable sections
   * @param {{ mode?: 'run'|'step', bps?: Record<string, number[]> }} [debug]
   */
  scriptRun(sections, debug = null) {
    // "Run" starts the stage over: the first run of a stage remembers the world, every further one restores it
    const next = this.stage.beforeRun(this.sim, { ais: this.ais.map((a) => a.getState()) });
    if (next) this.restart(next, this.stage.data?.extra ?? {});
    this.issue({ type: 'script', action: 'run', sections, ...(debug ? { debug } : {}) });
    if (this.debugHalt) { this.paused = false; this.debugHalt = false; }
    this.emitUi();
  }

  scriptStop() { this.issue({ type: 'script', action: 'stop' }); this.emitUi(); }

  /**
   * Debugger: 'continue' | 'into' | 'over' | 'out' | 'pause'; target 'player' or 'mission'.
   * If the mission script holds the game, a step immediately computes one tick (otherwise the command would never arrive).
   */
  scriptDebug(cmd, target = 'player', bps = null) {
    this.issue({ type: 'script', action: 'debug', target, cmd, ...(bps ? { bps } : {}) });
    if (target === 'mission' && this.debugHalt) {
      this.stepOnce();
      if (cmd === 'continue') { this.debugHalt = false; this.paused = false; }
    }
    this.emitUi();
  }

  /** Change breakpoints without influencing the run. */
  scriptBreakpoints(target, bps) { this.issue({ type: 'script', action: 'debug', target, bps }); }

  /**
   * Coding adventure (without castle): choose distance and centre so that the whole small map fits into the free
   * area left of the code panel. insetRight: width covered by the panel on the right (pixels).
   */
  frameOverview(insetRight = 0) {
    const r = this.renderer, rig = r?.rig;
    if (!rig || this.sim.findBuilding(this.player, 'headquarters')) return;
    const W = r.renderer.domElement.clientWidth;
    if (!W) return;
    const right = 1 - (2 * Math.min(insetRight, W * 0.6)) / W; // right edge of the free area (NDC)
    const mid = (right - 1) / 2;
    const { width: mw, height: mh } = this.sim.map;
    for (let i = 0; i < 5; i++) {
      rig.pose();
      r.camera.updateMatrixWorld();
      const L = rig.pick(-0.94, -0.3), R = rig.pick(right - 0.04, -0.3), T = rig.pick(mid, 0.72), B = rig.pick(mid, -0.75), C = rig.pick(mid, 0);
      if (!L || !R || !T || !B || !C) break;
      const k = Math.max((mw + 2) / Math.max(1, R.x - L.x), (mh + 2) / Math.max(1, B.z - T.z));
      if (k > 1.02) rig.dist = Math.min(rig.dist * k, 80);
      rig.target.x += mw / 2 - C.x;
      rig.target.z += mh / 2 - C.z;
    }
    rig.clamp();
  }

  /** Show tile grid (coding adventure: count steps). Pure rendering. */
  setGrid(on) { this.renderer?.setGrid(!!on); }

  /** End the dialogue line the mission script waits for; `all`: the rest of its conversation too. */
  skipDialog(all = false) {
    if (this.sim.mission?.script) this.issue({ type: 'script', action: 'skipDialog', ...(all ? { all: true } : {}) });
  }

  /** Smooth camera move (script: camera.fly_to; dialogue camera also with distance). */
  flyCamera(now) {
    const f = this.camFly;
    if (!f) return;
    const rig = this.renderer.rig;
    // player moved or zoomed the camera themselves: abort the move (the dialogue camera then does not return)
    if (f.last && (Math.abs(rig.target.x - f.last.x) > 0.05 || Math.abs(rig.target.z - f.last.z) > 0.05 || Math.abs(rig.dist - f.last.dist) > 0.05)) {
      this.camFly = null;
      if (this.dialogCam) this.dialogCam.taken = true;
      return;
    }
    const t = Math.min(1, (now - f.t0) / f.ms);
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    if (f.td !== undefined) { rig.dist = f.fd + (f.td - f.fd) * e; rig.clamp(); }
    if (f.view) { rig.yaw = f.view.fy + f.view.dy * e; rig.pitch = f.view.fp + (f.view.tp - f.view.fp) * e; }
    rig.lookAt(f.fx + (f.tx - f.fx) * e, f.fz + (f.tz - f.fz) * e);
    f.last = { x: rig.target.x, z: rig.target.z, dist: rig.dist };
    if (t >= 1) this.camFly = null;
  }

  /**
   * Dialogue camera: if a figure speaks that can be seen (hero, conversation figure), the camera moves close to it;
   * when the dialogue is over, back to the old spot. If the player moves the camera themselves, it stays
   * where they put it. Pure rendering (setting "Kamera bei Dialogen").
   * @param {{ speaker?: string|null }|null} msg the currently shown message (null: no dialogue any more)
   */
  dialogFocus(msg) {
    clearTimeout(this.dialogCamBack);
    if (!this.renderer || !setting('dialogCamera')) return;
    const rig = this.renderer.rig;
    const pos = msg?.speaker ? this.speakerPos(msg.speaker) : null;
    if (pos) {
      if (!this.dialogCam || this.dialogCam.taken) this.dialogCam = { x: rig.target.x, z: rig.target.z, dist: rig.dist, yaw: rig.yaw, pitch: rig.pitch, taken: false };
      // already close (same speaker, conversation partner next door): do not approach again
      if (Math.hypot(rig.target.x - pos.x, rig.target.z - pos.z) < 1.5 && Math.abs(rig.dist - DIALOG_DIST) < 0.5) return;
      const td = Math.min(rig.dist, DIALOG_DIST);
      this.camFly = { fx: rig.target.x, fz: rig.target.z, tx: pos.x, tz: pos.z, fd: rig.dist, td, view: this.viewTurn(pos.x, pos.z, td, [pos]), t0: performance.now(), ms: DIALOG_FLY_MS };
      return;
    }
    // no (visible) speaker any more: back after a short pause – if the next sentence follows right away, it stays
    const back = this.dialogCam;
    if (!back) return;
    this.dialogCamBack = setTimeout(() => {
      this.dialogCam = null;
      if (back.taken || this.camFly) return;
      const view = back.yaw === undefined ? null : { fy: rig.yaw, dy: angleDelta(rig.yaw, back.yaw), fp: rig.pitch, tp: back.pitch };
      this.camFly = { fx: rig.target.x, fz: rig.target.z, tx: back.x, tz: back.z, fd: rig.dist, td: back.dist, view, t0: performance.now(), ms: DIALOG_FLY_MS };
    }, msg ? 0 : DIALOG_BACK_MS);
  }

  /** Target panel: camera to the location of a target (hint { entity } | { area }). */
  focusHint(hint) {
    const p = hint?.entity ?? hint?.area;
    if (!p) return;
    this.camFly = null;
    // Portrait (phone): target and dialogue windows are at the top, place the target in the lower free third
    const vp = this.renderer.viewport;
    if (vp && vp.h > vp.w) { this.pendingFocus = null; this.renderer.rig.lookAtScreen(p.x, p.y, vp.h * 0.7, vp.h); } else this.focusPoint(p.x, p.y);
    this.emitUi();
  }

  /** Location of a speaking figure if it can be seen: hero with this name (own first) or conversation figure. */
  speakerPos(speaker) {
    const npcs = this.sim.mission?.def?.npcs ?? {}, own = this.sim.mission?.state?.npcs ?? {};
    let best = null;
    for (const e of this.sim.entities.values()) {
      // Talk figures speak with the voice of their speaker (npc(…, speaker="orrin")), otherwise under their own name
      const as = e.kind === 'npc' ? (Object.hasOwn(npcs, e.npc) ? npcs[e.npc].speaker : Object.hasOwn(own, e.npc) ? own[e.npc].speaker : null) ?? e.npc : null;
      const match = (e.kind === 'hero' && e.hero === speaker) || (e.kind === 'npc' && as === speaker);
      if (!match || !this.canSee(e)) continue;
      if (!best || (e.owner === this.player && best.owner !== this.player)) best = e;
    }
    return best ? { x: best.px / UNIT, z: best.py / UNIT } : null;
  }

  /**
   * Script camera (camera.jump_to / camera.fly_to): jump or glide to (x, z) and turn so that no tree or house hides
   * the figures there.
   * @param {number} x @param {number} z @param {number} [fly] duration in ticks (0: jump)
   */
  scriptCamera(x, z, fly = 0) {
    const rig = this.renderer.rig, view = this.viewTurn(x, z, rig.dist);
    // A running dialogue camera returns to the scripted target afterwards, not to where the view was before
    if (this.dialogCam && !this.dialogCam.taken) { this.dialogCam.x = x; this.dialogCam.z = z; }
    if (fly > 0) {
      // camera move: duration in game time (ticks), shorter accordingly at faster speed
      this.camFly = { fx: rig.target.x, fz: rig.target.z, tx: x, tz: z, view, t0: performance.now(), ms: (fly * 100) / Math.max(0.25, this.speed) };
      return;
    }
    this.camFly = null;
    // turn before placing: the placement on small screens depends on the rotation
    if (view) { rig.yaw = view.fy + view.dy; rig.pitch = view.tp; }
    // do not hide the target under the (possibly still open) panel of the previous step
    this.focusPoint(x, z);
  }

  /**
   * Clear view for a scripted camera move to (x, z): rotation (and if needed tilt) at which no tree or house
   * stands in front of the figures there (sightline.js). Without figures nearby the spot itself counts.
   * Pure rendering; the player's later camera keeps the rotation.
   * @param {number} x @param {number} z @param {number} dist distance at the end of the move
   * @param {{x:number, z:number}[]} [spots] figures to keep visible (default: visible figures around the spot)
   * @returns {{fy:number, dy:number, fp:number, tp:number}|null} start and change of rotation, start and end tilt; null: view is clear
   */
  viewTurn(x, z, dist, spots = null) {
    const r = this.renderer, rig = r?.rig;
    if (!rig?.positionFor || !r.sightBlockers) return null;
    if (!spots) {
      const near = [];
      for (const e of this.sim.entities.values()) {
        if (!VIEW_FIGURES.has(e.kind) || e.px === undefined || !this.canSee(e)) continue;
        const d = Math.hypot(e.px / UNIT - x, e.py / UNIT - z);
        if (d <= VIEW_RADIUS) near.push({ x: e.px / UNIT, z: e.py / UNIT, d });
      }
      near.sort((a, b) => a.d - b.d);
      spots = near.length ? near.slice(0, VIEW_MAX) : [{ x, z }];
    }
    const g = (px, pz) => r.terrain.heightAt(px, pz);
    const reach = Math.max(rig.dist, dist) + 4;
    const blockers = r.sightBlockers(x - reach, z - reach, x + reach, z + reach);
    const v = clearView((yaw, pitch) => rig.positionFor(x, z, yaw, pitch, dist), rig.yaw, rig.pitch, figureTargets(spots, g), blockers, g);
    if (v.yaw === rig.yaw && v.pitch === rig.pitch) return null;
    return { fy: rig.yaw, dy: angleDelta(rig.yaw, v.yaw), fp: rig.pitch, tp: v.pitch };
  }

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
      this.scriptCamera(ui.camera.x + 0.5, ui.camera.y + 0.5, ui.camera.fly);
    }
    // Breakpoint in the mission script (world editor, test play): halt the game until the debugger continues
    if (ui.script?.mission.paused && !this.debugHalt) { this.debugHalt = true; this.paused = true; }
    else if (!ui.script?.mission.paused && this.debugHalt) { this.debugHalt = false; this.paused = false; }
    // UI check the current step waits for (step(ui=…) in the mission program): reported once as a command
    const step = ui.tutorial;
    const check = step?.watch ?? null;
    const key = step ? `${step.index}:${step.id}` : '';
    if (check && !mv.checks[key]) {
      const rig = this.renderer.rig;
      if (!mv.camStart || mv.camStart.step !== key) mv.camStart = { step: key, x: rig.target.x, z: rig.target.z, yaw: rig.yaw, dist: rig.dist };
      const c = mv.camStart;
      const moved = Math.hypot(rig.target.x - c.x, rig.target.z - c.z) > 3 || Math.abs(rig.yaw - c.yaw) > 0.35 || Math.abs(rig.dist - c.dist) > 6;
      const ok = check === 'camera' ? moved : check === 'selectSerfs' ? this.ownSerfIds().length > 0 : false;
      if (ok) { mv.checks[key] = true; this.issue({ type: 'mission', action: 'ui', check }); }
    }
    // Marker: hint of the tutorial, otherwise the first open objective with a location (main objectives first)
    const has = (h) => !!(h && (h.entity || h.area));
    const goal = [...ui.objectives].sort((a, b) => Number(b.primary) - Number(a.primary)).find((o) => has(o.hint));
    mv.hint = has(ui.tutorial?.hint) ? ui.tutorial.hint : goal?.hint ?? null;
    // Pointer at controls (glow frame, build menu tile): the tutorial step, otherwise the first open objective with one
    const uiGoal = [...ui.objectives].sort((a, b) => Number(b.primary) - Number(a.primary)).find((o) => o.hint?.ui?.length);
    ui.pointer = ui.tutorial ? ui.tutorial.hint?.ui ?? [] : uiGoal?.hint.ui ?? [];
    mv.landmarks = ui.landmarks;
    return ui;
  }

  // ---------- UI ----------

  emitUi() {
    this.noticeSelection();
    this.onUi(this.uiState());
  }

  /**
   * Sex of a figure as it is drawn (variant in the figure manifest, src/render/variants.js) –
   * for title and portrait of the selection. Rendering only, the simulation knows no sex.
   * @returns {'m'|'f'}
   */
  sexOf(e) {
    return figureSex(characterManifest(), figureRole(e, this.sim.players, UNITS), e.id);
  }

  /** Newly selected figures speak up (bark, see GameAudio.bark). */
  noticeSelection() {
    const prev = this.prevSelected ?? new Set();
    let fresh = false;
    for (const id of this.selected) if (!prev.has(id)) { fresh = true; break; }
    this.prevSelected = new Set(this.selected);
    if (fresh) try { this.audio?.onSelect(this.selected); } catch { /* audio is a side issue */ }
  }

  /**
   * Reactive excerpt for Vue. Contains only IDs, numbers and reason codes – names and texts arise
   * in the UI (src/i18n), so a language switch takes effect immediately.
   */
  uiState() {
    const sim = this.sim, pl = sim.players[this.player];
    const res = {}, stock = {}, raw = {};
    for (const r of RESOURCES) { res[r] = pl.stock[r] + pl.raw[r]; stock[r] = pl.stock[r]; raw[r] = pl.raw[r]; }
    const now = performance.now();
    expireNotices(this.toasts, now);
    const quick = this.quickInfo();
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
      let idle = 0, wood = 0, mining = 0, building = 0, female = 0;
      for (const id of serfs) {
        if (this.sexOf(sim.entities.get(id)) === 'f') female++;
        const j = sim.entities.get(id).job;
        if (!j) idle++;
        else if (j.kind === 'build') building++;
        else if (sim.entities.get(j.target)?.kind === 'tree') wood++;
        else mining++;
      }
      selection = { kind: 'serfs', count: serfs.length, female, sex: female === serfs.length ? 'f' : female ? null : 'm', idle, jobs: { wood, mining, building } };
    } else if (this.selected.size === 1) {
      const e = sim.entities.get([...this.selected][0]);
      if (e?.kind === 'building') {
        const def = BUILDINGS[e.type];
        const lvl = def.levels[e.level];
        const own = e.owner === this.player;
        const relation = relationOf(sim, this.player, e.owner);
        // Foreign (non-allied) buildings: only name, level and hit points – as in the model no insides
        const inside = showsInterior(relation);
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
          own, relation, builders: e.builders.length, maxBuilders: def.builders,
          remaining: e.done ? 0 : Math.ceil((e.work - e.progress) / 10), profession: prof, motivation: inside ? motivation : null,
          beds: inside && lvl.beds ? [e.residents.length, lvl.beds] : null,
          seats: inside && lvl.seats ? [e.eaters.length, lvl.seats] : null,
          population: inside ? lvl.population ?? null : null,
          workers: inside && workerSlots(e) ? [e.workers.length, workerSlots(e)] : null,
          overtime: e.overtime,
          upgrade: own && next ? { level: e.level + 1, cost: Object.entries(next.cost), time: next.buildTime, reason: sim.checkUpgrade(this.player, e) } : null,
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
        selection = { kind: 'foreign', entity: kind, owner: e.owner ?? -1, relation: relationOf(sim, this.player, e.owner ?? -1), unit: e.def ?? null, hero: e.hero ?? null, prof: e.prof ?? null, sex: FIGURE_KINDS.has(e.kind) ? this.sexOf(e) : null, figure: e.kind === 'soldier' ? figureLook(figureRole(e, sim.players, UNITS)) : null, type: e.kind === 'ruin' ? e.type : null, level: e.kind === 'ruin' ? e.level : null };
      }
    }
    const buildOptions = serfs.length ? BUILD_MENU.filter((type) => BUILDINGS[type]).map((type) => {
      const def = BUILDINGS[type];
      const cost = def.levels[0].cost;
      let reason = null;
      if (sim.mission?.locked(this.player, 'buildings', type)) reason = 'err.notInMission';
      else if (def.requires && !pl.techs.has(def.requires)) reason = { code: 'err.techMissing', params: { tech: def.requires } };
      else if (!sim.canPay(this.player, cost)) reason = 'err.notEnoughResources';
      const lvl = def.levels[0];
      // Read-only data for the info strip of the build menu (size, build time, staff, where to research)
      return {
        type, category: BUILD_CATEGORY[type] ?? 'admin', cost: Object.entries(cost), reason, requires: def.requires ?? null,
        w: def.w, h: def.h, placement: def.placement, buildTime: lvl.buildTime, builders: def.builders,
        workers: lvl.workers ?? 0, prof: lvl.workers ? professionFor(type) : null, beds: lvl.beds ?? 0, seats: lvl.seats ?? 0, population: lvl.population ?? 0,
        researchAt: !def.requires ? null : TECHS[def.requires] ? 'university' : BUILDING_TECHS[def.requires]?.building ?? null,
      };
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
      /** paused by the script debugger (breakpoint), not by the player */
      halted: this.debugHalt,
      /** stage restarts so far (src/sim/stage.js) */
      restarts: this.restarts,
      selection,
      ...quick,
      buildOptions,
      placing: this.placing ? { type: this.placing.type, valid: this.placing.valid, reason: this.placing.reason, hasPos: this.placing.hasPos, level: this.placing.slope?.state ?? null } : null,
      toasts: pickVisible(this.toasts, this.persistentNotices(quick.heroes), this.touch ? MAX_TOASTS_TOUCH : MAX_TOASTS)
        .map((t) => ({ id: t.id, key: t.key, params: t.params, icon: t.icon, tone: t.tone, pos: t.pos, cat: t.cat, count: t.count, many: t.many, sticky: !!t.sticky })),
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

/**
 * Nearest walkable tile around (x, y) in growing rings up to `radius`, otherwise null.
 * @param {{ inBounds(x:number,y:number):boolean, walkable(x:number,y:number):boolean }} m
 */
export function nearestWalkable(m, x, y, radius) {
  for (let r = 0; r <= radius; r++) {
    let best = null, bd = Infinity;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const nx = x + dx, ny = y + dy, d = dx * dx + dy * dy;
      if (d < bd && m.inBounds(nx, ny) && m.walkable(nx, ny)) { best = { x: nx, y: ny }; bd = d; }
    }
    if (best) return best;
  }
  return null;
}
