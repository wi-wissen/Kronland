// Mission runtime: hooks into the simulation via three small hooks (setup, update, command)
// and evaluates goals, triggers (trigger → actions), tutorial steps and bandits.
//
// A mission is a module (see campaign/*.js and docs/MISSIONEN.md) with:
//   players, seed, size, setup(ctx), objectives[], events[], tutorial?, texts.
// The mission state (this.state) is pure JSON and is saved with the save game;
// the definition itself (with functions) is found again by ID when loading.
//
// Deterministic: integers only, fixed orders, no Math.random/Date.

import { Sim } from '../sim.js';
import { Rng } from '../rng.js';
import { BUILDINGS } from '../data/buildings.js';
import { RESOURCES, emptyStock } from '../data/resources.js';
import { UNITS } from '../data/units.js';
import { TICKS_PER_SECOND, UNIT, tileCenter } from '../fixed.js';
import { averageMotivation } from '../systems/workers.js';
import * as api from './setupApi.js';
import { getMission } from './registry.js';
import { revealArea } from '../systems/vision.js';
import { ScriptHost } from '../scripting/host.js';
import { scenarioToDef, playerSetupOf } from '../scripting/scenario.js';
import { WEATHER_EFFECTS } from '../data/weather.js';

const T = TICKS_PER_SECOND;
const MAX_MESSAGES = 30;
/** A hero this close to a talk figure (milli-tiles, per axis) talks to it: two tiles and a half. */
const TALK_REACH = 2 * UNIT + 500;
export const BANDIT_TEAM = 99;
const VILLAGE_TEAM = 100;

/** Text of a table for a reason ('hq', 'gold' …), only own entries. */
const byReason = (table, reason) => (table && Object.hasOwn(table, reason) ? table[reason] : undefined);

/** Kinds of goals that "hold" instead of "reach": they are fulfilled as long as they do not fail. */
const HOLD_TYPES = new Set(['protect']);

export class MissionRuntime {
  /** @param {any} def mission definition @param {any} [state] saved state */
  constructor(def, state = null) {
    this.def = def;
    this.state = state ?? {
      id: def.id,
      human: 0,
      bandits: -1,
      result: null,              // { won, tick, reason }
      objectives: (def.objectives ?? []).map((o) => ({
        id: o.id, status: o.hidden ? 'hidden' : 'active', since: 0, count: 0, progress: null,
      })),
      fired: {},                 // trigger ID → tick of the last firing
      fireCount: {},             // trigger ID → count
      refs: {},                  // name → entity ID, ID list or point/circle
      flags: {},
      ai: {},                    // player → { difficulty, aggression, startTick, forbid }
      camps: [],                 // bandit camps { id, guards[], x, y, r, alarm }
      messages: [],              // { seq, tick, speaker, text }
      seq: 0,
      camera: null,              // { seq, x, y }
      tutorial: def.tutorial ? { index: -1, ui: {}, since: 0, done: false } : null,
      warnings: [],
      /** Goals that a script creates at runtime: ID → { id, type: 'script', text, primary } */
      extraObjectives: {},
      /** Villages (neutral player slots without a castle): name → player */
      villages: {},
      /** Tributes: ID → 'open' | 'paid' | 'closed' (order = order of offering) */
      tributes: {},
      /** Talk figures: ID → { entity, state: 'open' | 'talked', hint } */
      npcs: {},
      /**
       * Campaign unlocks for the human: { buildings: [], techs: [] } or null (everything). Whatever is missing is
       * shown greyed out ("not available in this mission") and rejected by the simulation; action `unlock` adds to it.
       */
      available: def.available ? { buildings: [...(def.available.buildings ?? [])], techs: [...(def.available.techs ?? [])] } : null,
      /** Scenario with all code: part of the save game, so that corrections to a level never break old saves */
      scenario: def.scenario ?? null,
      /** Own level (editor, file, link) – not in the directory, no campaign progress */
      custom: !!def.custom,
    };
    this.census = null;
    /** Python scripts of the scenario (src/sim/scripting/host.js) or null */
    this.script = def.scenario ? new ScriptHost(this, def.scenario) : null;
    /** Saved script state that is applied after loading (afterLoad) */
    this.pendingScript = null;
  }

  static fromState(state) {
    // Older saves carried the scenario only for own levels
    const custom = state.custom ?? !!state.scenario;
    const base = custom ? null : getMission(state.id);
    const def = state.scenario ? { ...scenarioToDef(state.scenario), next: base?.next ?? null, custom } : base;
    if (!def) throw new Error(`Unknown mission: ${state.id}`);
    const st = structuredClone(state);
    const script = st.script ?? null;
    delete st.script;
    const rt = new MissionRuntime(def, st);
    rt.pendingScript = script;
    return rt;
  }

  /** After loading a save game (serialize.js): restore scripts. */
  afterLoad(sim) {
    if (this.script && this.pendingScript) this.script.load(this.pendingScript, sim);
    this.pendingScript = null;
  }

  getState() {
    const s = structuredClone(this.state);
    if (this.script) s.script = this.script.save();
    return s;
  }

  get human() { return this.state.human; }

  /** Is a building or tech ('buildings' | 'techs') still locked for this player by the campaign? */
  locked(player, kind, id) {
    const a = this.state.available;
    return !!a && player === this.state.human && !a[kind].includes(id);
  }

  // ---------- Hook 1: setup ----------

