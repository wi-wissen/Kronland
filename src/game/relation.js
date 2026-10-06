// Diplomacy from the player's point of view for displaying foreign figures and buildings (read-only).

import { BANDIT_TEAM } from '../sim/missions/runtime.js';

/**
 * How does the owner `owner` stand towards the player `me`?
 * @param {import('../sim/sim.js').Sim} sim
 * @returns {{ rel: 'own'|'allied'|'neutral'|'hostile'|'nature', bandits: boolean, village: string|null }}
 */
export function relationOf(sim, me, owner) {
  if (owner === undefined || owner === null || owner < 0 || !sim.players[owner]) return { rel: 'nature', bandits: false, village: null };
  if (owner === me) return { rel: 'own', bandits: false, village: null };
  const p = sim.players[owner];
  return { rel: sim.relation(me, owner), bandits: p.team === BANDIT_TEAM, village: p.village ?? null };
}

/** May the insides of a foreign building (workers, beds, mood) be shown? Only own and allied. */
export const showsInterior = (r) => r.rel === 'own' || r.rel === 'allied';
