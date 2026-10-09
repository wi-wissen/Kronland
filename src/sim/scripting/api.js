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
  PyBuiltin, PyHost, PyPartial, PyList, PyTuple, PyDict, PyFloat, PyFunction, PyModule, PyBoundMethod, Suspend, ScriptError,
  iterItems, isNum, num, typeName, truthy, suggest,
} from '../../script/index.js';
import { BUILDINGS } from '../data/buildings.js';
import { UNITS, HERO_IDS } from '../data/units.js';
import { RESOURCES } from '../data/resources.js';
import { TECHS } from '../data/technologies.js';
import { BUILDING_TECHS } from '../data/buildingTechs.js';
import { BALANCE } from '../data/balance.js';
import { WATER, CLIFF, OCCUPIED } from '../map.js';
import { TICKS_PER_SECOND, tileCenter, toTile, UNIT } from '../fixed.js';
import { valueNoise } from '../mapgen.js';
import * as sapi from '../missions/setupApi.js';
import { revealArea, canSee, isExplored } from '../systems/vision.js';
import { hasForecast, forecast as weatherForecast, checkWeatherChange } from '../systems/weather.js';
import { WEATHER_CONTROL } from '../data/weather.js';
import { isEnemy, changeOwner } from '../systems/military.js';
import { buildingMaxHp } from '../systems/techs.js';
import {
  DIRS, DIR_NAMES, TILE_WORDS, ITEM_KINDS, tileKind, tileToward, faceOf, figureTile, itemAt, itemList, addItem, removeItem,
  clearGround, setTrack,
} from '../systems/ground.js';
import { hasKey } from '../sim.js';
import { assetPathOk } from '../../paths.js';

export { assetPathOk };

const T = TICKS_PER_SECOND;

/** Compass directions for nelia.turn_left() & co. (src/sim/systems/ground.js): 0 = north (−y), 1 = east, 2 = south, 3 = west. */
export { DIRS, DIR_NAMES, TILE_WORDS };

const gameErr = (reason, reasonParams = {}) => new ScriptError('game', { reason: `script.game.${reason}`, reasonParams });

// ---------------------------------------------------------------------------------------------
// Boundary Python → simulation: the simulation only knows whole numbers. Every number from a script
// passes through toInt or toTicks; NaN, infinity and absurd sizes become a readable script error
// instead of reaching the game state (docs/SKRIPTE.md, tests/sim/rules.test.js).
// ---------------------------------------------------------------------------------------------

/** Largest amount a script may hand to the simulation (coordinates, counts, resources). */
export const MAX_GAME_INT = 1_000_000_000;
/** Longest duration in ticks (about 11 days of game time). */
export const MAX_GAME_TICKS = 10_000_000;

const shown = (n) => (Number.isNaN(n) ? 'nan' : n === Infinity ? 'inf' : n === -Infinity ? '-inf' : String(n));

/** Python number → whole number for the simulation (truncated towards 0). */
export function toInt(v, name) {
  if (!isNum(v)) throw new ScriptError('type', { what: 'numberNeeded', name, type: typeName(v) });
  const n = Number(num(v));
  if (!Number.isFinite(n) || Math.abs(n) > MAX_GAME_INT) throw new ScriptError('value', { what: 'gameNumber', name, value: shown(n), max: MAX_GAME_INT });
  return Math.trunc(n) || 0;
}

/**
 * Limits for shared levels: a script must not freeze the browser or blow up the save game.
 * World building per call (radius, count), number of places, goals and event handlers, length of texts.
 */
export const LIMITS = { radius: 64, trees: 2000, spawn: 50, serfs: 100, places: 500, objectives: 100, handlers: 200, text: 2000, npcs: 50, noteCode: 20_000, tributes: 50, steps: 200, heavy: 200 };

/** Names of places, goals and keys chosen by a script: letters, digits, _ and -, starting with a letter. */
export const NAME_RE = /^[A-Za-z][\w-]{0,63}$/;

/** Events for @on_event(name, …) → the decorator with the same filters (the short forms stay). */
export const EVENTS = {
  start: 'on_start', every: 'every', building_done: 'on_building_done', building_placed: 'on_building_placed',
  destroyed: 'on_destroyed', killed: 'on_killed', recruited: 'on_recruited', research: 'on_research',
  enter: 'on_enter', objective: 'on_objective', weather: 'on_weather', talk: 'on_talk',
  // Only as @on_event(name, …): payday, trade, serf bought, research and upgrade started, hero ability, tribute paid
  payday: 'on_payday', trade: 'on_trade', serf_bought: 'on_serf_bought', research_started: 'on_research_started',
  upgrade_started: 'on_upgrade_started', ability: 'on_ability', tribute: 'on_tribute',
};

/** Filters of the events that have no decorator of their own (kind → filter names, as in decorator()). */
const EVENT_ONLY = {
  on_payday: ['?player'], on_trade: ['?player'], on_serf_bought: ['?player'], on_research_started: ['?tech', '?player'],
  on_upgrade_started: ['?player'], on_ability: ['?ability', '?player'], on_tribute: ['?id'],
};
/** Events only mission programs hear (the player's UI shows no talk, no start, no tribute of the mission). */
const MISSION_EVENTS = new Set(['on_start', 'on_talk', 'on_tribute']);

/** UI checks a tutorial step can wait for (the engine reports them, src/game/Engine.js missionUi). */
export const STEP_CHECKS = ['camera', 'selectSerfs'];

/** Python seconds → ticks (rounded, at least 0). */
export function toTicks(v, name = 'seconds') {
  if (!isNum(v)) throw new ScriptError('type', { what: 'numberNeeded', name, type: typeName(v) });
  const n = Number(num(v));
  const t = Math.round(n * T);
  if (!Number.isFinite(n) || t > MAX_GAME_TICKS) throw new ScriptError('value', { what: 'gameSeconds', name, value: shown(n), max: MAX_GAME_TICKS / T });
  return Math.max(0, t);
}

/** Class of a handle by entity kind. */
export const CLASS_OF = { hero: 'Hero', unit: 'Serf', leader: 'Troop', soldier: 'Soldier', worker: 'Worker', building: 'Building', tree: 'Tree', pile: 'Pile', ruin: 'Ruin', npc: 'Npc' };
/** Resources that come out of shafts (mines). */
const SHAFT_RES = [...new Set(Object.values(BUILDINGS).map((b) => b.shaftResource).filter(Boolean))];
/** Look of a talk figure: a role of the figure manifest ("serf", "worker.alchemist", "hero.orrin") or an own model of the level. */
const LOOK_RE = /^[a-z][\w.-]{0,63}$/;

// ---------------------------------------------------------------------------------------------
// Directory for help panel, editor completion and docs. Descriptions: i18n script.api.<name>
// level: 'player' = both levels, 'mission' = mission scripts only. group: section in the help panel.
// also: further names explained in the same entry. query: only reads (the hints warn when the result is thrown
// away); answers: the possible text answers ('tile', 'dir', 'weather') – vocabulary of the hints (src/script/hints.js).
// ---------------------------------------------------------------------------------------------