  /** @param {Sim} sim */
  setup(sim) {
    const def = this.def, st = this.state;
    // Player data: resources, techs, serfs, teams
    def.players.forEach((p, i) => {
      if (p.kind === 'bandits' || p.kind === 'village') return;
      const pl = sim.players[i];
      if (!pl) return;
      if (p.stock) { pl.stock = { ...emptyStock(), ...p.stock }; }
      // Levels without a castle (coding adventures) start with an empty stock: stock("gold") counts the coins picked up
      else if (p.hq === false && def.scenario) pl.stock = emptyStock();
      if (p.techs) api.giveTechs(sim, i, p.techs);
      if (p.serfs !== undefined) api.setSerfs(sim, i, p.serfs);
      if (p.team !== undefined) pl.team = p.team;
      if (p.kind === 'ai') {
        st.ai[i] = {
          difficulty: p.difficulty ?? 'normal', aggression: p.aggression ?? 'normal',
          startTick: (p.startDelay ?? 0) * T, forbid: p.forbid ?? [],
          ...(p.aiSerfs !== undefined ? { serfs: p.aiSerfs } : {}),
          ...(p.militia === false ? { militia: false } : {}),
        };
      }
    });
    // Bandits: own player slot without a castle, never builds
    if (def.players.some((p) => p.kind === 'bandits')) {
      const id = sim.players.length;
      sim.players.push({
        id, stock: emptyStock(), raw: emptyStock(), taxLevel: 0, techs: new Set(), defeated: false, faith: 0, weatherEnergy: 0, weatherReadyAt: 0,
        unitTier: { sword: 1, spear: 1, bow: 1, lightCav: 1, heavyCav: 1, cannon: 1 }, team: BANDIT_TEAM, neutral: true,
        // look: 'soldiers' – troops of an opponent without own castle (e.g. outposts), look like soldiers
        ...(def.players.find((q) => q.kind === 'bandits').look === 'soldiers' ? { soldierLook: true } : {}),
      });
      st.bandits = id;
    }
    // Villages: own player slots without a castle and without AI, neutral to everyone by default (as in the model)
    for (const p of def.players.filter((q) => q.kind === 'village')) {
      const id = sim.players.length;
      sim.players.push({
        id, stock: emptyStock(), raw: emptyStock(), taxLevel: 0, techs: new Set(), defeated: false, faith: 0, weatherEnergy: 0, weatherReadyAt: 0,
        unitTier: { sword: 1, spear: 1, bow: 1, lightCav: 1, heavyCav: 1, cannon: 1 }, team: VILLAGE_TEAM + id, neutral: true, village: p.name,
      });
      st.villages[p.name] = id;
      for (const q of sim.players) if (q.id !== id) sim.setDiplomacy(id, q.id, 'neutral');
      for (const [other, state] of Object.entries(p.diplomacy ?? {})) sim.setDiplomacy(id, this.playerOf(other), state);
    }
    if (def.weatherCycle) {
      sim.weatherCycle = def.weatherCycle;
      sim.weather = { state: def.weatherCycle[0][0], index: 0, until: def.weatherCycle[0][1] };
      sim.map.frozen = !!WEATHER_EFFECTS[sim.weather.state]?.freezesWater;
    }
    // References of the heroes: 'hero' = main hero of the human, plus every hero under their name ('nelia', 'taran' …;
    // own heroes take precedence over same-named ones of other players)
    const heroes = [...sim.entities.values()].filter((e) => e.kind === 'hero');
    const mine = heroes.filter((e) => e.owner === st.human);
    if (mine.length) st.refs.hero = mine[0].id;
    for (const e of [...heroes.filter((e) => e.owner !== st.human), ...mine]) st.refs[e.hero] = e.id;
    const hq = sim.findBuilding(st.human, 'headquarters');
    if (hq) st.refs.hq = hq.id;

    // Shaft sites only for the raw materials the mission needs (def.shafts: ['clay', 'stone'] …)
    if (def.shafts) api.keepShafts(sim, def.shafts);
    const ctx = this.setupContext(sim);
    def.setup?.(ctx);
    // Initial actions and first tutorial step
    if (def.start) this.runActions(sim, def.start);
    if (st.tutorial) this.enterStep(sim, 0);
    // Python mission program: world building, register handlers
    this.script?.setup(sim);
  }

  /** Toolbox for def.setup(ctx). */
  setupContext(sim) {
    const m = this;
    const rng = new Rng((sim.seed * 7919 + 17) >>> 0);
    return {
      sim, rng, api, m,
      human: this.state.human,
      bandits: this.state.bandits,
      hq: (p = m.human) => sim.findBuilding(p, 'headquarters'),
      hqCenter: (p = m.human) => { const b = sim.findBuilding(p, 'headquarters'); return b ? api.centerOf(b) : sim.starts[p]; },
      mapCenter: () => ({ x: sim.map.width >> 1, y: sim.map.height >> 1 }),
      ref: (name, value) => { if (value !== undefined) m.state.refs[name] = value; return m.state.refs[name]; },
      warn: (msg) => m.state.warnings.push(msg),
      /** Bandit camp with guards. @returns {{x,y,r}|null} */
      camp: (name, near, units, o = {}) => m.addCamp(sim, name, near, units, o),
    };
  }

  /**
   * Create a bandit camp: clearing, camp buildings, guard squads. With `o.anchor` (building ID) the squads guard
   * an existing building of the bandits instead of a new camp hut. Camps and guards stay off frozen water unless
   * `o.onIce` (an outpost guarding the river itself).
   */
  addCamp(sim, name, near, units, o = {}) {
    const st = this.state;
    if (st.bandits < 0) { st.warnings.push('No bandits in this mission'); return null; }
    let b = o.anchor !== undefined ? sim.entities.get(o.anchor) : null;
    if (!b) {
      const from = o.from ?? null;
      const allowWater = !!o.onIce;
      const p = api.findOpen(sim, near.x, near.y, { maxR: o.maxR ?? 14, clear: 3, from, avoid: o.avoid ?? [], allowWater })
        ?? api.findOpen(sim, near.x, near.y, { maxR: (o.maxR ?? 14) + 10, clear: 2, allowWater });
      if (!p) { st.warnings.push(`No space for camp ${name}`); return null; }
      api.clearNodes(sim, p.x, p.y, 3);
      b = api.placeBuilding(sim, st.bandits, 'banditCamp', p, { radius: 6, margin: 0 });
      if (!b) { st.warnings.push(`Camp ${name} cannot be placed`); return null; }
    }
    const c = api.centerOf(b);
    const guards = [];
    for (const u of units) {
      for (let i = 0; i < (u.count ?? 1); i++) {
        const L = api.spawnTroop(sim, st.bandits, u.def, { x: c.x + (guards.length % 2 ? 3 : -3), y: c.y + 3 }, u.soldiers, { allowWater: o.onIce });
        if (L) guards.push(L.id);
      }
    }
    const camp = { name, id: b.id, guards, x: c.x, y: c.y, r: o.r ?? 7, alarm: 0 };
    st.camps.push(camp);
    st.refs[name] = b.id;
    st.refs[`${name}Guards`] = guards;
    st.refs[`${name}Area`] = { x: c.x, y: c.y, r: camp.r };
    return { x: c.x, y: c.y, r: camp.r };
  }

  // ---------- Hook 2: commands ----------

  /** Commands of type 'mission': next, skip, ui. */
  command(sim, cmd) {
    const st = this.state;
    if (cmd.player !== st.human) return sim.reject(cmd, 'err.missionHumanOnly');
    const tut = st.tutorial;
    switch (cmd.action) {
      case 'next': {
        const step = this.currentStep();
        if (!step) return sim.reject(cmd, 'err.noTutorial');
        if (step.done && !step.allowNext) return sim.reject(cmd, 'err.stepByAction');
        this.advance(sim);
        return true;
      }
      case 'skip':
        if (!tut || tut.done) return sim.reject(cmd, 'err.noTutorial');
        this.advance(sim, true);
        return true;
      case 'ui':
        if (!tut || typeof cmd.check !== 'string') return sim.reject(cmd, 'err.noTutorial');
        tut.ui[cmd.check] = sim.tick;
        return true;
      case 'tribute': return this.payTribute(sim, cmd);
      default:
        return sim.reject(cmd, 'err.unknownMissionAction');
    }
  }

