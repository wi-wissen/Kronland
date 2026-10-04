// Building technologies: check, research progress (depends on the workers in the building)
// and effect on combat values, speed, armour and hit points.

import { BUILDING_TECHS } from '../data/buildingTechs.js';
import { BUILDINGS } from '../data/buildings.js';
import { REASONS } from '../reasons.js';

/**
 * Research points of a building technology: time × 10 ticks × workplaces of the building at the
 * required level (at least 1). Each working worker contributes 1 point per tick; fully staffed
 * the research thus takes exactly `time` seconds, with fewer workers correspondingly longer.
 */
export function buildingTechPoints(tech) {
  const t = BUILDING_TECHS[tech];
  const lv = BUILDINGS[t.building].levels;
  return t.time * 10 * Math.max(1, lv[Math.min(t.minLevel, lv.length - 1)].workers ?? 1);
}

const ZERO = Object.freeze({ attack: 0, armor: 0, range: 0, speed: 0, sight: 0, hpPercent: 0 });

/**
 * Sum of a player's technology bonuses for a target.
 * The result is cached; technologies are only ever added, so
 * the number of researched technologies suffices as a version marker.
 * @param {any} sim @param {number} owner
 * @param {'units'|'serfs'|'workers'|'militia'|'buildings'|'leaders'} target
 * @param {string} [line] troop line for target 'units'
 */
export function techBonus(sim, owner, target, line = '') {
  const p = sim.players[owner];
  if (!p || !p.techs.size) return ZERO;
  // Cache per player; invalid as soon as the set of technologies changes
  const all = (sim._techCache ??= []);
  let pc = all[owner];
  if (!pc || pc.v !== p.techs.size || pc.set !== p.techs) pc = all[owner] = { v: p.techs.size, set: p.techs, m: new Map() };
  const key = line ? target + line : target;
  const hit = pc.m.get(key);
  if (hit) return hit;
  const b = { attack: 0, armor: 0, range: 0, speed: 0, sight: 0, hpPercent: 0 };
  for (const id of p.techs) {
    const t = BUILDING_TECHS[id];
    if (!t) continue;
    for (const fx of t.effects) {
      if (fx.target !== target) continue;
      if (fx.lines && !fx.lines.includes(line)) continue;
      b.attack += fx.attack ?? 0; b.armor += fx.armor ?? 0; b.range += fx.range ?? 0;
      b.speed += fx.speed ?? 0; b.sight += fx.sight ?? 0; b.hpPercent += fx.hpPercent ?? 0;
    }
  }
  pc.m.set(key, b);
  return b;
}

/** Speed with percentage bonus. */
export const boosted = (base, percent) => (percent ? Math.trunc((base * (100 + percent)) / 100) : base);

/** Maximum HP of a building incl. masonry. */
export function buildingMaxHp(sim, b) {
  const base = BUILDINGS[b.type].levels[b.level].hp;
  if (b.owner < 0 || !sim.players[b.owner]) return base;
  return boosted(base, techBonus(sim, b.owner, 'buildings').hpPercent);
}

/** Reason why a building technology cannot be researched, or null. */
export function checkBuildingResearch(sim, owner, b, techId) {
  const t = typeof techId === 'string' && Object.hasOwn(BUILDING_TECHS, techId) ? BUILDING_TECHS[techId] : null;
  if (!t) return REASONS.unknownTech;
  if (!b || b.kind !== 'building' || b.owner !== owner) return REASONS.notOwnBuilding;
  if (b.type !== t.building) return REASONS.wrongBuilding;
  if (!b.done) return REASONS.notReady;
  const p = sim.players[owner];
  if (p.techs.has(techId)) return REASONS.alreadyResearched;
  if (b.research) return REASONS.researchRunning;
  for (const e of sim.entities.values()) {
    if (e.kind === 'building' && e.owner === owner && e.research?.tech === techId) return REASONS.researchElsewhere;
  }
  if (t.prev && !p.techs.has(t.prev)) return { code: REASONS.needPrevTech, params: { tech: t.prev } };
  if (b.level < t.minLevel) return { code: REASONS.needLevel, params: { building: b.type, level: t.minLevel } };
  if (t.fortress && (sim.findBuilding(owner, 'headquarters')?.level ?? 0) < 1) return REASONS.needFortress;
  if (!sim.canPay(owner, t.cost)) return REASONS.noResources;
  return null;
}

/** Start research (cost is paid immediately). */
export function startBuildingResearch(sim, owner, b, techId) {
  sim.pay(owner, BUILDING_TECHS[techId].cost);
  b.research = { tech: techId, progress: 0 };
  sim.events.push({ type: 'researchStarted', player: owner, tech: techId, building: b.id });
}

/**
 * Research points per tick: working workers (overtime ×2). Buildings without workplaces
 * (castle, village centre, military buildings) research at a fixed rate of 1 (i.e. exactly `time` seconds).
 */
export function researchRate(sim, b) {
  const slots = BUILDINGS[b.type].levels[b.level].workers ?? 0;
  if (!slots) return 1;
  let n = 0;
  for (const id of b.workers) {
    const w = sim.entities.get(id);
    if (!w || w.resting) continue;
    // works in the building or waits right next to it for raw goods
    if (w.state === 'working' || (w.state === 'waiting' && w.intent === 'wait' && w.target === b.id)) n++;
  }
  return b.overtime ? n * 2 : n;
}

/** Tick: progress of all building researches. */
export function updateBuildingResearch(sim) {
  for (const b of sim.entities.values()) {
    if (b.kind !== 'building' || !b.research || !BUILDING_TECHS[b.research.tech] || !b.done) continue;
    b.research.progress += researchRate(sim, b);
    if (b.research.progress >= buildingTechPoints(b.research.tech)) finishBuildingResearch(sim, b);
  }
}

export function finishBuildingResearch(sim, b) {
  const tech = b.research.tech;
  b.research = null;
  grantBuildingTech(sim, b.owner, tech);
  sim.events.push({ type: 'researchDone', player: b.owner, tech, name: BUILDING_TECHS[tech].name, building: b.id });
}

/** Credit the technology and apply one-time consequences (raise building HP). */
export function grantBuildingTech(sim, owner, tech) {
  const before = new Map();
  for (const e of sim.entities.values()) if (e.kind === 'building' && e.owner === owner && e.done) before.set(e.id, buildingMaxHp(sim, e));
  sim.players[owner].techs.add(tech);
  for (const e of sim.entities.values()) {
    const old = before.get(e.id);
    if (!old) continue;
    const now = buildingMaxHp(sim, e);
    if (now !== old) e.hp = Math.trunc((e.hp * now) / old);
  }
}
