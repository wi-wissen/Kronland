// Game API of the scripting language (English names, see docs/SKRIPTE.md).
//
// Two permission levels:
//   player  – only what the UI may do as well. Every command runs as a normal sim command
//             (same rules, same cost) – coding adventures and later own AI.
//   mission – everything: create troops, give resources, camera, dialogues, goals, shape terrain.
// The level decides which names a program knows at all.
//
// Game objects are handles (PyHost): class + entity ID or place name. Everything stays deterministic:
// results only depend on the sim state, lists are sorted by ID.

import {
  PyBuiltin, PyHost, PyPartial, PyList, PyTuple, PyFloat, PyFunction, PyModule, PyBoundMethod, Suspend, ScriptError,
  iterItems, isNum, num, typeName, truthy, suggest,
} from '../../script/index.js';
import { BUILDINGS } from '../data/buildings.js';
import { UNITS, HERO_IDS } from '../data/units.js';
import { RESOURCES } from '../data/resources.js';
import { TECHS } from '../data/technologies.js';
import { BUILDING_TECHS } from '../data/buildingTechs.js';
import { BALANCE } from '../data/balance.js';
import { WATER, CLIFF, OCCUPIED } from '../map.js';
import { TICKS_PER_SECOND, tileCenter, toTile } from '../fixed.js';
import { valueNoise } from '../mapgen.js';
import * as sapi from '../missions/setupApi.js';
import { revealArea } from '../systems/vision.js';
import { hasKey } from '../sim.js';

const T = TICKS_PER_SECOND;

/** Compass directions for hero.turn_left() & co.: 0 = north (−y), 1 = east, 2 = south, 3 = west. */
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const DIR_NAMES = ['north', 'east', 'south', 'west'];

const gameErr = (reason, reasonParams = {}) => new ScriptError('game', { reason: `script.game.${reason}`, reasonParams });

/** Class of a handle by entity kind. */
const CLASS_OF = { hero: 'Hero', unit: 'Serf', leader: 'Troop', soldier: 'Soldier', worker: 'Worker', building: 'Building', tree: 'Tree', pile: 'Pile', ruin: 'Ruin' };

// ---------------------------------------------------------------------------------------------
// Directory for help panel, editor completion and docs. Descriptions: i18n script.api.<name>
// level: 'player' = both levels, 'mission' = mission scripts only. group: section in the help panel.
// ---------------------------------------------------------------------------------------------