  // ---------- Hook 3: tick ----------

  /** @param {Sim} sim */
  update(sim) {
    const st = this.state;
    if (st.result) return;
    this.census = null;
    this.script?.beginTick();
    this.updateCamps(sim);
    this.updateNpcs(sim);
    this.updateTalks(sim);
    if (st.result) return;
    this.updateTutorial(sim);
    this.updateObjectives(sim);
    this.updateEvents(sim);
    if (!st.result) this.script?.update(sim);
    this.checkEnd(sim);
  }

  // ---------- Counting (once per tick, only when needed) ----------

  /** Numbers per player from a single pass over all entities. */
  count(sim) {
    if (this.census) return this.census;
    const per = sim.players.map(() => ({ placed: {}, done: {}, level: {}, workers: 0, serfs: 0, leaders: 0, gather: {}, heroes: [] }));
    for (const e of sim.entities.values()) {
      const c = per[e.owner];
      if (!c) continue;
      if (e.kind === 'building') {
        c.placed[e.type] = (c.placed[e.type] ?? 0) + 1;
        if (e.done) c.done[e.type] = (c.done[e.type] ?? 0) + 1;
        const lv = e.done ? e.level : e.level - 1;
        if (lv >= 0) c.level[`${e.type}:${lv}`] = (c.level[`${e.type}:${lv}`] ?? 0) + 1;
      } else if (e.kind === 'worker') c.workers++;
      else if (e.kind === 'unit') {
        c.serfs++;
        if (e.job?.kind === 'gather') c.gather[e.job.res] = (c.gather[e.job.res] ?? 0) + 1;
      } else if (e.kind === 'leader') c.leaders++;
      else if (e.kind === 'hero') c.heroes.push(e);
    }
    this.census = per;
    return per;
  }

  /** Buildings of a type with at least level `level` (0-based), finished. */
  builtCount(sim, player, type, level = 0, placed = false) {
    const c = this.count(sim)[player];
    if (placed) return c.placed[type] ?? 0;
    if (!level) return c.done[type] ?? 0;
    let n = 0;
    for (let l = level; l < (BUILDINGS[type]?.levels.length ?? 0); l++) n += c.level[`${type}:${l}`] ?? 0;
    return n;
  }

  // ---------- References ----------

  /** Resolve player identifier: number, 'human', 'bandits', 'enemy' (first AI opponent). */
  playerOf(p) {
    if (p === undefined || p === 'human') return this.state.human;
    if (p === 'bandits') return this.state.bandits;
    if (p === 'enemy') return this.def.players.findIndex((q) => q.kind === 'ai');
    if (typeof p === 'string' && this.state.villages?.[p] !== undefined) return this.state.villages[p];
    return p;
  }

  /** Entity for a reference (single IDs only). */
  entityOf(sim, ref) {
    const v = typeof ref === 'string' ? this.state.refs[ref] : ref;
    return typeof v === 'number' ? sim.entities.get(v) ?? null : null;
  }

  /** IDs for a reference (single ID or list). */
  idsOf(ref) {
    const v = typeof ref === 'string' ? this.state.refs[ref] : ref;
    if (typeof v === 'number') return [v];
    if (Array.isArray(v)) return v;
    return [];
  }

  /** Point or circle for a reference: name, {x,y,r}, 'humanHq', 'enemyHq'. */
  pointOf(sim, ref) {
    if (ref && typeof ref === 'object' && !Array.isArray(ref)) return ref;
    if (ref === 'humanHq' || ref === 'enemyHq') {
      const p = ref === 'humanHq' ? this.state.human : this.playerOf('enemy');
      const hq = p >= 0 ? sim.findBuilding(p, 'headquarters') : null;
      return hq ? { ...api.centerOf(hq), r: 4 } : null;
    }
    const v = typeof ref === 'string' && Object.hasOwn(this.state.refs, ref) ? this.state.refs[ref] : undefined;
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    // Places of a scenario (scenario.json and make_place) – one table, kept by the script host
    const place = typeof ref === 'string' && this.script && Object.hasOwn(this.script.places, ref) ? this.script.places[ref] : null;
    if (place) return { x: place.x, y: place.y, r: place.r ?? 2 };
    for (const id of this.idsOf(ref)) {
      const e = sim.entities.get(id);
      if (e) return { ...api.tileOf(e), r: e.kind === 'building' ? Math.max(e.w, e.h) : 2 };
    }
    return null;
  }

  /** Are all entities of a reference gone (heroes: unconscious counts as "fallen")? */
  allGone(sim, ref, heroDown = true) {
    const ids = this.idsOf(ref);
    if (!ids.length) return false;
    return ids.every((id) => {
      const e = sim.entities.get(id);
      return !e || (heroDown && e.kind === 'hero' && e.down);
    });
  }

  // ---------- Conditions ----------

