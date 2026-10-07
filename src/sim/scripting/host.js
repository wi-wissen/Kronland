// Script host in the simulation: runs the Python sections of a scenario.
//
// - Mission sections (level 'mission') form a program with the full game API. It runs during setup
//   (world building, registering handlers) and afterwards tick by tick (events, wait, goals).
// - Player sections (level 'player') only run on command ({ type: 'script', action: 'run' }) with a
//   restricted API – coding adventures. Their code comes with the command so that everything stays deterministic.
// - All VM states are JSON and are part of the save game and the state hash. Budgets count commands.

import { compile, VM, ScriptError, saveVm, loadVm, sourceHash, PyList, PyTuple, PyDict, PyFunction, PyHost, truthy } from '../../script/index.js';
import { makeApi, DIRS } from './api.js';
import { TICKS_PER_SECOND, toTile } from '../fixed.js';
import { kill } from '../systems/military.js';

const T = TICKS_PER_SECOND;
/** Commands per tick for all mission scripts together or for the player program */
export const BUDGET = { mission: 60_000, player: 20_000, setup: 8_000_000 };
const MAX_CONSOLE = 300;
/** Longest text a notify() notice carries */
const NOTIFY_MAX = 300;
const MAX_ERRORS = 20;

/** May the sim state start a handler on this event? Event → [handler kind, filter, arguments]. */
const EVENT_HANDLERS = {
  buildingDone: (ev, h) => ['on_building_done', { kind: ev.buildingType, player: ev.player }, [h(ev.building)]],
  buildingPlaced: (ev, h) => ['on_building_placed', { kind: ev.buildingType, player: ev.player }, [h(ev.building)]],
  buildingDestroyed: (ev) => ['on_destroyed', { kind: ev.buildingType, owner: ev.owner }, [ev.buildingType, ev.owner]],
  killed: (ev) => ['on_killed', { owner: ev.owner }, [ev.kind === 'unit' ? 'serf' : ev.kind, ev.owner]],
  recruited: (ev, h) => ['on_recruited', { player: ev.player }, [h(ev.leader)]],
  researchDone: (ev) => ['on_research', { tech: ev.tech, player: ev.player }, [ev.tech]],
  objective: (ev) => ['on_objective', { id: ev.id, status: ev.status }, [ev.id, ev.status]],
  weather: (ev) => ['on_weather', { state: ev.state }, [ev.state]],
};
/** Filters that mean the human when unspecified (otherwise: all). */
const HUMAN_DEFAULT = new Set(['player']);

export class ScriptHost {
  /**
   * @param {import('../missions/runtime.js').MissionRuntime} runtime
   * @param {any} scenario scenario JSON
   */
  constructor(runtime, scenario) {
    this.runtime = runtime;
    this.scenario = scenario;
    /** @type {import('../sim.js').Sim|null} */
    this.sim = null;
    this.state = {
      places: { ...(scenario.world?.places ?? {}) },
      console: [], seq: 0, errors: [],
      started: false, every: {}, enter: {},
      player: { code: null, runs: 0, status: 'idle', bps: [] },
      missionDebug: !!scenario.debug, missionBps: [],
      skipSeq: 0,
    };
    this.vms = { mission: null, player: null };
    this.modules = { mission: null, player: null };
    this.apis = { mission: null, player: null };
    this.dirty = null;
    this.nature = false;
    /** Last notify() event of the current tick (transient, display only) */
    this.lastNotify = null;
  }

  get places() { return this.state.places; }
  vmOf(level) { return this.vms[level]; }

  // ---------- Sections → program ----------

  /**
   * Assemble the sections of a level into one source text.
   * @param {'mission'|'player'} level
   * @param {Record<string,string>} [override] code of editable sections (player program)
   * @returns {{ source: string, map: {id: string, title: any, from: number, count: number}[] }}
   */
  moduleSource(level, override = {}) {
    const parts = [], map = [];
    let line = 1;
    for (const s of this.scenario.sections ?? []) {
      if ((s.level ?? 'mission') !== level) continue;
      const code = (override[s.id] ?? s.code ?? '').replace(/\r\n?/g, '\n').replace(/\n+$/, '');
      const count = code ? code.split('\n').length : 0;
      map.push({ id: s.id, title: s.title ?? s.id, from: line, count });
      if (count) { parts.push(code); line += count; }
    }
    return { source: parts.join('\n') + '\n', map };
  }

