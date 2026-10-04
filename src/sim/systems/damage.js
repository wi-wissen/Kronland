// Building damage: below 50 % HP a finished building burns and slowly loses further HP
// until serfs repair it. Destroyed buildings leave a ruin that disappears after a
// while and blocks the spot until then.

import { buildingMaxHp } from './techs.js';

export const DAMAGE = {
  burnBelowPercent: 50,   // source: the original burns from about half (A for the exact threshold)
  burnTicks: 5,           // every 0.5 s … (A)
  burnHp: 1,              // … 1 HP loss → 2 HP/s (A)
  repairHpPerTick: 1,     // per serf and tick (A); repair costs no resources (A)
  ruinTicks: 600,         // ruin stays for 60 s (A)
};

/** Is the building damaged (finished and below full HP)? */
export const isDamaged = (sim, b) => b.kind === 'building' && b.done && b.hp < buildingMaxHp(sim, b);

/** Is the building burning (finished and below the burn threshold)? */
export const isBurning = (sim, b) => b.done && b.hp * 100 < buildingMaxHp(sim, b) * DAMAGE.burnBelowPercent;

/** Tick: fires, ruins. */
export function updateDamage(sim) {
  for (const e of [...sim.entities.values()]) {
    if (e.kind === 'ruin') {
      if (sim.tick >= e.until) {
        sim.removeEntity(e);
        sim.events.push({ type: 'ruinCleared', ruin: e.id });
      }
      continue;
    }
    if (e.kind !== 'building') continue;
    const burning = isBurning(sim, e);
    if (burning !== !!e.burning) {
      e.burning = burning;
      sim.events.push({ type: burning ? 'buildingBurning' : 'buildingExtinguished', player: e.owner, building: e.id });
    }
    if (burning && (sim.tick + e.id) % DAMAGE.burnTicks === 0) {
      e.hp -= DAMAGE.burnHp;
      if (e.hp <= 0) sim.destroyBuilding(e, null);
    }
  }
}

/** Create a ruin at the site of a destroyed building (blocks the area). */
export function createRuin(sim, b) {
  const r = {
    id: sim.nextId++, kind: 'ruin', type: b.type, level: b.level, owner: -1, formerOwner: b.owner,
    x: b.x, y: b.y, w: b.w, h: b.h, until: sim.tick + DAMAGE.ruinTicks,
  };
  sim.entities.set(r.id, r);
  sim.map.occupy(r.x, r.y, r.w, r.h, r.id);
  return r;
}