  /**
   * Check a condition. Function (sim, m) or object { type, … } – see docs/MISSIONEN.md.
   * @returns {boolean}
   */
  check(sim, c) {
    if (!c) return false;
    if (typeof c === 'function') return !!c(sim, this);
    const st = this.state;
    const pl = this.playerOf(c.player);
    switch (c.type) {
      case 'time': return sim.tick >= c.at * T;
      case 'delay': {
        const at = c.after === 'start' ? 0 : c.afterStep !== undefined ? this.stepEnteredAt(c.afterStep) : st.fired[c.after];
        return at !== undefined && at !== null && sim.tick >= at + c.seconds * T;
      }
      case 'objective': {
        const o = st.objectives.find((x) => x.id === c.id);
        return !!o && o.status === (c.status ?? 'done');
      }
      case 'fired': return st.fired[c.id] !== undefined;
      case 'built': return this.builtCount(sim, pl, c.building, c.level ?? 0, !!c.placed) >= (c.count ?? 1);
      case 'dead': case 'destroyed': return this.allGone(sim, c.ref);
      case 'area': {
        const a = this.pointOf(sim, c.area);
        return !!a && api.unitsInArea(sim, pl, a, c.who ?? 'any').length >= (c.count ?? 1);
      }
      case 'resource': return sim.available(pl, c.res) >= c.amount;
      case 'workers': return this.count(sim)[pl].workers >= c.count;
      case 'serfs': return this.count(sim)[pl].serfs >= c.count;
      case 'tech': return sim.players[pl].techs.has(c.tech);
      case 'job': {
        const g = this.count(sim)[pl].gather;
        return (Array.isArray(c.res) ? c.res : [c.res]).some((r) => (g[r] ?? 0) > 0);
      }
      case 'event': return sim.events.some((ev) => ev.type === c.event && (ev.player ?? ev.owner) === pl
        && Object.entries(c.match ?? {}).every(([k, v]) => ev[k] === v));
      case 'ui': return st.tutorial?.ui[c.check] !== undefined && st.tutorial.ui[c.check] >= st.tutorial.since;
      case 'weather': return sim.weather.state === c.state;
      case 'flag': return !!st.flags[c.name];
      case 'heroDown': return this.allGone(sim, c.hero ?? 'hero');
      case 'tribute': return st.tributes?.[c.id] === 'paid';
      case 'talked': return st.npcs?.[c.id]?.state === 'talked';
      case 'diplomacy': return sim.relation(this.playerOf(c.a ?? 'human'), this.playerOf(c.b)) === c.state;
      case 'defeated': return sim.players[pl]?.defeated ?? false;
      case 'all': return c.of.every((x) => this.check(sim, x));
      case 'any': return c.of.some((x) => this.check(sim, x));
      case 'not': return !this.check(sim, c.cond);
      default:
        st.warnings.push(`Unknown condition ${c.type}`);
        return false;
    }
  }

  // ---------- Goals ----------

  objectiveDef(id) { return this.def.objectives.find((o) => o.id === id) ?? this.state.extraObjectives?.[id]; }

  /** Progress of a goal: { cur, target, done, failed }. */
  evaluate(sim, def, o) {
    const pl = this.playerOf(def.player);
    const c = this.count(sim)[pl];
    switch (def.type) {
      case 'build': {
        const cur = this.builtCount(sim, pl, def.building, def.level ?? 0);
        return { cur, target: def.count ?? 1 };
      }
      case 'workers': return { cur: c.workers, target: def.count };
      case 'population': return { cur: sim.popUsed(pl), target: def.count };
      case 'stock': return { cur: sim.available(pl, def.res), target: def.amount };
      case 'research': {
        const techs = def.techs ?? [def.tech];
        return { cur: techs.filter((t) => sim.players[pl].techs.has(t)).length, target: techs.length };
      }
      case 'recruit': return { cur: o.count, target: def.count };
      case 'motivation': return { cur: averageMotivation(sim, pl), target: def.value };
      case 'destroy': {
        // also done: troops that switched (bribed) to the player's side
        const ids = this.idsOf(def.ref);
        const gone = ids.filter((id) => { const e = sim.entities.get(id); return !e || (e.kind === 'leader' && sim.allied(e.owner, pl)); }).length;
        return { cur: gone, target: ids.length || 1 };
      }
      case 'destroyHq': {
        const p = this.playerOf(def.target ?? 'enemy');
        const alive = !!sim.findBuilding(p, 'headquarters');
        return { cur: alive ? 0 : 1, target: 1 };
      }
      case 'defeatAll': {
        const foes = sim.players.filter((p) => !p.neutral && p.id !== pl && sim.hostile(p.id, pl));
        const cur = foes.filter((p) => p.defeated || !sim.findBuilding(p.id, 'headquarters')).length;
        let camps = 0, campsLeft = 0;
        if (def.bandits) for (const k of this.state.camps) { camps++; if (sim.entities.has(k.id)) campsLeft++; }
        return { cur: cur + camps - campsLeft, target: foes.length + camps };
      }
      case 'survive': {
        const end = def.until !== undefined ? def.until * T : o.since + def.seconds * T;
        const total = def.until !== undefined ? def.until * T : def.seconds * T;
        const done = Math.min(total, sim.tick - (def.until !== undefined ? 0 : o.since));
        return { cur: Math.trunc(done / T), target: Math.trunc(total / T), done: sim.tick >= end, time: true };
      }
      case 'reach': {
        const a = this.pointOf(sim, def.area);
        const n = a ? api.unitsInArea(sim, pl, a, def.who ?? 'any').length : 0;
        return { cur: Math.min(n, def.count ?? 1), target: def.count ?? 1 };
      }
      case 'protect': {
        const lost = this.allGone(sim, def.ref, def.heroDownFails ?? true);
        return { cur: lost ? 0 : 1, target: 1, failed: lost, hold: true };
      }
      case 'flag': return { cur: this.state.flags[def.flag] ? 1 : 0, target: 1 };
      case 'custom': return def.progress(sim, this);
      case 'script': return this.script ? this.script.objectiveProgress(def.id) : { cur: 0, target: 1 };
      default:
        return { cur: 0, target: 1 };
    }
  }

  updateObjectives(sim) {
    const st = this.state;
    // Count recruitments (events of this tick)
    for (const ev of sim.events) {
      if (ev.type !== 'recruited') continue;
      for (const o of st.objectives) {
        const d = this.objectiveDef(o.id);
        if (o.status === 'active' && d.type === 'recruit' && ev.player === this.playerOf(d.player)
          && (!d.line || UNITS[ev.def]?.line === d.line)) o.count++;
      }
    }
    for (const o of st.objectives) {
      if (o.status !== 'active') continue;
      const d = this.objectiveDef(o.id);
      const r = this.evaluate(sim, d, o);
      o.progress = [Math.min(r.cur, r.target), r.target];
      if (r.failed) this.setObjective(sim, o, 'failed');
      else if (!r.hold && (r.done ?? r.cur >= r.target)) this.setObjective(sim, o, 'done');
    }
  }

  setObjective(sim, o, status) {
    if (o.status === status) return;
    const d = this.objectiveDef(o.id);
    o.status = status;
    if (status === 'active') { o.since = sim.tick; o.count = 0; }
    sim.events.push({ type: 'objective', id: o.id, status, player: this.state.human });
    if (status === 'done' && d.onDone) this.runActions(sim, d.onDone);
    if (status === 'failed' && d.onFail) this.runActions(sim, d.onFail);
  }

  // ---------- Triggers ----------

  updateEvents(sim) {
    const st = this.state;
    for (const ev of this.def.events ?? []) {
      const n = st.fireCount[ev.id] ?? 0;
      const max = ev.times ?? (ev.every ? Infinity : 1);
      if (n >= max) continue;
      if (n > 0 && ev.every && sim.tick < st.fired[ev.id] + ev.every * T) continue;
      if (!this.check(sim, ev.when)) continue;
      st.fired[ev.id] = sim.tick;
      st.fireCount[ev.id] = n + 1;
      this.runActions(sim, ev.do);
      if (st.result) return;
    }
  }