export const API_DOC = [
  // Flow
  { name: 'wait', sig: 'wait(seconds)', level: 'player', group: 'flow' },
  { name: 'wait_until', sig: 'wait_until(condition, timeout=None)', level: 'player', group: 'flow' },
  { name: 'time', sig: 'time()', level: 'player', group: 'flow', query: true },
  { name: 'print', sig: 'print(*values)', level: 'player', group: 'flow' },
  { name: 'notify', sig: 'notify(text)', level: 'player', group: 'flow' },
  // Figures: heroes under their name, step by step; serfs and troops have the same basic commands
  { name: 'nelia', sig: 'nelia · orrin · taran · malvor', level: 'player', group: 'hero', also: ['hero', 'orrin', 'taran', 'malvor'] },
  { name: 'nelia.step', sig: 'nelia.step(n=1)', level: 'player', group: 'hero', also: ['hero.step'] },
  { name: 'nelia.turn_left', sig: 'nelia.turn_left()', level: 'player', group: 'hero', also: ['hero.turn_left'] },
  { name: 'nelia.turn_right', sig: 'nelia.turn_right()', level: 'player', group: 'hero', also: ['hero.turn_right'] },
  { name: 'nelia.turn_to', sig: 'nelia.turn_to(direction)', level: 'player', group: 'hero', also: ['hero.turn_to'] },
  { name: 'nelia.front', sig: 'nelia.front()', level: 'player', group: 'hero', query: true, answers: 'tile', also: ['hero.front', 'nelia.ahead', 'hero.ahead'] },
  { name: 'nelia.left', sig: 'nelia.left() · nelia.right()', level: 'player', group: 'hero', query: true, answers: 'tile', also: ['nelia.right', 'hero.left', 'hero.right'] },
  { name: 'nelia.here', sig: 'nelia.here()', level: 'player', group: 'hero', query: true, answers: 'tile', also: ['hero.here'] },
  { name: 'nelia.can_step', sig: 'nelia.can_step()', level: 'player', group: 'hero', query: true, also: ['hero.can_step'] },
  { name: 'nelia.move_to', sig: 'nelia.move_to(target, wait=True)', level: 'player', group: 'hero', also: ['hero.move_to', 'unit.move_to'] },
  { name: 'nelia.is_at', sig: 'nelia.is_at(target)', level: 'player', group: 'hero', query: true, also: ['hero.is_at', 'unit.is_at'] },
  { name: 'nelia.take', sig: 'nelia.take()', level: 'player', group: 'hero', also: ['hero.take'] },
  { name: 'nelia.put', sig: 'nelia.put(kind="coin")', level: 'player', group: 'hero', also: ['hero.put'] },
  { name: 'nelia.say', sig: 'nelia.say(text)', level: 'player', group: 'hero', also: ['hero.say'] },
  { name: 'nelia.facing', sig: 'nelia.facing', level: 'player', group: 'hero', answers: 'dir', also: ['hero.facing'] },
  { name: 'nelia.x', sig: 'nelia.x, nelia.y', level: 'player', group: 'hero', also: ['hero.x', 'nelia.y', 'hero.y'] },
  // Read world
  { name: 'place', sig: 'place(name)', level: 'player', group: 'world' },
  { name: 'places', sig: 'places()', level: 'player', group: 'world', query: true },
  { name: 'tile', sig: 'tile(x, y)', level: 'player', group: 'world', query: true, answers: 'tile' },
  { name: 'distance', sig: 'distance(a, b)', level: 'player', group: 'world', query: true },
  { name: 'obj.distance_to', sig: 'obj.distance_to(target)', level: 'player', group: 'world', query: true },
  { name: 'place.contains', sig: 'place.contains(target)', level: 'player', group: 'world', query: true },
  { name: 'trees_near', sig: 'trees_near(target, radius=6)', level: 'player', group: 'world', query: true },
  { name: 'piles_near', sig: 'piles_near(target, radius=6, res=None)', level: 'player', group: 'world', query: true },
  { name: 'figures_near', sig: 'figures_near(target, radius=6, kind=None, side=None)', level: 'player', group: 'world', query: true, also: ['units_in'] },
  { name: 'items_near', sig: 'items_near(target, radius=6, kind=None)', level: 'player', group: 'world', query: true },
  { name: 'weather', sig: 'weather()', level: 'player', group: 'world', query: true, answers: 'weather' },
  { name: 'forecast', sig: 'forecast()', level: 'player', group: 'world', query: true },
  // Village (commands as in the UI)
  { name: 'stock', sig: 'stock(res)', level: 'player', group: 'village', query: true },
  { name: 'count', sig: 'count(kind, placed=False, level=0)', level: 'player', group: 'village', query: true },
  { name: 'researched', sig: 'researched(tech)', level: 'player', group: 'village', query: true },
  { name: 'serfs', sig: 'serfs(idle=False)', level: 'player', group: 'village', query: true },
  { name: 'troops', sig: 'troops()', level: 'player', group: 'village', query: true },
  { name: 'buildings', sig: 'buildings(kind=None)', level: 'player', group: 'village', query: true },
  { name: 'hq', sig: 'hq()', level: 'player', group: 'village', query: true },
  { name: 'find_spot', sig: 'find_spot(kind, near, radius=20)', level: 'player', group: 'village', query: true },
  { name: 'can_build', sig: 'can_build(kind, x, y)', level: 'player', group: 'village', query: true },
  { name: 'build', sig: 'build(kind, x, y)', level: 'player', group: 'village' },
  { name: 'buy_serf', sig: 'buy_serf(count=1)', level: 'player', group: 'village' },
  { name: 'serf.chop', sig: 'serf.chop()', level: 'player', group: 'village' },
  { name: 'serf.work_on', sig: 'serf.work_on(target)', level: 'player', group: 'village', also: ['unit.work_on'] },
  { name: 'troop.attack', sig: 'troop.attack(target)', level: 'player', group: 'village', also: ['unit.attack', 'nelia.attack', 'serf.attack'] },
  { name: 'troop.hold', sig: 'troop.hold() · troop.defend()', level: 'player', group: 'village', also: ['troop.defend', 'nelia.hold', 'nelia.defend'] },
  { name: 'building.upgrade', sig: 'building.upgrade()', level: 'player', group: 'village' },
  { name: 'building.change_weather', sig: 'building.change_weather(state) · building.can_change_weather(state)', level: 'player', group: 'village', also: ['building.can_change_weather'] },
  // Staging (missions only)
  { name: 'say', sig: 'say(speaker, text=None, de=None, en=None, seconds=None, voice=None, wait=True)', level: 'mission', group: 'story' },
  { name: 'message', sig: 'message(text=None, de=None, en=None)', level: 'mission', group: 'story' },
  { name: 'npc', sig: 'npc(id, look="serf", at=…, name=None, speaker=None, owner=None)', level: 'mission', group: 'story' },
  { name: 'npc.stop_talking', sig: 'npc.stop_talking() · npc.start_talking()', level: 'mission', group: 'story' },
  { name: 'camera.jump_to', sig: 'camera.jump_to(target)', level: 'mission', group: 'story' },
  { name: 'camera.fly_to', sig: 'camera.fly_to(target, seconds=2)', level: 'mission', group: 'story' },
  { name: 'reveal', sig: 'reveal(target, radius=None, seconds=30)', level: 'mission', group: 'story' },
  { name: 'step', sig: 'step(id, until=None, ui=None, next=False, title=None, de=None, en=None, touch=None, hint=None)', level: 'mission', group: 'story' },
  // Events (decorators)
  { name: 'on_start', sig: '@on_start', level: 'mission', group: 'events' },
  { name: 'every', sig: '@every(seconds)', level: 'player', group: 'events' },
  { name: 'on_building_done', sig: '@on_building_done(kind=None, player=HUMAN)', level: 'player', group: 'events' },
  { name: 'on_building_placed', sig: '@on_building_placed(kind=None, player=HUMAN)', level: 'player', group: 'events' },
  { name: 'on_destroyed', sig: '@on_destroyed(kind=None, owner=None)', level: 'player', group: 'events' },
  { name: 'on_killed', sig: '@on_killed(owner=None)', level: 'player', group: 'events' },
  { name: 'on_recruited', sig: '@on_recruited(player=HUMAN)', level: 'player', group: 'events' },
  { name: 'on_research', sig: '@on_research(tech=None, player=HUMAN)', level: 'player', group: 'events' },
  { name: 'on_enter', sig: '@on_enter(target, who="any", player=HUMAN)', level: 'player', group: 'events' },
  { name: 'on_objective', sig: '@on_objective(id, status=None)', level: 'player', group: 'events' },
  { name: 'on_weather', sig: '@on_weather(state=None)', level: 'player', group: 'events' },
  { name: 'on_talk', sig: '@on_talk(id=None)', level: 'mission', group: 'events' },
  { name: 'on_event', sig: '@on_event(name, …)', level: 'player', group: 'events' },
  // Goals and end
  { name: 'objective', sig: 'objective(id, condition=None, de=None, en=None, primary=True, hidden=False, hold=False, clock=False, all_worlds=False)', level: 'mission', group: 'goals' },
  { name: 'objective_status', sig: 'objective_status(id)', level: 'mission', group: 'goals', query: true },
  { name: 'complete', sig: 'complete(id)', level: 'mission', group: 'goals' },
  { name: 'fail', sig: 'fail(id)', level: 'mission', group: 'goals' },
  { name: 'show_objective', sig: 'show_objective(id)', level: 'mission', group: 'goals' },
  { name: 'hint', sig: 'hint(id, ui=None, area=None, entity=None, ui_until=None)', level: 'mission', group: 'goals' },
  { name: 'offer', sig: 'offer(id, cost, de=None, en=None, group=None)', level: 'mission', group: 'goals' },
  { name: 'withdraw', sig: 'withdraw(id)', level: 'mission', group: 'goals' },
  { name: 'unlock', sig: 'unlock(*ids)', level: 'mission', group: 'goals' },
  { name: 'victory', sig: 'victory(reason=None, de=None, en=None)', level: 'mission', group: 'goals' },
  { name: 'ending', sig: 'ending(reason)', level: 'mission', group: 'goals' },
  { name: 'defeat', sig: 'defeat(reason=None, de=None, en=None)', level: 'mission', group: 'goals' },
  { name: 'program.get', sig: 'program.get(name, default=None) · program.status · program.runs · program.stop()', level: 'mission', group: 'goals' },
  { name: 'note', sig: 'note(speaker, code, title=None, de=None, en=None, editable=True)', level: 'mission', group: 'goals' },
  { name: 'reset', sig: 'reset(on=True)', level: 'mission', group: 'goals' },
  { name: 'hints', sig: 'hints(on=True)', level: 'mission', group: 'goals' },
  // Intervening
  { name: 'spawn', sig: 'spawn(owner, kind, at, count=1, soldiers=None, spread=True)', level: 'mission', group: 'power' },
  { name: 'spawn_serfs', sig: 'spawn_serfs(player, count)', level: 'mission', group: 'power' },
  { name: 'give', sig: 'give(player, wood=0, gold=0, …, energy=0)', level: 'mission', group: 'power' },
  { name: 'player', sig: 'player(name)', level: 'mission', group: 'power', query: true },
  { name: 'set_diplomacy', sig: 'set_diplomacy(a, b, "allied"|"neutral"|"hostile")', level: 'mission', group: 'power' },
  { name: 'diplomacy', sig: 'diplomacy(a, b)', level: 'player', group: 'power', query: true },
  { name: 'give_tech', sig: 'give_tech(player, *techs)', level: 'mission', group: 'power' },
  { name: 'place_building', sig: 'place_building(player, kind, near, done=True, level=0, min_r=0, radius=20, fixed=False, margin=1)', level: 'mission', group: 'power' },
  { name: 'camp', sig: 'camp(name, near, units, r=7, anchor=None, on_ice=False)', level: 'mission', group: 'power' },
  { name: 'add_hero', sig: 'add_hero(player, name, at)', level: 'mission', group: 'power' },
  { name: 'convert', sig: 'convert(units, player)', level: 'mission', group: 'power' },
  { name: 'remove', sig: 'remove(thing)', level: 'mission', group: 'power' },
  { name: 'nelia.teleport', sig: 'nelia.teleport(target)', level: 'mission', group: 'power', also: ['hero.teleport'] },
  { name: 'obj.kill', sig: 'obj.kill()', level: 'mission', group: 'power' },
  { name: 'attack', sig: 'attack(units, target)', level: 'mission', group: 'power' },
  { name: 'move', sig: 'move(units, target)', level: 'mission', group: 'power' },
  { name: 'alive', sig: 'alive(units)', level: 'mission', group: 'power', query: true },
  { name: 'hero_of', sig: 'hero_of(player, name=None)', level: 'mission', group: 'power', query: true },
  { name: 'set_weather', sig: 'set_weather(state, seconds=120)', level: 'mission', group: 'power' },
  { name: 'ai', sig: 'ai(player, difficulty=None, aggression=None, start_in=None, attack_now=False, forbid=None)', level: 'mission', group: 'power' },
  // Shape terrain
  { name: 'make_place', sig: 'make_place(name, x, y, r=3)', level: 'mission', group: 'terrain' },
  { name: 'find_open', sig: 'find_open(near, min_r=0, max_r=24, clear=1, reachable_from=None, avoid=None, on_ice=False)', level: 'mission', group: 'terrain', query: true },
  { name: 'toward', sig: 'toward(a, b, distance)', level: 'mission', group: 'terrain', query: true },
  { name: 'map_center', sig: 'map_center()', level: 'mission', group: 'terrain', query: true },
  { name: 'start_spot', sig: 'start_spot(player=HUMAN)', level: 'mission', group: 'terrain', query: true },
  { name: 'plant_trees', sig: 'plant_trees(target, count, radius=5)', level: 'mission', group: 'terrain' },
  { name: 'add_tree', sig: 'add_tree(x, y, amount=None)', level: 'mission', group: 'terrain' },
  { name: 'add_pile', sig: 'add_pile(res, x, y, amount=None)', level: 'mission', group: 'terrain' },
  { name: 'add_shaft', sig: 'add_shaft(res, near, max_dist=22)', level: 'mission', group: 'terrain' },
  { name: 'add_ruin', sig: 'add_ruin(kind, near, level=0, radius=8)', level: 'mission', group: 'terrain' },
  { name: 'add_item', sig: 'add_item(kind, x, y)', level: 'mission', group: 'terrain' },
  { name: 'remove_item', sig: 'remove_item(x, y)', level: 'mission', group: 'terrain' },
  { name: 'items', sig: 'items(kind=None)', level: 'mission', group: 'terrain', query: true },
  { name: 'clear_area', sig: 'clear_area(target, radius)', level: 'mission', group: 'terrain' },
  { name: 'world.width', sig: 'world.width, world.height, world.water_level', level: 'mission', group: 'terrain' },
  { name: 'world.id', sig: 'world.id · world.stage', level: 'mission', group: 'terrain', also: ['world.stage'] },
  { name: 'world.height_at', sig: 'world.height_at(x, y)', level: 'mission', group: 'terrain', query: true },
  { name: 'world.is_water', sig: 'world.is_water(x, y)', level: 'mission', group: 'terrain', query: true },
  { name: 'world.set_height', sig: 'world.set_height(x, y, h)', level: 'mission', group: 'terrain' },
  { name: 'world.set_water', sig: 'world.set_water(x, y, on=True)', level: 'mission', group: 'terrain' },
  { name: 'world.set_cliff', sig: 'world.set_cliff(x, y, on=True)', level: 'mission', group: 'terrain' },
  { name: 'world.set_track', sig: 'world.set_track(x, y, strength=None)', level: 'mission', group: 'terrain' },
  { name: 'world.noise', sig: 'world.noise(x, y, cell=16, seed=0)', level: 'mission', group: 'terrain', query: true },
  // Shaping whole landscapes in one call (natives over src/sim/missions/setupApi.js – fast, integer, no randomness)
  { name: 'world.reachable', sig: 'world.reachable(a, b, frozen=None)', level: 'mission', group: 'terrain', query: true },
  { name: 'world.nearest_walkable', sig: 'world.nearest_walkable(target, max_r=8)', level: 'mission', group: 'terrain', query: true },
  { name: 'world.axis_point', sig: 'world.axis_point(a, b, along, side=0)', level: 'mission', group: 'terrain', query: true, also: ['world.axis_coords'] },
  { name: 'world.soften', sig: 'world.soften(divide=3, floor=150, sites=False)', level: 'mission', group: 'terrain' },
  { name: 'world.ridge', sig: 'world.ridge(a, b, at, width, wobble=2)', level: 'mission', group: 'terrain' },
  { name: 'world.ridge_gap', sig: 'world.ridge_gap(ridge, side, width=3, water=False)', level: 'mission', group: 'terrain' },
  { name: 'world.channel', sig: 'world.channel(a, b, width=3)', level: 'mission', group: 'terrain' },
  { name: 'world.lake_island', sig: 'world.lake_island(center, inner=6, width=4, shore=3)', level: 'mission', group: 'terrain' },
  { name: 'world.moat', sig: 'world.moat(center, reachable_from, inner=12, width=4)', level: 'mission', group: 'terrain' },
  { name: 'world.island', sig: 'world.island(a, b, inner=5, width=2, min_dist=26, keep=None)', level: 'mission', group: 'terrain' },
  // Constants
  { name: 'HUMAN', sig: 'HUMAN, ENEMY, BANDITS', level: 'player', group: 'const' },
];

/** Calls that only read the game (query in API_DOC, plus a few that change nothing): they keep the census of the tick. */
const READS = new Set([
  ...API_DOC.filter((e) => e.query).flatMap((e) => [e.name, ...(e.also ?? [])]),
  'place', 'time', 'print', 'notify', 'wait', 'wait_until', 'program.get',
]);

/** Basic commands of every figure that a program steers (hero, serf, troop – the troop through its captain). */
export const FIGURE_METHODS = ['step', 'turn_left', 'turn_right', 'turn_to', 'front', 'left', 'right', 'here', 'can_step', 'move_to', 'is_at', 'say', 'distance_to'];