  /** Module line → { section, line } (line in the section). */
  sectionLine(level, line) {
    const map = this.modules[level]?.map ?? this.moduleSource(level).map;
    for (const m of map) if (line >= m.from && line < m.from + m.count) return { section: m.id, line: line - m.from + 1 };
    return { section: map[map.length - 1]?.id ?? null, line };
  }

  /** Breakpoints { section: [lines] } → module lines. */
  moduleLines(level, bps) {
    const map = this.modules[level]?.map ?? [];
    const out = [];
    for (const m of map) for (const l of bps?.[m.id] ?? []) if (l >= 1 && l <= m.count) out.push(m.from + l - 1);
    return out;
  }

  makeVm(level, source, seed) {
    const api = this.apis[level] ?? (this.apis[level] = makeApi(this, level));
    const prog = compile(source, { known: api.known, modules: api.modules });
    const opts = this.vmOpts(level, api, seed);
    return { prog, opts };
  }

  vmOpts(level, api, seed) {
    return {
      host: { ...api.hostHooks, print: (text, task) => this.print(level, text, task) },
      natives: api.natives,
      globals: { ...api.globals, ...api.dynamicGlobals() },
      seed,
    };
  }

  // ---------- Setup ----------

  /** Translate and start the mission program (runs at the end of the Sim constructor). */
  setup(sim) {
    this.sim = sim;
    const mod = this.moduleSource('mission');
    this.modules.mission = mod;
    if (!mod.source.trim()) return;
    try {
      const { prog, opts } = this.makeVm('mission', mod.source, (sim.seed * 31 + 7) >>> 0);
      this.vms.mission = new VM(prog, opts);
      this.vms.mission.start({ kind: 'main' }, this.debugOpts('mission'));
      // World building and registration run immediately (large budget), waiting continues tick by tick
      this.runVm('mission', BUDGET.setup);
    } catch (e) {
      if (!(e instanceof ScriptError)) throw e;
      this.reportError('mission', e.toJSON());
    }
    this.flush();
  }

  debugOpts(level) {
    if (level === 'mission') return this.state.missionDebug ? { mode: 'run', bps: this.moduleLines('mission', this.state.missionBps) } : null;
    return null;
  }

  // ---------- Tick ----------

  update(sim) {
    this.sim = sim;
    const mvm = this.vms.mission;
    if (mvm) {
      if (!this.state.started) { this.state.started = true; this.fire('on_start', {}, []); }
      for (const ev of sim.events) {
        const f = EVENT_HANDLERS[ev.type];
        if (f) { const [kind, info, args] = f(ev, (id) => this.handleOf(id)); this.fire(kind, info, args); }
      }
      this.poll(sim);
      this.runVm('mission', BUDGET.mission);
    }
    if (this.vms.player) this.runVm('player', BUDGET.player);
    this.flush();
  }

  handleOf(id) {
    const e = this.sim.entities.get(id);
    if (!e) return null;
    const cls = { hero: 'Hero', unit: 'Serf', leader: 'Troop', worker: 'Worker', building: 'Building', tree: 'Tree', pile: 'Pile' }[e.kind] ?? 'Entity';
    return new PyHost(cls, id);
  }

  /** Registered handlers: VM variable `.handlers` = [(kind, function, filter), …] */
  handlers() {
    const list = this.vms.mission?.globals.get('.handlers');
    return list instanceof PyList ? list.items : [];
  }

  register(vm, kind, fn, filters) {
    let list = vm.globals.get('.handlers');
    if (!(list instanceof PyList)) { list = new PyList([]); vm.globals.set('.handlers', list); }
    const d = new PyDict();
    for (const [k, v] of Object.entries(filters)) d.set(k, v);
    list.items.push(new PyTuple([kind, fn, d]));
  }

  /** Start handlers of a kind whose filters match. */
  fire(kind, info, args) {
    const vm = this.vms.mission;
    if (!vm) return;
    this.handlers().forEach((h, i) => {
      const [k, fn, filt] = h.items;
      if (k !== kind || !this.matches(filt, info)) return;
      this.spawnHandler(fn, args, { kind, handler: i });
    });
  }