  /** Execute actions (see docs/MISSIONEN.md). */
  runActions(sim, actions) {
    for (const a of Array.isArray(actions) ? actions : [actions]) this.runAction(sim, a);
  }

  runAction(sim, a) {
    const st = this.state;
    if (typeof a === 'function') { a(sim, this); return; }
    switch (a.type) {
      case 'dialog': this.say(sim, a.speaker, a.text); break;
      // Reveal area (fog of war): { type: 'reveal', area, r?, seconds?, player? }
      case 'reveal': if (a.area !== undefined) { this.revealMap(sim, a); break; }
      // eslint-disable-next-line no-fallthrough
      case 'complete': case 'fail': {
        const status = { reveal: 'active', complete: 'done', fail: 'failed' }[a.type];
        for (const id of [].concat(a.id)) {
          const o = st.objectives.find((x) => x.id === id);
          if (!o) { st.warnings.push(`Objective ${id} missing`); continue; }
          if (a.type === 'reveal' && o.status !== 'hidden') continue;
          if (a.type !== 'reveal' && o.status !== 'active') continue;
          this.setObjective(sim, o, status);
        }
        break;
      }
      case 'spawn': this.spawn(sim, a); break;
      case 'give': {
        const p = this.playerOf(a.player);
        const pl = sim.players[p];
        for (const [r, n] of Object.entries(a.res ?? {})) if (RESOURCES.includes(r)) pl.stock[r] = Math.max(0, pl.stock[r] + n);
        api.giveTechs(sim, p, a.techs ?? []);
        if (a.serfs) for (let i = 0; i < a.serfs; i++) sim.spawnSerf(p);
        break;
      }
      case 'build': {
        const p = this.playerOf(a.player);
        const near = this.pointOf(sim, a.near ?? 'humanHq');
        const b = near && api.placeBuilding(sim, p, a.building, near, { minR: a.minR ?? 4, radius: a.radius ?? 20, done: a.done ?? true });
        if (!b) st.warnings.push(`No space for ${a.building}`);
        else if (a.ref) st.refs[a.ref] = b.id;
        break;
      }
      case 'ai': {
        const p = this.playerOf(a.player ?? 'enemy');
        const c = st.ai[p] ?? (st.ai[p] = { difficulty: 'normal', aggression: 'normal', startTick: 0, forbid: [] });
        if (a.difficulty) c.difficulty = a.difficulty;
        if (a.aggression) c.aggression = a.aggression;
        if (a.startIn !== undefined) c.startTick = sim.tick + Math.round(a.startIn * T);
        if (a.forbid) c.forbid = a.forbid;
        if (a.attackNow) c.attackNow = sim.tick;
        break;
      }
      case 'weather': sim.setWeather(a.state, (a.seconds ?? 120) * T); break;
      case 'camera': {
        const p = this.pointOf(sim, a.at);
        if (p) st.camera = { seq: ++st.seq, x: p.x, y: p.y };
        break;
      }
      case 'flag': st.flags[a.name] = a.value ?? true; break;
      // Campaign unlock: { type: 'unlock', buildings?: [], techs?: [] }
      case 'unlock': {
        if (!st.available) break;
        for (const kind of ['buildings', 'techs']) for (const id of a[kind] ?? []) if (!st.available[kind].includes(id)) st.available[kind].push(id);
        sim.events.push({ type: 'unlocked', buildings: a.buildings ?? [], techs: a.techs ?? [], player: st.human });
        break;
      }
      // Diplomacy: { type: 'diplomacy', a?: 'human', b: 'moorhof' | 'enemy' | number, state: 'allied' | 'neutral' | 'hostile' }
      case 'diplomacy': {
        const pa = this.playerOf(a.a ?? 'human'), pb = this.playerOf(a.b);
        if (!sim.setDiplomacy(pa, pb, a.state)) st.warnings.push(`Diplomacy ${a.a ?? 'human'}/${a.b} unknown`);
        break;
      }
      // Offer / withdraw tribute (definition in def.tributes)
      case 'tribute': {
        if (!this.def.tributes?.[a.id]) { st.warnings.push(`Tribute ${a.id} missing`); break; }
        if (!st.tributes[a.id]) st.tributes[a.id] = 'open';
        break;
      }
      case 'closeTribute': for (const id of [].concat(a.id)) if (st.tributes[id] === 'open') st.tributes[id] = 'closed'; break;
      // Set up talk figure (definition in def.npcs)
      case 'npc': this.placeNpc(sim, a.id); break;
      // Bring a hero in mid-mission: { type: 'hero', hero, player?, at }
      case 'hero': {
        const p = this.playerOf(a.player ?? 'human');
        const h = sim.spawnHero(p, a.hero);
        const at = a.at !== undefined ? this.pointOf(sim, a.at) : null;
        const q = at && api.findOpen(sim, at.x, at.y, { maxR: 8 });
        if (q) { h.px = tileCenter(q.x); h.py = tileCenter(q.y); h.anchor = { x: h.px, y: h.py }; }
        st.refs[a.ref ?? a.hero] = h.id;
        break;
      }
      // Remove figures or buildings from the game (without combat, e.g. for cutscenes)
      case 'remove': {
        for (const id of this.idsOf(a.ref)) {
          const e = sim.entities.get(id);
          if (!e) continue;
          if (e.kind === 'leader') for (const sid of e.soldiers) sim.entities.delete(sid);
          if (e.kind === 'building') sim.destroyBuilding(e, null); else sim.entities.delete(id);
        }
        break;
      }
      case 'victory': this.finish(sim, true, a.reason ?? 'script'); break;
      case 'defeat': this.finish(sim, false, a.reason ?? 'script'); break;
      default: st.warnings.push(`Unknown action ${a.type}`);
    }
  }

  /**
   * Reveal map area: permanently explored, visible for `seconds` seconds (default 30).
   * Ineffective without fog of war.
   */
  revealMap(sim, a) {
    const p = this.pointOf(sim, a.area);
    if (!p) { this.state.warnings.push(`Reveal without location ${a.area}`); return; }
    revealArea(sim, this.playerOf(a.player), p.x, p.y, a.r ?? Math.max(6, (p.r ?? 4) + 4), Math.round((a.seconds ?? 30) * T));
  }

  /** Message of a figure (bilingual text). */
  say(sim, speaker, text) {
    const st = this.state;
    st.messages.push({ seq: ++st.seq, tick: sim.tick, speaker, text });
    if (st.messages.length > MAX_MESSAGES) st.messages.shift();
    sim.events.push({ type: 'dialog', seq: st.seq, player: st.human });
  }