/** Names of the methods per handle class and level (also read by the scripting reference on the website). */
export const CLASS_METHODS = {
  Hero: {
    player: [...FIGURE_METHODS, 'take', 'put', 'attack', 'hold', 'defend'],
    mission: ['teleport', 'kill'],
  },
  Serf: { player: [...FIGURE_METHODS, 'take', 'put', 'chop', 'work_on', 'attack', 'hold', 'defend'], mission: ['teleport', 'kill'] },
  Troop: { player: [...FIGURE_METHODS, 'attack', 'hold', 'defend'], mission: ['teleport', 'kill'] },
  Worker: { player: ['is_at', 'distance_to'], mission: ['kill'] },
  Soldier: { player: ['is_at', 'distance_to'], mission: [] },
  Building: { player: ['upgrade', 'change_weather', 'can_change_weather', 'distance_to'], mission: ['kill'] },
  Tree: { player: ['distance_to'], mission: ['kill'] },
  Pile: { player: ['distance_to'], mission: ['kill'] },
  Ruin: { player: [], mission: [] },
  Npc: { player: ['distance_to'], mission: ['start_talking', 'stop_talking', 'kill'] },
  Place: { player: ['distance_to', 'contains'], mission: [] },
};

/** Old names that still work but are no longer shown (version-1 levels): ahead() = front(). */
export const DEPRECATED_METHODS = { ahead: 'front' };

/** Properties per class (for dir(), suggestions and the scripting reference). */
export const CLASS_PROPS = {
  common: ['id', 'kind', 'owner', 'x', 'y', 'alive', 'hp'],
  Hero: ['name', 'facing', 'down', 'side'],
  Troop: ['type', 'soldiers', 'facing', 'idle', 'side'],
  Serf: ['idle', 'job', 'res', 'facing', 'side'],
  Worker: ['profession', 'side'],
  Building: ['type', 'level', 'done', 'w', 'h', 'max_hp'],
  Tree: ['res', 'amount'],
  Pile: ['res', 'amount'],
  Npc: ['name', 'look', 'talkable'],
  Place: ['name', 'x', 'y', 'r'],
};

/** Answers of the sensors and readers per kind (API_DOC `answers`) – vocabulary of the hints. */
export const ANSWERS = { tile: [...TILE_WORDS, 'unknown'], dir: DIR_NAMES, weather: ['summer', 'rain', 'winter'] };

/**
 * Vocabulary of the game API for the hints (src/script/hints.js): which calls only read, their possible answers,
 * look → turn pairs, the methods of figures and the attributes of the predefined game objects (nelia, hero …).
 * @param {'mission'|'player'} level
 */