  matches(filt, info) {
    for (const [key, [k, v]] of filt.map) {
      void key;
      const want = v === null || v === undefined ? (HUMAN_DEFAULT.has(k) ? this.runtime.state.human : null) : v;
      if (want === null) continue;
      if (k === 'target' || k === 'who' || k === 'seconds') continue;
      if (info[k] !== want) return false;
    }
    return true;
  }

  spawnHandler(fn, args, meta) {
    const vm = this.vms.mission;
    let list = args;
    if (fn instanceof PyFunction) {
      const c = vm.codes[fn.code];
      if (!c.vararg) list = args.slice(0, c.params.length);
    }
    vm.spawn(fn, list, meta, this.debugOpts('mission'));
  }

  /** Check timed (@every) and region handlers (@on_enter). */
  poll(sim) {
    const st = this.state;
    const list = this.handlers();
    list.forEach((h, i) => {
      const [kind, fn, filt] = h.items;
      if (kind === 'every') {
        const sec = Number(filt.get('seconds') ?? 1);
        const period = Math.max(1, Math.round(sec * T));
        if (st.every[i] === undefined) st.every[i] = sim.tick + period;
        if (sim.tick < st.every[i]) return;
        st.every[i] = sim.tick + period;
        // Do not pile up: if the last run is still going, this one is skipped
        const busy = [...this.vms.mission.tasks.values()].some((t) => t.meta?.handler === i && (t.state === 'ready' || t.state === 'waiting' || t.state === 'paused'));
        if (!busy) this.spawnHandler(fn, [], { kind, handler: i });
      } else if (kind === 'on_enter' && (sim.tick + i) % 5 === 0) {
        let inside = false;
        try {
          const api = this.apis.mission;
          const target = filt.get('target');
          const who = filt.get('who') ?? 'any';
          const player = filt.get('player') ?? this.runtime.state.human;
          const units = api.natives.units_in({ vm: this.vms.mission, task: null }, [target, player, who], Object.create(null));
          inside = units.items.length > 0;
          if (inside && !st.enter[i]) this.spawnHandler(fn, [units.items[0]], { kind, handler: i });
        } catch (e) {
          if (!(e instanceof ScriptError)) throw e;
          this.reportError('mission', e.toJSON());
        }
        st.enter[i] = inside;
      }
    });
  }

  /** Execute all tasks of a VM in fixed order (check waiting, share budget). */
  runVm(level, budget) {
    const vm = this.vms[level];
    if (!vm) return;
    let left = budget;
    for (const task of [...vm.tasks.values()]) {
      if (task.state === 'waiting') this.checkWait(vm, task);
      if (task.state === 'ready' && left > 0) {
        const r = vm.run(task, left);
        left -= r.used;
      }
      if (task.state === 'error' && !task.reported) {
        task.reported = true;
        this.reportError(level, task.error);
      }
    }
    if (level === 'player') this.updatePlayerStatus();
    vm.prune();
  }

  /** Is a task's waiting over? Then continues it (or ends it with an error). */
  checkWait(vm, task) {
    const w = task.wait, sim = this.sim;
    switch (w?.k) {
      case 't': case 'dialog':
        if (sim.tick >= w.until) vm.resume(task, w.value ?? null);
        break;
      case 'until': {
        if (w.until >= 0 && sim.tick >= w.until) { vm.resume(task, false); break; }
        try {
          if (truthy(vm.callSync(w.fn, [], null, task))) vm.resume(task, true);
        } catch (e) {
          if (!(e instanceof ScriptError)) throw e;
          this.failTask(vm, task, e);
        }
        break;
      }
      case 'walk': this.checkWalk(vm, task, w); break;
      default: vm.resume(task, null);
    }
  }