  /**
   * Create troops, e.g. an attack wave.
   * { owner, units: [{ def, count, soldiers }], at, order: 'attackMove'|'guard', target, ref, spread }
   */
  spawn(sim, a) {
    const st = this.state;
    const owner = this.playerOf(a.owner ?? 'bandits');
    if (owner < 0 || !sim.players[owner]) { st.warnings.push('Spawn without owner'); return; }
    const at = this.pointOf(sim, a.at);
    if (!at) { st.warnings.push('Spawn without location'); return; }
    const ids = [];
    let k = 0;
    for (const u of a.units) {
      for (let i = 0; i < (u.count ?? 1); i++, k++) {
        const near = { x: at.x + ((k % 3) - 1) * 3, y: at.y + Math.trunc(k / 3) * 3 };
        const L = api.spawnTroop(sim, owner, u.def, near, u.soldiers);
        if (L) ids.push(L.id);
      }
    }
    if (!ids.length) { st.warnings.push('Spawn: no space'); return; }
    if (a.ref) st.refs[a.ref] = [...(a.append ? this.idsOf(a.ref) : []), ...ids];
    const target = a.order === 'attackMove' ? this.pointOf(sim, a.target ?? 'humanHq') : null;
    if (target) {
      // Command as from a player, so that the same rules apply
      sim.applyCommand({ type: 'order', player: owner, units: ids, order: 'attackMove', x: target.x, y: target.y });
    }
    sim.events.push({ type: 'wave', owner, count: ids.length, player: st.human });
  }

  // ---------- Tributes ----------

  /**
   * Pay tribute (command { type: 'mission', action: 'tribute', id }): deduct cost, close offer,
   * withdraw offers of the same group (choice between two ways), execute `onPaid`.
   */
  payTribute(sim, cmd) {
    const st = this.state;
    const d = typeof cmd.id === 'string' && Object.hasOwn(this.def.tributes ?? {}, cmd.id) ? this.def.tributes[cmd.id] : null;
    if (!d || st.tributes[cmd.id] !== 'open') return sim.reject(cmd, 'err.noTribute');
    if (!sim.pay(st.human, d.cost)) return sim.reject(cmd, 'err.notEnoughResources');
    st.tributes[cmd.id] = 'paid';
    if (d.group) {
      for (const [id, t] of Object.entries(this.def.tributes)) if (id !== cmd.id && t.group === d.group && st.tributes[id] === 'open') st.tributes[id] = 'closed';
    }
    sim.events.push({ type: 'tributePaid', id: cmd.id, player: st.human });
    if (d.onPaid) this.runActions(sim, d.onPaid);
    return true;
  }

  // ---------- Talk figures ----------

  /** Set up a talk figure from def.npcs: figure with exclamation mark, a (specific) hero talks to it. */
  placeNpc(sim, id) {
    const st = this.state, d = this.def.npcs?.[id];
    if (!d) { st.warnings.push(`Dialogue figure ${id} missing`); return; }
    if (st.npcs[id]) return;
    const at = this.pointOf(sim, d.at);
    const q = at && (api.findOpen(sim, at.x, at.y, { maxR: d.maxR ?? 6 }) ?? at);
    if (!q) { st.warnings.push(`No space for dialogue figure ${id}`); return; }
    const owner = d.owner !== undefined ? this.playerOf(d.owner) : -1;
    const e = {
      id: sim.nextId++, kind: 'npc', npc: id, look: d.look ?? 'serf', owner, px: tileCenter(q.x), py: tileCenter(q.y),
      path: [], talk: true, hp: 1,
    };
    sim.entities.set(e.id, e);
    st.npcs[id] = { entity: e.id, state: 'open', hint: -1000 };
    st.refs[id] = e.id;
  }

  /**
   * Talk figure of a script (npc() in Python): stands like decoration and carries an exclamation mark. A hero
   * sent to it (order 'talk') starts the talk on arrival; @on_talk in the mission program decides what happens.
   * @returns {any|null} the figure, null if the name is taken
   */
  addNpc(sim, id, o) {
    const st = this.state;
    if (Object.hasOwn(st.npcs, id) && st.npcs[id].state !== 'gone') return null;
    const q = api.findOpen(sim, o.at.x, o.at.y, { maxR: 6 }) ?? o.at;
    const e = { id: sim.nextId++, kind: 'npc', npc: id, look: o.look, owner: -1, px: tileCenter(q.x), py: tileCenter(q.y), path: [], talk: true, hp: 1 };
    sim.entities.set(e.id, e);
    st.npcs[id] = { entity: e.id, state: 'open', hint: -1000, script: true, ...(o.name ? { name: o.name } : {}) };
    return e;
  }

  /** Switch talking with a script figure on or off (exclamation mark, tapping). */
  setTalkable(sim, id, on) {
    const n = Object.hasOwn(this.state.npcs, id) ? this.state.npcs[id] : null;
    const e = n && sim.entities.get(n.entity);
    if (!e || n.state === 'gone') return false;
    e.talk = on;
    n.state = on ? 'open' : 'closed';
    return true;
  }

  /** Heroes sent to a talk figure: next to it the talk starts (every 5 ticks, like updateNpcs). */
  updateTalks(sim) {
    if ((sim.tick + 1) % 5 !== 0) return;
    const st = this.state;
    for (const h of sim.entities.values()) {
      if (h.kind !== 'hero' || h.talkTo === undefined) continue;
      const e = sim.entities.get(h.talkTo);
      if (!e || !e.talk || h.down) { delete h.talkTo; continue; }
      if (Math.abs(h.px - e.px) > TALK_REACH || Math.abs(h.py - e.py) > TALK_REACH) {
        // Arrived somewhere else (blocked): give up instead of talking later by chance
        if ((h.order?.type ?? 'idle') === 'idle' && !h.path.length) delete h.talkTo;
        continue;
      }
      delete h.talkTo;
      const n = st.npcs[e.npc];
      // Figures of mission files talk by nearness alone (updateNpcs)
      if (!n?.script) continue;
      sim.events.push({ type: 'npcTalked', id: e.npc, hero: h.hero, player: h.owner });
      this.script?.talk(e.npc, h);
    }
  }

