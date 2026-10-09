// Script host in the simulation: runs the Python sections of a scenario.
//
// - Mission sections (level 'mission') form a program with the full game API. It runs during setup
//   (world building, registering handlers) and afterwards tick by tick (events, wait, goals).
// - Player sections (level 'player') only run on command ({ type: 'script', action: 'run' }) with a
//   restricted API – coding adventures. Their code comes with the command so that everything stays deterministic.
// - All VM states are JSON and are part of the save game and the state hash. Budgets count commands.

import { compile, VM, ScriptError, saveVm, loadVm, sourceHash, PyList, PyTuple, PyDict, PyFloat, PyFunction, PyHost, truthy, DATA_DEPTH } from '../../script/index.js';
import { makeApi, toTicks, toInt, LIMITS, CLASS_OF } from './api.js';
import { TICKS_PER_SECOND, toTile, tileCenter } from '../fixed.js';
import { kill } from '../systems/military.js';
import { clearJob } from '../systems/serfs.js';
import { removeWorker } from '../systems/workers.js';
import { DIRS, faceOf, tileKind } from '../systems/ground.js';

const T = TICKS_PER_SECOND;
/** Commands per tick for all mission scripts together or for the player program */
export const BUDGET = { mission: 60_000, player: 20_000, setup: 8_000_000 };
/**
 * Instructions per tick for synchronous calls (goal conditions, wait_until, sorted(key=…)) – shared by all calls
 * of a program, so that a slow condition cannot freeze the game. During world building the setup budget applies.
 */
export const SYNC_BUDGET = { mission: 200_000, player: 200_000 };
const MAX_CONSOLE = 300;
/** Longest text a notify() notice carries */
const NOTIFY_MAX = 300;
const MAX_ERRORS = 20;
/** Ticks in a row in which the player program uses its whole budget without any action → hint busyLoop (5 s). */
export const BUSY_TICKS = 50;

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
  // Events without a decorator of their own (@on_event("payday") …, see EVENTS in api.js)
  payday: (ev) => ['on_payday', { player: ev.player }, [ev.income, ev.wages]],
  tradeDone: (ev) => ['on_trade', { player: ev.player }, [ev.give, ev.take, ev.amount]],
  serfBought: (ev, h) => ['on_serf_bought', { player: ev.player }, [h(ev.unit)]],
  researchStarted: (ev) => ['on_research_started', { tech: ev.tech, player: ev.player }, [ev.tech]],
  upgradeStarted: (ev, h) => ['on_upgrade_started', { player: ev.player }, [h(ev.building)]],
  ability: (ev, h) => ['on_ability', { ability: ev.ability, player: ev.owner }, [h(ev.hero), ev.ability]],
  tributePaid: (ev) => ['on_tribute', { id: ev.id }, [ev.id]],
};