  checkWalk(vm, task, w) {
    const sim = this.sim;
    const e = sim.entities.get(w.id);
    if (!e) { this.failTask(vm, task, new ScriptError('game', { reason: 'script.game.gone', reasonParams: { what: 'unit' } })); return; }
    if (e.kind === 'hero' && e.down) { this.failTask(vm, task, new ScriptError('game', { reason: 'script.game.heroDown', reasonParams: {} })); return; }
    const tx = toTile(e.px), ty = toTile(e.py);
    const arrived = tx === w.x && ty === w.y;
    const idle = e.kind === 'unit' ? e.goal === undefined && !e.path.length : (e.order?.type ?? 'idle') === 'idle' && !e.path.length;
    if (!idle && sim.tick < w.until) return;
    if (w.mode === 'step') {
      if (!arrived) { this.failTask(vm, task, new ScriptError('game', { reason: 'script.game.blocked', reasonParams: { what: 'unit' } })); return; }
      if (w.more > 0) {
        // Next step in look direction
        const d = DIRS[e.face ?? 1];
        const nx = tx + d[0], ny = ty + d[1];
        const m = sim.map;
        if (!m.walkable(nx, ny)) {
          const info = !m.inBounds(nx, ny) ? 'edge' : this.apis[task.meta?.level ?? 'player']?.natives.tile({ vm, task }, [nx, ny], Object.create(null)) ?? 'blocked';
          this.failTask(vm, task, new ScriptError('game', { reason: 'script.game.blocked', reasonParams: { what: info } }));
          return;
        }
        const face = e.face;
        sim.applyCommand({ type: 'order', player: e.owner, units: [e.id], order: 'move', x: nx, y: ny });
        if (face !== undefined) e.face = face;
        w.x = nx; w.y = ny; w.more--; w.until = sim.tick + 60 * T;
        return;
      }
      vm.resume(task, null);
      return;
    }
    // After move_to the hero looks in the main direction of their path (for ahead() and the rendering)
    if (e.kind === 'hero' && w.sx !== undefined) {
      const dx = tx - w.sx, dy = ty - w.sy;
      if (dx || dy) e.face = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
    }
    vm.resume(task, arrived);
  }

  failTask(vm, task, err) {
    const frame = task.frames[task.frames.length - 1];
    vm.fail(task, err, frame);
  }

  // ---------- Staging, goals, output ----------

  /** Text from the scenario table (key) or literal; {de, en} dictionaries become bilingual. */
  text(v) {
    if (typeof v === 'string') return this.scenario.texts?.[v] ?? v;
    if (v instanceof PyDict) {
      const o = {};
      for (const [k, x] of v.entries()) if (typeof k === 'string') o[k] = this.vms.mission?.str(x) ?? String(x);
      return o;
    }
    return this.vms.mission?.str(v) ?? String(v);
  }

  /** Message of a figure. @returns {number} duration in ticks (deterministic, language-independent) */
  say(speaker, textV, ticks, voice, bubble = false) {
    const st = this.runtime.state;
    const text = this.text(textV);
    const key = typeof textV === 'string' && this.scenario.texts?.[textV] ? textV : null;
    const de = typeof text === 'string' ? text : text.de ?? text.en ?? '';
    let dur = ticks ?? Math.min(150, Math.max(30, 25 + Math.ceil(de.length * 0.55)));
    const vlen = key ? this.scenario.voiceLength?.[key] : null;
    if (ticks === null && vlen) dur = Math.max(dur, Math.round(vlen * T) + 5);
    const v = voice ?? (key ? this.scenario.voice?.[key] ?? null : null);
    st.messages.push({ seq: ++st.seq, tick: this.sim.tick, speaker, text, voice: v, dur, bubble });
    if (st.messages.length > 30) st.messages.shift();
    this.sim.events.push({ type: 'dialog', seq: st.seq, player: st.human });
    return dur;
  }

  camera(x, y, fly) {
    const st = this.runtime.state;
    st.camera = { seq: ++st.seq, x, y, fly };
  }

  addObjective(vm, id, textV, cond, primary, hidden) {
    const rt = this.runtime, st = rt.state;
    if (st.objectives.some((o) => o.id === id)) throw new ScriptError('game', { reason: 'script.game.objectiveExists', reasonParams: { id } });
    (st.extraObjectives ??= {})[id] = { id, type: 'script', text: this.text(textV), primary };
    let conds = vm.globals.get('.objectives');
    if (!(conds instanceof PyDict)) { conds = new PyDict(); vm.globals.set('.objectives', conds); }
    conds.set(id, cond);
    st.objectives.push({ id, status: hidden ? 'hidden' : 'active', since: this.sim.tick, count: 0, progress: null });
  }

