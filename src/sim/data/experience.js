// Experience of squad leaders: 5 stars, gained through hits by the squad.
// Effects per manual (tier texts); numbers are assumptions (A). Effects are cumulative.
//   1 ★ Gefreiter:     combat tactics – chance of critical hits (double damage)
//   2 ★ Feldwebel:     combat instinct – ranged units/cavalry see and shoot further
//   3 ★ Hauptmann:     regeneration – squad slowly heals itself
//   4 ★ Kommandant:    attack strength rises
//   5 ★ General:       ranged units hit better (more damage), melee units defend better

export const EXPERIENCE = {
  thresholds: [15, 40, 80, 140, 220], // hits until star 1 … 5 (A)
  critPercent: 10,                     // 1 ★ (A)
  rangeBonus: 1000,                    // 2 ★, ranged only, milli-tiles (A)
  sightBonus: 2,                       // 2 ★, tiles (A)
  regenTicks: 20,                      // 3 ★: every 2 s … (A)
  regenHp: 2,                          // … +2 HP for squad leader and soldiers (A)
  attackBonus: 2,                      // 4 ★ (A)
  rangedAttackBonus: 2,                // 5 ★, ranged (A)
  meleeArmorBonus: 1,                  // 5 ★, melee (A)
};

/** Stars to experience points. */
export function starsOf(xp) {
  let s = 0;
  for (const t of EXPERIENCE.thresholds) if ((xp ?? 0) >= t) s++;
  return s;
}

export const RANK_NAMES = ['Rekrut', 'Gefreiter', 'Feldwebel', 'Hauptmann', 'Kommandant', 'General'];
