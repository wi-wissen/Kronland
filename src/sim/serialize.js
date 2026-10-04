// Save game: store and load. The entire simulation state becomes JSON;
// after loading, the simulation continues exactly as if it had never been saved.

import { Sim } from './sim.js';
import { Rng } from './rng.js';
import { TileMap } from './map.js';
import { MissionRuntime } from './missions/runtime.js';
import { createMarket } from './systems/market.js';
import { saveVision, loadVision } from './systems/vision.js';

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

export const SAVE_VERSION = 1;

/** @param {Sim} sim @param {any} [extra] e.g. state of the AI opponents */
export function saveGame(sim, extra = {}) {
  // Deep copy: the save game shares no objects with the running simulation
  return structuredClone({
    version: SAVE_VERSION,
    seed: sim.seed,
    tick: sim.tick,
    nextId: sim.nextId,
    rng: sim.rng.getState(),
    waterLevel: sim.waterLevel,
    starts: sim.starts,
    spots: sim.spots,
    shafts: sim.shafts,
    // Expansion: on/off and bridge sites
    addon: !!sim.addon,
    bridgeSites: sim.bridgeSites ?? [],
    weather: sim.weather,
    weatherCycle: sim.weatherCycle,
    winner: sim.winner,
    market: sim.market,
    pending: sim.pending,
    map: {
      width: sim.map.width, height: sim.map.height, frozen: sim.map.frozen,
      heights: toB64(sim.map.heights), flags: toB64(sim.map.flags), owner: toB64(sim.map.owner),
    },
    players: sim.players.map((p) => ({ ...p, techs: [...p.techs] })),
    entities: [...sim.entities.values()],
    // Mission state (pure JSON); the definition is found by ID when loading
    mission: sim.mission ? sim.mission.getState() : null,
    // Fog of war: explored/visible tiles as bitfields, last seen buildings
    vision: saveVision(sim, toB64),
    extra,
  });
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
  Object.assign(sim, {
    seed: data.seed, tick: data.tick, nextId: data.nextId, map, waterLevel: data.waterLevel,
    starts: data.starts, spots: data.spots, shafts: data.shafts, weather: data.weather,
    weatherCycle: data.weatherCycle, winner: data.winner, pending: data.pending ?? [], events: [],
    market: data.market ?? createMarket(),
    addon: !!data.addon, bridgeSites: data.bridgeSites ?? [],
  });
  sim.rng = new Rng(0);
  sim.rng.setState(data.rng);
  sim.players = data.players.map((p) => ({ ...p, techs: new Set(p.techs) }));
  sim.entities = new Map(data.entities.map((e) => [e.id, e]));
  sim.mission = data.mission ? MissionRuntime.fromState(data.mission) : null;
  loadVision(sim, data.vision, fromB64);
  return sim;
}