  /** Progress of a script goal: check condition (function). */
  objectiveProgress(id) {
    const vm = this.vms.mission;
    const conds = vm?.globals.get('.objectives');
    const fn = conds instanceof PyDict ? conds.get(id) : null;
    if (!fn) return { cur: 0, target: 1 };
    try {
      return { cur: truthy(vm.callSync(fn, [], null, null)) ? 1 : 0, target: 1 };
    } catch (e) {
      if (!(e instanceof ScriptError)) throw e;
      this.reportError('mission', e.toJSON());
      conds.set(id, null);
      return { cur: 0, target: 1 };
    }
  }

  objectiveAction(action, id) {
    if (!this.runtime.state.objectives.some((o) => o.id === id)) throw new ScriptError('game', { reason: 'script.game.objectiveUnknown', reasonParams: { id } });
    this.runtime.runAction(this.sim, { type: action, id });
  }

  print(level, text, task) {
    const st = this.state;
    const lines = text.split('\n');
    // Continue a started line (print(…, end=""))
    const last = st.console[st.console.length - 1];
    let first = true;
    for (let i = 0; i < lines.length; i++) {
      const piece = lines[i];
      if (i === lines.length - 1 && piece === '') break;
      if (first && last && last.open && last.level === level) { last.text += piece; }
      else { st.console.push({ seq: ++st.seq, level, text: piece, open: false }); }
      first = false;
      st.console[st.console.length - 1].open = i === lines.length - 1;
    }
    if (text.endsWith('\n') && st.console.length) st.console[st.console.length - 1].open = false;
    void task;
    if (st.console.length > MAX_CONSOLE) st.console.splice(0, st.console.length - MAX_CONSOLE);
  }

  /**
   * notify(text): notice in the game (src/game/Engine.js eventToasts), display only – no sim state changes.
   * All calls of one tick fold into one event (newest text, `n` = number of calls), so a loop cannot flood.
   */
  notify(level, text) {
    const sim = this.sim;
    if (!sim) return;
    const msg = String(text).slice(0, NOTIFY_MAX);
    const last = this.lastNotify;
    if (last && last.tick === sim.tick && last.ev.level === level && sim.events.includes(last.ev)) {
      last.ev.text = msg;
      last.ev.n++;
      return;
    }
    const ev = { type: 'scriptNotify', level, text: msg, n: 1, player: this.runtime.state.human };
    sim.events.push(ev);
    this.lastNotify = { tick: sim.tick, ev };
  }

  reportError(level, err) {
    const st = this.state;
    const where = err.line ? this.sectionLine(level, err.line) : { section: null, line: 0 };
    const e = { ...err, level, section: where.section, sline: where.line, seq: ++st.seq, tick: this.sim?.tick ?? 0 };
    e.traceback = (err.traceback ?? []).map((t) => ({ ...t, ...this.sectionLine(level, t.line) }));
    st.errors.push(e);
    if (st.errors.length > MAX_ERRORS) st.errors.shift();
    st.console.push({ seq: ++st.seq, level, text: '', err: e, open: false });
    if (st.console.length > MAX_CONSOLE) st.console.splice(0, st.console.length - MAX_CONSOLE);
    this.sim?.events.push({ type: 'scriptError', level, code: err.code, player: this.runtime.state.human });
  }

  removeEntity(e) {
    if (!e || !this.sim.entities.has(e.id)) return;
    const sim = this.sim;
    if (e.kind === 'tree' || e.kind === 'pile') {
      sim.removeEntity(e);
      sim.events.push({ type: 'nodeDepleted', node: e.id, res: e.res });
    } else if (e.kind === 'leader' || e.kind === 'soldier' || e.kind === 'hero' || e.kind === 'unit' || e.kind === 'worker' || e.kind === 'building') {
      kill(sim, e, null);
    } else sim.removeEntity(e);
  }