  /** Does a hero talk to a talk figure? (every 5 ticks) */
  updateNpcs(sim) {
    const st = this.state;
    if (!st.npcs || (sim.tick + 1) % 5 !== 0) return;
    for (const [id, n] of Object.entries(st.npcs)) {
      if (n.state === 'gone') continue;
      const e = sim.entities.get(n.entity);
      if (!e) { n.state = 'gone'; continue; }
      if (n.state !== 'open' || n.script) continue;
      const d = this.def.npcs[id];
      const R = (d.radius ?? 2) * UNIT + 500;
      let right = null, wrong = null;
      for (const h of sim.entities.values()) {
        if (h.kind !== 'hero' || h.owner !== st.human || h.down) continue;
        if (Math.abs(h.px - e.px) > R || Math.abs(h.py - e.py) > R) continue;
        if (!d.hero || [].concat(d.hero).includes(h.hero)) { right = h; break; }
        wrong = h;
      }
      if (right) {
        n.state = 'talked'; e.talk = false;
        sim.events.push({ type: 'npcTalked', id, hero: right.hero, player: st.human });
        if (d.onTalk) this.runActions(sim, d.onTalk);
        if (st.result) return;
      } else if (wrong && d.wrongHero && sim.tick - n.hint > 200) {
        n.hint = sim.tick;
        this.say(sim, d.speaker ?? null, d.wrongHero);
      }
    }
  }

  // ---------- Bandits ----------

  /** Guards defend their camp: if an enemy comes too close, all guards attack. */
  updateCamps(sim) {
    const st = this.state;
    if (st.bandits < 0 || (sim.tick + 3) % 10 !== 0) return;
    for (const camp of st.camps) {
      // fallen and bribed guards no longer belong to the camp
      camp.guards = camp.guards.filter((id) => sim.entities.get(id)?.owner === st.bandits);
      if (!camp.guards.length) continue;
      let foe = null, bd = Infinity;
      const R = (camp.r + 3) * UNIT, cx = tileCenter(camp.x), cy = tileCenter(camp.y);
      for (const e of sim.entities.values()) {
        if (e.px === undefined || e.owner === st.bandits || e.owner === undefined || e.owner < 0) continue;
        if (!(e.kind === 'leader' || e.kind === 'soldier' || e.kind === 'hero' || e.kind === 'unit') || (e.kind === 'hero' && e.down)) continue;
        if (sim.allied(e.owner, st.bandits)) continue;
        const d = Math.abs(e.px - cx) + Math.abs(e.py - cy);
        if (d < R && d < bd) { bd = d; foe = e; }
      }
      if (foe) {
        camp.alarm = sim.tick;
        // Only send guards without an enemy in sight off again – a new command would abort running fights
        const free = camp.guards.filter((id) => { const L = sim.entities.get(id); return !(L.order?.type === 'attackMove' && L.targetId); });
        if (free.length) sim.applyCommand({ type: 'order', player: st.bandits, units: free, order: 'attackMove', x: Math.trunc(foe.px / UNIT), y: Math.trunc(foe.py / UNIT) });
      } else if (camp.alarm && sim.tick - camp.alarm > 150) {
        // Calm: back to the campfire
        camp.alarm = 0;
        sim.applyCommand({ type: 'order', player: st.bandits, units: camp.guards, order: 'move', x: camp.x, y: camp.y + 3 });
      }
    }
  }

  // ---------- Tutorial ----------

  currentStep() {
    const t = this.state.tutorial;
    if (!t || t.done || t.index < 0) return null;
    return this.def.tutorial[t.index] ?? null;
  }

  stepEnteredAt(id) {
    const t = this.state.tutorial;
    const step = this.currentStep();
    return step?.id === id ? t.since : this.state.fired[`step:${id}`];
  }

  enterStep(sim, index) {
    const t = this.state.tutorial;
    t.index = index;
    t.since = sim.tick;
    const step = this.def.tutorial[index];
    if (!step) { t.done = true; return; }
    this.state.fired[`step:${step.id}`] = sim.tick;
    sim.events.push({ type: 'tutorialStep', index, id: step.id, player: this.state.human });
    if (step.onEnter) this.runActions(sim, step.onEnter);
  }

  advance(sim, skipped = false) {
    const t = this.state.tutorial;
    const step = this.currentStep();
    if (step?.onDone && !skipped) this.runActions(sim, step.onDone);
    if (t.index + 1 >= this.def.tutorial.length) {
      t.done = true;
      this.finish(sim, true, 'tutorial');
      return;
    }
    this.enterStep(sim, t.index + 1);
  }

  updateTutorial(sim) {
    const step = this.currentStep();
    if (!step || !step.done) return;
    if (this.check(sim, step.done)) this.advance(sim);
  }

  // ---------- End ----------

  checkEnd(sim) {
    const st = this.state;
    if (st.result) return;
    // Scenarios with the end rule 'script' end solely via victory() and defeat()
    if (this.def.scenario && this.def.end !== 'objectives') return;
    if (!this.def.noDefeat) {
      if (sim.players[st.human].defeated) { this.finish(sim, false, 'hq'); return; }
      for (const o of st.objectives) {
        if (o.status === 'failed' && this.objectiveDef(o.id).primary) { this.finish(sim, false, o.id); return; }
      }
    }
    if (this.def.tutorial) return; // tutorial ends with the last step
    const prim = st.objectives.filter((o) => this.objectiveDef(o.id).primary);
    if (!prim.length) return;
    const ok = prim.every((o) => o.status === 'done' || (o.status === 'active' && HOLD_TYPES.has(this.objectiveDef(o.id).type)));
    if (ok && prim.some((o) => o.status === 'done')) this.finish(sim, true, 'objectives');
  }

  /** @param {string} reason picks the texts (victoryTexts/defeatTexts/debriefs) @param {any} [text] own text instead */
  finish(sim, won, reason, text = null) {
    const st = this.state;
    if (st.result) return;
    st.result = { won, tick: sim.tick, reason, ...(text ? { text } : {}) };
    if (won) {
      for (const o of st.objectives) if (o.status === 'active' && HOLD_TYPES.has(this.objectiveDef(o.id).type)) o.status = 'done';
      if (this.def.onVictory) this.runActions(sim, this.def.onVictory);
    }
    sim.events.push({ type: won ? 'missionWon' : 'missionLost', reason, player: st.human });
  }

  // ---------- Output ----------

  /** Mix into the state hash of the simulation. */
  hash(h) {
    const st = this.state;
    h.str('m').str(st.id).int(st.seq).int(st.result ? (st.result.won ? 2 : 1) : 0);
    for (const o of st.objectives) h.str(o.status).int(o.count);
    for (const k of Object.keys(st.fireCount)) h.str(k).int(st.fireCount[k]);
    if (st.tutorial) h.int(st.tutorial.index);
    for (const k of Object.keys(st.tributes ?? {})) h.str(k).str(st.tributes[k]);
    for (const k of Object.keys(st.npcs ?? {})) h.str(k).str(st.npcs[k].state);
    if (st.available) for (const kind of ['buildings', 'techs']) h.int(st.available[kind].length).str(st.available[kind].join(','));
    this.script?.hash(h);
  }

