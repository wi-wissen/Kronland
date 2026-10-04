// Damage model: structure as in the model (dedk.de wiki "damage model"), factors own (A),
// strengths and weaknesses the same (pierce vs. cavalry, slash vs. light armour, siege vs. buildings).
// Damage = attack × factor(attack type, armour type) − target armour + random 0…2

/** Factors in percent. Row = attack type, column = armour type. */
export const DAMAGE_FACTORS = {
  pierce: { none: 140, padded: 100, leather: 95, iron: 155, fortified: 30, hero: 90 },    // pierce
  slash:  { none: 100, padded: 160, leather: 140, iron: 95, fortified: 40, hero: 100 },   // slash
  shot:   { none: 100, padded: 180, leather: 100, iron: 100, fortified: 30, hero: 120 },  // shot
  chaos:  { none: 110, padded: 100, leather: 140, iron: 120, fortified: 70, hero: 100 },
  siege:  { none: 25, padded: 25, leather: 25, iron: 25, fortified: 160, hero: 25 },      // siege
  hero:   { none: 100, padded: 100, leather: 100, iron: 100, fortified: 60, hero: 100 },
};

/**
 * @param {number} attack
 * @param {keyof typeof DAMAGE_FACTORS} attackType
 * @param {string} armorType
 * @param {number} armor
 * @param {number} bonus random part 0…2
 */
export function computeDamage(attack, attackType, armorType, armor, bonus = 0) {
  const f = DAMAGE_FACTORS[attackType]?.[armorType] ?? 100;
  return Math.max(1, Math.trunc((attack * f) / 100) - armor + bonus);
}

export const COMBAT = {
  sight: 9,             // tiles: automatically attack enemies (A)
  leash: 14,            // tiles: defenders do not chase further (A)
  meleeRange: 1300,     // milli-tiles (A)
  heroReviveTicks: 100, // 10 s without enemies nearby (source)
  heroReviveRadius: 8,
  gridCell: 8,          // tiles per cell of the search grid
};
