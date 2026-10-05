// Variants of a figure role (e.g. serf male/female): pure functions without Three.js, so that
// rendering and sound (voice matching the look) make the same choice.

/**
 * Choose a variant for a unit: weighted, stable via the unit ID (looks random, but stays the same
 * across loading and replays). Rendering only – the simulation knows no variants.
 * @param {{weight?: number}[]} variants @param {number} id
 * @returns {number} index
 */
export function pickVariant(variants, id) {
  if (!variants?.length) return 0;
  let total = 0;
  for (const v of variants) total += Math.max(0, v.weight ?? 1);
  if (!(total > 0)) return 0;
  // Integer hash (murmur3 finalizer), independent of the phase offset of the animations
  let h = (id | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h = (h ^ (h >>> 16)) >>> 0;
  let x = (h / 4294967296) * total;
  for (let i = 0; i < variants.length; i++) {
    x -= Math.max(0, variants[i].weight ?? 1);
    if (x < 0) return i;
  }
  return variants.length - 1;
}
