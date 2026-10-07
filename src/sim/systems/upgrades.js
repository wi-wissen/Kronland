// Building upgrades: run on their own, without serfs (original: GGL::CBuilding::UpgradeProgress over
// Upgrade/Time; the upgrade site ZB_UpgradeSite* is plain scaffolding without builder slots).
// While the upgrade runs, `done` is false and `level` already the target level (see isUpgrading).

import { isUpgrading } from '../data/buildings.js';
import { buildingMaxHp } from './techs.js';

/** One tick: every running upgrade advances by one point; at `work` the building is done. */
export function updateUpgrades(sim) {
  for (const b of sim.entities.values()) {
    if (b.done !== false || b.kind !== 'building' || !isUpgrading(b)) continue; // cheap test first: runs every tick
    b.progress++;
    const maxHp = buildingMaxHp(sim, b);
    b.hp = Math.max(b.hp, Math.trunc((maxHp * b.progress) / b.work));
    if (b.progress >= b.work) {
      b.done = true;
      b.hp = maxHp;
      sim.onBuildingDone(b);
    }
  }
}
