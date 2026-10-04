// Invisibility (expansion: thief, fog veil) – without further dependencies, so that vision (vision.js),
// combat (military.js) and rendering use the same rule without import cycles.
//   e.hidden  true  = no enemy detects the figure (invisible to all enemies, cannot be attacked)
//   e.seenBy  bitmask of the teams whose towers/scouts currently detect it (only set for thieves and
//             veiled troops). Only these teams see and fight it – a tower of
//             player B does not reveal a thief of A to player C.

/**
 * Is e invisible to `player`? Allies always see their own people (callers check that beforehand).
 * @param {import('../sim.js').Sim} sim @param {number} player @param {any} e
 */
export function hiddenFrom(sim, player, e) {
  if (e.hidden) return true;
  if (e.seenBy === undefined) return false;
  const team = sim.players[player]?.team;
  return team !== undefined && !(e.seenBy & (1 << team));
}
