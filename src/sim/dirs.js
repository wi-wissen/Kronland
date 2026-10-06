// Directions as integer vectors for the simulation – no floating-point angles (Math.sin is not equally
// precise everywhere). For circles around a target: surrounding in melee, spots at the campfire, at the tree, in front of buildings.

/** sin(0°, 5°, …, 90°) × 1000, rounded. */
const SIN5 = [0, 87, 174, 259, 342, 423, 500, 574, 643, 707, 766, 819, 866, 906, 940, 966, 985, 996, 1000];

const sin72 = (i) => {
  const j = ((i % 72) + 72) % 72;
  return j <= 18 ? SIN5[j] : j <= 36 ? SIN5[36 - j] : -sin72(j - 36);
};

/** 72 directions in a 5° grid (length 1000), index 0 = +x, counter-clockwise towards +y. */
export const DIR72 = Object.freeze(Array.from({ length: 72 }, (_, k) => Object.freeze({ x: sin72(k + 18), y: sin72(k) })));

/** Divisors of 72 – this many spots fit evenly on a circle made from DIR72. */
export const RING_SIZES = [72, 36, 24, 18, 12, 9, 8, 6, 4, 3, 2, 1];
