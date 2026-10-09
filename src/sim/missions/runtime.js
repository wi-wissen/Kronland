// Mission runtime: hooks into the simulation via three small hooks (setup, update, command). Every mission is a
// level folder (scenario.json + Python, docs/SKRIPTE.md): the data say what there is, the mission program (ScriptHost)
// says when what happens. The runtime keeps what the program calls on – objectives and their end rule, bandit
// camps, villages, talk figures, tributes, unlocks, guided steps, dialogue and camera.
// Only the developer maps (showcase.js, stress.js) stay JS with a small hook: setup(ctx) and tick(sim, m).
//
// The mission state (this.state) is pure JSON and is saved with the save game (the scenario with all code too).
//
// Deterministic: integers only, fixed orders, no Math.random/Date.

import { Sim } from '../sim.js';
import { BUILDINGS } from '../data/buildings.js';
import { emptyStock } from '../data/resources.js';
import { TICKS_PER_SECOND, UNIT, tileCenter } from '../fixed.js';
import * as api from './setupApi.js';
import { getMission } from './registry.js';
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

/** Longest wait for a running conversation once all objectives are done (ticks). */
const END_WAIT = 60 * T;

export class MissionRuntime {
  /** @param {any} def mission definition @param {any} [state] saved state */
  constructor(def, state = null) {
    this.def = def;
    this.state = state ?? {
      id: def.id,
      human: 0,
      bandits: -1,
      result: null,              // { won, tick, reason }
      // Signposts of the developer maps; levels add theirs with objective() in the mission program
      objectives: (def.objectives ?? []).map((o) => ({
        id: o.id, status: o.hidden ? 'hidden' : 'active', since: 0, count: 0, progress: null,
      })),
      refs: {},                  // developer maps: name → entity ID, ID list or point/circle (devContext)
      ai: {},                    // player → { difficulty, aggression, startTick, forbid }
      camps: [],                 // bandit camps { id, guards[], x, y, r, alarm }
      messages: [],              // { seq, tick, speaker, text }
      seq: 0,
      camera: null,              // { seq, x, y }
      /** Guided steps (step() in Python): { index, ui: {check: tick}, since, step } – created by the first step */
      tutorial: null,
      warnings: [],
      /** Goals that a script creates at runtime: ID → { id, type: 'script', text, primary } */
      extraObjectives: {},
      /** Villages (neutral player slots without a castle): name → player */
      villages: {},
      /** Tributes: ID → 'open' | 'paid' | 'closed' (order = order of offering) */
      tributes: {},
      /** Tributes a script offers (offer()): ID → { cost, text, group } */
      tributeDefs: {},
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
    // A mission that moved from a mission file into a level folder: its old saves carry no scenario and cannot go on
    if (!custom && !state.scenario && base?.scenario) {
      throw Object.assign(new Error(`Mission ${state.id} was rewritten, the save game is too old`), { code: 'saves.err.missionChanged' });
    }
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
    // Shaft sites only for the raw materials the mission needs (shafts: ['clay', 'stone'] …)
    if (def.shafts) api.keepShafts(sim, def.shafts);
    // Developer maps (JS in the repo only): their own setup
    def.setup?.(this.devContext(sim));
    // Python mission program: world building, register handlers
    this.script?.setup(sim);
  }

  /**
   * Toolbox for the developer maps (showcase.js, stress.js – JS in the repo, never reachable from a level file):
   * setup(ctx) builds the map, ctx.ref() keeps their places and figures in state.refs.
   */
  devContext(sim) {
    const m = this;
    return {
      sim, api, m,
      human: this.state.human,
      bandits: this.state.bandits,
      hq: (p = m.human) => sim.findBuilding(p, 'headquarters'),
      hqCenter: (p = m.human) => { const b = sim.findBuilding(p, 'headquarters'); return b ? api.centerOf(b) : sim.starts[p]; },
      mapCenter: () => ({ x: sim.map.width >> 1, y: sim.map.height >> 1 }),
      ref: (name, value) => { if (value !== undefined) m.state.refs[name] = value; return m.state.refs[name]; },
      warn: (msg) => m.state.warnings.push(msg),
      /** Bandit camp with guards; its hut, guards and area become references `name`, `nameGuards`, `nameArea`. */
      camp: (name, near, units, o = {}) => {
        const c = m.addCamp(sim, name, near, units, o);
        if (c) { m.state.refs[name] = c.id; m.state.refs[`${name}Guards`] = c.guards; m.state.refs[`${name}Area`] = { x: c.x, y: c.y, r: c.r }; }
        return c;
      },
      /** Talk figure at a reference; a hero sent to it calls def.talk(sim, m, id, hero). */
      npc: (id, o) => { const at = m.pointOf(sim, o.at); return at ? m.addNpc(sim, id, { ...o, at }) : null; },
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
    let b = o.anchor !== undefined && o.anchor !== null ? sim.entities.get(o.anchor) : null;
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
    return { id: b.id, x: c.x, y: c.y, r: camp.r, guards };
  }

  // ---------- Hook 2: commands ----------

  /** Commands of type 'mission': next, skip, ui. */
  command(sim, cmd) {
    const st = this.state;
    if (cmd.player !== st.human) return sim.reject(cmd, 'err.missionHumanOnly');
    const tut = st.tutorial;
    switch (cmd.action) {
      // The step that step() waits for ends with "Weiter" (reading steps and next=True) or "Überspringen" (always)
      case 'next': case 'skip': {
        const step = this.currentStep();
        if (!step || step.result) return sim.reject(cmd, 'err.noTutorial');
        if (cmd.action === 'next' && !step.canNext) return sim.reject(cmd, 'err.stepByAction');
        step.result = cmd.action;
        return true;
      }
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
    this.updateTalks(sim);
    if (st.result) return;
    this.updateObjectives(sim);
    // Developer maps: their own tick (e.g. reinforcements in the stress test)
    this.def.tick?.(sim, this);
    if (!st.result) this.script?.update(sim);
    this.checkEnd(sim);
  }

  // ---------- Counting (once per tick, only when needed) ----------

  /** Numbers per player from a single pass over all entities. */
  count(sim) {
    if (this.census) return this.census;
    const per = sim.players.map(() => ({ placed: {}, done: {}, level: {}, workers: 0, serfs: 0, leaders: 0, soldiers: 0, gather: {}, heroes: [] }));
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
      else if (e.kind === 'soldier') c.soldiers++;
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

  /** Point or circle for a reference: {x,y,r}, 'humanHq', 'enemyHq', a place of the level or of a developer map. */
  pointOf(sim, ref) {
    if (ref && typeof ref === 'object' && !Array.isArray(ref)) return ref;
    if (ref === 'humanHq' || ref === 'enemyHq') {
      const p = ref === 'humanHq' ? this.state.human : this.playerOf('enemy');
      const hq = p >= 0 ? sim.findBuilding(p, 'headquarters') : null;
      return hq ? { ...api.centerOf(hq), r: 4 } : null;
    }
    if (typeof ref !== 'string') return null;
    // Places of a scenario (scenario.json and make_place) – one table, kept by the script host
    const place = this.script && Object.hasOwn(this.script.places, ref) ? this.script.places[ref] : null;
    if (place) return { x: place.x, y: place.y, r: place.r ?? 2 };
    // Developer maps: circles and figures in state.refs
    const v = Object.hasOwn(this.state.refs, ref) ? this.state.refs[ref] : undefined;
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    const e = typeof v === 'number' ? sim.entities.get(v) : null;
    return e ? { ...api.tileOf(e), r: e.kind === 'building' ? Math.max(e.w, e.h) : 2 } : null;
  }

  // ---------- Conditions ----------

  // ---------- Goals ----------

  /** Declaration of an objective: objective() of the mission program, or a signpost of a developer map. */
  objectiveDef(id) {
    return (Object.hasOwn(this.state.extraObjectives ?? {}, id) ? this.state.extraObjectives[id] : null) ?? (this.def.objectives ?? []).find((o) => o.id === id);
  }

  /** Progress of an objective: { cur, target, done?, failed?, hold? } from its condition in the mission program. */
  evaluate(sim, def) {
    // Signposts of the developer maps have no condition: never met
    const r = this.script && def.type === 'script' ? this.script.objectiveProgress(def.id) : { cur: 0, target: 1, none: true };
    // hold=True: met as long as the condition holds, failed once it does not (without condition: until fail())
    if (def.hold) return r.none ? { cur: 1, target: 1, hold: true } : { ...r, failed: r.cur < r.target, hold: true };
    return r;
  }

  updateObjectives(sim) {
    for (const o of this.state.objectives) {
      if (o.status !== 'active') continue;
      const r = this.evaluate(sim, this.objectiveDef(o.id));
      o.progress = [Math.min(r.cur, r.target), r.target];
      if (r.failed) this.setObjective(sim, o, 'failed');
      else if (!r.hold && (r.done ?? r.cur >= r.target)) this.setObjective(sim, o, 'done');
    }
    this.script?.checkHints();
  }

  setObjective(sim, o, status) {
    if (o.status === status) return;
    o.status = status;
    if (status === 'active') { o.since = sim.tick; o.count = 0; }
    sim.events.push({ type: 'objective', id: o.id, status, player: this.state.human });
  }

  /**
   * show_objective / complete / fail of the mission program: 'reveal' shows a hidden objective, 'complete' and
   * 'fail' end an active one.
   */
  objectiveAction(sim, action, id) {
    const o = this.state.objectives.find((x) => x.id === id);
    if (!o) return false;
    if (action === 'reveal' ? o.status !== 'hidden' : o.status !== 'active') return false;
    this.setObjective(sim, o, { reveal: 'active', complete: 'done', fail: 'failed' }[action]);
    return true;
  }

  /** Campaign unlock (unlock() in Python): buildings and technologies the human may use from now on. */
  unlock(sim, buildings = [], techs = []) {
    const st = this.state;
    if (!st.available) return;
    for (const [kind, ids] of [['buildings', buildings], ['techs', techs]]) for (const id of ids) if (!st.available[kind].includes(id)) st.available[kind].push(id);
    sim.events.push({ type: 'unlocked', buildings, techs, player: st.human });
  }

  /** Settings of a computer opponent (ai() in Python): difficulty, aggression, start, forbidden buildings, attack now. */
  setAi(sim, player, o) {
    const c = this.state.ai[player] ?? (this.state.ai[player] = { difficulty: 'normal', aggression: 'normal', startTick: 0, forbid: [] });
    if (o.difficulty) c.difficulty = o.difficulty;
    if (o.aggression) c.aggression = o.aggression;
    if (o.startIn !== undefined) c.startTick = sim.tick + Math.round(o.startIn * T);
    if (o.forbid) c.forbid = o.forbid;
    if (o.attackNow) c.attackNow = sim.tick;
  }

  // ---------- Triggers ----------

  /** Message of a figure (bilingual text). */
  say(sim, speaker, text) {
    const st = this.state;
    st.messages.push({ seq: ++st.seq, tick: sim.tick, speaker, text });
    if (st.messages.length > MAX_MESSAGES) st.messages.shift();
    sim.events.push({ type: 'dialog', seq: st.seq, player: st.human });
  }

  // ---------- Tributes ----------

  /**
   * Pay tribute (command { type: 'mission', action: 'tribute', id }): deduct cost, close offer, withdraw offers of
   * the same group (choice between two ways); the mission program hears it (@on_event("tribute")).
   */
  payTribute(sim, cmd) {
    const st = this.state;
    const d = typeof cmd.id === 'string' ? this.tributeDef(cmd.id) : null;
    if (!d || st.tributes[cmd.id] !== 'open') return sim.reject(cmd, 'err.noTribute');
    if (!sim.pay(st.human, d.cost)) return sim.reject(cmd, 'err.notEnoughResources');
    st.tributes[cmd.id] = 'paid';
    if (d.group) {
      for (const id of Object.keys(st.tributes)) if (id !== cmd.id && this.tributeDef(id)?.group === d.group && st.tributes[id] === 'open') st.tributes[id] = 'closed';
    }
    sim.events.push({ type: 'tributePaid', id: cmd.id, player: st.human });
    return true;
  }

  /** Definition of a tribute offered by the mission program (offer()). */
  tributeDef(id) {
    return Object.hasOwn(this.state.tributeDefs ?? {}, id) ? this.state.tributeDefs[id] : null;
  }

  // ---------- Talk figures ----------

  /**
   * Talk figure of a script (npc() in Python): stands like decoration and carries an exclamation mark. A hero
   * sent to it (order 'talk') starts the talk on arrival; @on_talk in the mission program decides what happens.
   * @returns {any|null} the figure, null if the name is taken
   */
  addNpc(sim, id, o) {
    const st = this.state;
    if (Object.hasOwn(st.npcs, id) && st.npcs[id].state !== 'gone') return null;
    const q = api.findOpen(sim, o.at.x, o.at.y, { maxR: 6 }) ?? o.at;
    const e = { id: sim.nextId++, kind: 'npc', npc: id, look: o.look, owner: o.owner ?? -1, px: tileCenter(q.x), py: tileCenter(q.y), path: [], talk: true, hp: 1 };
    sim.entities.set(e.id, e);
    // speaker: who speaks for the figure (the dialogue camera looks at it when that speaker talks)
    st.npcs[id] = { entity: e.id, state: 'open', hint: -1000, script: true, ...(o.name ? { name: o.name } : {}), ...(o.speaker ? { speaker: o.speaker } : {}) };
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
      if (!st.npcs[e.npc]) continue;
      sim.events.push({ type: 'npcTalked', id: e.npc, hero: h.hero, player: h.owner });
      this.script?.talk(e.npc, h);
      this.def.talk?.(sim, this, e.npc, h);
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

  // ---------- Tutorial (step() in Python) ----------

  /** The step that a step() call is waiting for, or null (between two steps, or no tutorial). */
  currentStep() {
    const step = this.state.tutorial?.step;
    return step && !step.finished ? step : null;
  }

  /**
   * step(): show a step card (title, text, touch text, pointer) and remember what ends it – the UI check `watch`
   * ('camera', 'selectSerfs'), "Weiter" (canNext) or "Überspringen". The script waits until then.
   * @param {{ id: string, title: any, text: any, touch: any, hint: any, watch: string|null, canNext: boolean }} o
   */
  enterScriptStep(sim, o) {
    const t = this.state.tutorial ?? (this.state.tutorial = { index: -1, ui: {}, since: 0, step: null });
    t.index++;
    t.since = sim.tick;
    t.step = { ...o, result: null, finished: false };
    sim.events.push({ type: 'tutorialStep', index: t.index, id: o.id, player: this.state.human });
    return t.step;
  }

  /** Has the UI reported the check of the current step since the step began? */
  uiChecked(check) {
    const t = this.state.tutorial;
    return !!t && Object.hasOwn(t.ui, check) && t.ui[check] >= t.since;
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
    const prim = st.objectives.filter((o) => this.objectiveDef(o.id).primary);
    if (!prim.length) return;
    const ok = prim.every((o) => o.status === 'done' || (o.status === 'active' && this.objectiveDef(o.id).hold));
    if (!ok || !prim.some((o) => o.status === 'done')) return;
    // A conversation of the script still running (e.g. the lines after the last objective) is heard to its end
    // first – at most END_WAIT ticks
    if (this.script?.talking()) {
      st.endWait ??= sim.tick;
      if (sim.tick - st.endWait < END_WAIT) return;
    }
    // ending(reason) of the script picks the texts of the way taken
    this.finish(sim, true, st.endReason ?? 'objectives');
  }

  /** @param {string} reason picks the texts (victoryTexts/defeatTexts/debriefs) @param {any} [text] own text instead */
  finish(sim, won, reason, text = null) {
    const st = this.state;
    if (st.result) return;
    st.result = { won, tick: sim.tick, reason, ...(text ? { text } : {}) };
    // Objectives to keep (hold=True) count as met on victory
    if (won) for (const o of st.objectives) if (o.status === 'active' && this.objectiveDef(o.id).hold) o.status = 'done';
    sim.events.push({ type: won ? 'missionWon' : 'missionLost', reason, player: st.human });
  }

  // ---------- Output ----------

  /** Mix into the state hash of the simulation. */
  hash(h) {
    const st = this.state;
    h.str('m').str(st.id).int(st.seq).int(st.result ? (st.result.won ? 2 : 1) : 0);
    for (const o of st.objectives) { h.str(o.status).int(o.count); if (o.uiOff) h.int(1); }
    if (st.endWait !== undefined) h.int(st.endWait);
    if (st.endReason) h.str(st.endReason);
    if (st.tutorial) h.int(st.tutorial.index).str(st.tutorial.step?.result ?? '');
    for (const k of Object.keys(st.tributes ?? {})) h.str(k).str(st.tributes[k]);
    if (Object.keys(st.tributeDefs ?? {}).length) h.str(JSON.stringify(st.tributeDefs));
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
          time: !!d.clock,
          // Where to? hint: { area } | { entity } | { ui }
          hint: o.status === 'active' ? this.resolveHint(sim, this.objectiveHint(sim, d, o)) : null,
        };
      });
    let tutorial = null;
    const step = this.currentStep();
    if (step) {
      tutorial = {
        // Number of steps: read from the code (scenarioSteps), at least up to the current one
        index: st.tutorial.index, total: Math.max(def.steps?.length ?? 0, st.tutorial.index + 1), id: step.id,
        title: step.title ?? null, text: step.text, touch: step.touch ?? null,
        canNext: !!step.canNext, hint: this.resolveHint(sim, step.hint),
        // UI check the engine watches for this step ('camera', 'selectSerfs'), see Engine.missionUi
        watch: step.watch ?? null,
      };
    }
    return {
      id: st.id, title: def.title, objectives, tutorial, kind: def.kind ?? 'mission',
      // all kept messages (at most MAX_MESSAGES): a conversation of many lines in one tick must not lose its start.
      // A copy: the UI compares snapshots – the live array would change under its feet and a new line go unseen.
      messages: st.messages.slice(),
      tributes: Object.entries(st.tributes ?? {}).filter(([id, v]) => v === 'open' && this.tributeDef(id)).map(([id]) => {
        const d = this.tributeDef(id);
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
        debrief: st.result.won ? byReason(def.debriefs, st.result.reason) ?? def.debrief ?? null : null,
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
   * Hint of an objective (hint() in Python, signposts of the developer maps). A pointer at a control (`ui`, e.g.
   * 'build-clayMine') stays only as long as it helps: it goes once its ui_until condition held (o.uiOff).
   */
  objectiveHint(sim, d, o = null) {
    const h = d.hint ?? null;
    if (!h?.ui || !o?.uiOff) return h;
    const { ui, ...rest } = h;
    return Object.keys(rest).length ? rest : null;
  }

  /** Hint for coach and 3D marker: { ui } | { entity } | { area } → resolved positions. */
  resolveHint(sim, hint) {
    if (!hint) return null;
    const out = {};
    if (hint.ui) out.ui = [].concat(hint.ui);
    if (hint.entity) {
      const e = typeof hint.entity === 'number' ? sim.entities.get(hint.entity) ?? null : null;
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
 * @param {{ seed?: number, tracks?: string }} [opts] tracks: game option of the player (ignored when the level fixes it)
 */
export function createMissionSim(id, opts = {}) {
  const def = getMission(id);
  if (!def) throw new Error(`Unknown mission: ${id}`);
  return simForDef(def, opts);
}

/**
 * Create a simulation for a scenario JSON that is in no directory (world editor, loaded file).
 * @param {any} scenario @param {{ seed?: number, tracks?: string }} [opts]
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
    tracks: opts.tracks,
    world: def.world ? { ...def.world, size: def.world.size ?? def.size, seed: opts.seed ?? def.world.seed ?? def.seed } : undefined,
    // Without castle (hq: false): coding adventures and command missions
    playerSetup: def.scenario ? playerSetupOf(def) : real.map((p) => ({ hq: p.hq !== false })),
  });
}
