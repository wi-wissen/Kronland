// Workers: come from the village centre, work, eat at the farm, sleep in the house,
// have motivation and pay taxes on payday. Not directly controllable.

import { BUILDINGS } from '../data/buildings.js';
import { PROFESSIONS, WORKER as W, professionFor } from '../data/professions.js';
import { researchPoints, TECHS } from '../data/technologies.js';
import { moveAlong, pathTo, isAdjacent } from './movement.js';
import { tileCenter, toTile } from '../fixed.js';
import { techBonus, boosted } from './techs.js';
import { addWeatherEnergy } from './weather.js';

/**
 * @typedef {Object} Worker
 * @property {number} id
 * @property {'worker'} kind
 * @property {string} prof
 * @property {number} owner
 * @property {number} px @property {number} py
 * @property {number[]} path
 * @property {number} workplace
 * @property {number} home 0 = none
 * @property {number} farm 0 = none
 * @property {string} state 'walk' | 'working' | 'eating' | 'sleeping' | 'camping' | 'waiting'
 * @property {string} intent target of the walking
 * @property {number} target building being walked to
 * @property {number} timer
 * @property {number} stamina
 * @property {number} motivation percent
 * @property {number} carry raw goods in hand (refiner)
 * @property {boolean} resting
 * @property {boolean} ate
 * @property {boolean} inside inside the building (invisible)
 */

// ---------- Helpers ----------

/** Worker slots in a building (current level). */
export const workerSlots = (b) => BUILDINGS[b.type].levels[b.level].workers ?? 0;

export function maxMotivation(sim, owner) {
  let m = W.baseMaxMotivation;
  for (const e of sim.entities.values()) {
    if (e.kind === 'building' && e.owner === owner && e.done && BUILDINGS[e.type].motivationEffect) m += BUILDINGS[e.type].motivationEffect;
  }
  return Math.min(W.hardMaxMotivation, m);
}

export function workersOf(sim, owner) {
  const out = [];
  for (const e of sim.entities.values()) if (e.kind === 'worker' && e.owner === owner) out.push(e);
  return out;
}

export function averageMotivation(sim, owner) {
  const ws = workersOf(sim, owner);
  if (!ws.length) return W.startMotivation;
  return Math.trunc(ws.reduce((s, w) => s + w.motivation, 0) / ws.length);
}

const center = (b) => ({ x: b.x + (b.w >> 1), y: b.y + (b.h >> 1) });
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

