// Keyboard keys of the hero abilities in the army panel. Abilities show only for a hero selected on its own,
// so the keys are always the same per ability slot.

/** Keys of the ability slots of the selected hero (numbers belong to the control groups, WASD, QE, R, F to the camera). */
export const ABILITY_KEYS = ['x', 'c', 'v'];

/** Key per ability of the given heroes: [{ key, hero, ability }] in order (the panel passes the single selected hero). */
export function abilityKeyMap(heroes) {
  const out = [];
  for (const h of heroes ?? []) for (const a of h.abilities) if (out.length < ABILITY_KEYS.length) out.push({ key: ABILITY_KEYS[out.length], hero: h, ability: a });
  return out;
}