export const API_DOC = [
  // Flow
  { name: 'wait', sig: 'wait(seconds)', level: 'player', group: 'flow' },
  { name: 'wait_until', sig: 'wait_until(condition, timeout=None)', level: 'player', group: 'flow' },
  { name: 'time', sig: 'time()', level: 'player', group: 'flow' },
  { name: 'print', sig: 'print(*values)', level: 'player', group: 'flow' },
  // Hero (coding adventure)
  { name: 'hero', sig: 'hero', level: 'player', group: 'hero' },
  { name: 'hero.step', sig: 'hero.step(n=1)', level: 'player', group: 'hero' },
  { name: 'hero.turn_left', sig: 'hero.turn_left()', level: 'player', group: 'hero' },
  { name: 'hero.turn_right', sig: 'hero.turn_right()', level: 'player', group: 'hero' },
  { name: 'hero.turn_to', sig: 'hero.turn_to(direction)', level: 'player', group: 'hero' },
  { name: 'hero.ahead', sig: 'hero.ahead()', level: 'player', group: 'hero' },
  { name: 'hero.can_step', sig: 'hero.can_step()', level: 'player', group: 'hero' },
  { name: 'hero.move_to', sig: 'hero.move_to(target)', level: 'player', group: 'hero' },
  { name: 'hero.is_at', sig: 'hero.is_at(target)', level: 'player', group: 'hero' },
  { name: 'hero.take', sig: 'hero.take()', level: 'player', group: 'hero' },
  { name: 'hero.chop', sig: 'hero.chop()', level: 'player', group: 'hero' },
  { name: 'hero.say', sig: 'hero.say(text)', level: 'player', group: 'hero' },
  { name: 'hero.facing', sig: 'hero.facing', level: 'player', group: 'hero' },
  { name: 'hero.x', sig: 'hero.x, hero.y', level: 'player', group: 'hero' },
  // Read world
  { name: 'place', sig: 'place(name)', level: 'player', group: 'world' },
  { name: 'places', sig: 'places()', level: 'player', group: 'world' },
  { name: 'tile', sig: 'tile(x, y)', level: 'player', group: 'world' },
  { name: 'distance', sig: 'distance(a, b)', level: 'player', group: 'world' },
  { name: 'trees_near', sig: 'trees_near(target, radius=6)', level: 'player', group: 'world' },
  { name: 'piles_near', sig: 'piles_near(target, radius=6, res=None)', level: 'player', group: 'world' },
  // Village (commands as in the UI)
  { name: 'stock', sig: 'stock(res)', level: 'player', group: 'village' },
  { name: 'count', sig: 'count(kind)', level: 'player', group: 'village' },
  { name: 'serfs', sig: 'serfs(idle=False)', level: 'player', group: 'village' },
  { name: 'troops', sig: 'troops()', level: 'player', group: 'village' },
  { name: 'buildings', sig: 'buildings(kind=None)', level: 'player', group: 'village' },
  { name: 'hq', sig: 'hq()', level: 'player', group: 'village' },
  { name: 'find_spot', sig: 'find_spot(kind, near)', level: 'player', group: 'village' },
  { name: 'can_build', sig: 'can_build(kind, x, y)', level: 'player', group: 'village' },
  { name: 'build', sig: 'build(kind, x, y)', level: 'player', group: 'village' },
  { name: 'buy_serf', sig: 'buy_serf(count=1)', level: 'player', group: 'village' },
  { name: 'unit.move_to', sig: 'unit.move_to(target, wait=True)', level: 'player', group: 'village' },
  { name: 'unit.work_on', sig: 'serf.work_on(target)', level: 'player', group: 'village' },
  { name: 'unit.attack', sig: 'troop.attack(target)', level: 'player', group: 'village' },
  { name: 'building.upgrade', sig: 'building.upgrade()', level: 'player', group: 'village' },
  // Staging (missions only)
  { name: 'say', sig: 'say(speaker, text, seconds=None, voice=None)', level: 'mission', group: 'story' },
  { name: 'message', sig: 'message(text)', level: 'mission', group: 'story' },
  { name: 'camera.jump_to', sig: 'camera.jump_to(target)', level: 'mission', group: 'story' },
  { name: 'camera.fly_to', sig: 'camera.fly_to(target, seconds=2)', level: 'mission', group: 'story' },
  { name: 'reveal', sig: 'reveal(target, radius=None, seconds=30)', level: 'mission', group: 'story' },
  // Events (decorators)
  { name: 'on_start', sig: '@on_start', level: 'mission', group: 'events' },
  { name: 'every', sig: '@every(seconds)', level: 'mission', group: 'events' },
  { name: 'on_building_done', sig: '@on_building_done(kind=None, player=HUMAN)', level: 'mission', group: 'events' },
  { name: 'on_building_placed', sig: '@on_building_placed(kind=None, player=HUMAN)', level: 'mission', group: 'events' },
  { name: 'on_destroyed', sig: '@on_destroyed(kind=None, owner=None)', level: 'mission', group: 'events' },
  { name: 'on_killed', sig: '@on_killed(owner=None)', level: 'mission', group: 'events' },
  { name: 'on_recruited', sig: '@on_recruited(player=HUMAN)', level: 'mission', group: 'events' },
  { name: 'on_research', sig: '@on_research(tech=None, player=HUMAN)', level: 'mission', group: 'events' },
  { name: 'on_enter', sig: '@on_enter(target, who="any", player=HUMAN)', level: 'mission', group: 'events' },
  { name: 'on_objective', sig: '@on_objective(id, status="done")', level: 'mission', group: 'events' },
  { name: 'on_weather', sig: '@on_weather(state=None)', level: 'mission', group: 'events' },
  // Goals and end
  { name: 'objective', sig: 'objective(id, text, condition=None, primary=True, hidden=False)', level: 'mission', group: 'goals' },
  { name: 'complete', sig: 'complete(id)', level: 'mission', group: 'goals' },
  { name: 'fail', sig: 'fail(id)', level: 'mission', group: 'goals' },
  { name: 'show_objective', sig: 'show_objective(id)', level: 'mission', group: 'goals' },
  { name: 'victory', sig: 'victory(reason=None)', level: 'mission', group: 'goals' },
  { name: 'defeat', sig: 'defeat(reason=None)', level: 'mission', group: 'goals' },
  // Intervening
  { name: 'spawn', sig: 'spawn(owner, kind, at, count=1, soldiers=None)', level: 'mission', group: 'power' },
  { name: 'spawn_serfs', sig: 'spawn_serfs(player, count)', level: 'mission', group: 'power' },
  { name: 'give', sig: 'give(player, wood=0, gold=0, …)', level: 'mission', group: 'power' },
  { name: 'set_diplomacy', sig: 'set_diplomacy(a, b, "allied"|"neutral"|"hostile")', level: 'mission', group: 'power' },
  { name: 'diplomacy', sig: 'diplomacy(a, b)', level: 'player', group: 'power' },
  { name: 'give_tech', sig: 'give_tech(player, *techs)', level: 'mission', group: 'power' },
  { name: 'place_building', sig: 'place_building(player, kind, near, done=True)', level: 'mission', group: 'power' },
  { name: 'remove', sig: 'remove(thing)', level: 'mission', group: 'power' },
  { name: 'attack', sig: 'attack(units, target)', level: 'mission', group: 'power' },
  { name: 'move', sig: 'move(units, target)', level: 'mission', group: 'power' },
  { name: 'units_in', sig: 'units_in(target, player=HUMAN, who="any")', level: 'mission', group: 'power' },
  { name: 'alive', sig: 'alive(units)', level: 'mission', group: 'power' },
  { name: 'hero_of', sig: 'hero_of(player, name=None)', level: 'mission', group: 'power' },
  { name: 'set_weather', sig: 'set_weather(state, seconds=120)', level: 'mission', group: 'power' },
  { name: 'ai', sig: 'ai(player, difficulty=None, aggression=None, start_in=None, attack_now=False)', level: 'mission', group: 'power' },
  // Shape terrain
  { name: 'make_place', sig: 'make_place(name, x, y, r=3)', level: 'mission', group: 'terrain' },
  { name: 'find_open', sig: 'find_open(near, min_r=0, max_r=24)', level: 'mission', group: 'terrain' },
  { name: 'toward', sig: 'toward(a, b, distance)', level: 'mission', group: 'terrain' },
  { name: 'map_center', sig: 'map_center()', level: 'mission', group: 'terrain' },
  { name: 'plant_trees', sig: 'plant_trees(target, count, radius=5)', level: 'mission', group: 'terrain' },
  { name: 'add_tree', sig: 'add_tree(x, y)', level: 'mission', group: 'terrain' },
  { name: 'add_pile', sig: 'add_pile(res, x, y, amount=None)', level: 'mission', group: 'terrain' },
  { name: 'clear_area', sig: 'clear_area(target, radius)', level: 'mission', group: 'terrain' },
  { name: 'world.width', sig: 'world.width, world.height', level: 'mission', group: 'terrain' },
  { name: 'world.height_at', sig: 'world.height_at(x, y)', level: 'mission', group: 'terrain' },
  { name: 'world.set_height', sig: 'world.set_height(x, y, h)', level: 'mission', group: 'terrain' },
  { name: 'world.set_water', sig: 'world.set_water(x, y, on=True)', level: 'mission', group: 'terrain' },
  { name: 'world.set_cliff', sig: 'world.set_cliff(x, y, on=True)', level: 'mission', group: 'terrain' },
  { name: 'world.noise', sig: 'world.noise(x, y, cell=16)', level: 'mission', group: 'terrain' },
  // Constants
  { name: 'HUMAN', sig: 'HUMAN, ENEMY, BANDITS', level: 'player', group: 'const' },
];

/** Names of the methods per handle class and level. */
const METHODS = {
  Hero: {
    player: ['step', 'turn_left', 'turn_right', 'turn_to', 'ahead', 'can_step', 'move_to', 'is_at', 'take', 'chop', 'say', 'distance_to'],
    mission: ['teleport', 'kill'],
  },
  Serf: { player: ['move_to', 'work_on', 'is_at', 'distance_to'], mission: ['kill'] },
  Troop: { player: ['move_to', 'attack', 'is_at', 'distance_to'], mission: ['kill'] },
  Worker: { player: ['is_at', 'distance_to'], mission: ['kill'] },
  Soldier: { player: ['is_at', 'distance_to'], mission: [] },
  Building: { player: ['upgrade', 'distance_to'], mission: ['kill'] },
  Tree: { player: ['distance_to'], mission: ['kill'] },
  Pile: { player: ['distance_to'], mission: ['kill'] },
  Ruin: { player: [], mission: [] },
  Place: { player: ['distance_to', 'contains'], mission: [] },
};

/** Properties per class (for dir() and suggestions). */
const PROPS = {
  common: ['id', 'kind', 'owner', 'x', 'y', 'alive', 'hp'],
  Hero: ['name', 'facing', 'down'],
  Troop: ['type', 'soldiers'],
  Serf: ['idle', 'job'],
  Worker: ['profession'],
  Building: ['type', 'level', 'done', 'w', 'h'],
  Tree: ['res', 'amount'],
  Pile: ['res', 'amount'],
  Place: ['name', 'x', 'y', 'r'],
};

// ---------------------------------------------------------------------------------------------

/**
 * Natives, predefined names and host hooks for a VM.
 * @param {import('./host.js').ScriptHost} host
 * @param {'mission'|'player'} level
 */
