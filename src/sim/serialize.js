// Save game: store and load. The entire simulation state becomes JSON;
// after loading, the simulation continues exactly as if it had never been saved.

import { Sim } from './sim.js';
import { Rng } from './rng.js';
import { TileMap } from './map.js';
import { MissionRuntime } from './missions/runtime.js';
import { createMarket } from './systems/market.js';
import { saveVision, loadVision } from './systems/vision.js';
import { levelTrackMode } from './systems/ground.js';
import { BALANCE } from './data/balance.js';

const toB64 = (typed) => {
  const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b64, Type) => {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return new Type(bytes.buffer);
};

/** 2: campaign "Krone aus Eis" (new heroes), expansion without inn/specialists/rifleman */
export const SAVE_VERSION = 2;

/** @param {Sim} sim @param {any} [extra] e.g. state of the AI opponents */
export function saveGame(sim, extra = {}, { clone = true } = {}) {
  // Deep copy: the save game shares no objects with the running simulation. Without the copy (clone: false)
  // the result points to the running state and must be turned into text immediately, within the same tick
  // (autosave: on large maps saves half the time, see docs/PERFORMANCE.md).
  const state = {
    version: SAVE_VERSION,
    seed: sim.seed,
    tick: sim.tick,
    nextId: sim.nextId,
    rng: sim.rng.getState(),
    waterLevel: sim.waterLevel,
    starts: sim.starts,
    spots: sim.spots,
    shafts: sim.shafts,
    // Bridge sites
    bridgeSites: sim.bridgeSites ?? [],
    weather: sim.weather,
    // Game option "tracks" and whether the level fixes it
    trackMode: sim.trackMode,
    trackModeFixed: sim.trackModeFixed,
    weatherCycle: sim.weatherCycle,
    winner: sim.winner,
    market: sim.market,
    pending: sim.pending,
    map: {
      width: sim.map.width, height: sim.map.height, frozen: sim.map.frozen,
      heights: toB64(sim.map.heights), flags: toB64(sim.map.flags), owner: toB64(sim.map.owner),
      // Ground: tracks (one byte per tile) and items [[tile, kind], …] sorted by tile
      tracks: toB64(sim.map.tracks),
      items: [...sim.map.items.keys()].sort((a, b) => a - b).map((k) => [k, sim.map.items.get(k)]),
    },
    players: sim.players.map((p) => ({ ...p, techs: [...p.techs] })),
    diplomacy: sim.diplomacy ?? {},
    entities: [...sim.entities.values()],
    // Mission state (pure JSON); the definition is found by ID when loading
    mission: sim.mission ? sim.mission.getState() : null,
    // Fog of war: explored/visible tiles as bitfields, last seen buildings
    vision: saveVision(sim, toB64),
    extra,
  };
  return clone ? structuredClone(state) : state;
}

/**
 * Align older save games (without a new version number, the conversion is lossless enough):
 * resting/waiting workers and serfs mining used to stand on a tile spot (`spot`),
 * now on a ring slot (`slot`, src/sim/systems/spots.js). The old tile spot is dropped; the figure
 * picks a ring slot at the next step (until then it stays where it is).
 */
export function migrateEntity(e) {
  if (e.slot !== undefined || e.spot === undefined) return e;
  if (e.kind === 'worker') { delete e.spot; e.slot = -1; } else if (e.kind === 'unit' && e.job?.kind === 'gather') { e.spot = -1; e.slot = -1; }
  return e;
}

/** @returns {Sim} */
export function loadGame(data) {
  if (data?.version !== SAVE_VERSION) throw new Error('Save game does not match this version');
  // Copy, so that the same save game can be loaded several times without the simulations sharing objects
  data = structuredClone(data);
  const sim = Object.create(Sim.prototype);
  const map = new TileMap(data.map.width, data.map.height);
  map.heights = fromB64(data.map.heights, Int32Array);
  map.flags = fromB64(data.map.flags, Uint8Array);
  map.owner = fromB64(data.map.owner, Int32Array);
  map.frozen = data.map.frozen;
  // Older save games have no ground yet: no tracks, no items
  if (data.map.tracks) map.tracks = fromB64(data.map.tracks, Uint8Array);
  for (const [k, kind] of data.map.items ?? []) map.items.set(k, kind);
  Object.assign(sim, {
    seed: data.seed, tick: data.tick, nextId: data.nextId, map, waterLevel: data.waterLevel,
    starts: data.starts, spots: data.spots, shafts: data.shafts, weather: data.weather,
    weatherCycle: data.weatherCycle, winner: data.winner, pending: data.pending ?? [], events: [],
    market: data.market ?? createMarket(),
    bridgeSites: data.bridgeSites ?? [],
  });
  sim.rng = new Rng(0);
  sim.rng.setState(data.rng);
  sim.players = data.players.map((p) => ({ ...p, techs: new Set(p.techs) }));
  sim.diplomacy = data.diplomacy ?? {};
  sim.entities = new Map(data.entities.map((e) => [e.id, migrateEntity(e)]));
  sim.mission = data.mission ? MissionRuntime.fromState(data.mission) : null;
  // Older save games: the mode of the level (world.tracks) or the default
  const fixedTracks = levelTrackMode(sim.mission?.def?.tracks);
  sim.trackMode = data.trackMode ?? fixedTracks ?? BALANCE.ground.tracks.defaultMode;
  sim.trackModeFixed = data.trackModeFixed ?? !!fixedTracks;
  loadVision(sim, data.vision, fromB64);
  // Scripts (VM states) need the finished simulation
  sim.mission?.afterLoad(sim);
  return sim;
}
