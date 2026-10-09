// Computer opponents inside the simulation tick (lockstep): Sim.step calls runAi() first, before it applies the
// commands of the tick. Every AI thinks on its own cadence (DIFFICULTY.think, staggered by player); its commands go
// through `sim.command` into `sim.pending` and are validated and applied in the same tick like every other command
// (AI commands first, then the commands handed to step – the order the engine used before).
//
// State: `sim.ai` – one plain record per AI player (AiState, sorted by player), saved by src/sim/serialize.js and
// part of the state hash. Brains (AiPlayer objects) are only a per-simulation cache without memory of their own.
//
// Errors: an exception in the AI code is deterministic (same code, same state on every client). The decision is
// dropped (no commands), the simulation reports `aiError` and counts it in the record; after AI_ERROR_LIMIT failing
// ticks in a row the AI is switched off for good (`disabled`, event `aiDisabled`) – identically on every client.

import { AiPlayer, createAiState } from './AiPlayer.js';

/** Failing AI ticks in a row until the AI is switched off. */
export const AI_ERROR_LIMIT = 3;

/** @type {WeakMap<object, Map<number, AiPlayer>>} brains per simulation (cache, no state) */
const brains = new WeakMap();

/**
 * Make a player a computer opponent (replaces an existing AI of that player).
 * @param {import('../sim/sim.js').Sim} sim @param {number} player @param {string} [difficulty]
 * @returns {AiPlayer}
 */
export function addAi(sim, player, difficulty = 'normal') {
  sim.ai = (sim.ai ?? []).filter((s) => s.player !== player);
  sim.ai.push(createAiState(sim, player, difficulty));
  sim.ai.sort((a, b) => a.player - b.player);
  return /** @type {AiPlayer} */ (aiOf(sim, player));
}

/**
 * Brain of a player's AI (reads and writes the record in sim.ai), or null.
 * @param {import('../sim/sim.js').Sim} sim @param {number} player @returns {AiPlayer|null}
 */
export function aiOf(sim, player) {
  const st = sim.ai?.find((s) => s.player === player);
  if (!st) return null;
  let map = brains.get(sim);
  if (!map) brains.set(sim, (map = new Map()));
  let brain = map.get(player);
  if (!brain || brain.st !== st) map.set(player, (brain = new AiPlayer(sim, player, st.difficulty, st)));
  return brain;
}

/** All AI brains of the simulation, sorted by player. @param {import('../sim/sim.js').Sim} sim */
export function aisOf(sim) {
  return (sim.ai ?? []).map((st) => /** @type {AiPlayer} */ (aiOf(sim, st.player)));
}

/**
 * AI part of the tick: every active AI decides; its commands go through sim.command into sim.pending. An optional `sim.clock`
 * (wall clock, set by the engine) measures the time in `sim.aiMs` – read-only, never part of the state.
 * @param {import('../sim/sim.js').Sim} sim
 */
export function runAi(sim) {
  const list = sim.ai;
  if (!list?.length) return;
  const clock = sim.clock;
  const t0 = clock ? clock() : 0;
  for (const st of list) {
    if (st.disabled || !sim.players[st.player] || sim.players[st.player].defeated) continue;
    let cmds;
    try {
      cmds = /** @type {AiPlayer} */ (aiOf(sim, st.player)).run();
    } catch (err) {
      st.errors++;
      const e = /** @type {any} */ (err);
      sim.events.push({ type: 'aiError', player: st.player, message: String(e?.message ?? e).slice(0, 300), stack: String(e?.stack ?? '').slice(0, 2000) });
      if (st.errors >= AI_ERROR_LIMIT) {
        st.disabled = true;
        sim.events.push({ type: 'aiDisabled', player: st.player });
      }
      continue;
    }
    if (!cmds) continue;
    st.errors = 0;
    for (const c of cmds) sim.command(c);
  }
  if (clock) sim.aiMs = clock() - t0;
}

/**
 * AI memory into the state hash (nothing without AI, so hashes of games without AI stay as they were).
 * @param {import('../sim/sim.js').Sim} sim @param {import('../sim/hash.js').Hasher} h
 */
export function hashAi(sim, h) {
  const list = sim.ai;
  if (!list?.length) return;
  h.int(list.length);
  for (const st of list) {
    h.int(st.player).str(String(st.difficulty)).str(st.armyState).int(st.attackStrength).int(st.attackNowSeen);
    for (const v of st.rng) h.int(v);
    h.int(st.forceAttack ? 1 : 0).int(st.errors).int(st.disabled ? 1 : 0);
  }
}