/** Longest line in the output panel. */
const MAX_LINE = 2000;

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
      player: { code: null, runs: 0, status: 'idle', bps: [], every: {}, enter: {}, listening: false },
      /** Note of a figure in the code panel (note()): { seq, speaker, code, title, editable } or null */
      note: null,
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
    /** Figure of the last basic command (step, turn …) – the phone camera follows it (transient, display only) */
    this.focus = 0;
    /** Did the player program act in this tick (sim command or waiting)? For the busy-loop hint (transient). */
    this.acted = false;
    /** Task of the player program that ran last – the panel shows its line (transient, display only) */
    this.shownTask = 0;
    /** Heavy calls (world.ridge, world.reachable …) left in this tick – reset at every tick and for world building */
    this.heavyLeft = LIMITS.heavy;
  }

  /** Remember the figure a program just steered (display only, not part of the state). */
  focusOn(id) { this.focus = id; }

  /** A program issued a sim command (busy-loop hint: it does something). */
  noteAction() { this.acted = true; }

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
    const prog = compile(source, { known: api.known, modules: api.modules, vocab: api.vocab, removed: api.removed });
    const opts = this.vmOpts(level, api, seed);
    return { prog, opts };
  }

  vmOpts(level, api, seed) {
    return {
      host: { ...api.hostHooks, print: (text, task) => this.print(level, text, task) },
      natives: api.natives,
      globals: api.globals,
      dynamic: api.dynamic,
      seed,
    };
  }

  // ---------- Setup ----------

  /** Translate and start the mission program (runs at the end of the Sim constructor). */
  setup(sim) {
    this.sim = sim;
    this.heavyLeft = LIMITS.heavy;
    const mod = this.moduleSource('mission');
    this.modules.mission = mod;
    if (!mod.source.trim()) return;
    try {
      const { prog, opts } = this.makeVm('mission', mod.source, (sim.seed * 31 + 7) >>> 0);
      // Hints for mission sections (shown in the world editor)
      this.addHints('mission', prog.hints);
      this.vms.mission = new VM(prog, opts);
      const main = this.vms.mission.start({ kind: 'main' }, this.debugOpts('mission'));
      // World building and registration run immediately (large budget), waiting continues tick by tick
      this.vms.mission.syncBudget = BUDGET.setup;
      this.runVm('mission', BUDGET.setup);
      if (main.state === 'ready') {
        // Not waiting, not finished: a world building that never ends must not continue silently in the game
        this.failTask(this.vms.mission, main, new ScriptError('setupTooLong', { max: BUDGET.setup }));
        main.reported = true;
        this.reportError('mission', main.error);
      }
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

  /** Start of a tick (before goals are checked): fresh budget for synchronous calls. */
  beginTick() {
    this.heavyLeft = LIMITS.heavy;
    for (const level of ['mission', 'player']) if (this.vms[level]) this.vms[level].syncBudget = SYNC_BUDGET[level];
  }

  /**
   * One tick: first the mission program (on_start, events, @every/@on_enter, tasks), then the player program with
   * its own event handlers – both in fixed order, so everything stays deterministic.
   */
  update(sim) {
    this.sim = sim;
    if (this.vms.mission) {
      if (!this.state.started) { this.state.started = true; this.fire('on_start', {}, [], 'mission'); }
      this.dispatch(sim, 'mission');
      this.runVm('mission', BUDGET.mission);
    }
    if (this.vms.player) {
      // While the debugger holds the player program, no new event tasks start (they would run past the halt)
      if (this.playerListens() && !this.playerHeld()) this.dispatch(sim, 'player');
      this.runVm('player', BUDGET.player);
    }
    this.flush();
  }

  /** Sim events of this tick to the handlers of one program, then the timed and region handlers. */
  dispatch(sim, level) {
    for (const ev of sim.events) {
      const f = EVENT_HANDLERS[ev.type];
      if (f) { const [kind, info, args] = f(ev, (id) => this.handleOf(id)); this.fire(kind, info, args, level); }
    }
    this.poll(sim, level);
  }

  /** Does the player program still take events (not ended by an error or stop)? */
  playerListens() {
    return !!this.vms.player && !['error', 'stopped'].includes(this.state.player.status);
  }

  /**
   * Is the player program held by the debugger? A paused task – or one that is stepping – holds all others, so that
   * no other task moves a figure in the background (all tasks of the player program halt together).
   */
  playerHeld() {
    const vm = this.vms.player;
    if (!vm) return false;
    for (const t of vm.tasks.values()) if (t.state === 'paused' || (t.debug?.mode === 'step' && (t.state === 'ready' || t.state === 'waiting'))) return true;
    return false;
  }

  handleOf(id) {
    const e = this.sim.entities.get(id);
    if (!e) return null;
    return new PyHost(CLASS_OF[e.kind] ?? 'Entity', id);
  }

  /** A hero arrived at a talk figure of the script: start @on_talk(id) with the hero. */
  talk(id, hero) {
    this.fire('on_talk', { id }, [this.handleOf(hero.id)], 'mission');
  }

  /** Registered handlers of a program: VM variable `.handlers` = [(kind, function, filter), …] */
  handlers(level = 'mission') {
    const list = this.vms[level]?.globals.get('.handlers');
    return list instanceof PyList ? list.items : [];
  }

  register(vm, kind, fn, filters) {
    let list = vm.globals.get('.handlers');
    if (!(list instanceof PyList)) { list = new PyList([]); vm.globals.set('.handlers', list); }
    if (list.items.length >= LIMITS.handlers) throw new ScriptError('value', { what: 'tooMany', name: `@${kind}`, max: LIMITS.handlers });
    const d = new PyDict();
    for (const [k, v] of Object.entries(filters)) d.set(k, v);
    list.items.push(new PyTuple([kind, fn, d]));
  }

  /** Start the handlers of a kind whose filters match (one program). */
  fire(kind, info, args, level = 'mission') {
    if (!this.vms[level]) return;
    this.handlers(level).forEach((h, i) => {
      const [k, fn, filt] = h.items;
      if (k !== kind || !this.matches(filt, info)) return;
      this.spawnHandler(fn, args, { kind, handler: i, level }, level);
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

  spawnHandler(fn, args, meta, level = 'mission') {
    const vm = this.vms[level];
    let list = args;
    if (fn instanceof PyFunction) {
      const c = vm.codes[fn.code];
      if (!c.vararg) list = args.slice(0, c.params.length);
    }
    // Event functions of the player program stop at its breakpoints too
    const debug = level === 'mission' ? this.debugOpts('mission') : { mode: 'run', bps: this.moduleLines('player', this.state.player.bps) };
    vm.spawn(fn, list, meta, debug);
  }

  /** Check timed (@every) and region handlers (@on_enter) of one program. */
  poll(sim, level = 'mission') {
    const vm = this.vms[level];
    // Mission: state.every/enter (as in older save games); player program: its own, reset on every run
    const st = level === 'mission' ? this.state : this.state.player;
    st.every ??= {};
    st.enter ??= {};
    const list = this.handlers(level);
    list.forEach((h, i) => {
      const [kind, fn, filt] = h.items;
      if (kind === 'every') {
        const sec = filt.get('seconds');
        const period = Math.max(1, sec === undefined || sec === null ? T : toTicks(sec));
        if (st.every[i] === undefined) st.every[i] = sim.tick + period;
        if (sim.tick < st.every[i]) return;
        st.every[i] = sim.tick + period;
        // Do not pile up: if the last run is still going, this one is skipped
        const busy = [...vm.tasks.values()].some((t) => t.meta?.handler === i && (t.state === 'ready' || t.state === 'waiting' || t.state === 'paused'));
        if (!busy) this.spawnHandler(fn, [], { kind, handler: i, level }, level);
      } else if (kind === 'on_enter' && (sim.tick + i) % 5 === 0) {
        let inside = false;
        try {
          const target = filt.get('target');
          const who = filt.get('who') ?? 'any';
          const player = filt.get('player') ?? this.runtime.state.human;
          // Player programs only notice figures their player sees (fog of war)
          const units = this.apis[level].inArea(target, player, who);
          inside = units.length > 0;
          if (inside && !st.enter[i]) this.spawnHandler(fn, [units[0]], { kind, handler: i, level }, level);
        } catch (e) {
          if (!(e instanceof ScriptError)) throw e;
          this.reportError(level, e.toJSON());
          if (level === 'player') this.failPlayer();
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
    this.acted = false;
    const player = level === 'player';
    for (const task of [...vm.tasks.values()]) {
      if (task.state === 'waiting') this.checkWait(vm, task);
      // Player program held by the debugger: only the stepping task goes on
      const held = player && task.debug?.mode !== 'step' && this.playerHeld();
      if (task.state === 'ready' && left > 0 && !held) {
        const r = vm.run(task, left);
        left -= r.used;
        if (player && (r.used || task.state === 'paused')) this.shownTask = task.id;
      }
      if (task.state === 'error' && !task.reported) {
        task.reported = true;
        this.reportError(level, task.error);
      }
    }
    if (player) {
      this.updatePlayerStatus();
      if (this.state.player.status === 'error') this.failPlayer();
      this.checkBusy(vm, left);
    }
    vm.prune();
  }

  /** An error in one task ends the whole player program: the other tasks stop, no more events. */
  failPlayer() {
    const vm = this.vms.player;
    if (!vm) return;
    for (const t of vm.tasks.values()) if (t.state !== 'error' && t.state !== 'done') vm.kill(t);
    this.state.player.status = 'error';
    this.state.player.listening = false;
    this.state.player.error = this.state.errors[this.state.errors.length - 1] ?? null;
  }

  /**
   * Hint busyLoop: the player program computes for BUSY_TICKS ticks in a row with its whole budget, without waiting
   * and without a single game command – an endless loop in which nothing happens in the game.
   */
  checkBusy(vm, left) {
    const st = this.state.player;
    const busy = left <= 0 && !this.acted && ![...vm.tasks.values()].some((t) => t.state === 'waiting');
    st.busy = busy ? (st.busy ?? 0) + 1 : 0;
    if (st.busy !== BUSY_TICKS || this.state.hintsOff) return;
    const main = [...vm.tasks.values()].find((t) => t.state === 'ready') ?? null;
    const line = main ? vm.lineOf(main) : 0;
    this.addHints('player', [{ code: 'script.hint.busyLoop', params: {}, line, col: 0 }]);
  }

  /** Store hints (compile time or busyLoop) with section and line, like errors. */
  addHints(level, hints) {
    if (!hints?.length) return;
    const list = level === 'player' ? (this.state.player.hints ??= []) : (this.state.missionHints ??= []);
    for (const h of hints) {
      if (list.length >= 20) break;
      const where = this.sectionLine(level, h.line);
      list.push({ ...h, level, section: where.section, sline: where.line, seq: ++this.state.seq });
    }
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
      case 'chop': this.checkChop(vm, task, w); break;
      case 'say':
        // Waiting for its turn in the dialogue: then the line, then waiting for its end
        if (this.mayTalk(task)) {
          const dur = this.sayLine(task, w.speaker, w.text, w.ticks, w.voice);
          task.wait = { k: 'dialog', until: sim.tick + dur };
        }
        break;
      case 'step': this.checkStep(vm, task, w); break;
      default: vm.resume(task, null);
    }
  }

  /**
   * step(): the step ends by "Weiter"/"Überspringen" (runtime.command), the UI check of the step or the condition.
   * step() returns "next", "skip" or "done".
   */
  checkStep(vm, task, w) {
    const rt = this.runtime, step = rt.state.tutorial?.step;
    if (!step || step.finished) { vm.resume(task, 'skip'); return; }
    let result = step.result;
    if (!result && step.watch && rt.uiChecked(step.watch)) result = 'done';
    if (!result && w.fn) {
      try {
        if (truthy(vm.callSync(w.fn, [], null, task))) result = 'done';
      } catch (e) {
        if (!(e instanceof ScriptError)) throw e;
        this.failTask(vm, task, e);
        return;
      }
    }
    if (!result) return;
    step.finished = true;
    step.result = result;
    vm.resume(task, result);
  }

  /**
   * Pointers of script objectives (hint(…, ui_until=…)): once the condition holds, the pointer at the controls
   * goes for good (the objective keeps its place or figure). Checked every tick for open objectives.
   */
  checkHints() {
    const vm = this.vms.mission;
    const conds = vm?.globals.get('.hints');
    if (!(conds instanceof PyDict) || !conds.map.size) return;
    for (const o of this.runtime.state.objectives) {
      if (o.status !== 'active' || o.uiOff || !conds.has(o.id)) continue;
      const fn = conds.get(o.id);
      try {
        if (truthy(vm.callSync(fn, [], null, null))) { o.uiOff = true; conds.delete(o.id); }
      } catch (e) {
        if (!(e instanceof ScriptError)) throw e;
        this.reportError('mission', e.toJSON());
        conds.delete(o.id);
      }
    }
  }

  /** Is a figure standing still (no walk command, no path)? Serfs walk with `goal`, all others with an order. */
  static idle(e) {
    return e.kind === 'unit' && !e.militia ? e.goal === undefined && !e.path.length : (e.order?.type ?? 'idle') === 'idle' && !e.path.length;
  }

  gameError(vm, task, reason, reasonParams = {}) {
    this.failTask(vm, task, new ScriptError('game', { reason: `script.game.${reason}`, reasonParams }));
  }

  /** step(n) / move_to(): wait until the figure stands still; a step must reach its tile, then the next step follows. */
  checkWalk(vm, task, w) {
    const sim = this.sim;
    const e = sim.entities.get(w.id);
    if (!e) { this.gameError(vm, task, 'gone', { what: 'unit' }); return; }
    if (e.kind === 'hero' && e.down) { this.gameError(vm, task, 'heroDown'); return; }
    const tx = toTile(e.px), ty = toTile(e.py);
    const arrived = tx === w.x && ty === w.y;
    if (!ScriptHost.idle(e) && sim.tick < w.until) return;
    if (w.mode === 'step') {
      if (!arrived) { this.gameError(vm, task, 'blocked', { what: 'unit' }); return; }
      if (w.more > 0) {
        // Next step in look direction – the same check as can_step() and the first step
        const d = DIRS[faceOf(e)];
        const nx = tx + d[0], ny = ty + d[1];
        if (!sim.map.walkable(nx, ny)) { this.gameError(vm, task, 'blocked', { what: tileKind(sim, nx, ny) }); return; }
        const face = e.face;
        sim.applyCommand(e.kind === 'unit' && !e.militia
          ? { type: 'move', player: e.owner, units: [e.id], x: nx, y: ny }
          : { type: 'order', player: e.owner, units: [e.id], order: 'move', x: nx, y: ny });
        if (face !== undefined) e.face = face;
        w.x = nx; w.y = ny; w.more--; w.until = sim.tick + 60 * T;
        return;
      }
      vm.resume(task, null);
      return;
    }
    // After move_to the figure looks in the main direction of its way (for front() and the rendering)
    if (w.sx !== undefined) {
      const dx = tx - w.sx, dy = ty - w.sy;
      if (dx || dy) e.face = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
    }
    vm.resume(task, arrived);
  }

  /**
   * serf.chop(): the serf fells the tree by the rules of the game (job with `once`). Done when the tree is gone;
   * then the serf steps back onto the tile it chopped from (its working spot may lie beside it).
   */
  checkChop(vm, task, w) {
    const sim = this.sim;
    const e = sim.entities.get(w.id);
    if (!e) { this.gameError(vm, task, 'gone', { what: 'unit' }); return; }
    if (sim.entities.has(w.tree)) {
      if (e.job?.target !== w.tree) { this.gameError(vm, task, 'interrupted'); return; }
      if (sim.tick >= w.until) { this.gameError(vm, task, 'interrupted'); return; }
      return;
    }
    if (e.job) { this.gameError(vm, task, 'interrupted'); return; }
    if (toTile(e.px) === w.x && toTile(e.py) === w.y) { vm.resume(task, null); return; }
    // Back to the own tile, then done (a step without further steps)
    sim.applyCommand({ type: 'move', player: e.owner, units: [e.id], x: w.x, y: w.y });
    task.wait = { k: 'walk', id: e.id, x: w.x, y: w.y, mode: 'step', more: 0, until: sim.tick + 60 * T };
  }

  failTask(vm, task, err) {
    const frame = task.frames[task.frames.length - 1];
    vm.fail(task, err, frame);
  }

  // ---------- Staging, goals, output ----------

  /**
   * Text of say/message/objective: literal, a dict {"de": …} or the
   * object {de, en} from the keywords de=/en=. Bilingual texts stay objects (the UI picks the language).
   */
  text(v) {
    const cut = (s) => (s.length > LIMITS.text ? s.slice(0, LIMITS.text - 1) + '…' : s);
    if (typeof v === 'string') return cut(v);
    if (v instanceof PyDict) {
      const o = {};
      for (const [k, x] of v.entries()) if (typeof k === 'string' && /^[a-z]{2}$/.test(k)) o[k] = cut(this.vms.mission?.str(x) ?? String(x));
      return o;
    }
    if (v && Object.getPrototypeOf(v) === Object.prototype) {
      const o = {};
      for (const k of ['de', 'en']) if (typeof v[k] === 'string') o[k] = cut(v[k]);
      return o;
    }
    return cut(this.vms.mission?.str(v) ?? String(v));
  }

  /**
   * May this task speak now? A conversation keeps the dialogue to itself: while a line of another task is running
   * (and one tick after it, so that the next line of the same conversation follows on), other tasks wait their turn.
   */
  mayTalk(task) {
    const t = this.state.talk;
    return !t || t.task === task.id || this.sim.tick > t.until;
  }

  /** Is a conversation of the mission program running (a task waits for its line or for its turn)? */
  talking() {
    const vm = this.vms.mission;
    if (!vm) return false;
    for (const t of vm.tasks.values()) if (t.state === 'waiting' && (t.wait?.k === 'dialog' || t.wait?.k === 'say')) return true;
    return false;
  }

  /**
   * say() of a task: one line of its conversation. After "Gespräch überspringen" the rest of that conversation goes
   * into the log at once, marked as skipped (the dialogue box does not show it).
   * @returns {number} ticks to wait (0: go on at once)
   */
  sayLine(task, speaker, textV, ticks, voice) {
    const sk = this.state.skip;
    // Check games („Prüfen“) have nobody listening: lines do not hold the program up
    if (this.runtime.state.check || (sk && sk.task === task.id && sk.tick === this.sim.tick)) {
      this.say(speaker, textV, 0, voice, false, true);
      return 0;
    }
    const dur = this.say(speaker, textV, ticks, voice);
    this.state.talk = { task: task.id, until: this.sim.tick + dur + 1 };
    return dur;
  }

  /** Message of a figure. @returns {number} duration in ticks (deterministic, language-independent) */
  say(speaker, textV, ticks, voice, bubble = false, skipped = false) {
    const st = this.runtime.state;
    const text = this.text(textV);
    const de = typeof text === 'string' ? text : text.de ?? text.en ?? '';
    const dur = ticks ?? Math.min(150, Math.max(30, 25 + Math.ceil(de.length * 0.55)));
    const v = voice ?? null;
    st.messages.push({ seq: ++st.seq, tick: this.sim.tick, speaker, text, voice: v, dur, bubble, ...(skipped ? { skipped: true } : {}) });
    if (st.messages.length > 30) st.messages.shift();
    this.sim.events.push({ type: 'dialog', seq: st.seq, player: st.human });
    return dur;
  }

  /** note(): a figure hands over code; the code panel shows it with the figure's seal (display, saved with the state). */
  note(speaker, code, title, editable) {
    this.state.note = { seq: ++this.state.seq, speaker, code: code.replace(/\r\n?/g, '\n'), title, editable };
  }

  camera(x, y, fly) {
    const st = this.runtime.state;
    st.camera = { seq: ++st.seq, x, y, fly };
  }

  addObjective(vm, id, textV, cond, primary, hidden, o = {}) {
    const rt = this.runtime, st = rt.state;
    if (st.objectives.some((x) => x.id === id)) throw new ScriptError('game', { reason: 'script.game.objectiveExists', reasonParams: { id } });
    if (st.objectives.length >= LIMITS.objectives) throw new ScriptError('value', { what: 'tooMany', name: 'objective', max: LIMITS.objectives });
    (st.extraObjectives ??= {})[id] = { id, type: 'script', text: this.text(textV), primary, ...(o.hold ? { hold: true } : {}), ...(o.clock ? { clock: true } : {}), ...(o.allWorlds ? { allWorlds: true } : {}) };
    let conds = vm.globals.get('.objectives');
    if (!(conds instanceof PyDict)) { conds = new PyDict(); vm.globals.set('.objectives', conds); }
    conds.set(id, cond);
    st.objectives.push({ id, status: hidden ? 'hidden' : 'active', since: this.sim.tick, count: 0, progress: null });
  }

  /**
   * Progress of a script goal: the condition returns True/False or a pair (done, needed), e.g.
   * lambda: (count("residence"), 2) – then the goal panel shows 1/2.
   */
  objectiveProgress(id) {
    const vm = this.vms.mission;
    const conds = vm?.globals.get('.objectives');
    const fn = conds instanceof PyDict ? conds.get(id) : null;
    if (!fn) return { cur: 0, target: 1, none: true };
    try {
      const r = vm.callSync(fn, [], null, null);
      // Only a tuple is a pair: a list of two figures (units_in …) still counts as "true"; a third value decides when it is met
      if (r instanceof PyTuple && (r.items.length === 2 || r.items.length === 3)) {
        const target = Math.max(1, toInt(r.items[1], 'needed'));
        const cur = Math.max(0, Math.min(target, toInt(r.items[0], 'done')));
        return r.items.length === 3 ? { cur, target, done: truthy(r.items[2]) } : { cur, target };
      }
      return { cur: truthy(r) ? 1 : 0, target: 1 };
    } catch (e) {
      if (!(e instanceof ScriptError)) throw e;
      this.reportError('mission', e.toJSON());
      conds.set(id, null);
      return { cur: 0, target: 1 };
    }
  }

  objectiveAction(action, id) {
    if (!this.runtime.state.objectives.some((o) => o.id === id)) throw new ScriptError('game', { reason: 'script.game.objectiveUnknown', reasonParams: { id } });
    this.runtime.objectiveAction(this.sim, action, id);
  }

  /**
   * program.get(name): copy of a global variable of the player program – numbers, texts, lists, dicts and game
   * objects; functions and modules give None. Without a program (or variable) the default.
   */
  playerVariable(name, dflt) {
    const vm = this.vms.player;
    const v = vm?.globals.get(name);
    if (v === undefined) return dflt;
    const copy = (x, depth) => {
      if (depth > DATA_DEPTH) throw new ScriptError('recursion', { max: DATA_DEPTH, what: 'nested' });
      if (x === null || typeof x === 'number' || typeof x === 'bigint' || typeof x === 'string' || typeof x === 'boolean') return x;
      if (x instanceof PyFloat) return new PyFloat(x.v);
      if (x instanceof PyList) return new PyList(x.items.map((y) => copy(y, depth + 1)));
      if (x instanceof PyTuple) return new PyTuple(x.items.map((y) => copy(y, depth + 1)));
      if (x instanceof PyDict) {
        const d = new PyDict();
        for (const [k, y] of x.entries()) d.set(copy(k, depth + 1), copy(y, depth + 1));
        return d;
      }
      if (x instanceof PyHost) return new PyHost(x.cls, x.id);
      return null;
    };
    return copy(v, 0);
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
      if (first && last && last.open && last.level === level) { last.text = (last.text + piece).slice(0, MAX_LINE); }
      else { st.console.push({ seq: ++st.seq, level, text: piece.slice(0, MAX_LINE), open: false }); }
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
   * run: { sections: {id: code}, debug?: {mode: 'run'|'step', bps: {id: [lines]}} }, stop, debug: { target, cmd, bps }, skipDialog, mission debug,
   * check: { stage, passed } – result of „Prüfen“ (MissionRuntime.applyCheck).
   */
  command(sim, cmd) {
    this.sim = sim;
    switch (cmd.action) {
      case 'run': return this.runPlayer(cmd);
      case 'stop': this.stopPlayer(); return true;
      case 'debug': return this.debugCommand(cmd);
      case 'skipDialog': this.skipDialog(!!cmd.all); return true;
      case 'check': return this.runtime.applyCheck(sim, cmd);
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
    st.player.hints = [];
    st.player.busy = 0;
    st.player.every = {};
    st.player.enter = {};
    st.player.listening = false;
    this.shownTask = 0;
    try {
      const { prog, opts } = this.makeVm('player', mod.source, (sim.seed * 131 + st.player.runs * 7919) >>> 0);
      if (!st.hintsOff) this.addHints('player', prog.hints);
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
    // Figures the program is waiting for (step, move_to, chop) stop where they are; orders that keep running stay
    const steered = new Set();
    if (vm) {
      for (const t of vm.tasks.values()) if (t.state === 'waiting' && (t.wait?.k === 'walk' || t.wait?.k === 'chop')) steered.add(t.wait.id);
      for (const t of vm.tasks.values()) vm.kill(t);
      vm.prune();
    }
    this.vms.player = null;
    this.state.player.listening = false;
    if (this.state.player.status === 'running' || this.state.player.status === 'paused') this.state.player.status = 'stopped';
    if (!this.sim) return;
    const human = this.runtime.state.human;
    for (const e of this.sim.entities.values()) {
      if (e.owner !== human) continue;
      // All heroes stay put (also those walking for an older program), and every figure the program steered
      if (e.kind === 'hero' && e.order?.type === 'move') { e.order = { type: 'idle' }; e.path = []; e.anchor = { x: e.px, y: e.py }; continue; }
      if (!steered.has(e.id)) continue;
      if (e.kind === 'unit' && !e.militia) {
        if (e.job?.once) clearJob(this.sim, e);
        e.goal = undefined; e.path = [];
        // Back to the middle of the tile it stands on
        e.px = tileCenter(toTile(e.px)); e.py = tileCenter(toTile(e.py));
      } else if (e.order?.type === 'move') { e.order = { type: 'idle' }; e.path = []; e.anchor = { x: e.px, y: e.py }; }
    }
  }

  /**
   * Status of the player program over all its tasks: an error in any task → "error", a halt → "paused", tasks
   * running → "running", main program finished with event handlers registered → still "running" but `listening`
   * ("waits for events"), otherwise "done".
   */
  updatePlayerStatus() {
    const vm = this.vms.player, st = this.state.player;
    if (!vm || st.status === 'error' || st.status === 'stopped') return;
    const tasks = [...vm.tasks.values()];
    if (tasks.some((t) => t.state === 'error')) { st.status = 'error'; st.listening = false; st.error = this.state.errors[this.state.errors.length - 1] ?? null; return; }
    const live = tasks.filter((t) => t.state !== 'done');
    const handlers = this.handlers('player').length > 0;
    if (live.some((t) => t.state === 'paused')) st.status = 'paused';
    else if (live.length || handlers) st.status = 'running';
    else st.status = 'done';
    st.listening = st.status === 'running' && handlers && !live.length;
  }

  debugCommand(cmd) {
    const level = cmd.target === 'mission' ? 'mission' : 'player';
    const vm = this.vms[level];
    if (level === 'mission' && cmd.bps) { this.state.missionBps = cmd.bps; this.state.missionDebug = true; }
    if (level === 'player' && cmd.bps) this.state.player.bps = cmd.bps;
    if (!vm) return true;
    const bps = cmd.bps ? this.moduleLines(level, cmd.bps) : null;
    const ok = ['continue', 'into', 'over', 'out', 'pause'].includes(cmd.cmd) ? cmd.cmd : null;
    // Player program: a step applies to the halted task shown in the panel (the others stay held)
    const tasks = [...vm.tasks.values()];
    const stepper = level === 'player' && ['into', 'over', 'out'].includes(ok) && cmd.task === undefined
      ? tasks.find((t) => t.state === 'paused' && t.id === this.shownTask) ?? tasks.find((t) => t.state === 'paused') ?? null
      : null;
    for (const t of tasks) {
      if (cmd.task !== undefined && t.id !== cmd.task) continue;
      // Continue releases every task (also those a pause sent into step mode); pause halts all of them
      const applies = ok && (ok === 'continue' || ok === 'pause' || cmd.task !== undefined || (stepper ? t === stepper : t.state === 'paused'));
      if (applies) vm.debugCommand(t, ok, bps);
      else if (bps) { t.debug ??= { mode: 'run', kind: 'into', depth: 0, bps: [], skip: null }; t.debug.bps = bps; }
    }
    if (level === 'player') this.updatePlayerStatus();
    return true;
  }

  /** End the line the script waits for; with `all` ("Gespräch überspringen") the rest of that conversation too. */
  skipDialog(all = false) {
    this.state.skipSeq++;
    const st = this.runtime.state;
    for (const level of ['mission', 'player']) {
      const vm = this.vms[level];
      if (!vm) continue;
      for (const t of vm.tasks.values()) if (t.state === 'waiting' && t.wait?.k === 'dialog') t.wait.until = this.sim.tick;
    }
    if (all && this.state.talk) this.state.skip = { task: this.state.talk.task, tick: this.sim.tick };
    st.dialogSkip = st.seq;
  }

  /**
   * Take a thing out of the game without a trace (remove()): no death, no ruin, no event – for story scenes.
   * Squad leaders take their soldiers along.
   */
  takeOut(e) {
    const sim = this.sim;
    if (!e || !sim.entities.has(e.id)) return;
    switch (e.kind) {
      case 'leader': for (const id of e.soldiers) sim.entities.delete(id); sim.entities.delete(e.id); break;
      case 'soldier': {
        const L = sim.entities.get(e.leader);
        if (L) L.soldiers = L.soldiers.filter((id) => id !== e.id);
        sim.entities.delete(e.id);
        break;
      }
      case 'worker': removeWorker(sim, e, 'removed'); break;
      case 'unit': clearJob(sim, e); sim.entities.delete(e.id); break;
      case 'building':
        for (const id of e.builders) { const u = sim.entities.get(id); if (u?.job?.target === e.id) clearJob(sim, u); }
        sim.removeEntity(e);
        break;
      case 'tree': case 'pile':
        sim.removeEntity(e);
        sim.events.push({ type: 'nodeDepleted', node: e.id, res: e.res });
        break;
      default: sim.removeEntity(e);
    }
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
    const p = s.state.player;
    h.str(JSON.stringify([s.mission, s.player, s.state.places, s.state.every, s.state.enter, p.status, p.every ?? {}, p.enter ?? {}, s.state.note?.seq ?? 0, s.state.reset ?? null, s.state.talk ?? null, s.state.skip ?? null]));
  }

  // ---------- UI ----------

  /** State for code panel, console and debugger (read only, pure JSON). */
  uiState() {
    const st = this.state;
    const player = {
      status: st.player.status, runs: st.player.runs, since: st.player.since ?? 0, error: st.player.error ?? null, line: null, vars: null,
      hints: st.hintsOff ? [] : st.player.hints ?? [],
      listening: !!st.player.listening, tasks: 0,
    };
    const pvm = this.vms.player;
    if (pvm) {
      // The halted task, otherwise the one that ran last, otherwise the main program
      const live = [...pvm.tasks.values()].filter((t) => t.state === 'paused' || t.state === 'waiting' || t.state === 'ready');
      player.tasks = live.length;
      const shown = live.find((t) => t.state === 'paused') ?? live.find((t) => t.id === this.shownTask) ?? live.find((t) => t.meta?.kind === 'main') ?? live[0];
      if (shown) {
        player.line = this.sectionLine('player', pvm.lineOf(shown));
        if (shown.state === 'paused') player.vars = pvm.inspect(shown);
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
    return {
      console: st.console.slice(-120), errors: st.errors.slice(-5), player, mission, missionHints: st.missionHints ?? [], places: { ...st.places }, focus: this.focus,
      note: st.note ? { ...st.note } : null,
    };
  }
}