  /** Data for the UI (texts stay bilingual objects; translation happens in Vue). */
  uiState(sim) {
    const st = this.state, def = this.def;
    const objectives = st.objectives
      .filter((o) => o.status !== 'hidden')
      .map((o) => {
        const d = this.objectiveDef(o.id);
        return {
          id: o.id, text: d.text, primary: !!d.primary, status: o.status,
          progress: d.showProgress === false || !o.progress || o.progress[1] <= 1 ? null : o.progress,
          time: d.type === 'survive',
          // Where to? Goals of type reach show their area, others an own hint (hint: { area } | { entity } | { ui })
          hint: o.status === 'active' ? this.resolveHint(sim, this.objectiveHint(sim, d)) : null,
        };
      });
    let tutorial = null;
    const step = this.currentStep();
    if (step) {
      tutorial = {
        index: st.tutorial.index, total: def.tutorial.length, id: step.id,
        title: step.title ?? null, text: step.text, touch: step.touch ?? null,
        canNext: !step.done || !!step.allowNext, hint: this.resolveHint(sim, step.hint),
      };
    }
    return {
      id: st.id, title: def.title, objectives, tutorial, kind: def.kind ?? 'mission',
      // all kept messages (at most MAX_MESSAGES): a conversation of many lines in one tick must not lose its start.
      // A copy: the UI compares snapshots – the live array would change under its feet and a new line go unseen.
      messages: st.messages.slice(),
      tributes: Object.entries(st.tributes ?? {}).filter(([, v]) => v === 'open').map(([id]) => {
        const d = this.def.tributes[id];
        return { id, text: d.text, cost: d.cost, affordable: sim.canPay(st.human, d.cost) };
      }),
      dialogSkip: st.dialogSkip ?? 0,
      // Own speakers of a level (scenario.json "speakers", names of npc()): name, colour, portrait
      speakers: this.speakerTable(),
      // Landmark (rendering only): { at, model } → location and model, e.g. the foundations of the village centre in mission 1
      landmarks: (def.landmarks ?? []).map((l) => ({ model: l.model, building: l.building ?? null, at: this.pointOf(sim, l.at) })).filter((l) => l.at),
      camera: st.camera,
      script: this.script ? this.script.uiState() : null,
      result: st.result ? {
        ...st.result, title: def.title,
        text: st.result.text ?? (st.result.won ? byReason(def.victoryTexts, st.result.reason) ?? def.victoryText : byReason(def.defeatTexts, st.result.reason) ?? def.defeatText),
        debrief: st.result.won ? byReason(def.debriefs, st.result.reason) ?? (typeof def.debrief === 'function' ? def.debrief(st) : def.debrief) ?? null : null,
        next: st.result.won ? def.next ?? null : null,
      } : null,
    };
  }

  /** Speakers of the level: scenario.json "speakers" plus the names given to npc(). */
  speakerTable() {
    const out = {};
    for (const [id, sp] of Object.entries(this.def.scenario?.speakers ?? {})) out[id] = sp;
    for (const [id, n] of Object.entries(this.state.npcs ?? {})) if (n.name && !Object.hasOwn(out, id)) out[id] = { name: n.name };
    return out;
  }

  /**
   * Hint of an objective. A pointer at a control (`ui`, e.g. 'build-clayMine') stays only as long as it helps:
   * while `uiWhile` holds, for build objectives until enough buildings are placed.
   */
  objectiveHint(sim, d) {
    const h = d.hint ?? (d.type === 'reach' ? { area: d.area } : null);
    if (!h?.ui) return h;
    // uiWhile: own condition; build objectives: until enough are placed
    const keep = h.uiWhile ? this.check(sim, h.uiWhile)
      : d.type !== 'build' || this.builtCount(sim, this.playerOf(d.player), d.building, 0, true) < (d.count ?? 1);
    if (keep) return h;
    const { ui, uiWhile, ...rest } = h;
    return Object.keys(rest).length ? rest : null;
  }

  /** Hint for coach and 3D marker: { ui } | { entity } | { area } → resolved positions. */
  resolveHint(sim, hint) {
    if (!hint) return null;
    const out = {};
    if (hint.ui) out.ui = [].concat(hint.ui);
    if (hint.entity) {
      const e = this.entityOf(sim, hint.entity) ?? (this.idsOf(hint.entity).map((id) => sim.entities.get(id)).find(Boolean) ?? null);
      if (e) {
        const p = e.kind === 'building' ? { x: e.x + e.w / 2, y: e.y + e.h / 2 } : e.px !== undefined ? { x: e.px / UNIT, y: e.py / UNIT } : { x: e.x + 0.5, y: e.y + 0.5 };
        out.entity = { id: e.id, ...p, size: e.kind === 'building' ? Math.max(e.w, e.h) / 2 : 0.6 };
      }
    }
    if (hint.area) {
      const a = this.pointOf(sim, hint.area);
      if (a) out.area = { x: a.x + 0.5, y: a.y + 0.5, r: a.r ?? 3 };
    }
    return out;
  }
}

/** Settings of the AI opponents from the mission (for AiPlayer). */
export function missionAiConfig(sim, player) {
  return sim.mission?.state?.ai?.[player] ?? null;
}

/**
 * Create a simulation for a mission.
 * @param {string} id
 * @param {{ seed?: number }} [opts]
 */
export function createMissionSim(id, opts = {}) {
  const def = getMission(id);
  if (!def) throw new Error(`Unknown mission: ${id}`);
  return simForDef(def, opts);
}

/**
 * Create a simulation for a scenario JSON that is in no directory (world editor, loaded file).
 * @param {any} scenario @param {{ seed?: number }} [opts]
 */
export function createScenarioSim(scenario, opts = {}) {
  return simForDef({ ...scenarioToDef(scenario), custom: true }, opts);
}

function simForDef(def, opts) {
  const runtime = new MissionRuntime(def);
  const real = def.players.filter((p) => p.kind !== 'bandits' && p.kind !== 'village');
  return new Sim({
    seed: opts.seed ?? def.seed ?? 1,
    size: def.size ?? 96,
    players: real.length,
    heroes: real.map((p) => p.heroes ?? p.hero ?? null),
    teams: real.map((p, i) => p.team ?? i),
    mission: runtime,
    world: def.world ? { ...def.world, size: def.world.size ?? def.size, seed: opts.seed ?? def.world.seed ?? def.seed } : undefined,
    // Without castle (hq: false): coding adventures and command missions
    playerSetup: def.scenario ? playerSetupOf(def) : real.map((p) => ({ hq: p.hq !== false })),
  });
}