  terrainChanged(x, y) {
    const d = this.dirty;
    if (!d) this.dirty = { x0: x, y0: y, x1: x, y1: y };
    else { d.x0 = Math.min(d.x0, x); d.y0 = Math.min(d.y0, y); d.x1 = Math.max(d.x1, x); d.y1 = Math.max(d.y1, y); }
  }

  natureChanged() { this.nature = true; }

  /** Report collected terrain changes of this tick as one event (rendering rebuilds once). */
  flush() {
    const sim = this.sim;
    if (this.dirty) {
      const d = this.dirty;
      sim.map.heightVersion++;
      sim.map.version++;
      sim.events.push({ type: 'terrainChanged', x: d.x0 - 1, y: d.y0 - 1, w: d.x1 - d.x0 + 3, h: d.y1 - d.y0 + 3 });
      this.dirty = null;
    }
    if (this.nature) { sim.events.push({ type: 'natureChanged' }); this.nature = false; }
  }

  // ---------- Player program (commands) ----------

  /**
   * Command { type: 'script', action, … } from the human player.
   * run: { sections: {id: code}, debug?: {mode: 'run'|'step', bps: {id: [lines]}} }, stop, debug: { target, cmd, bps }, skipDialog, mission debug.
   */
  command(sim, cmd) {
    this.sim = sim;
    switch (cmd.action) {
      case 'run': return this.runPlayer(cmd);
      case 'stop': this.stopPlayer(); return true;
      case 'debug': return this.debugCommand(cmd);
      case 'skipDialog': this.skipDialog(); return true;
      default: return sim.reject(cmd, 'err.unknownMissionAction');
    }
  }

  runPlayer(cmd) {
    const sim = this.sim, st = this.state;
    if (!(this.scenario.sections ?? []).some((s) => s.level === 'player')) return sim.reject(cmd, 'err.noPlayerScript');
    this.stopPlayer();
    const override = {};
    for (const s of this.scenario.sections) {
      if (s.level === 'player' && s.editable && typeof cmd.sections?.[s.id] === 'string') override[s.id] = cmd.sections[s.id].slice(0, 100_000);
    }
    const mod = this.moduleSource('player', override);
    this.modules.player = mod;
    st.player.code = override;
    st.player.runs++;
    // Console entries up to here belong to earlier runs (the code panel only shows the current run)
    st.player.since = st.seq;
    st.player.bps = cmd.debug?.bps ?? {};
    st.player.error = null;
    try {
      const { prog, opts } = this.makeVm('player', mod.source, (sim.seed * 131 + st.player.runs * 7919) >>> 0);
      this.vms.player = new VM(prog, opts);
      const bps = this.moduleLines('player', st.player.bps);
      const debug = cmd.debug ? { mode: cmd.debug.mode === 'step' ? 'step' : 'run', kind: 'into', bps } : { mode: 'run', bps };
      this.vms.player.start({ kind: 'main', level: 'player' }, debug);
      st.player.status = 'running';
      sim.events.push({ type: 'scriptStarted', player: this.runtime.state.human });
    } catch (e) {
      if (!(e instanceof ScriptError)) throw e;
      this.vms.player = null;
      st.player.status = 'error';
      this.reportError('player', e.toJSON());
      st.player.error = st.errors[st.errors.length - 1];
    }
    return true;
  }

  stopPlayer() {
    const vm = this.vms.player;
    if (vm) {
      for (const t of vm.tasks.values()) vm.kill(t);
      vm.prune();
    }
    this.vms.player = null;
    if (this.state.player.status === 'running' || this.state.player.status === 'paused') this.state.player.status = 'stopped';
    // Hero stays put
    const h = this.sim && [...this.sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === this.runtime.state.human);
    if (h && h.order?.type === 'move') { h.order = { type: 'idle' }; h.path = []; h.anchor = { x: h.px, y: h.py }; }
  }

  updatePlayerStatus() {
    const vm = this.vms.player, st = this.state.player;
    if (!vm) return;
    const main = [...vm.tasks.values()].find((t) => t.meta?.kind === 'main');
    if (!main) return;
    if (main.state === 'paused') st.status = 'paused';
    else if (main.state === 'done') st.status = 'done';
    else if (main.state === 'error') { st.status = 'error'; st.error = this.state.errors[this.state.errors.length - 1] ?? null; }
    else st.status = 'running';
  }