export function hintVocab(level) {
  const queryFunctions = new Set(), queryMethods = new Set(), answers = {};
  for (const e of API_DOC) {
    if (level !== 'mission' && e.level === 'mission') continue;
    for (const n of [e.name, ...(e.also ?? [])]) {
      const last = n.split('.').pop();
      if (e.query) (n.includes('.') ? queryMethods : queryFunctions).add(last);
      if (e.answers) answers[last] = ANSWERS[e.answers];
    }
  }
  const heroAttrs = [...CLASS_PROPS.common, ...CLASS_PROPS.Hero, ...CLASS_METHODS.Hero.player,
    ...(level === 'mission' ? CLASS_METHODS.Hero.mission : []), ...Object.keys(DEPRECATED_METHODS)];
  const objects = {};
  for (const id of ['hero', ...HERO_IDS]) objects[id] = heroAttrs;
  const methods = new Set();
  for (const cls of ['Hero', 'Serf', 'Troop']) for (const m of [...CLASS_METHODS[cls].player, ...CLASS_METHODS[cls].mission]) methods.add(m);
  return { queryFunctions, queryMethods, answers, turns: { left: 'turn_left', right: 'turn_right' }, objects, methods };
}

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

  /** Player by name: "human", "bandits", "enemy" (first computer opponent) or the name of a village ("moorbrook"). */
  const playerNamed = (name) => {
    const rt = host.runtime;
    const p = name === 'human' ? human() : name === 'bandits' ? rt.state.bandits : name === 'enemy' ? consts().ENEMY
      : Object.hasOwn(rt.state.villages ?? {}, name) ? rt.state.villages[name] : -1;
    if (p < 0 || !sim().players[p]) throw gameErr('playerUnknown', { player: name.slice(0, 40), suggestion: suggest(name, ['human', 'bandits', 'enemy', ...Object.keys(rt.state.villages ?? {})]) });
    return p;
  };
  const playerOf = (v, def = human()) => {
    if (v === undefined || v === null) return def;
    if (typeof v === 'string') return playerNamed(v);
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
    const p = Object.hasOwn(host.places, name) ? host.places[name] : undefined;
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
    if (v2 !== undefined && isNum(v)) return { x: toInt(v, 'x'), y: toInt(v2, 'y'), r: 0 };
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
      const [x, y, r = 0] = v.items.map((a, i) => toInt(a, ['x', 'y', 'r'][i] ?? 'r'));
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

  /** What lies on a tile (src/sim/systems/ground.js); player programs see "unknown" where the fog was never lifted. */
  const tileInfo = (x, y) => {
    if (!isMission && sim().map.inBounds(x, y) && !isExplored(sim(), human(), x, y)) return 'unknown';
    return tileKind(sim(), x, y);
  };
  /** Player programs only see figures the player sees (fog of war); missions see everything. */
  const visibleTo = (e) => isMission || canSee(sim(), human(), e);
  /** Side of a figure seen from the human: "own", "allied", "neutral" or "enemy". */
  const sideOf = (e) => {
    const h = human();
    if (e.owner === h) return 'own';
    if (e.owner === undefined || e.owner < 0 || !sim().players[e.owner]) return 'neutral';
    if (isEnemy(sim(), h, e.owner)) return 'enemy';
    return sim().relation(h, e.owner) === 'allied' ? 'allied' : 'neutral';
  };

  /** Execute a sim command as a player; rejection becomes a GameError with the simulation's reason. */
  const command = (cmd) => {
    const s = sim();
    host.noteAction();
    const before = s.events.length;
    const ok = s.applyCommand({ ...cmd, player: cmd.player ?? human() });
    if (ok) return true;
    const rej = s.events.slice(before).reverse().find((e) => e.type === 'rejected');
    throw new ScriptError('game', { reason: rej?.reason ?? 'err.unknownCommand', reasonParams: rej?.params ?? {} });
  };

  const intArg = toInt;
  const secondsArg = toTicks;
  const strArg = (v, name) => {
    if (typeof v !== 'string') throw new ScriptError('type', { what: 'strNeeded', name, type: typeName(v) });
    return v;
  };
  /** Whole number up to a limit (radius, count …): bigger values are a readable error, not a frozen browser. */
  const capArg = (v, name, max) => {
    const n = toInt(v, name);
    if (n > max) throw new ScriptError('value', { what: 'tooBig', name, max, value: String(n) });
    return n;
  };
  const nameArg = (v, name) => {
    const s = strArg(v, name);
    if (!NAME_RE.test(s)) throw new ScriptError('value', { what: 'badName', name, value: s.slice(0, 40) });
    return s;
  };
  /**
   * Text of say/message/objective: one string (one language, or a key of the version-1 table `texts`),
   * a dict {"de": …, "en": …} or the keywords de=/en= – then both languages travel along.
   */
  const textArg = (fname, text, de, en, need = true) => {
    if ((de !== undefined && de !== null) || (en !== undefined && en !== null)) {
      const o = {};
      if (de !== undefined && de !== null) o.de = strArg(de, 'de');
      if (en !== undefined && en !== null) o.en = strArg(en, 'en');
      return o;
    }
    if (text === undefined || text === null) {
      if (need) throw new ScriptError('argMissing', { name: fname, arg: 'text' });
      return null;
    }
    if (typeof text !== 'string' && !(text instanceof PyDict)) throw new ScriptError('type', { what: 'strNeeded', name: 'text', type: typeName(text) });
    return text;
  };
  const isCallable = (v) => v instanceof PyFunction || v instanceof PyBuiltin || v instanceof PyPartial || v instanceof PyBoundMethod;
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
  def('notify', (ctx, a, kw) => {
    const [text] = args('notify', a, kw, ['text']);
    host.notify(level, ctx.vm.str(text));
    return null;
  });

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

  /** Figures for figures_near: heroes (awake), serfs, troops (the captain stands for the soldiers), workers outside. */
  const FIGURE_KINDS = { hero: 'hero', unit: 'serf', leader: 'troop', worker: 'worker' };
  const SIDES = ['own', 'allied', 'neutral', 'enemy'];
  const kindMatches = (e, kind) => {
    if (kind === FIGURE_KINDS[e.kind]) return true;
    if (e.kind === 'hero') return e.hero === kind;
    if (e.kind === 'leader') return e.def === kind;
    if (e.kind === 'worker') return e.prof === kind;
    return false;
  };
  def('figures_near', (ctx, a, kw) => {
    const [t, r = 6, k, sd] = args('figures_near', a, kw, ['target', '?radius', '?kind', '?side']);
    const c = pt(t), R = capArg(r, 'radius', LIMITS.radius) * UNIT;
    const kind = k === undefined || k === null ? null : strArg(k, 'kind');
    const side = sd === undefined || sd === null ? null : strArg(sd, 'side');
    if (side !== null && !SIDES.includes(side)) throw gameErr('sideUnknown', { name: side.slice(0, 40), suggestion: suggest(side, SIDES) });
    const self = t instanceof PyHost && t.cls !== 'Place' ? t.id : 0;
    const cx = tileCenter(c.x), cy = tileCenter(c.y);
    const out = [];
    for (const e of sim().entities.values()) {
      if (!FIGURE_KINDS[e.kind] || e.id === self || e.px === undefined || e.inside || (e.kind === 'hero' && e.down)) continue;
      const d = (e.px - cx) ** 2 + (e.py - cy) ** 2;
      if (d > R * R || (kind && !kindMatches(e, kind)) || (side && sideOf(e) !== side) || !visibleTo(e)) continue;
      out.push({ e, d });
    }
    out.sort((p, q) => p.d - q.d || p.e.id - q.e.id);
    return new PyList(out.map((o) => handle(o.e)));
  });
  const itemKindArg = (k) => {
    if (k === undefined || k === null) return null;
    const s = strArg(k, 'kind');
    if (!ITEM_KINDS.includes(s)) throw gameErr('itemUnknown', { name: s.slice(0, 40), suggestion: suggest(s, ITEM_KINDS) });
    return s;
  };
  def('items_near', (ctx, a, kw) => {
    const [t, r = 6, k] = args('items_near', a, kw, ['target', '?radius', '?kind']);
    const c = pt(t), R = capArg(r, 'radius', LIMITS.radius), kind = itemKindArg(k);
    const out = itemList(sim().map, kind)
      .filter((p) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2 <= R * R && (isMission || isExplored(sim(), human(), p.x, p.y)))
      .map((p) => ({ p, d: (p.x - c.x) ** 2 + (p.y - c.y) ** 2 }))
      .sort((p, q) => p.d - q.d || p.p.y - q.p.y || p.p.x - q.p.x);
    return new PyList(out.map((o) => new PyTuple([o.p.x, o.p.y])));
  });
  def('weather', (ctx, a, kw) => {
    args('weather', a, kw, []);
    return sim().weather.state;
  });
  /** forecast(): the next weathers like the top bar – [("winter", 42), …] (seconds until they begin). Players need a weather tower. */
  def('forecast', (ctx, a, kw) => {
    args('forecast', a, kw, []);
    if (!isMission && !hasForecast(sim(), human())) throw gameErr('noForecast', {});
    return new PyList(weatherForecast(sim()).map((f) => new PyTuple([f.state, Math.ceil(f.inTicks / T)])));
  });

  // ---------- Village ----------

  def('stock', (ctx, a, kw) => {
    const [r, p] = args('stock', a, kw, ['res', '?player']);
    const pl = isMission ? playerOf(p) : human();
    // "energy": charge of the weather power plant (0 … 1000), like the bar at the plant
    if (r === 'energy') return sim().players[pl].weatherEnergy ?? 0;
    return sim().available(pl, resArg(r));
  });
  /**
   * count(kind, player, placed=False, level=0): from the census of the tick (one pass over all entities, shared by every
   * objective and condition – runtime.count); commands of the script clear it, so it is never stale.
   */
  def('count', (ctx, a, kw) => {
    const [k, p, placed = false, lv = 0] = args('count', a, kw, ['kind', '?player', '?placed', '?level']);
    const kind = strArg(k, 'kind');
    const pl = isMission ? playerOf(p) : human();
    const c = host.runtime.count(sim())[pl];
    if (!c) return 0;
    if (kind === 'serf') return c.serfs;
    if (kind === 'worker') return c.workers;
    if (kind === 'troop') return c.leaders;
    if (kind === 'soldier') return c.leaders + c.soldiers;
    if (!hasKey(BUILDINGS, kind)) {
      throw gameErr('kindUnknown', { name: kind, suggestion: suggest(kind, [...Object.keys(BUILDINGS), 'serf', 'worker', 'troop', 'soldier']) });
    }
    return host.runtime.builtCount(sim(), pl, kind, Math.max(0, intArg(lv, 'level')), truthy(placed));
  });
  /** researched(tech): has the player this technology (researched or given)? */
  def('researched', (ctx, a, kw) => {
    const [t, p] = args('researched', a, kw, ['tech', '?player']);
    const id = strArg(t, 'tech');
    if (!hasKey(TECHS, id) && !hasKey(BUILDING_TECHS, id)) throw gameErr('techUnknown', { name: id, suggestion: suggest(id, [...Object.keys(TECHS), ...Object.keys(BUILDING_TECHS)]) });
    return sim().players[isMission ? playerOf(p) : human()].techs.has(id);
  });
  def('serfs', (ctx, a, kw) => {
    const [idle = false, p] = args('serfs', a, kw, ['?idle', '?player']);
    const pl = isMission ? playerOf(p) : human();
    return new PyList(sortedEntities((e) => e.kind === 'unit' && e.owner === pl && (!truthy(idle) || (!e.job && !e.path.length && e.goal === undefined))));
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

  /**
   * say(): one line of a conversation. It waits until the line is over; lines of another conversation (another task)
   * wait for their turn, so conversations never mix. wait=False only queues the line (the dialogue box shows it after
   * the lines before, as long as reading or the recording takes) and goes on at once.
   */
  def('say', (ctx, a, kw) => {
    const [speaker, text, seconds, voice, de, en, wait = true] = args('say', a, kw, ['speaker', '?text', '?seconds', '?voice', '?de', '?en', '?wait']);
    const words = textArg('say', text, de, en);
    let path = null;
    if (voice !== undefined && voice !== null) {
      path = strArg(voice, 'voice');
      if (!assetPathOk(path)) throw new ScriptError('value', { what: 'assetPath', name: 'voice', value: path.slice(0, 60) });
    }
    const who = speaker === null ? null : strArg(speaker, 'speaker');
    const ticks = seconds === undefined || seconds === null ? null : secondsArg(seconds);
    if (!truthy(wait)) { host.say(who, words, 0, path); return null; }
    if (!ctx.task || !host.mayTalk(ctx.task)) return new Suspend({ k: 'say', speaker: who, text: words, ticks, voice: path });
    const dur = host.sayLine(ctx.task, who, words, ticks, path);
    return dur ? new Suspend({ k: 'dialog', until: sim().tick + dur }) : null;
  }, true);
  def('message', (ctx, a, kw) => {
    const [text, de, en] = args('message', a, kw, ['?text', '?de', '?en']);
    host.say(null, textArg('message', text, de, en), null, null);
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
      const filters = Object.fromEntries(names.map((n, i) => [n.replace(/^\?/, ''), filt[i] ?? null]));
      // Player programs only hear about their own buildings, figures and research (what their UI reports)
      if (!isMission) for (const k of ['player', 'owner']) if (k in filters && kind !== 'on_enter') filters[k] = human();
      host.register(ctx.vm, kind, last, filters);
      return last;
    }
    if (last instanceof PyPartial || last instanceof PyBuiltin) throw new ScriptError('type', { what: 'decoratorFunction' });
    // With filters: the function follows when decorating
    const fil = args(kind, a, kw, names.map((n) => (n.startsWith('?') ? n : `?${n}`)));
    return new PyPartial(new PyBuiltin(kind), fil.map((v) => (v === undefined ? null : v)), []);
  };
  def('on_start', decorator('on_start', []), true);
  def('every', (ctx, a, kw) => {
    // checked once when registering: the period in ticks must be a sensible number (not 0.5 → every tick by accident)
    const first = a[0];
    if (!(first instanceof PyFunction) && first !== undefined) toTicks(first, 'seconds');
    if (kw.seconds !== undefined) toTicks(kw.seconds, 'seconds');
    return decorator('every', ['seconds'])(ctx, a, kw);
  });
  def('on_building_done', decorator('on_building_done', ['?kind', '?player']));
  def('on_building_placed', decorator('on_building_placed', ['?kind', '?player']));
  def('on_destroyed', decorator('on_destroyed', ['?kind', '?owner']));
  def('on_killed', decorator('on_killed', ['?owner']));
  def('on_recruited', decorator('on_recruited', ['?player']));
  def('on_research', decorator('on_research', ['?tech', '?player']));
  def('on_enter', decorator('on_enter', ['target', '?who', '?player']));
  def('on_objective', decorator('on_objective', ['id', '?status']));
  def('on_weather', decorator('on_weather', ['?state']));
  def('on_talk', decorator('on_talk', ['?id']), true);
  // Events without a short form of their own: natives under their kind (decorating calls them), but no global name
  for (const [kind, names] of Object.entries(EVENT_ONLY)) def(kind, decorator(kind, names), MISSION_EVENTS.has(kind));
  /** One decorator for every event: @on_event("talk", id="alchemist") is the same as @on_talk("alchemist"). */
  def('on_event', (ctx, a, kw) => {
    const name = a[0] ?? kw.name;
    if (typeof name !== 'string') throw gameErr('eventName', { events: Object.keys(EVENTS).join(', ') });
    // Player programs know the events their UI also sees (not start and talk)
    const known = Object.keys(EVENTS).filter((k) => natives[EVENTS[k]] && (isMission || !MISSION_EVENTS.has(EVENTS[k])));
    if (!known.includes(name)) throw gameErr('eventUnknown', { name: name.slice(0, 40), suggestion: suggest(name, known) });
    const { name: _n, ...rest } = kw;
    return natives[EVENTS[name]](ctx, a.slice(1), rest);
  });

  // ---------- Missions: goals ----------

  /**
   * objective(id, condition, de=…, en=…, primary=True, hidden=False, hold=False, clock=False): the condition returns
   * True/False, a pair (done, needed) for a progress bar or a triple (done, needed, finished) that shows a bar but
   * decides itself when the objective is met. hold=True: an objective to keep (protect something) – it counts as met as
   * long as the condition holds and fails once it does not; clock=True shows the pair as remaining seconds.
   * Version 1 order objective(id, text, condition) still works.
   */
  def('objective', (ctx, a, kw) => {
    const KW = ['id', 'condition', 'text', 'primary', 'hidden', 'de', 'en', 'hold', 'clock', 'all_worlds'];
    for (const k of Object.keys(kw)) if (!KW.includes(k)) throw new ScriptError('argUnexpected', { name: 'objective', arg: k, suggestion: suggest(k, KW) });
    if (a.length > 5) throw new ScriptError('argCount', { name: 'objective', max: 5, given: a.length });
    const v1 = a.length >= 2 && a[1] !== null && !isCallable(a[1]);
    const pos = v1 ? ['id', 'text', 'condition', 'primary', 'hidden'] : ['id', 'condition', 'text', 'primary', 'hidden'];
    const v = {};
    a.forEach((x, i) => { v[pos[i]] = x; });
    for (const k of Object.keys(kw)) {
      if (v[k] !== undefined) throw new ScriptError('argDuplicate', { name: 'objective', arg: k });
      v[k] = kw[k];
    }
    if (v.id === undefined) throw new ScriptError('argMissing', { name: 'objective', arg: 'id' });
    const cond = v.condition ?? null;
    if (cond !== null && !isCallable(cond)) throw new ScriptError('type', { what: 'callableNeeded', type: typeName(cond) });
    const name = nameArg(v.id, 'id');
    const words = textArg('objective', v.text, v.de, v.en, false);
    host.addObjective(ctx.vm, name, words ?? name, cond, truthy(v.primary ?? true), truthy(v.hidden ?? false), { hold: truthy(v.hold ?? false), clock: truthy(v.clock ?? false), allWorlds: truthy(v.all_worlds ?? false) });
    return v.id;
  }, true);
  /** objective_status(id): "active", "done", "failed" or "hidden" – e.g. to wait for an all_worlds goal. */
  def('objective_status', (ctx, a, kw) => {
    const [id] = args('objective_status', a, kw, ['id']);
    const name = strArg(id, 'id');
    const o = host.runtime.state.objectives.find((x) => x.id === name);
    if (!o) throw new ScriptError('game', { reason: 'script.game.objectiveUnknown', reasonParams: { id: name } });
    return o.status;
  }, true);
  const objectiveAction = (name, action) => def(name, (ctx, a, kw) => {
    const [id] = args(name, a, kw, ['id']);
    host.objectiveAction(action, strArg(id, 'id'));
    return null;
  }, true);
  objectiveAction('complete', 'complete');
  objectiveAction('fail', 'fail');
  objectiveAction('show_objective', 'reveal');

  /**
   * Pointer of an objective or step: `ui` names controls (data-testid without prefix, e.g. "build-farm"), `area` a
   * place or circle, `entity` a game object. Places stay names (resolved when shown), objects their number.
   */
  const hintSpec = (uiV, areaV, entityV) => {
    const out = {};
    if (uiV !== undefined && uiV !== null) {
      const list = uiV instanceof PyList || uiV instanceof PyTuple ? uiV.items : [uiV];
      out.ui = list.map((x) => nameArg(x, 'ui'));
    }
    if (areaV !== undefined && areaV !== null) {
      if (typeof areaV === 'string') out.area = nameArg(areaV, 'area');
      else if (areaV instanceof PyHost && areaV.cls === 'Place' && !String(areaV.id).startsWith('@')) out.area = String(areaV.id);
      else { const p = pt(areaV); out.area = { x: p.x, y: p.y, r: p.r || 3 }; }
    }
    if (entityV !== undefined && entityV !== null) out.entity = entityOf(entityV).id;
    return Object.keys(out).length ? out : null;
  };
  /** Values of a dict {"ui": …, "area": …, "entity": …} (hint= of step()). */
  const hintDict = (d) => {
    if (d === undefined || d === null) return null;
    if (!(d instanceof PyDict)) throw new ScriptError('type', { what: 'dictNeeded', name: 'hint', type: typeName(d) });
    for (const [k] of d.entries()) if (!['ui', 'area', 'entity'].includes(k)) throw new ScriptError('argUnexpected', { name: 'hint', arg: String(k), suggestion: suggest(String(k), ['ui', 'area', 'entity']) });
    return hintSpec(d.get('ui'), d.get('area'), d.get('entity'));
  };

  /**
   * hint(id, ui=None, area=None, entity=None, ui_until=None): pointer of an objective – a ring on the map (area,
   * entity) and a glow around controls (ui). The glow goes for good once ui_until holds (e.g. the building is placed).
   */
  def('hint', (ctx, a, kw) => {
    const [n, uiV, areaV, entityV, until] = args('hint', a, kw, ['id', '?ui', '?area', '?entity', '?ui_until']);
    const id = strArg(n, 'id');
    const st = host.runtime.state;
    const o = st.objectives.find((x) => x.id === id);
    const d = o && Object.hasOwn(st.extraObjectives ?? {}, id) ? st.extraObjectives[id] : null;
    if (!d) throw gameErr('objectiveUnknown', { id });
    if (until !== undefined && until !== null && !isCallable(until)) throw new ScriptError('type', { what: 'callableNeeded', type: typeName(until) });
    d.hint = hintSpec(uiV, areaV, entityV);
    o.uiOff = false;
    let conds = ctx.vm.globals.get('.hints');
    if (!(conds instanceof PyDict)) { conds = new PyDict(); ctx.vm.globals.set('.hints', conds); }
    if (until !== undefined && until !== null) conds.set(id, until); else conds.delete(id);
    return null;
  }, true);

  /**
   * offer(id, cost, de=…, en=…, group=None): a tribute in the objectives panel – the player pays the cost with one
   * tap, @on_event("tribute", id=…) reacts. Paying one offer of a group withdraws the others (a choice).
   */
  def('offer', (ctx, a, kw) => {
    const [n, costV, text, de, en, groupV] = args('offer', a, kw, ['id', 'cost', '?text', '?de', '?en', '?group']);
    const id = nameArg(n, 'id');
    const rt = host.runtime, st = rt.state;
    if (!(costV instanceof PyDict)) throw new ScriptError('type', { what: 'dictNeeded', name: 'cost', type: typeName(costV) });
    const cost = {};
    for (const [r, v] of costV.entries()) cost[resArg(r)] = Math.max(0, intArg(v, String(r)));
    if (st.tributes[id] === 'paid') return false;
    if (!Object.hasOwn(st.tributes, id) && Object.keys(st.tributes).length >= LIMITS.tributes) throw new ScriptError('value', { what: 'tooMany', name: 'offer', max: LIMITS.tributes });
    const words = textArg('offer', text, de, en, false);
    st.tributeDefs[id] = { cost, text: words === null ? id : host.text(words), ...(groupV === undefined || groupV === null ? {} : { group: nameArg(groupV, 'group') }) };
    st.tributes[id] = 'open';
    return true;
  }, true);
  def('withdraw', (ctx, a, kw) => {
    const [n] = args('withdraw', a, kw, ['id']);
    const st = host.runtime.state, id = strArg(n, 'id');
    if (Object.hasOwn(st.tributes, id) && st.tributes[id] === 'open') st.tributes[id] = 'closed';
    return null;
  }, true);
  /** unlock("barracks", "standingArmy"): buildings and technologies the mission makes available (campaign unlocks). */
  def('unlock', (ctx, a, kw) => {
    args('unlock', [], kw, []);
    const buildings = [], techs = [];
    for (const v of a) {
      const id = strArg(v, 'id');
      if (hasKey(BUILDINGS, id)) buildings.push(id);
      else if (hasKey(TECHS, id) || hasKey(BUILDING_TECHS, id)) techs.push(id);
      else throw gameErr('kindUnknown', { name: id, suggestion: suggest(id, [...Object.keys(BUILDINGS), ...Object.keys(TECHS), ...Object.keys(BUILDING_TECHS)]) });
    }
    host.runtime.unlock(sim(), buildings, techs);
    return null;
  }, true);

  /**
   * step(id, until=None, ui=None, next=False, title, de/en, touch, hint): a guided step (tutorial). The card shows
   * title and text (on phones `touch` if given) and the pointer; step() waits until `until` holds, the UI check `ui`
   * ("camera", "selectSerfs") is reported, "Weiter" (reading steps and next=True) or "Überspringen" is pressed.
   * Returns "done", "next" or "skip".
   */
  def('step', (ctx, a, kw) => {
    const [n, until, uiV, nxt = false, title, text, de, en, touch, hintV] = args('step', a, kw, ['id', '?until', '?ui', '?next', '?title', '?text', '?de', '?en', '?touch', '?hint']);
    const id = nameArg(n, 'id');
    if (until !== undefined && until !== null && !isCallable(until)) throw new ScriptError('type', { what: 'callableNeeded', type: typeName(until) });
    const watch = uiV === undefined || uiV === null ? null : strArg(uiV, 'ui');
    if (watch !== null && !STEP_CHECKS.includes(watch)) throw gameErr('stepCheckUnknown', { name: watch.slice(0, 40), suggestion: suggest(watch, STEP_CHECKS) });
    if ((host.runtime.state.tutorial?.index ?? -1) + 1 >= LIMITS.steps) throw new ScriptError('value', { what: 'tooMany', name: 'step', max: LIMITS.steps });
    const fn = until === undefined || until === null ? null : until;
    const opt = (v) => (v === undefined || v === null ? null : host.text(textArg('step', v, null, null)));
    host.runtime.enterScriptStep(sim(), {
      id, title: opt(title), text: host.text(textArg('step', text, de, en)), touch: opt(touch),
      hint: hintDict(hintV), watch, canNext: (!fn && !watch) || truthy(nxt),
    });
    return new Suspend({ k: 'step', fn });
  }, true);
  /** victory(reason) picks the texts of that reason from the scenario (victoryTexts, debriefs); de=/en= give them inline. */
  const finish = (won) => (ctx, a, kw) => {
    const fname = won ? 'victory' : 'defeat';
    const [r, text, de, en] = args(fname, a, kw, ['?reason', '?text', '?de', '?en']);
    const words = textArg(fname, text, de, en, false);
    host.runtime.finish(sim(), won, r ? nameArg(r, 'reason') : 'script', words === null ? null : host.text(words));
    return null;
  };
  def('victory', finish(true), true);
  def('defeat', finish(false), true);
  /**
   * ending(reason): the reason a level that ends by its objectives is won with – it picks victory text and epilogue
   * (victoryTexts, debriefs) as with victory(reason), e.g. the way the player took. None goes back to "objectives".
   */
  def('ending', (ctx, a, kw) => {
    const [r] = args('ending', a, kw, ['reason']);
    host.runtime.state.endReason = r === null ? null : nameArg(r, 'reason');
    return null;
  }, true);

  // ---------- Missions: intervening ----------

  /**
   * spawn(owner, kind, at, count=1, soldiers=None, spread=True): troops for free. `kind` is a unit or a list like in
   * camp() – [("sword1", 2, 4), ("bow1", 1, 4)] is one wave of three squads. Several squads stand in rows of three
   * around `at`; spread=False puts every squad on the nearest free tile at `at` itself.
   */
  def('spawn', (ctx, a, kw) => {
    const [o, k, at, n = 1, soldiers, spread = true] = args('spawn', a, kw, ['owner', 'kind', 'at', '?count', '?soldiers', '?spread']);
    const owner = playerOf(o);
    let groups;
    if (k instanceof PyList) groups = unitsArg(k);
    else {
      const kind = strArg(k, 'kind');
      if (!hasKey(UNITS, kind)) throw gameErr('unitUnknown', { name: kind, suggestion: suggest(kind, Object.keys(UNITS)) });
      groups = [{ def: kind, count: capArg(n, 'count', LIMITS.spawn), soldiers: soldiers === undefined || soldiers === null ? undefined : intArg(soldiers, 'soldiers') }];
    }
    const total = groups.reduce((t, g) => t + g.count, 0);
    if (total > LIMITS.spawn) throw new ScriptError('value', { what: 'tooBig', name: 'count', max: LIMITS.spawn, value: String(total) });
    const c = pt(at), rows = truthy(spread);
    const out = [];
    let i = 0;
    for (const g of groups) {
      for (let j = 0; j < g.count; j++, i++) {
        const near = rows ? { x: c.x + ((i % 3) - 1) * 3, y: c.y + Math.trunc(i / 3) * 3 } : { x: c.x, y: c.y };
        const L = sapi.spawnTroop(sim(), owner, g.def, near, g.soldiers);
        if (L) out.push(handle(L));
      }
    }
    sim().events.push({ type: 'wave', owner, count: out.length, player: human() });
    return new PyList(out);
  }, true);
  def('spawn_serfs', (ctx, a, kw) => {
    const [p, n] = args('spawn_serfs', a, kw, ['player', 'count']);
    const pl = playerOf(p), out = [];
    for (let i = 0, k = capArg(n, 'count', LIMITS.serfs); i < k; i++) { const u = sim().spawnSerf(pl); if (u) out.push(handle(u)); }
    return new PyList(out);
  }, true);
  def('give', (ctx, a, kw) => {
    const [p] = args('give', a, {}, ['player']);
    const pl = sim().players[playerOf(p)];
    for (const k of Object.keys(kw)) {
      // energy: charge of the weather power plant (change the weather without waiting)
      if (k === 'energy') { pl.weatherEnergy = Math.max(0, Math.min(WEATHER_CONTROL.maxEnergy, (pl.weatherEnergy ?? 0) + intArg(kw[k], k))); continue; }
      const r = resArg(k);
      pl.stock[r] = Math.max(0, Math.min(MAX_GAME_INT, pl.stock[r] + intArg(kw[k], k)));
    }
    return null;
  }, true);
  /** player("moorbrook"): number of a player by name – "human", "bandits", "enemy" or a village of scenario.json. */
  def('player', (ctx, a, kw) => {
    const [n] = args('player', a, kw, ['name']);
    return playerNamed(strArg(n, 'name'));
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
  /**
   * place_building(player, kind, near, done=True, level=0, min_r=0, radius=20, fixed=False): a building for free on
   * the nearest fitting spot (ring min_r … radius); level = upgrade level (0 = first), fixed = the computer opponent
   * never tears it down. Without a fitting spot: None.
   */
  def('place_building', (ctx, a, kw) => {
    const [p, k, nearV, done = true, lv = 0, minR = 0, radius = 20, fixed = false, margin = 1] = args('place_building', a, kw,
      ['player', 'kind', 'near', '?done', '?level', '?min_r', '?radius', '?fixed', '?margin']);
    const kind = buildingArg(k);
    const c = pt(nearV);
    const b = sapi.placeBuilding(sim(), playerOf(p), kind, c, {
      minR: Math.max(0, intArg(minR, 'min_r')), radius: capArg(radius, 'radius', LIMITS.radius), done: truthy(done), level: Math.max(0, intArg(lv, 'level')),
      // margin: free tiles around it (0 = right next to water or a camp, e.g. on a small island)
      margin: Math.max(0, capArg(margin, 'margin', 4)),
    });
    // No fitting spot: None (like find_open), so that world building goes on on every map
    if (!b) return null;
    if (truthy(fixed)) b.fixed = true;
    return handle(b);
  }, true);
  /** Units for camp(): ("spear1", 2, 3) = 2 squads of 3 soldiers, or just "spear1"; a list of them. */
  const unitsArg = (v) => {
    const list = v instanceof PyList ? v.items : [v];
    return list.map((u) => {
      const [k, n = 1, s = null] = u instanceof PyTuple || u instanceof PyList ? u.items : [u];
      const kind = strArg(k, 'kind');
      if (!hasKey(UNITS, kind)) throw gameErr('unitUnknown', { name: kind, suggestion: suggest(kind, Object.keys(UNITS)) });
      return { def: kind, count: capArg(n, 'count', LIMITS.spawn), soldiers: s === null ? undefined : intArg(s, 'soldiers') };
    });
  };
  /** Circles to keep free (find_open, camp): one target or a list of them. */
  const circlesArg = (v) => (v === undefined || v === null ? [] : (v instanceof PyList ? v.items : [v]).map((x) => { const p = pt(x); return { x: p.x, y: p.y, r: p.r }; }));
  /**
   * camp(name, near, units, r=7, anchor=None, on_ice=False): a bandit camp with guards near `near` – clearing, camp
   * hut and squads; the guards attack whoever comes closer than r + 3. With `anchor` they guard an existing building
   * of the bandits instead. Creates the place `name`. Returns the guards.
   */
  def('camp', (ctx, a, kw) => {
    const [n, nearV, unitsV, r = 7, anchorV, onIce = false, fromV, avoidV, maxR = 14] = args('camp', a, kw,
      ['name', 'near', 'units', '?r', '?anchor', '?on_ice', '?reachable_from', '?avoid', '?max_r']);
    const name = nameArg(n, 'name');
    const rt = host.runtime;
    if (rt.state.bandits < 0) throw gameErr('noBandits', {});
    const c = pt(nearV);
    const anchor = anchorV === undefined || anchorV === null ? undefined : entityOf(anchorV).id;
    const from = fromV === undefined || fromV === null ? null : pt(fromV);
    const res = rt.addCamp(sim(), name, c, unitsArg(unitsV), {
      r: capArg(r, 'r', LIMITS.radius), anchor, onIce: truthy(onIce), from: from && { x: from.x, y: from.y }, avoid: circlesArg(avoidV), maxR: capArg(maxR, 'max_r', LIMITS.radius),
    });
    if (!res) return new PyList([]);
    host.places[name] = { x: res.x, y: res.y, r: res.r };
    return new PyList(res.guards.map((id) => handle(sim().entities.get(id))));
  }, true);
  /** add_hero(player, name, at): a hero joins (e.g. after a conversation); stands on the nearest free tile at `at`. */
  def('add_hero', (ctx, a, kw) => {
    const [p, n, at] = args('add_hero', a, kw, ['player', 'name', 'at']);
    const name = strArg(n, 'name');
    if (!HERO_IDS.includes(name)) throw gameErr('heroUnknown', { name: name.slice(0, 40), suggestion: suggest(name, HERO_IDS) });
    const c = pt(at);
    const h = sim().spawnHero(playerOf(p), name);
    const q = sapi.findOpen(sim(), c.x, c.y, { maxR: 8 });
    if (q) { h.px = tileCenter(q.x); h.py = tileCenter(q.y); h.anchor = { x: h.px, y: h.py }; }
    return handle(h);
  }, true);
  /**
   * convert(units, player): figures switch sides by the rules of bribing – a troop takes its soldiers along, everyone
   * forgets their target and stands still. Heroes, serfs and troops. Returns how many switched.
   */
  def('convert', (ctx, a, kw) => {
    const [u, p] = args('convert', a, kw, ['units', 'player']);
    const to = playerOf(p);
    let n = 0;
    for (const x of listOfHandles(u)) {
      let e = entityOf(x, false);
      if (e?.kind === 'soldier') e = sim().entities.get(e.leader) ?? null;
      if (!e || !['hero', 'unit', 'leader'].includes(e.kind) || e.owner === to) continue;
      const from = e.owner;
      changeOwner(sim(), e, to);
      sim().events.push({ type: 'converted', id: e.id, kind: e.kind, from, to });
      n++;
    }
    return n;
  }, true);
  /** remove(thing): take objects out of the game without a trace (no death, no ruin, no event); obj.kill() reports them. */
  def('remove', (ctx, a, kw) => {
    const [h] = args('remove', a, kw, ['thing']);
    for (const x of listOfHandles(h)) host.takeOut(entityOf(x, false));
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
    const [p, difficulty, aggression, startIn, attackNow = false, forbidV] = args('ai', a, kw, ['player', '?difficulty', '?aggression', '?start_in', '?attack_now', '?forbid']);
    const act = {};
    if (difficulty) act.difficulty = strArg(difficulty, 'difficulty');
    if (aggression) act.aggression = strArg(aggression, 'aggression');
    if (startIn !== undefined && startIn !== null) act.startIn = toTicks(startIn, 'start_in') / T;
    if (truthy(attackNow)) act.attackNow = true;
    // forbid: building kinds the computer opponent must not build (e.g. no weather power plant)
    if (forbidV !== undefined && forbidV !== null) act.forbid = (forbidV instanceof PyList || forbidV instanceof PyTuple ? forbidV.items : [forbidV]).map((x) => buildingArg(x));
    host.runtime.setAi(sim(), playerOf(p), act);
    return null;
  }, true);

  // ---------- Missions: terrain ----------

  def('make_place', (ctx, a, kw) => {
    const [n, x, y, r = 3] = args('make_place', a, kw, ['name', 'x', 'y', '?r']);
    const name = nameArg(n, 'name');
    if (!Object.hasOwn(host.places, name) && Object.keys(host.places).length >= LIMITS.places) throw new ScriptError('value', { what: 'tooMany', name: 'make_place', max: LIMITS.places });
    host.places[name] = { x: intArg(x, 'x'), y: intArg(y, 'y'), r: capArg(r, 'r', LIMITS.radius) };
    return new PyHost('Place', name);
  }, true);
  /**
   * find_open(near, min_r, max_r, clear=1, reachable_from=None, avoid=None, on_ice=False): the nearest spot whose
   * square of radius `clear` is walkable and free, that can be reached on foot from `reachable_from` and lies outside
   * the circles `avoid`. Water never counts as open, unless on_ice (frozen water carries in winter).
   */
  def('find_open', (ctx, a, kw) => {
    const [t, minR = 0, maxR = 24, clear = 1, fromV, avoidV, onIce = false] = args('find_open', a, kw,
      ['near', '?min_r', '?max_r', '?clear', '?reachable_from', '?avoid', '?on_ice']);
    const c = pt(t);
    const from = fromV === undefined || fromV === null ? null : pt(fromV);
    const p = sapi.findOpen(sim(), c.x, c.y, {
      minR: intArg(minR, 'min_r'), maxR: capArg(maxR, 'max_r', LIMITS.radius), clear: Math.max(0, capArg(clear, 'clear', 8)),
      from: from && { x: from.x, y: from.y }, avoid: circlesArg(avoidV), allowWater: truthy(onIce),
    });
    return p ? pointPlace(p.x, p.y, 1) : null;
  }, true);
  /**
   * add_shaft(res, near, max_dist=22): a shaft site for a mine near a target – the nearest free one of that resource,
   * otherwise a new one. Returns its centre (a point) or None.
   */
  def('add_shaft', (ctx, a, kw) => {
    const [r, nearV, d = 22] = args('add_shaft', a, kw, ['res', 'near', '?max_dist']);
    const res = strArg(r, 'res');
    if (!SHAFT_RES.includes(res)) throw gameErr('resUnknown', { name: res.slice(0, 40), suggestion: suggest(res, SHAFT_RES) });
    const s = sapi.ensureShaft(sim(), res, pt(nearV), capArg(d, 'max_dist', LIMITS.radius));
    return s ? pointPlace(s.x + 1, s.y + 1, 1) : null;
  }, true);
  /** add_ruin(kind, near, level=0, radius=8): the ruin of a building – backdrop that blocks the ground for good. */
  def('add_ruin', (ctx, a, kw) => {
    const [k, nearV, lv = 0, radius = 8] = args('add_ruin', a, kw, ['kind', 'near', '?level', '?radius']);
    const r = sapi.addRuin(sim(), buildingArg(k), pt(nearV), { level: Math.max(0, intArg(lv, 'level')), radius: capArg(radius, 'radius', LIMITS.radius) });
    return r ? handle(r) : null;
  }, true);
  def('toward', (ctx, a, kw) => {
    const [p, q, d] = args('toward', a, kw, ['a', 'b', 'distance']);
    const r = sapi.toward(pt(p), pt(q), intArg(d, 'distance'));
    return pointPlace(r.x, r.y, 2);
  }, true);
  def('map_center', () => pointPlace(sim().map.width >> 1, sim().map.height >> 1, 4), true);
  /** start_spot(player=HUMAN): where a player starts – the castle, or for levels without a castle the start tile. */
  def('start_spot', (ctx, a, kw) => {
    const [p] = args('start_spot', a, kw, ['?player']);
    const pl = playerOf(p);
    const b = sim().findBuilding(pl, 'headquarters');
    const s = b ? sapi.centerOf(b) : sim().starts[pl];
    if (!s) throw gameErr('playerUnknown', { player: pl });
    return pointPlace(s.x, s.y, 2);
  }, true);
  def('plant_trees', (ctx, a, kw) => {
    const [t, n, r = 5] = args('plant_trees', a, kw, ['target', 'count', '?radius']);
    const c = pt(t);
    const k = sapi.plantTrees(sim(), c, capArg(n, 'count', LIMITS.trees), capArg(r, 'radius', LIMITS.radius));
    host.natureChanged();
    return k;
  }, true);
  def('add_tree', (ctx, a, kw) => {
    const [x, y, amount] = args('add_tree', a, kw, ['x', 'y', '?amount']);
    const tx = intArg(x, 'x'), ty = intArg(y, 'y');
    if (!sim().map.rectFree(tx, ty, 1, 1)) return null;
    const wood = amount === undefined || amount === null ? BALANCE.tree.wood : Math.max(1, capArg(amount, 'amount', BALANCE.tree.wood * 10));
    const n = sim().addNode('tree', tx, ty, 'wood', wood);
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
    const R = capArg(r, 'radius', LIMITS.radius);
    for (const e of [...sim().entities.values()]) {
      if ((e.kind === 'tree' || e.kind === 'pile') && sapi.dist(e, c) <= R) host.removeEntity(e);
    }
    for (const p of itemList(sim().map)) if (sapi.dist(p, c) <= R) removeItem(sim(), p.x, p.y);
    return null;
  }, true);
  // Items on tiles (coins, flowers): world building; players pick them up with take()
  def('add_item', (ctx, a, kw) => {
    const [k, x, y] = args('add_item', a, kw, ['kind', 'x', 'y']);
    const kind = itemKindArg(k);
    if (kind === null) throw new ScriptError('argMissing', { name: 'add_item', arg: 'kind' });
    return addItem(sim(), intArg(x, 'x'), intArg(y, 'y'), kind);
  }, true);
  def('remove_item', (ctx, a, kw) => {
    const [x, y] = args('remove_item', a, kw, ['x', 'y']);
    return removeItem(sim(), intArg(x, 'x'), intArg(y, 'y'));
  }, true);
  def('items', (ctx, a, kw) => {
    const [k] = args('items', a, kw, ['?kind']);
    return new PyList(itemList(sim().map, itemKindArg(k)).map((p) => new PyTuple([p.x, p.y])));
  }, true);
  /** hints(False): no hints for the player program of this level (e.g. a stage where finding the mistake is the task). */
  def('hints', (ctx, a, kw) => {
    const [on = true] = args('hints', a, kw, ['?on']);
    host.state.hintsOff = !truthy(on);
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
      // Water and rock carry no items and keep no tracks
      clearGround(m, k);
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
  /** world.set_track(x, y, strength=None): a track on a tile (None = strongest, 0 = none). Read it with tile(). */
  def('world.set_track', (ctx, a, kw) => {
    const [x, y, st] = args('set_track', a, kw, ['x', 'y', '?strength']);
    const tx = intArg(x, 'x'), ty = intArg(y, 'y');
    inMap(tx, ty);
    setTrack(sim().map, tx, ty, st === undefined || st === null ? BALANCE.ground.tracks.max : intArg(st, 'strength'));
    return null;
  }, true);
  def('world.is_water', (ctx, a, kw) => {
    const [x, y] = args('is_water', a, kw, ['x', 'y']);
    return !!(sim().map.flags[inMap(intArg(x, 'x'), intArg(y, 'y'))] & WATER);
  }, true);
  def('world.noise', (ctx, a, kw) => {
    const [x, y, cell = 16, seed = 0] = args('noise', a, kw, ['x', 'y', '?cell', '?seed']);
    return valueNoise(intArg(x, 'x'), intArg(y, 'y'), Math.max(1, intArg(cell, 'cell')), (sim().seed + intArg(seed, 'seed')) | 0);
  }, true);

  // world.*: shape whole landscapes in one call – thin wrappers around src/sim/missions/setupApi.js (integer, no
  // randomness, a whole map in milliseconds instead of a Python loop over every tile). Each counts as a heavy call:
  // at most LIMITS.heavy per tick (and during world building), so that a level of somebody else cannot freeze the game.
  const heavy = (name) => {
    if (--host.heavyLeft < 0) throw new ScriptError('value', { what: 'tooMany', name, max: LIMITS.heavy });
  };
  /** Terrain changed in one go: the renderer rebuilds the whole map once. */
  const shaped = () => { const m = sim().map; host.terrainChanged(0, 0); host.terrainChanged(m.width - 1, m.height - 1); host.natureChanged(); };
  const xy = (p) => ({ x: p.x, y: p.y });
  const axisOf = (aV, bV) => sapi.axis(xy(pt(aV)), xy(pt(bV)));
  const optPlace = (p, r = 1) => (p ? pointPlace(p.x, p.y, r) : null);

  /** world.reachable(a, b, frozen=None): can a figure walk from a to b? frozen=True/False: as in winter/summer. */
  def('world.reachable', (ctx, a, kw) => {
    const [p, q, fr] = args('reachable', a, kw, ['a', 'b', '?frozen']);
    heavy('world.reachable');
    return sapi.reachable(sim(), xy(pt(p)), xy(pt(q)), fr === undefined || fr === null ? sim().map.frozen : truthy(fr));
  }, true);
  def('world.nearest_walkable', (ctx, a, kw) => {
    const [t, r = 8] = args('nearest_walkable', a, kw, ['target', '?max_r']);
    const c = pt(t);
    return optPlace(sapi.nearestWalkable(sim(), c.x, c.y, capArg(r, 'max_r', LIMITS.radius)));
  }, true);
  /**
   * world.axis_point(a, b, along, side=0): the tile `along` tiles from a towards b (also beyond b or behind a), moved
   * `side` tiles to the right of the way a → b (negative: to the left). world.axis_coords(a, b, target) is the reverse.
   */
  def('world.axis_point', (ctx, a, kw) => {
    const [p, q, along, side = 0] = args('axis_point', a, kw, ['a', 'b', 'along', '?side']);
    const r = axisOf(p, q).at(intArg(along, 'along'), intArg(side, 'side'));
    return pointPlace(r.x, r.y, 2);
  }, true);
  def('world.axis_coords', (ctx, a, kw) => {
    const [p, q, t] = args('axis_coords', a, kw, ['a', 'b', 'target']);
    const ax = axisOf(p, q), c = pt(t);
    return new PyTuple([ax.p(c.x, c.y), ax.q(c.x, c.y)]);
  }, true);
  /** world.soften(divide=3, floor=150, sites=False): flatter relief, no rock and no water; sites=True also removes settlement spots, shafts and bridge sites. */
  def('world.soften', (ctx, a, kw) => {
    const [d = 3, f = 150, sites = false] = args('soften', a, kw, ['?divide', '?floor', '?sites']);
    heavy('world.soften');
    sapi.soften(sim(), { divide: Math.max(1, capArg(d, 'divide', 100)), floor: Math.max(0, capArg(f, 'floor', 5000)), sites: truthy(sites) });
    shaped();
    return null;
  }, true);
  /** Ridge as a dict (only numbers and points – it travels with the save game). */
  const ridgeDict = (ax, r) => {
    const d = new PyDict();
    d.set('a', pointPlace(ax.from.x, ax.from.y, 0)); d.set('b', pointPlace(ax.to.x, ax.to.y, 0));
    for (const k of ['at', 'width', 'wobble', 'foot']) d.set(k, r[k]);
    return d;
  };
  /**
   * world.ridge(a, b, at, width, wobble=2): a mountain ridge (impassable rock, also over the ice) across the whole map,
   * at right angles to the way a → b, `at` tiles from a and `width` tiles thick, with wavy edges. Returns the ridge
   * for world.ridge_gap().
   */
  def('world.ridge', (ctx, a, kw) => {
    const [p, q, at, w, wob = 2] = args('ridge', a, kw, ['a', 'b', 'at', 'width', '?wobble']);
    heavy('world.ridge');
    const ax = axisOf(p, q);
    ax.to = xy(pt(q));
    const r = sapi.ridge(sim(), ax, intArg(at, 'at'), Math.max(1, capArg(w, 'width', 256)), { wobble: Math.max(0, capArg(wob, 'wobble', 16)) });
    shaped();
    return ridgeDict(ax, r);
  }, true);
  /**
   * world.ridge_gap(ridge, side, width=3, water=False): a pass through a ridge `side` tiles beside the way a → b, or with
   * water=True a gorge with a river (walkable only on the ice). Returns {"center", "near", "far"}: the middle of the
   * gap and the tiles in front of and behind the ridge.
   */
  def('world.ridge_gap', (ctx, a, kw) => {
    const [rd, side, w = 3, water = false] = args('ridge_gap', a, kw, ['ridge', 'side', '?width', '?water']);
    if (!(rd instanceof PyDict)) throw new ScriptError('type', { what: 'dictNeeded', name: 'ridge', type: typeName(rd) });
    heavy('world.ridge_gap');
    const ax = axisOf(rd.get('a'), rd.get('b'));
    const r = { ax, at: intArg(rd.get('at'), 'at'), width: intArg(rd.get('width'), 'width'), wobble: intArg(rd.get('wobble'), 'wobble'), foot: intArg(rd.get('foot'), 'foot') };
    const g = sapi.ridgeGap(sim(), r, intArg(side, 'side'), { width: Math.max(1, capArg(w, 'width', 16)), water: truthy(water) });
    shaped();
    const d = new PyDict();
    d.set('center', pointPlace(g.center.x, g.center.y, 3)); d.set('near', pointPlace(g.near.x, g.near.y, 2)); d.set('far', pointPlace(g.far.x, g.far.y, 2));
    return d;
  }, true);
  /** world.channel(a, b, width=3): a river bed (water) from a to b; tiles outside the map are left out. */
  def('world.channel', (ctx, a, kw) => {
    const [p, q, w = 3] = args('channel', a, kw, ['a', 'b', '?width']);
    heavy('world.channel');
    sapi.channel(sim(), xy(pt(p)), xy(pt(q)), { width: Math.max(1, capArg(w, 'width', 16)) });
    shaped();
    return null;
  }, true);
  /** world.lake_island(center, inner=6, width=4, shore=3): a lake ring around a flat island, with a flat shore. Returns the island (r = inner − 1). */
  def('world.lake_island', (ctx, a, kw) => {
    const [c, inner = 6, w = 4, shore = 3] = args('lake_island', a, kw, ['center', '?inner', '?width', '?shore']);
    heavy('world.lake_island');
    const r = sapi.lakeIsland(sim(), xy(pt(c)), { inner: Math.max(2, capArg(inner, 'inner', LIMITS.radius)), width: Math.max(1, capArg(w, 'width', 16)), shore: Math.max(0, capArg(shore, 'shore', 16)) });
    shaped();
    return pointPlace(r.x, r.y, r.r);
  }, true);
  /**
   * world.moat(center, reachable_from, inner=12, width=4): a ring of water around a fixed centre (a castle) so that it
   * is cut off from `reachable_from` in summer and reachable over the ice in winter. Buildings in the ring or no cut:
   * nothing changes, None. Otherwise the island (r = inner − 1).
   */
  def('world.moat', (ctx, a, kw) => {
    const [c, fromV, inner = 12, w = 4] = args('moat', a, kw, ['center', 'reachable_from', '?inner', '?width']);
    heavy('world.moat');
    const r = sapi.moat(sim(), xy(pt(c)), xy(pt(fromV)), { inner: Math.max(2, capArg(inner, 'inner', LIMITS.radius)), width: Math.max(1, capArg(w, 'width', 16)) });
    if (r) shaped();
    return r ? pointPlace(r.x, r.y, r.r) : null;
  }, true);
  /**
   * world.island(a, b, inner=5, width=2, min_dist=26, keep=None): an island on the way from a towards b (at least
   * `min_dist` tiles from a): a water ring cuts it off from a in summer, the ice carries in winter. Every point in
   * `keep` must stay reachable from a in summer. None if nothing fits.
   */
  def('world.island', (ctx, a, kw) => {
    const [p, q, inner = 5, w = 2, md = 26, keepV] = args('island', a, kw, ['a', 'b', '?inner', '?width', '?min_dist', '?keep']);
    heavy('world.island');
    const keep = keepV === undefined || keepV === null ? [] : listOfHandles(keepV).map((x) => xy(pt(x)));
    const r = sapi.makeIsland(sim(), xy(pt(p)), xy(pt(q)), {
      inner: Math.max(2, capArg(inner, 'inner', LIMITS.radius)), width: Math.max(1, capArg(w, 'width', 16)), minDist: Math.max(0, capArg(md, 'min_dist', 256)), keep,
    });
    if (r) shaped();
    return r ? pointPlace(r.x, r.y, r.r) : null;
  }, true);

  // ---------- Missions: talk figures ----------

  /**
   * npc(id, look="serf", at=…, name=None): a figure that stands like decoration and carries an exclamation mark.
   * A hero sent to it by tapping starts @on_talk(id) on arrival – the mission decides what happens.
   */
  def('npc', (ctx, a, kw) => {
    const [n, lookV = 'serf', at, nameV, de, en, spk, ow] = args('npc', a, kw, ['id', '?look', '?at', '?name', '?de', '?en', '?speaker', '?owner']);
    const id = nameArg(n, 'id');
    if (at === undefined || at === null) throw new ScriptError('argMissing', { name: 'npc', arg: 'at' });
    const look = strArg(lookV, 'look');
    if (!LOOK_RE.test(look) && !(assetPathOk(look) && /\.glb$/i.test(look))) throw new ScriptError('value', { what: 'look', name: 'look', value: look.slice(0, 60) });
    const live = Object.values(host.runtime.state.npcs).filter((x) => x.state !== 'gone').length;
    if (live >= LIMITS.npcs) throw new ScriptError('value', { what: 'tooMany', name: 'npc', max: LIMITS.npcs });
    const name = textArg('npc', nameV, de, en, false);
    const speaker = spk === undefined || spk === null ? null : nameArg(spk, 'speaker');
    const owner = ow === undefined || ow === null ? -1 : playerOf(ow);
    const e = host.runtime.addNpc(sim(), id, { look, at: pt(at), name: name === null ? null : host.text(name), speaker, owner });
    if (!e) throw gameErr('npcExists', { id });
    return handle(e);
  }, true);

  // ---------- Missions: the player's program ----------

  /** program.get("guess", default): copy of a variable of the player program (for prediction and variable tasks). */
  def('program.get', (ctx, a, kw) => {
    const [n, dflt = null] = args('get', a, kw, ['name', '?default']);
    return host.playerVariable(strArg(n, 'name'), dflt);
  }, true);
  /** program.stop(): stop the player program (between two stages, before the mission moves the hero on). */
  def('program.stop', (ctx, a, kw) => {
    args('stop', a, kw, []);
    host.stopPlayer();
    return null;
  }, true);
  /**
   * note(speaker, code, title=None, de/en=None, editable=True): a figure hands the player a note with code. It replaces
   * the program in the code panel and carries the figure's seal; the own code stays reachable ("back to my code").
   */
  def('note', (ctx, a, kw) => {
    const [speaker, code, title, de, en, editable = true] = args('note', a, kw, ['speaker', 'code', '?title', '?de', '?en', '?editable']);
    const text = strArg(code, 'code');
    if (text.length > LIMITS.noteCode) throw new ScriptError('value', { what: 'tooBig', name: 'code', max: LIMITS.noteCode, value: String(text.length) });
    const t = textArg('note', title, de, en, false);
    host.note(speaker === null ? null : nameArg(speaker, 'speaker'), text, t === null ? null : host.text(t), truthy(editable));
    return null;
  }, true);
  /** reset(False): "Run" no longer restarts the stage (building missions); reset() switches it on again. */
  def('reset', (ctx, a, kw) => {
    const [on = true] = args('reset', a, kw, ['?on']);
    host.state.reset = !!truthy(on);
    return null;
  }, true);

  // Everything that may change the game clears the census of the tick (count() counts afresh afterwards)
  for (const [name, fn] of Object.entries(natives)) {
    if (READS.has(name)) continue;
    natives[name] = (ctx, a, kw) => { const r = fn(ctx, a, kw); host.runtime.census = null; return r; };
  }

  // ---------- Predefined names ----------

  const globals = {};
  for (const name of Object.keys(natives)) if (!name.includes('.') && !Object.hasOwn(EVENT_ONLY, name)) globals[name] = new PyBuiltin(name);
  if (isMission) {
    globals.camera = new PyModule('camera');
    globals.world = new PyModule('world');
    globals.program = new PyModule('program');
  }
  const consts = () => {
    const ai = host.runtime.def.players.findIndex((p) => p.kind === 'ai');
    return { HUMAN: human(), ENEMY: ai, BANDITS: host.runtime.state.bandits };
  };
  const heroEntity = () => [...sim().entities.values()].find((e) => e.kind === 'hero' && e.owner === human());
  // Every hero also under their name (nelia, orrin …): own first, otherwise that of another player (player
  // programs: only while the player sees them)
  const heroNamed = (id) => {
    let other = null;
    for (const e of sim().entities.values()) {
      if (e.kind !== 'hero' || e.hero !== id) continue;
      if (e.owner === human()) return e;
      if (visibleTo(e)) other ??= e;
    }
    return other;
  };
  // Looked up on every access (VM option `dynamic`): a hero who joins later is there at once, before and after loading
  const dynamic = {
    HUMAN: () => human(),
    ENEMY: () => consts().ENEMY,
    BANDITS: () => consts().BANDITS,
    hero: () => { const h = heroEntity(); return h ? handle(h) : null; },
  };
  for (const id of HERO_IDS) dynamic[id] = () => { const e = heroNamed(id); return e ? handle(e) : null; };

  const modules = isMission ? {
    camera: ['jump_to', 'fly_to'],
    world: ['width', 'height', 'water_level', 'id', 'stage', 'height_at', 'set_height', 'set_water', 'set_cliff', 'set_track', 'is_water', 'noise',
      'reachable', 'nearest_walkable', 'axis_point', 'axis_coords', 'soften', 'ridge', 'ridge_gap', 'channel', 'lake_island', 'moat', 'island'],
    program: ['status', 'runs', 'get', 'stop'],
  } : {};

  // ---------- Methods and properties of the handles ----------

  const methodsOf = (cls) => [...(CLASS_METHODS[cls]?.player ?? []), ...(isMission ? CLASS_METHODS[cls]?.mission ?? [] : [])];
  /** Shown methods plus old names that still work (ahead → front) for steerable figures. */
  const callable = (cls, name) => methodsOf(cls).includes(name) || (Object.hasOwn(DEPRECATED_METHODS, name) && methodsOf(cls).includes(DEPRECATED_METHODS[name]));
  const propsOf = (cls) => [...(cls === 'Place' ? [] : CLASS_PROPS.common), ...(CLASS_PROPS[cls] ?? [])];

  const hostHooks = {
    modules,
    moduleAttr(mod, name) {
      if (mod === 'world') {
        const m = sim().map;
        if (name === 'width') return m.width;
        if (name === 'height') return m.height;
        if (name === 'water_level') return sim().waterLevel;
        // Worlds of the level (docs/SKRIPTE.md#welten): which one is built, and the stage the switcher started it at
        if (name === 'id') return host.runtime.state.world ?? null;
        if (name === 'stage') return host.runtime.state.startStage ?? null;
      }
      if (mod === 'program') {
        if (name === 'status') return host.state.player.status;
        if (name === 'runs') return host.state.player.runs;
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
      if (callable(obj.cls, name)) return new PyBoundMethod(obj, name);
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
        case 'side': if (e.px !== undefined && e.kind !== 'npc') return sideOf(e); break;
        case 'facing': if (e.kind === 'hero' || e.kind === 'unit' || e.kind === 'leader') return DIR_NAMES[faceOf(e)]; break;
        default: break;
      }
      switch (obj.cls) {
        case 'Hero':
          if (name === 'name') return e.hero;
          if (name === 'down') return !!e.down;
          break;
        case 'Troop':
          if (name === 'type') return e.def;
          if (name === 'soldiers') return e.soldiers.length;
          if (name === 'idle') return (e.order?.type ?? 'idle') === 'idle' && !e.targetId && !e.path.length;
          break;
        case 'Serf':
          if (name === 'idle') return !e.job && !e.path.length && e.goal === undefined;
          if (name === 'job') return e.job?.kind ?? null;
          // what the serf is cutting or digging right now ("wood", "clay" …)
          if (name === 'res') return e.job?.kind === 'gather' ? e.job.res ?? null : null;
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
          if (name === 'max_hp') return buildingMaxHp(sim(), e);
          break;
        case 'Tree': case 'Pile':
          if (name === 'res') return e.res;
          if (name === 'amount') return e.amount;
          break;
        case 'Npc':
          if (name === 'name') return e.npc;
          if (name === 'look') return e.look;
          if (name === 'talkable') return !!e.talk;
          break;
        default: break;
      }
      return undefined;
    },
    setattr() { return false; },
    callMethod(ctx, obj, name, a, kw) {
      if (!callable(obj.cls, name)) throw new ScriptError('attr', { type: obj.cls, name, suggestion: suggest(name, methodsOf(obj.cls)) });
      if (Object.hasOwn(DEPRECATED_METHODS, name)) name = DEPRECATED_METHODS[name];
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
      // Foreign figures: player programs may only ask where they are (and only while they see them)
      if (!isMission && e.owner !== human() && !(READ_ONLY.has(name) && visibleTo(e))) throw gameErr('notYours', {});
      const r = unitMethod(ctx, e, obj, name, a, kw);
      if (!SENSORS.has(name)) host.runtime.census = null;
      return r;
    },
  };

  // ---------- Methods of the game objects ----------

  /** Methods that only read and may be asked of visible foreign figures too. */
  const READ_ONLY = new Set(['is_at', 'distance_to']);
  /** Methods that change nothing in the game (the census of the tick stays valid). */
  const SENSORS = new Set([...READ_ONLY, 'front', 'left', 'right', 'here', 'can_step', 'can_change_weather']);

  const isAt = (e, t) => {
    const c = pt(t);
    const p = tileOfE(e);
    return (p.x - c.x) ** 2 + (p.y - c.y) ** 2 <= c.r * c.r;
  };

  /** Walk command of a figure: serfs walk with `move`, heroes, troops and militia with an `order` (as in the UI). */
  const moveCommand = (e, x, y) => (e.kind === 'unit' && !e.militia
    ? { type: 'move', units: [e.id], x, y, player: e.owner }
    : { type: 'order', units: [e.id], order: 'move', x, y, player: e.owner });

  /**
   * Send a figure to a tile and wait until it is there (or cannot get further). A step keeps the look direction
   * (an order from the UI clears it, the script sets it again).
   */
  const walk = (e, x, y, mode, more = 0) => {
    const face = e.face, from = tileOfE(e);
    command(moveCommand(e, x, y));
    if (mode === 'step' && face !== undefined) e.face = face;
    host.focusOn(e.id);
    return new Suspend({ k: 'walk', id: e.id, x, y, sx: from.x, sy: from.y, mode, more, until: sim().tick + 60 * T });
  };

  /** Figures that a program steers step by step (heroes, serfs, troops through their captain). */
  const steerable = (e) => e.kind === 'hero' || e.kind === 'unit' || e.kind === 'leader';
  const checkUp = (e) => { if (e.kind === 'hero' && e.down) throw gameErr('heroDown', {}); };

  /**
   * Player programs: a figure that another task of the same program is steering right now (walking, turning, picking
   * up …) cannot take a second command – "… is busy" instead of the last command silently winning.
   */
  const claim = (ctx, e) => {
    if (isMission || !ctx?.vm) return;
    for (const t of ctx.vm.tasks.values()) {
      if (t !== ctx.task && t.state === 'waiting' && t.wait?.id === e.id) throw gameErr('busy', { name: e.kind === 'hero' ? e.hero : e.kind === 'leader' ? 'troop' : 'serf' });
    }
  };
  const STEERING = new Set(['step', 'turn_left', 'turn_right', 'turn_to', 'move_to', 'take', 'put', 'chop', 'work_on', 'attack', 'hold', 'defend']);

  function unitMethod(ctx, e, obj, name, a, kw) {
    const s = sim();
    if (STEERING.has(name) && steerable(e)) claim(ctx, e);
    switch (name) {
      case 'start_talking': case 'stop_talking':
        args(name, a, kw, []);
        host.runtime.setTalkable(s, e.npc, name === 'start_talking');
        return null;
      // ----- step by step (waits) -----
      case 'step': {
        const [n = 1] = args('step', a, kw, ['?n']);
        const steps = intArg(n, 'n');
        if (steps < 1) return null;
        checkUp(e);
        const t = tileToward(e, 0);
        if (!s.map.walkable(t.x, t.y)) throw gameErr('blocked', { what: tileKind(s, t.x, t.y) });
        return walk(e, t.x, t.y, 'step', steps - 1);
      }
      case 'turn_left': case 'turn_right': {
        args(name, a, kw, []);
        checkUp(e);
        e.face = (faceOf(e) + (name === 'turn_left' ? 3 : 1)) % 4;
        host.focusOn(e.id);
        return new Suspend({ k: 't', id: e.id, until: s.tick + 3 });
      }
      case 'turn_to': {
        const [dirV] = args(name, a, kw, ['direction']);
        const dir = DIR_NAMES.indexOf(strArg(dirV, 'direction'));
        if (dir < 0) throw gameErr('dirUnknown', { name: dirV, suggestion: suggest(dirV, DIR_NAMES) });
        checkUp(e);
        e.face = dir;
        host.focusOn(e.id);
        return new Suspend({ k: 't', id: e.id, until: s.tick + 3 });
      }
      // ----- sensors (read only, take no time) -----
      case 'front': case 'left': case 'right': case 'here': {
        args(name, a, kw, []);
        const t = tileToward(e, name === 'front' ? 0 : name === 'left' ? -1 : name === 'right' ? 1 : null);
        return tileInfo(t.x, t.y);
      }
      case 'can_step': {
        args(name, a, kw, []);
        const t = tileToward(e, 0);
        return s.map.walkable(t.x, t.y);
      }
      case 'move_to': {
        const [t, w = true] = args(name, a, kw, ['target', '?wait']);
        const c = pt(t);
        if (!steerable(e)) throw gameErr('cannotMove', {});
        checkUp(e);
        if (truthy(w)) return walk(e, c.x, c.y, 'move');
        // Orders that keep running return at once, like a click in the UI
        command(moveCommand(e, c.x, c.y));
        return null;
      }
      case 'is_at': { const [t] = args(name, a, kw, ['target']); return isAt(e, t); }
      // ----- items (on the tile the figure stands on) -----
      case 'take': {
        args(name, a, kw, []);
        const here = figureTile(e);
        const kind = itemAt(s.map, here.x, here.y);
        command({ type: 'item', action: 'take', unit: e.id, player: e.owner });
        host.focusOn(e.id);
        return new Suspend({ k: 't', id: e.id, until: s.tick + BALANCE.ground.itemTicks, value: kind });
      }
      case 'put': {
        const [k = 'coin'] = args(name, a, kw, ['?kind']);
        const kind = itemKindArg(k);
        command({ type: 'item', action: 'put', unit: e.id, kind, player: e.owner });
        host.focusOn(e.id);
        return new Suspend({ k: 't', id: e.id, until: s.tick + BALANCE.ground.itemTicks });
      }
      // ----- serfs: fell the tree in front by the rules of the game (job system, real duration) -----
      case 'chop': {
        args(name, a, kw, []);
        const t = tileToward(e, 0);
        const m = s.map;
        const k = m.inBounds(t.x, t.y) ? m.idx(t.x, t.y) : -1;
        const node = k >= 0 && (m.flags[k] & OCCUPIED) ? s.entities.get(m.owner[k]) : null;
        if (!node || node.kind !== 'tree') throw gameErr('noTree', { what: tileKind(s, t.x, t.y) });
        const from = tileOfE(e);
        command({ type: 'assignWork', units: [e.id], target: node.id, once: true, player: e.owner });
        host.focusOn(e.id);
        return new Suspend({ k: 'chop', id: e.id, tree: node.id, x: from.x, y: from.y, until: s.tick + 600 * T });
      }
      case 'say': {
        const [text] = args(name, a, kw, ['text']);
        const dur = host.say(e.kind === 'hero' ? e.hero : null, text, null, null, true);
        return new Suspend({ k: 'dialog', until: s.tick + Math.min(dur, 30) });
      }
      // ----- orders that keep running (return at once) -----
      case 'work_on': {
        const [t] = args(name, a, kw, ['target']);
        const target = entityOf(t);
        command({ type: 'assignWork', units: [e.id], target: target.id, player: e.owner });
        return null;
      }
      case 'attack': {
        const [t] = args(name, a, kw, ['target']);
        const isThing = t instanceof PyHost && t.cls !== 'Place';
        // Serfs (no militia) fight with their fists, like a click on an opponent
        if (e.kind === 'unit' && !e.militia) {
          if (!isThing) throw new ScriptError('type', { what: 'entityNeeded', type: typeName(t) });
          command({ type: 'assignWork', units: [e.id], target: entityOf(t).id, player: e.owner });
        } else if (isThing) command({ type: 'order', units: [e.id], order: 'attack', target: entityOf(t).id, player: e.owner });
        else { const c = pt(t); command({ type: 'order', units: [e.id], order: 'attackMove', x: c.x, y: c.y, player: e.owner }); }
        return null;
      }
      case 'hold': case 'defend': {
        args(name, a, kw, []);
        command({ type: 'order', units: [e.id], order: name === 'hold' ? 'hold' : 'idle', player: e.owner });
        return null;
      }
      case 'upgrade': {
        args(name, a, kw, []);
        command({ type: 'upgradeBuilding', building: e.id, player: e.owner });
        return null;
      }
      // ----- weather power plant: the same command as the button at the plant (energy, waiting time, research) -----
      case 'can_change_weather': case 'change_weather': {
        const [stV] = args(name, a, kw, ['state']);
        const state = strArg(stV, 'state');
        if (!['summer', 'rain', 'winter'].includes(state)) throw gameErr('weatherUnknown', { name: state.slice(0, 40) });
        if (name === 'can_change_weather') return checkWeatherChange(s, e.owner, e, state) === null;
        command({ type: 'changeWeather', building: e.id, state, player: e.owner });
        return null;
      }
      case 'teleport': {
        const [t] = args(name, a, kw, ['target']);
        const c = pt(t);
        if (e.px === undefined) throw gameErr('cannotMove', {});
        e.px = tileCenter(c.x); e.py = tileCenter(c.y); e.path = [];
        if (e.order) e.order = { type: 'idle' };
        if (e.anchor) e.anchor = { x: e.px, y: e.py };
        if (e.goal !== undefined) e.goal = undefined;
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

  /**
   * Figures of a player in an area (@on_enter): missions see everything, player programs only the figures their
   * player sees (fog of war). Sorted by ID.
   */
  const inArea = (target, playerV, whoV) => {
    const c = pt(target);
    const list = sapi.unitsInArea(sim(), playerOf(playerV), { ...c, r: Math.max(1, c.r) }, strArg(whoV ?? 'any', 'who'));
    return list.filter(visibleTo).sort((x, y) => x.id - y.id).map(handle);
  };

  const known = [...Object.keys(globals), 'HUMAN', 'ENEMY', 'BANDITS', 'hero', ...HERO_IDS];
  return { natives, globals, dynamic, hostHooks, known, modules, vocab: hintVocab(level), inArea };
}
