// Keyboard keys of the hero abilities in the army panel.

/**
 * Keys of the hero abilities, handed out in order over all selected heroes (Nelia X C, Orrin V G, Taran T N) –
 * every ability has its own key. Numbers belong to the control groups, WASD, QE, R, F to the camera, H, B, M to the bar.
 */
export const ABILITY_KEYS = ['x', 'c', 'v', 'g', 't', 'n'];

/** Key per ability of the selected heroes: [{ key, hero, ability }] in the order of the panel. */
export function abilityKeyMap(heroes) {
  const out = [];
  for (const h of heroes ?? []) for (const a of h.abilities) if (out.length < ABILITY_KEYS.length) out.push({ key: ABILITY_KEYS[out.length], hero: h, ability: a });
  return out;
}