function nearestDone(sim, owner, types, from, filter = () => true) {
  let best = null, bd = Infinity;
  for (const e of sim.entities.values()) {
    if (e.kind !== 'building' || e.owner !== owner || !e.done || !types.includes(e.type) || !filter(e)) continue;
    const d = d2(center(e), from);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

/** Assign bed and eating place (nearest, with a free spot, within reach of the workplace). */
export function assignHousing(sim, w) {
  const wp = sim.entities.get(w.workplace);
  if (!wp) return;
  const from = center(wp), maxD2 = W.maxDistance * W.maxDistance;
  const valid = (id, list) => { const b = sim.entities.get(id); return b && b.kind === 'building' && b[list].includes(w.id); };
  if (w.home && !valid(w.home, 'residents')) w.home = 0;
  if (w.farm && !valid(w.farm, 'eaters')) w.farm = 0;
  if (!w.home) {
    const h = nearestDone(sim, w.owner, ['residence'], from, (b) => b.residents.length < (BUILDINGS.residence.levels[b.level].beds ?? 0) && d2(center(b), from) <= maxD2);
    if (h) { h.residents.push(w.id); w.home = h.id; }
  }
  if (!w.farm) {
    const f = nearestDone(sim, w.owner, ['farm'], from, (b) => b.eaters.length < (BUILDINGS.farm.levels[b.level].seats ?? 0) && d2(center(b), from) <= maxD2);
    if (f) { f.eaters.push(w.id); w.farm = f.id; }
  }
}

/** Remove a worker (emigration, workplace gone). */
export function removeWorker(sim, w, reason) {
  for (const id of [w.home, w.farm, w.workplace]) {
    const b = sim.entities.get(id);
    if (b?.kind === 'building') {
      b.residents = b.residents.filter((x) => x !== w.id);
      b.eaters = b.eaters.filter((x) => x !== w.id);
      b.workers = b.workers.filter((x) => x !== w.id);
    }
  }
  sim.entities.delete(w.id);
  sim.events.push({ type: 'workerLeft', player: w.owner, worker: w.id, prof: w.prof, reason });
}

// ---------- Moving in ----------

/** New workers from village centres for free workplaces. */
export function updateSpawning(sim) {
  for (const vc of [...sim.entities.values()]) {
    if (vc.kind !== 'building' || vc.type !== 'villageCenter' || !vc.done) continue;
    if ((sim.tick + vc.id) % W.spawnTicks !== 0) continue;
    const owner = vc.owner;
    if (sim.popUsed(owner) >= sim.popLimit(owner)) continue;
    if (averageMotivation(sim, owner) < W.noNewSettlersBelow) continue;
    const wp = nearestDone(sim, owner, Object.keys(BUILDINGS), center(vc), (b) => !!professionFor(b.type) && b.workers.length < workerSlots(b));
    if (!wp) continue;
    const ring = sim.map.ring(vc.x, vc.y, vc.w, vc.h);
    if (!ring.length) continue;
    const t = ring[sim.tick % ring.length];
    /** @type {Worker} */
    const w = {
      id: sim.nextId++, kind: 'worker', prof: professionFor(wp.type), owner,
      px: tileCenter(t % sim.map.width), py: tileCenter((t / sim.map.width) | 0), path: [],
      workplace: wp.id, home: 0, farm: 0, state: 'idle', intent: '', target: 0, timer: 0,
      stamina: W.maxStamina, motivation: Math.min(W.startMotivation, maxMotivation(sim, owner)),
      carry: 0, resting: false, ate: false, inside: false,
    };
    sim.entities.set(w.id, w);
    wp.workers.push(w.id);
    assignHousing(sim, w);
    sim.events.push({ type: 'workerArrived', player: owner, worker: w.id, prof: w.prof, workplace: wp.id });
    decide(sim, w);
  }
}

// ---------- Ablauf ----------

function walkTo(sim, w, b, intent) {
  w.inside = false;
  w.intent = intent;
  w.target = b.id;
  if (isAdjacent(w, b)) { w.path = []; arrive(sim, w); return; }
  const p = pathTo(sim, w, sim.map.ring(b.x, b.y, b.w, b.h));
  if (!p) { w.state = 'waiting'; w.timer = 20; return; }
  w.path = p;
  w.state = 'walk';
}

function campOf(sim, w) {
  const wp = sim.entities.get(w.workplace);
  return nearestDone(sim, w.owner, ['villageCenter', 'headquarters'], wp ? center(wp) : { x: toTile(w.px), y: toTile(w.py) });
}

const motivationFactor = (w) => Math.max(10, w.motivation);

/** Choose the next step. */
function decide(sim, w) {
  const wp = sim.entities.get(w.workplace);
  if (!wp) { removeWorker(sim, w, 'noWorkplace'); return; }
  if (!w.resting && w.stamina < W.cycleCost) w.resting = true;

  if (w.resting) {
    if (!w.ate) {
      const farm = sim.entities.get(w.farm);
      if (farm?.done) return walkTo(sim, w, farm, 'eat');
      const camp = campOf(sim, w);
      if (camp) return walkTo(sim, w, camp, 'campEat');
    } else {
      const home = sim.entities.get(w.home);
      if (home?.done) return walkTo(sim, w, home, 'sleep');
      const camp = campOf(sim, w);
      if (camp) return walkTo(sim, w, camp, 'campSleep');
    }
    w.state = 'waiting'; w.timer = 20; return;
  }

  if (!wp.done) return walkTo(sim, w, wp, 'wait');
  const prof = PROFESSIONS[w.prof];
  if (prof.kind === 'refine' && w.carry === 0) {
    if (sim.players[w.owner].raw[prof.res] <= 0) return walkTo(sim, w, wp, 'wait');
    const supply = nearestDone(sim, w.owner, ['headquarters', 'storehouse', `${prof.res}Mine`], center(wp));
    if (supply) return walkTo(sim, w, supply, 'fetch');
    return walkTo(sim, w, wp, 'wait');
  }
  walkTo(sim, w, wp, 'work');
}

function arrive(sim, w) {
  const prof = PROFESSIONS[w.prof];
  switch (w.intent) {
    case 'eat': w.state = 'eating'; w.timer = W.eatTicks; w.inside = true; break;
    case 'sleep': w.state = 'sleeping'; w.timer = W.sleepTicks; w.inside = true; break;
    case 'campEat': case 'campSleep': w.state = 'camping'; w.timer = W.campTicks; break;
    case 'fetch': {
      const p = sim.players[w.owner];
      const amt = Math.min(W.fetchAmount, p.raw[prof.res]);
      p.raw[prof.res] -= amt;
      w.carry = amt;
      decide(sim, w);
      break;
    }
    case 'work': {
      const wp = sim.entities.get(w.workplace);
      w.state = 'working'; w.inside = true;
      w.timer = wp?.overtime ? Math.trunc((prof.cycle * 100) / W.overtimeSpeedPercent) : prof.cycle;
      break;
    }
    default: w.state = 'waiting'; w.timer = 20;
  }
}

function finishCycle(sim, w) {
  const prof = PROFESSIONS[w.prof];
  const wp = sim.entities.get(w.workplace);
  const p = sim.players[w.owner];
  switch (prof.kind) {
    case 'mine': p.raw[BUILDINGS[wp.type].shaftResource] += prof.yield; break;
    case 'refine': if (w.carry > 0) { w.carry--; p.stock[prof.res] += prof.yield; } break;
    case 'gold': p.stock.gold += prof.yield; break;
    case 'faith': p.faith += prof.yield; break;
    case 'energy': addWeatherEnergy(sim, w.owner, prof.yield); break;
    default: break;
  }
  w.stamina -= W.cycleCost;
  if (wp?.overtime) w.motivation = Math.max(0, w.motivation + W.overtimeMotivation);
}

/** Tick of a worker. */
export function updateWorker(sim, w) {
  const wp = sim.entities.get(w.workplace);
  if (!wp) { removeWorker(sim, w, 'noWorkplace'); return; }
  if ((sim.tick + w.id) % 50 === 0 && (!w.home || !w.farm)) assignHousing(sim, w);

  switch (w.state) {
    case 'walk': {
      const target = sim.entities.get(w.target);
      if (!target) { decide(sim, w); return; }
      if (moveAlong(sim, w, boosted(W.speed, techBonus(sim, w.owner, 'workers').speed))) {
        if (isAdjacent(w, target)) arrive(sim, w); else decide(sim, w);
      }
      return;
    }
    case 'working': {
      if (!wp.done) { decide(sim, w); return; }
      // Scholars research while working
      if (PROFESSIONS[w.prof].kind === 'research' && wp.research) {
        wp.research.progress += wp.overtime ? 2 : 1;
        if (wp.research.progress >= researchPoints(wp.research.tech)) finishResearch(sim, wp);
      }
      if (--w.timer > 0) return;
      finishCycle(sim, w);
      decide(sim, w);
      return;
    }
    case 'eating':
      if (--w.timer > 0) return;
      w.stamina = Math.min(W.maxStamina, w.stamina + Math.trunc((W.eatGain * motivationFactor(w)) / 100));
      w.ate = true;
      decide(sim, w);
      return;
    case 'sleeping':
      if (--w.timer > 0) return;
      w.stamina = Math.min(W.maxStamina, w.stamina + Math.trunc((W.sleepGain * motivationFactor(w)) / 100));
      w.ate = false; w.resting = false;
      decide(sim, w);
      return;
    case 'camping':
      if (--w.timer > 0) return;
      w.stamina = Math.min(W.maxStamina, w.stamina + Math.trunc((W.campGain * motivationFactor(w)) / 100));
      if (w.intent === 'campEat') w.ate = true; else { w.ate = false; w.resting = false; }
      decide(sim, w);
      return;
    default:
      if (--w.timer > 0) return;
      decide(sim, w);
  }
}

function finishResearch(sim, b) {
  const tech = b.research.tech;
  sim.players[b.owner].techs.add(tech);
  b.research = null;
  sim.events.push({ type: 'researchDone', player: b.owner, tech, name: TECHS[tech].name });
}

/** Change motivation on payday; whoever falls below the limit emigrates. */
export function paydayMotivation(sim, owner, delta) {
  const max = maxMotivation(sim, owner);
  for (const w of workersOf(sim, owner)) {
    w.motivation = Math.max(0, Math.min(max, w.motivation + delta));
    if (w.motivation < W.leaveBelow) removeWorker(sim, w, 'motivation');
  }
}
