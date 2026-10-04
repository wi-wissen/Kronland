// What a research at the college unlocks – derived from the game data so the
// tooltip never goes stale: new buildings (requires) and upgrade levels (UPGRADE_REQUIRES).

import { BUILDINGS, UPGRADE_REQUIRES } from '../sim/data/buildings.js';

/** Researches with special effects outside the building data (key → i18n text) */
const EXTRA = { education: ['bld.techTax'] };

/**
 * @param {string} techId
 * @returns {{ build: string[], upgrade: [string, number][], extra: string[] }}
 *   build: building types, upgrade: [type, target level index], extra: i18n keys
 */
export function techUnlocks(techId) {
  const build = Object.values(BUILDINGS).filter((b) => b.requires === techId).map((b) => b.id);
  const upgrade = [];
  for (const [type, reqs] of Object.entries(UPGRADE_REQUIRES)) {
    reqs.forEach((r, level) => { if (r === techId) upgrade.push([type, level]); });
  }
  return { build, upgrade, extra: EXTRA[techId] ?? [] };
}
