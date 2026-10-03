// Schadensmodell (Quelle: dedk.de-Wiki "Schadensmodell").
// Damage = attack × factor(attack type, armour type) − target armour + random 0…2

/** Factors in percent. Row = attack type, column = armour type. */
export const DAMAGE_FACTORS = {
  pierce: { none: 150, padded: 100, leather: 100, iron: 150, fortified: 30, hero: 90 },   // Stich
  slash:  { none: 100, padded: 170, leather: 150, iron: 100, fortified: 40, hero: 100 },  // Schlag
  shot:   { none: 100, padded: 180, leather: 100, iron: 100, fortified: 30, hero: 120 },  // shot
  chaos:  { none: 100, padded: 100, leather: 150, iron: 125, fortified: 75, hero: 100 },
  siege:  { none: 20, padded: 20, leather: 20, iron: 20, fortified: 170, hero: 20 },      // Belagerung
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