export function makeApi(host, level) {
  const isMission = level === 'mission';
  const sim = () => host.sim;
  const st = () => host.state;
  const human = () => host.runtime.state.human;

  // ---------- Helpers ----------

  const playerOf = (v, def = human()) => {
    if (v === undefined || v === null) return def;
    if (!isNum(v)) throw new ScriptError('type', { what: 'intNeeded', name: 'player', type: typeName(v) });
    const p = Number(num(v));
    if (!sim().players[p]) throw gameErr('playerUnknown', { player: p });
    return p;
  };

  const handle = (e) => new PyHost(CLASS_OF[e.kind] ?? 'Entity', e.id);
  const entityOf = (h, need = true) => {
    if (!(h instanceof PyHost) || h.cls === 'Place') {
      if (need) throw new ScriptError('type', { what: 'entityNeeded', type: typeName(h) });
      return null;
    }
    const e = sim().entities.get(h.id);
    if (!e && need) throw gameErr('gone', { what: h.cls });
    return e ?? null;
  };
  const alive = (e) => !!e && !(e.kind === 'hero' && e.down);

  /** Tile of an entity. */
  const tileOfE = (e) => (e.kind === 'building' ? sapi.centerOf(e) : e.px !== undefined ? { x: toTile(e.px), y: toTile(e.py) } : { x: e.x, y: e.y });

  /** Place for a name (scenario places, mission references). */
  const placeByName = (name) => {
    const p = host.places[name];
    if (p) return { x: p.x, y: p.y, r: p.r ?? 2 };
    const pt = host.runtime.pointOf(sim(), name);
    if (pt) return { x: pt.x, y: pt.y, r: pt.r ?? 2 };
    return null;
  };

  /**
   * Resolve a target to tile coordinates: place, game object, (x, y), place name.
   * @returns {{x:number, y:number, r:number}}
   */
  const pt = (v, v2) => {
    if (v2 !== undefined && isNum(v)) return { x: Math.trunc(Number(num(v))), y: Math.trunc(Number(num(v2))), r: 0 };
    if (v instanceof PyHost) {
      if (v.cls === 'Place') {
        const p = placeHandle(v);
        if (!p) throw gameErr('placeUnknown', { name: String(v.id) });
        return p;
      }
      const e = entityOf(v);
      const t = tileOfE(e);
      return { x: t.x, y: t.y, r: e.kind === 'building' ? Math.max(e.w, e.h) >> 1 : 0 };
    }
    if (v instanceof PyTuple || v instanceof PyList) {
      const [x, y, r = 0] = v.items.map((a) => Math.trunc(Number(num(a))));
      return { x, y, r };
    }
    if (typeof v === 'string') {
      const p = placeByName(v);
      if (!p) throw gameErr('placeUnknown', { name: v, suggestion: suggest(v, Object.keys(host.places)) });
      return p;
    }
    throw new ScriptError('type', { what: 'targetNeeded', type: typeName(v) });
  };

  const placeHandle = (h) => {
    const id = String(h.id);
    if (id.startsWith('@')) {
      const [x, y, r] = id.slice(1).split(',').map(Number);
      return { x, y, r: r ?? 0 };
    }
    return placeByName(id);
  };
  const pointPlace = (x, y, r = 0) => new PyHost('Place', `@${x},${y},${r}`);

  const tileInfo = (x, y) => {
    const m = sim().map;
    if (!m.inBounds(x, y)) return 'edge';
    const k = m.idx(x, y), f = m.flags[k];
    if (f & CLIFF) return 'cliff';
    if (f & OCCUPIED) {
      const e = sim().entities.get(m.owner[k]);
      return e?.kind === 'tree' ? 'tree' : e?.kind === 'pile' ? 'pile' : e?.kind === 'ruin' ? 'ruin' : 'building';
    }
    if (f & WATER) return m.frozen ? 'ice' : 'water';
    return 'free';
  };

  /** Execute a sim command as a player; rejection becomes a GameError with the simulation's reason. */
  const command = (cmd) => {
    const s = sim();
    const before = s.events.length;
    const ok = s.applyCommand({ ...cmd, player: cmd.player ?? human() });
    if (ok) return true;
    const rej = s.events.slice(before).reverse().find((e) => e.type === 'rejected');
    throw new ScriptError('game', { reason: rej?.reason ?? 'err.unknownCommand', reasonParams: rej?.params ?? {} });
  };

  const intArg = (v, name) => {
    if (!isNum(v)) throw new ScriptError('type', { what: 'numberNeeded', name, type: typeName(v) });
    return Math.trunc(Number(num(v)));
  };
  const secondsArg = (v, name = 'seconds') => {
    if (!isNum(v)) throw new ScriptError('type', { what: 'numberNeeded', name, type: typeName(v) });
    return Math.max(0, Math.round(Number(num(v)) * T));
  };
  const strArg = (v, name) => {
    if (typeof v !== 'string') throw new ScriptError('type', { what: 'strNeeded', name, type: typeName(v) });
    return v;
  };
  const listOfHandles = (v) => (v instanceof PyList || v instanceof PyTuple ? v.items : [v]);
  const sortedEntities = (filter) => [...sim().entities.values()].filter(filter).sort((a, b) => a.id - b.id).map(handle);

  /** Several named/positional arguments (as in builtins.js, but more concise). */
  const args = (fname, a, kw, names) => {
    const plain = names.map((n) => n.replace(/^\?/, ''));
    if (a.length > names.length) throw new ScriptError('argCount', { name: fname, max: names.length, given: a.length });
    const out = names.map((_, i) => a[i]);
    for (const k of Object.keys(kw)) {
      const i = plain.indexOf(k);
      if (i < 0) throw new ScriptError('argUnexpected', { name: fname, arg: k, suggestion: suggest(k, plain) });
      out[i] = kw[k];
    }
    names.forEach((n, i) => { if (out[i] === undefined && !n.startsWith('?')) throw new ScriptError('argMissing', { name: fname, arg: plain[i] }); });
    return out;
  };

  const resArg = (r) => {
    const s = strArg(r, 'res');
    if (!RESOURCES.includes(s)) throw gameErr('resUnknown', { name: s, suggestion: suggest(s, RESOURCES) });
    return s;
  };
  const buildingArg = (k) => {
    const s = strArg(k, 'kind');
    if (!hasKey(BUILDINGS, s)) throw gameErr('buildingUnknown', { name: s, suggestion: suggest(s, Object.keys(BUILDINGS)) });
    return s;
  };

  /** Call a Python function with as many arguments as it has parameters. */
  const fitArgs = (fn, list) => {
    if (!(fn instanceof PyFunction)) return list;
    const c = host.vmOf(level).codes[fn.code];
    return c.vararg ? list : list.slice(0, c.params.length);
  };

  // ---------- Waiting ----------

  const natives = {};
  const def = (name, fn, mission = false) => { if (!mission || isMission) natives[name] = fn; };

  def('wait', (ctx, a, kw) => {
    const [s] = args('wait', a, kw, ['seconds']);
    return new Suspend({ k: 't', until: sim().tick + Math.max(1, secondsArg(s)) });
  });
  def('wait_until', (ctx, a, kw) => {
    const [fn, timeout] = args('wait_until', a, kw, ['condition', '?timeout']);
    if (!(fn instanceof PyFunction || fn instanceof PyBuiltin || fn instanceof PyPartial)) throw new ScriptError('type', { what: 'callableNeeded', type: typeName(fn) });
    if (truthy(ctx.vm.callSync(fn, [], null, ctx.task))) return true;
    return new Suspend({ k: 'until', fn, until: timeout === undefined || timeout === null ? -1 : sim().tick + secondsArg(timeout, 'timeout') });
  });
  def('time', () => new PyFloat(sim().tick / T));

  // ---------- Places and reading the world ----------

  def('place', (ctx, a, kw) => {
    const [n] = args('place', a, kw, ['name']);
    const name = strArg(n, 'name');
    if (!placeByName(name)) throw gameErr('placeUnknown', { name, suggestion: suggest(name, Object.keys(host.places)) });
    return new PyHost('Place', name);
  });
  def('places', () => new PyList(Object.keys(host.places).sort()));
  def('tile', (ctx, a, kw) => {
    const [x, y] = args('tile', a, kw, ['x', 'y']);
    return tileInfo(intArg(x, 'x'), intArg(y, 'y'));
  });
  def('distance', (ctx, a, kw) => {
    const [p, q] = args('distance', a, kw, ['a', 'b']);
    const A = pt(p), B = pt(q);
    return new PyFloat(Math.sqrt((A.x - B.x) ** 2 + (A.y - B.y) ** 2));
  });
  const near = (kind) => (ctx, a, kw) => {
    const [t, r = 6, res] = args(`${kind}s_near`, a, kw, ['target', '?radius', '?res']);
    const c = pt(t), R = intArg(r, 'radius');
    const want = res === undefined || res === null ? null : resArg(res);
    return new PyList([...sim().entities.values()]
      .filter((e) => e.kind === kind && (!want || e.res === want) && (e.x - c.x) ** 2 + (e.y - c.y) ** 2 <= R * R)
      .sort((p, q) => ((p.x - c.x) ** 2 + (p.y - c.y) ** 2) - ((q.x - c.x) ** 2 + (q.y - c.y) ** 2) || p.id - q.id)
      .map(handle));
  };
  def('trees_near', near('tree'));
  def('piles_near', near('pile'));

  // ---------- Village ----------

  def('stock', (ctx, a, kw) => {
    const [r, p] = args('stock', a, kw, ['res', '?player']);
    return sim().available(isMission ? playerOf(p) : human(), resArg(r));
  });
  def('count', (ctx, a, kw) => {
    const [k, p] = args('count', a, kw, ['kind', '?player']);
    const kind = strArg(k, 'kind');
    const pl = isMission ? playerOf(p) : human();
    const s = sim();
    if (kind === 'serf') return s.countUnits(pl);
    let n = 0;
    for (const e of s.entities.values()) {
      if (e.owner !== pl) continue;
      if (kind === 'worker' && e.kind === 'worker') n++;
      else if (kind === 'troop' && e.kind === 'leader') n++;
      else if (kind === 'soldier' && (e.kind === 'leader' || e.kind === 'soldier')) n++;
      else if (e.kind === 'building' && e.type === kind && e.done) n++;
    }
    if (n === 0 && !['worker', 'troop', 'soldier'].includes(kind) && !hasKey(BUILDINGS, kind)) {
      throw gameErr('kindUnknown', { name: kind, suggestion: suggest(kind, [...Object.keys(BUILDINGS), 'serf', 'worker', 'troop', 'soldier']) });
    }
    return n;
  });
  def('serfs', (ctx, a, kw) => {
    const [idle = false, p] = args('serfs', a, kw, ['?idle', '?player']);
    const pl = isMission ? playerOf(p) : human();
    return new PyList(sortedEntities((e) => e.kind === 'unit' && e.owner === pl && (!truthy(idle) || (!e.job && !e.path.length))));
  });
  def('troops', (ctx, a, kw) => {
    const [p] = args('troops', a, kw, ['?player']);
    const pl = isMission ? playerOf(p) : human();
    return new PyList(sortedEntities((e) => e.kind === 'leader' && e.owner === pl));
  });
  def('buildings', (ctx, a, kw) => {
    const [k, p] = args('buildings', a, kw, ['?kind', '?player']);
    const pl = isMission ? playerOf(p) : human();
    const kind = k === undefined || k === null ? null : buildingArg(k);
    return new PyList(sortedEntities((e) => e.kind === 'building' && e.owner === pl && (!kind || e.type === kind)));
  });
  def('hq', (ctx, a, kw) => {
    const [p] = args('hq', a, kw, ['?player']);
    const b = sim().findBuilding(isMission ? playerOf(p) : human(), 'headquarters');
    return b ? handle(b) : null;
  });
  def('find_spot', (ctx, a, kw) => {
    const [k, nearV, r = 20] = args('find_spot', a, kw, ['kind', 'near', '?radius']);
    const kind = buildingArg(k);
    const c = pt(nearV);
    const p = sim().findPlacement(human(), kind, c.x, c.y, intArg(r, 'radius'));
    return p ? new PyTuple([p.x, p.y]) : null;
  });
  def('can_build', (ctx, a, kw) => {
    const [k, x, y] = args('can_build', a, kw, ['kind', 'x', 'y']);
    return sim().checkPlacement(human(), buildingArg(k), intArg(x, 'x'), intArg(y, 'y')) === null;
  });
  def('build', (ctx, a, kw) => {
    const [k, x, y] = args('build', a, kw, ['kind', 'x', 'y']);
    const kind = buildingArg(k);
    const s = sim();
    const before = s.nextId;
    command({ type: 'placeBuilding', building: kind, x: intArg(x, 'x'), y: intArg(y, 'y') });
    const b = [...s.entities.values()].find((e) => e.id >= before && e.kind === 'building');
    return b ? handle(b) : null;
  });
  def('buy_serf', (ctx, a, kw) => {
    const [n = 1] = args('buy_serf', a, kw, ['?count']);
    command({ type: 'buySerf', count: intArg(n, 'count') });
    return null;
  });

  // ---------- Missions: staging ----------

  def('say', (ctx, a, kw) => {
    const [speaker, text, seconds, voice] = args('say', a, kw, ['speaker', 'text', '?seconds', '?voice']);
    const dur = host.say(speaker === null ? null : strArg(speaker, 'speaker'), text, seconds === undefined || seconds === null ? null : secondsArg(seconds), voice ?? null);
    return new Suspend({ k: 'dialog', until: sim().tick + dur });
  }, true);
  def('message', (ctx, a, kw) => {
    const [text] = args('message', a, kw, ['text']);
    host.say(null, text, null, null);
    return null;
  }, true);
  def('camera.jump_to', (ctx, a, kw) => {
    const [t] = args('jump_to', a, kw, ['target']);
    const p = pt(t);
    host.camera(p.x, p.y, 0);
    return null;
  }, true);
  def('camera.fly_to', (ctx, a, kw) => {
    const [t, s = 2] = args('fly_to', a, kw, ['target', '?seconds']);
    const p = pt(t);
    const ticks = secondsArg(s);
    host.camera(p.x, p.y, ticks);
    return ticks ? new Suspend({ k: 't', until: sim().tick + ticks }) : null;
  }, true);
  def('reveal', (ctx, a, kw) => {
    const [t, r, s = 30, p] = args('reveal', a, kw, ['target', '?radius', '?seconds', '?player']);
    const c = pt(t);
    revealArea(sim(), playerOf(p), c.x, c.y, r === undefined || r === null ? Math.max(6, c.r + 4) : intArg(r, 'radius'), secondsArg(s));
    return null;
  }, true);

  // ---------- Missions: events ----------

  /** Decorator: @on_x or @on_x(filter…). Registers (kind, fn, filter) in the VM variable .handlers. */
  const decorator = (kind, names) => (ctx, a, kw) => {
    const last = a[a.length - 1];
    if (last instanceof PyFunction && Object.keys(kw).length === 0) {
      const filt = args(kind, a.slice(0, -1), {}, names.map((n) => (n.startsWith('?') ? n : `?${n}`)));
      host.register(ctx.vm, kind, last, Object.fromEntries(names.map((n, i) => [n.replace(/^\?/, ''), filt[i] ?? null])));
      return last;
    }
    if (last instanceof PyPartial || last instanceof PyBuiltin) throw new ScriptError('type', { what: 'decoratorFunction' });
    // With filters: the function follows when decorating
    const fil = args(kind, a, kw, names.map((n) => (n.startsWith('?') ? n : `?${n}`)));
    return new PyPartial(new PyBuiltin(kind), fil.map((v) => (v === undefined ? null : v)), []);
  };
  def('on_start', decorator('on_start', []), true);
  def('every', decorator('every', ['seconds']), true);
  def('on_building_done', decorator('on_building_done', ['?kind', '?player']), true);
  def('on_building_placed', decorator('on_building_placed', ['?kind', '?player']), true);
  def('on_destroyed', decorator('on_destroyed', ['?kind', '?owner']), true);
  def('on_killed', decorator('on_killed', ['?owner']), true);
  def('on_recruited', decorator('on_recruited', ['?player']), true);
  def('on_research', decorator('on_research', ['?tech', '?player']), true);
  def('on_enter', decorator('on_enter', ['target', '?who', '?player']), true);
  def('on_objective', decorator('on_objective', ['id', '?status']), true);
  def('on_weather', decorator('on_weather', ['?state']), true);

  // ---------- Missions: goals ----------

  def('objective', (ctx, a, kw) => {
    const [id, text, cond = null, primary = true, hidden = false] = args('objective', a, kw, ['id', 'text', '?condition', '?primary', '?hidden']);
    host.addObjective(ctx.vm, strArg(id, 'id'), text, cond, truthy(primary), truthy(hidden));
    return id;
  }, true);
  const objectiveAction = (name, action) => def(name, (ctx, a, kw) => {
    const [id] = args(name, a, kw, ['id']);
    host.objectiveAction(action, strArg(id, 'id'));
    return null;
  }, true);
  objectiveAction('complete', 'complete');
  objectiveAction('fail', 'fail');
  objectiveAction('show_objective', 'reveal');
  def('victory', (ctx, a, kw) => {
    const [r] = args('victory', a, kw, ['?reason']);
    host.runtime.finish(sim(), true, r ? strArg(r, 'reason') : 'script');
    return null;
  }, true);
  def('defeat', (ctx, a, kw) => {
    const [r] = args('defeat', a, kw, ['?reason']);
    host.runtime.finish(sim(), false, r ? strArg(r, 'reason') : 'script');
    return null;
  }, true);

  // ---------- Missions: intervening ----------

  def('spawn', (ctx, a, kw) => {
    const [o, k, at, n = 1, soldiers] = args('spawn', a, kw, ['owner', 'kind', 'at', '?count', '?soldiers']);
    const owner = playerOf(o);
    const kind = strArg(k, 'kind');
    if (!hasKey(UNITS, kind)) throw gameErr('unitUnknown', { name: kind, suggestion: suggest(kind, Object.keys(UNITS)) });
    const c = pt(at);
    const out = [];
    const count = intArg(n, 'count');
    for (let i = 0; i < count; i++) {
      const L = sapi.spawnTroop(sim(), owner, kind, { x: c.x + ((i % 3) - 1) * 3, y: c.y + Math.trunc(i / 3) * 3 }, soldiers === undefined || soldiers === null ? undefined : intArg(soldiers, 'soldiers'));
      if (L) out.push(handle(L));
    }
    sim().events.push({ type: 'wave', owner, count: out.length, player: human() });
    return new PyList(out);
  }, true);
  def('spawn_serfs', (ctx, a, kw) => {
    const [p, n] = args('spawn_serfs', a, kw, ['player', 'count']);
    const pl = playerOf(p), out = [];
    for (let i = 0; i < intArg(n, 'count'); i++) { const u = sim().spawnSerf(pl); if (u) out.push(handle(u)); }
    return new PyList(out);
  }, true);
  def('give', (ctx, a, kw) => {
    const [p] = args('give', a, {}, ['player']);
    const pl = sim().players[playerOf(p)];
    for (const k of Object.keys(kw)) {
      const r = resArg(k);
      pl.stock[r] = Math.max(0, pl.stock[r] + intArg(kw[k], k));
    }
    return null;
  }, true);
  def('set_diplomacy', (ctx, a, kw) => {
    const [pa, pb, st] = args('set_diplomacy', a, kw, ['a', 'b', 'state']);
    const state = strArg(st, 'state');
    if (!['allied', 'neutral', 'hostile'].includes(state)) throw gameErr('diplomacyUnknown', { name: state });
    sim().setDiplomacy(playerOf(pa), playerOf(pb), state);
    return null;
  }, true);
  def('diplomacy', (ctx, a, kw) => {
    const [pa, pb] = args('diplomacy', a, kw, ['a', 'b']);
    return sim().relation(playerOf(pa), playerOf(pb));
  });
  def('give_tech', (ctx, a, kw) => {
    if (!a.length) throw new ScriptError('argMissing', { name: 'give_tech', arg: 'player' });
    const pl = playerOf(a[0]);
    for (const t of a.slice(1)) {
      const id = strArg(t, 'tech');
      if (!TECHS[id] && !BUILDING_TECHS[id]) throw gameErr('techUnknown', { name: id, suggestion: suggest(id, [...Object.keys(TECHS), ...Object.keys(BUILDING_TECHS)]) });
      sapi.giveTechs(sim(), pl, [id]);
    }
    return null;
  }, true);
  def('place_building', (ctx, a, kw) => {
    const [p, k, nearV, done = true] = args('place_building', a, kw, ['player', 'kind', 'near', '?done']);
    const kind = buildingArg(k);
    const c = pt(nearV);
    const b = sapi.placeBuilding(sim(), playerOf(p), kind, c, { minR: 0, radius: 20, done: truthy(done) });
    if (!b) throw gameErr('noSpace', { kind });
    return handle(b);
  }, true);
  def('remove', (ctx, a, kw) => {
    const [h] = args('remove', a, kw, ['thing']);
    for (const x of listOfHandles(h)) host.removeEntity(entityOf(x, false));
    return null;
  }, true);
  const order = (name, ord) => def(name, (ctx, a, kw) => {
    const [u, t] = args(name, a, kw, ['units', 'target']);
    const es = listOfHandles(u).map((x) => entityOf(x, false)).filter(Boolean);
    if (!es.length) return null;
    const c = pt(t);
    const byOwner = new Map();
    for (const e of es) (byOwner.get(e.owner) ?? byOwner.set(e.owner, []).get(e.owner)).push(e.id);
    for (const [owner, ids] of byOwner) {
      if (ord === 'attack' && t instanceof PyHost && t.cls !== 'Place') sim().applyCommand({ type: 'order', player: owner, units: ids, order: 'attack', target: t.id });
      else sim().applyCommand({ type: 'order', player: owner, units: ids, order: ord === 'attack' ? 'attackMove' : 'move', x: c.x, y: c.y });
    }
    return null;
  }, true);
  order('attack', 'attack');
  order('move', 'move');
  def('units_in', (ctx, a, kw) => {
    const [t, p, who = 'any'] = args('units_in', a, kw, ['target', '?player', '?who']);
    const c = pt(t);
    return new PyList(sapi.unitsInArea(sim(), playerOf(p), { ...c, r: Math.max(1, c.r) }, strArg(who, 'who')).sort((x, y) => x.id - y.id).map(handle));
  }, true);
  def('alive', (ctx, a, kw) => {
    const [u] = args('alive', a, kw, ['units']);
    return listOfHandles(u).filter((x) => alive(entityOf(x, false))).length;
  }, true);
  def('hero_of', (ctx, a, kw) => {
    const [p, n = null] = args('hero_of', a, kw, ['player', '?name']);
    const pl = playerOf(p);
    const name = n === null ? null : strArg(n, 'name');
    const h = [...sim().entities.values()].find((e) => e.kind === 'hero' && e.owner === pl && (name === null || e.hero === name));
    return h ? handle(h) : null;
  }, true);
  def('set_weather', (ctx, a, kw) => {
    const [s, sec = 120] = args('set_weather', a, kw, ['state', '?seconds']);
    const state = strArg(s, 'state');
    if (!['summer', 'rain', 'winter'].includes(state)) throw gameErr('weatherUnknown', { name: state });
    sim().setWeather(state, secondsArg(sec));
    return null;
  }, true);
  def('ai', (ctx, a, kw) => {
    const [p, difficulty, aggression, startIn, attackNow = false] = args('ai', a, kw, ['player', '?difficulty', '?aggression', '?start_in', '?attack_now']);
    const act = { type: 'ai', player: playerOf(p) };
    if (difficulty) act.difficulty = strArg(difficulty, 'difficulty');
    if (aggression) act.aggression = strArg(aggression, 'aggression');
    if (startIn !== undefined && startIn !== null) act.startIn = Number(num(startIn));
    if (truthy(attackNow)) act.attackNow = true;
    host.runtime.runAction(sim(), act);
    return null;
  }, true);

  // ---------- Missions: terrain ----------

  def('make_place', (ctx, a, kw) => {
    const [n, x, y, r = 3] = args('make_place', a, kw, ['name', 'x', 'y', '?r']);
    const name = strArg(n, 'name');
    host.places[name] = { x: intArg(x, 'x'), y: intArg(y, 'y'), r: intArg(r, 'r') };
    return new PyHost('Place', name);
  }, true);
  def('find_open', (ctx, a, kw) => {
    const [t, minR = 0, maxR = 24] = args('find_open', a, kw, ['near', '?min_r', '?max_r']);
    const c = pt(t);
    const p = sapi.findOpen(sim(), c.x, c.y, { minR: intArg(minR, 'min_r'), maxR: intArg(maxR, 'max_r') });
    return p ? pointPlace(p.x, p.y, 1) : null;
  }, true);
  def('toward', (ctx, a, kw) => {
    const [p, q, d] = args('toward', a, kw, ['a', 'b', 'distance']);
    const r = sapi.toward(pt(p), pt(q), intArg(d, 'distance'));
    return pointPlace(r.x, r.y, 2);
  }, true);
  def('map_center', () => pointPlace(sim().map.width >> 1, sim().map.height >> 1, 4), true);
  def('plant_trees', (ctx, a, kw) => {
    const [t, n, r = 5] = args('plant_trees', a, kw, ['target', 'count', '?radius']);
    const c = pt(t);
    const k = sapi.plantTrees(sim(), c, intArg(n, 'count'), intArg(r, 'radius'));
    host.natureChanged();
    return k;
  }, true);
  def('add_tree', (ctx, a, kw) => {
    const [x, y] = args('add_tree', a, kw, ['x', 'y']);
    const tx = intArg(x, 'x'), ty = intArg(y, 'y');
    if (!sim().map.rectFree(tx, ty, 1, 1)) return null;
    const n = sim().addNode('tree', tx, ty, 'wood', BALANCE.tree.wood);
    host.natureChanged();
    return n ? handle(n) : null;
  }, true);
  def('add_pile', (ctx, a, kw) => {
    const [r, x, y, amount] = args('add_pile', a, kw, ['res', 'x', 'y', '?amount']);
    const res = resArg(r);
    const tx = intArg(x, 'x'), ty = intArg(y, 'y');
    if (!sim().map.walkable(tx, ty)) return null;
    const n = sim().addNode('pile', tx, ty, res, amount === undefined || amount === null ? BALANCE.pile.amount : intArg(amount, 'amount'));
    if (n) sim().map.reserve(tx, ty, 1, 1);
    host.natureChanged();
    return n ? handle(n) : null;
  }, true);
  def('clear_area', (ctx, a, kw) => {
    const [t, r] = args('clear_area', a, kw, ['target', 'radius']);
    const c = pt(t);
    const R = intArg(r, 'radius');
    for (const e of [...sim().entities.values()]) {
      if ((e.kind === 'tree' || e.kind === 'pile') && sapi.dist(e, c) <= R) host.removeEntity(e);
    }
    return null;
  }, true);

  // world.*: read and shape terrain (missions, world building)
  const inMap = (x, y) => {
    if (!sim().map.inBounds(x, y)) throw gameErr('outside', { x, y });
    return sim().map.idx(x, y);
  };
  def('world.height_at', (ctx, a, kw) => {
    const [x, y] = args('height_at', a, kw, ['x', 'y']);
    return sim().map.heights[inMap(intArg(x, 'x'), intArg(y, 'y'))];
  }, true);
  def('world.set_height', (ctx, a, kw) => {
    const [x, y, h] = args('set_height', a, kw, ['x', 'y', 'h']);
    const tx = intArg(x, 'x'), ty = intArg(y, 'y');
    sim().map.heights[inMap(tx, ty)] = Math.max(-5000, Math.min(10000, intArg(h, 'h')));
    host.terrainChanged(tx, ty);
    return null;
  }, true);
  const setFlag = (name, flag) => def(`world.${name}`, (ctx, a, kw) => {
    const [x, y, on = true] = args(name, a, kw, ['x', 'y', '?on']);
    const tx = intArg(x, 'x'), ty = intArg(y, 'y');
    const k = inMap(tx, ty);
    const m = sim().map;
    if (truthy(on)) {
      // Trees and piles on the tile disappear
      const e = sim().entities.get(m.owner[k]);
      if (e && (e.kind === 'tree' || e.kind === 'pile')) host.removeEntity(e);
      if (m.flags[k] & OCCUPIED) return null;
      m.flags[k] |= flag;
      if (flag === WATER) m.heights[k] = Math.min(m.heights[k], sim().waterLevel - 220);
    } else {
      m.flags[k] &= ~flag;
      if (flag === WATER) m.heights[k] = Math.max(m.heights[k], sim().waterLevel + 80);
    }
    m.version++;
    host.terrainChanged(tx, ty);
    return null;
  }, true);
  setFlag('set_water', WATER);
  setFlag('set_cliff', CLIFF);
  def('world.is_water', (ctx, a, kw) => {
    const [x, y] = args('is_water', a, kw, ['x', 'y']);
    return !!(sim().map.flags[inMap(intArg(x, 'x'), intArg(y, 'y'))] & WATER);
  }, true);
  def('world.noise', (ctx, a, kw) => {
    const [x, y, cell = 16, seed = 0] = args('noise', a, kw, ['x', 'y', '?cell', '?seed']);
    return valueNoise(intArg(x, 'x'), intArg(y, 'y'), Math.max(1, intArg(cell, 'cell')), (sim().seed + intArg(seed, 'seed')) | 0);
  }, true);

  // ---------- Predefined names ----------

  const globals = {};
  for (const name of Object.keys(natives)) if (!name.includes('.')) globals[name] = new PyBuiltin(name);
  if (isMission) {
    globals.camera = new PyModule('camera');
    globals.world = new PyModule('world');
  }
  const consts = () => {
    const ai = host.runtime.def.players.findIndex((p) => p.kind === 'ai');
    return { HUMAN: human(), ENEMY: ai, BANDITS: host.runtime.state.bandits };
  };
  const heroEntity = () => [...sim().entities.values()].find((e) => e.kind === 'hero' && e.owner === human());
  // Every hero also under their name (nelia, orrin …): own first, otherwise that of another player
  const heroNamed = (id) => {
    let other = null;
    for (const e of sim().entities.values()) {
      if (e.kind !== 'hero' || e.hero !== id) continue;
      if (e.owner === human()) return e;
      other ??= e;
    }
    return other;
  };
  const dynamicGlobals = () => {
    const c = consts();
    const out = { ...c };
    const h = heroEntity();
    out.hero = h ? handle(h) : null;
    for (const id of HERO_IDS) { const e = heroNamed(id); out[id] = e ? handle(e) : null; }
    return out;
  };

  const modules = isMission ? {
    camera: ['jump_to', 'fly_to'],
    world: ['width', 'height', 'water_level', 'height_at', 'set_height', 'set_water', 'set_cliff', 'is_water', 'noise'],
  } : {};

  // ---------- Methods and properties of the handles ----------

  const methodsOf = (cls) => [...(METHODS[cls]?.player ?? []), ...(isMission ? METHODS[cls]?.mission ?? [] : [])];
  const propsOf = (cls) => [...(cls === 'Place' ? [] : PROPS.common), ...(PROPS[cls] ?? [])];

  const hostHooks = {
    modules,
    moduleAttr(mod, name) {
      if (mod === 'world') {
        const m = sim().map;
        if (name === 'width') return m.width;
        if (name === 'height') return m.height;
        if (name === 'water_level') return sim().waterLevel;
      }
      if (modules[mod]?.includes(name) && natives[`${mod}.${name}`]) return new PyBuiltin(`${mod}.${name}`);
      return undefined;
    },
    dir(obj) { return [...propsOf(obj.cls), ...methodsOf(obj.cls)]; },
    repr(obj) {
      if (obj.cls === 'Place') {
        const p = placeHandle(obj);
        return String(obj.id).startsWith('@') ? `<Place ${p?.x}, ${p?.y}>` : `<Place '${obj.id}'>`;
      }
      const e = sim()?.entities.get(obj.id);
      if (!e) return `<${obj.cls} ${obj.id} (gone)>`;
      const t = tileOfE(e);
      const what = e.kind === 'building' ? e.type : e.kind === 'hero' ? e.hero : e.kind === 'leader' ? e.def : e.res ?? '';
      return `<${obj.cls}${what ? ' ' + what : ''} at ${t.x}, ${t.y}>`;
    },
    getattr(ctx, obj, name) {
      if (methodsOf(obj.cls).includes(name)) return new PyBoundMethod(obj, name);
      if (obj.cls === 'Place') {
        const p = placeHandle(obj);
        if (!p) throw gameErr('placeUnknown', { name: String(obj.id) });
        if (name === 'x') return p.x;
        if (name === 'y') return p.y;
        if (name === 'r') return p.r;
        if (name === 'name') return String(obj.id).startsWith('@') ? null : obj.id;
        return undefined;
      }
      const e = sim().entities.get(obj.id);
      if (name === 'alive') return alive(e);
      if (name === 'id') return obj.id;
      if (!e) throw gameErr('gone', { what: obj.cls });
      const t = tileOfE(e);
      switch (name) {
        case 'kind': return e.kind === 'unit' ? 'serf' : e.kind === 'leader' ? 'troop' : e.kind;
        case 'owner': return e.owner ?? null;
        case 'x': return t.x;
        case 'y': return t.y;
        case 'hp': return e.hp ?? null;
        default: break;
      }
      switch (obj.cls) {
        case 'Hero':
          if (name === 'name') return e.hero;
          if (name === 'facing') return DIR_NAMES[e.face ?? 1];
          if (name === 'down') return !!e.down;
          break;
        case 'Troop':
          if (name === 'type') return e.def;
          if (name === 'soldiers') return e.soldiers.length;
          break;
        case 'Serf':
          if (name === 'idle') return !e.job && !e.path.length;
          if (name === 'job') return e.job?.kind ?? null;
          break;
        case 'Worker':
          if (name === 'profession') return e.prof;
          break;
        case 'Building':
          if (name === 'type') return e.type;
          if (name === 'level') return e.level;
          if (name === 'done') return e.done;
          if (name === 'w') return e.w;
          if (name === 'h') return e.h;
          break;
        case 'Tree': case 'Pile':
          if (name === 'res') return e.res;
          if (name === 'amount') return e.amount;
          break;
        default: break;
      }
      return undefined;
    },
    setattr() { return false; },
    callMethod(ctx, obj, name, a, kw) {
      if (!methodsOf(obj.cls).includes(name)) throw new ScriptError('attr', { type: obj.cls, name, suggestion: suggest(name, methodsOf(obj.cls)) });
      if (name === 'distance_to') {
        const [t] = args(name, a, kw, ['target']);
        const A = pt(obj), B = pt(t);
        return new PyFloat(Math.sqrt((A.x - B.x) ** 2 + (A.y - B.y) ** 2));
      }
      if (obj.cls === 'Place') {
        if (name === 'contains') {
          const [t] = args(name, a, kw, ['target']);
          const P = pt(obj), Q = pt(t);
          return (P.x - Q.x) ** 2 + (P.y - Q.y) ** 2 <= Math.max(0, P.r) ** 2;
        }
      }
      const e = entityOf(obj);
      if (!isMission && e.owner !== human()) throw gameErr('notYours', {});
      return unitMethod(ctx, e, obj, name, a, kw);
    },
  };

  // ---------- Methods of the game objects ----------

  const isAt = (e, t) => {
    const c = pt(t);
    const p = tileOfE(e);
    return (p.x - c.x) ** 2 + (p.y - c.y) ** 2 <= c.r * c.r;
  };

  /** Send a figure to a tile and wait until it is there (or cannot get further). */
  const walk = (e, x, y, mode) => {
    const s = sim();
    const face = e.face, from = tileOfE(e);
    if (e.kind === 'unit') command({ type: 'move', units: [e.id], x, y, player: e.owner });
    else command({ type: 'order', units: [e.id], order: 'move', x, y, player: e.owner });
    // Steps keep the look direction
    if (mode === 'step' && face !== undefined) e.face = face;
    return new Suspend({ k: 'walk', id: e.id, x, y, sx: from.x, sy: from.y, mode, until: s.tick + 60 * T });
  };

  function unitMethod(ctx, e, obj, name, a, kw) {
    const s = sim();
    switch (name) {
      case 'step': {
        const [n = 1] = args('step', a, kw, ['?n']);
        const steps = intArg(n, 'n');
        if (steps < 1) return null;
        const d = DIRS[e.face ?? 1];
        const p = tileOfE(e);
        const tx = p.x + d[0], ty = p.y + d[1];
        const what = tileInfo(tx, ty);
        if (what !== 'free' && what !== 'ice') throw gameErr('blocked', { what });
        if (e.down) throw gameErr('heroDown', {});
        const r = walk(e, tx, ty, 'step');
        if (steps > 1) r.wait.more = steps - 1;
        return r;
      }
      case 'turn_left': case 'turn_right': {
        args(name, a, kw, []);
        e.face = ((e.face ?? 1) + (name === 'turn_left' ? 3 : 1)) % 4;
        return new Suspend({ k: 't', until: s.tick + 3 });
      }
      case 'turn_to': {
        const [dirV] = args(name, a, kw, ['direction']);
        const dir = DIR_NAMES.indexOf(strArg(dirV, 'direction'));
        if (dir < 0) throw gameErr('dirUnknown', { name: dirV, suggestion: suggest(dirV, DIR_NAMES) });
        e.face = dir;
        return new Suspend({ k: 't', until: s.tick + 3 });
      }
      case 'ahead': case 'can_step': {
        args(name, a, kw, []);
        const d = DIRS[e.face ?? 1];
        const p = tileOfE(e);
        const what = tileInfo(p.x + d[0], p.y + d[1]);
        return name === 'ahead' ? what : what === 'free' || what === 'ice';
      }
      case 'move_to': {
        const [t, w = true] = args(name, a, kw, ['target', '?wait']);
        const c = pt(t);
        if (e.kind === 'building') throw gameErr('cannotMove', {});
        if (truthy(w)) return walk(e, c.x, c.y, 'move');
        if (e.kind === 'unit') command({ type: 'move', units: [e.id], x: c.x, y: c.y, player: e.owner });
        else command({ type: 'order', units: [e.id], order: 'move', x: c.x, y: c.y, player: e.owner });
        return null;
      }
      case 'is_at': { const [t] = args(name, a, kw, ['target']); return isAt(e, t); }
      case 'take': case 'chop': {
        args(name, a, kw, []);
        const d = DIRS[e.face ?? 1];
        const p = tileOfE(e);
        const tx = p.x + d[0], ty = p.y + d[1];
        const m = s.map;
        const node = m.inBounds(tx, ty) ? s.entities.get(m.owner[m.idx(tx, ty)]) : null;
        const want = name === 'take' ? 'pile' : 'tree';
        if (!node || node.kind !== want) throw gameErr(name === 'take' ? 'noPile' : 'noTree', { what: tileInfo(tx, ty) });
        const res = node.res, amount = name === 'take' ? node.amount : (BALANCE.tree.wood ?? 1);
        host.removeEntity(node);
        const pl = s.players[e.owner];
        if (pl && RESOURCES.includes(res)) pl.stock[res] += amount;
        return new Suspend({ k: 't', until: s.tick + (name === 'chop' ? 15 : 5), value: res });
      }
      case 'say': {
        const [text] = args(name, a, kw, ['text']);
        const dur = host.say(e.kind === 'hero' ? e.hero : null, text, null, null, true);
        return new Suspend({ k: 'dialog', until: s.tick + Math.min(dur, 30) });
      }
      case 'work_on': {
        const [t] = args(name, a, kw, ['target']);
        const target = entityOf(t);
        command({ type: 'assignWork', units: [e.id], target: target.id, player: e.owner });
        return null;
      }
      case 'attack': {
        const [t] = args(name, a, kw, ['target']);
        if (t instanceof PyHost && t.cls !== 'Place') command({ type: 'order', units: [e.id], order: 'attack', target: entityOf(t).id, player: e.owner });
        else { const c = pt(t); command({ type: 'order', units: [e.id], order: 'attackMove', x: c.x, y: c.y, player: e.owner }); }
        return null;
      }
      case 'upgrade': {
        args(name, a, kw, []);
        command({ type: 'upgradeBuilding', building: e.id, player: e.owner });
        return null;
      }
      case 'teleport': {
        const [t] = args(name, a, kw, ['target']);
        const c = pt(t);
        if (e.px === undefined) throw gameErr('cannotMove', {});
        e.px = tileCenter(c.x); e.py = tileCenter(c.y); e.path = [];
        if (e.order) e.order = { type: 'idle' };
        if (e.anchor) e.anchor = { x: e.px, y: e.py };
        return null;
      }
      case 'kill': {
        args(name, a, kw, []);
        host.removeEntity(e);
        return null;
      }
      default: throw new ScriptError('attr', { type: obj.cls, name });
    }
  }

  const known = [...Object.keys(globals), 'HUMAN', 'ENEMY', 'BANDITS', 'hero', ...HERO_IDS];
  return { natives, globals, dynamicGlobals, hostHooks, known, modules };
}