  debugCommand(cmd) {
    const level = cmd.target === 'mission' ? 'mission' : 'player';
    const vm = this.vms[level];
    if (level === 'mission' && cmd.bps) { this.state.missionBps = cmd.bps; this.state.missionDebug = true; }
    if (level === 'player' && cmd.bps) this.state.player.bps = cmd.bps;
    if (!vm) return true;
    const bps = cmd.bps ? this.moduleLines(level, cmd.bps) : null;
    const ok = ['continue', 'into', 'over', 'out', 'pause'].includes(cmd.cmd) ? cmd.cmd : null;
    for (const t of vm.tasks.values()) {
      if (cmd.task !== undefined && t.id !== cmd.task) continue;
      if (ok && (t.state === 'paused' || cmd.cmd === 'pause' || cmd.task !== undefined)) vm.debugCommand(t, ok, bps);
      else if (bps) { t.debug ??= { mode: 'run', kind: 'into', depth: 0, bps: [], skip: null }; t.debug.bps = bps; }
    }
    if (level === 'player') this.updatePlayerStatus();
    return true;
  }

  skipDialog() {
    this.state.skipSeq++;
    const st = this.runtime.state;
    for (const level of ['mission', 'player']) {
      const vm = this.vms[level];
      if (!vm) continue;
      for (const t of vm.tasks.values()) if (t.state === 'waiting' && t.wait?.k === 'dialog') t.wait.until = this.sim.tick;
    }
    st.dialogSkip = st.seq;
  }

  // ---------- Saving ----------

  save() {
    const out = { state: structuredClone(this.state), mission: null, player: null };
    if (this.vms.mission) out.mission = { vm: saveVm(this.vms.mission), hash: sourceHash(this.modules.mission.source) };
    if (this.vms.player) out.player = { vm: saveVm(this.vms.player), override: this.state.player.code ?? {} };
    return out;
  }

  /** After loading a save game: retranslate programs and restore VMs. */
  load(data, sim) {
    this.sim = sim;
    this.state = structuredClone(data.state);
    const mod = this.moduleSource('mission');
    this.modules.mission = mod;
    if (data.mission) {
      if (sourceHash(mod.source) !== data.mission.hash) throw new Error('Mission script does not match the save game');
      const { prog, opts } = this.makeVm('mission', mod.source, 1);
      this.vms.mission = loadVm(prog, data.mission.vm, opts);
    }
    if (data.player) {
      const pm = this.moduleSource('player', data.player.override);
      this.modules.player = pm;
      const { prog, opts } = this.makeVm('player', pm.source, 1);
      this.vms.player = loadVm(prog, data.player.vm, opts);
    }
  }

  /** Mix into the state hash. */
  hash(h) {
    const s = this.save();
    h.str(JSON.stringify([s.mission, s.player, s.state.places, s.state.every, s.state.enter, s.state.player.status]));
  }

  // ---------- UI ----------

  /** State for code panel, console and debugger (read only, pure JSON). */
  uiState() {
    const st = this.state;
    const player = { status: st.player.status, runs: st.player.runs, since: st.player.since ?? 0, error: st.player.error ?? null, line: null, vars: null };
    const pvm = this.vms.player;
    if (pvm) {
      const main = [...pvm.tasks.values()].find((t) => t.meta?.kind === 'main');
      if (main && (main.state === 'paused' || main.state === 'waiting' || main.state === 'ready')) {
        const ml = pvm.lineOf(main);
        player.line = this.sectionLine('player', ml);
        if (main.state === 'paused') player.vars = pvm.inspect(main);
      }
    }
    const mission = { tasks: [], paused: null };
    const mvm = this.vms.mission;
    if (mvm) {
      for (const t of mvm.tasks.values()) {
        const line = this.sectionLine('mission', mvm.lineOf(t));
        mission.tasks.push({ id: t.id, state: t.state, kind: t.meta?.kind ?? 'main', line });
        if (t.state === 'paused' && !mission.paused) mission.paused = { id: t.id, line, vars: mvm.inspect(t) };
      }
    }
    return { console: st.console.slice(-120), errors: st.errors.slice(-5), player, mission, places: st.places };
  }
}
