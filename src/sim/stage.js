// "Run" restarts the stage (coding missions): on the first run after a new sub-goal became active the world is
// remembered (snapshot = a normal save game), every further run starts again from that snapshot. So a prediction
// or a second try always begins where the stage began, not where the last attempt left Nelia.
//
// Determinism and lockstep: snapshot and restore only use the save format (saveGame/loadGame, hash equal after a
// restore) and happen between two ticks, right before the run command of the player is applied. In a lockstep game
// every peer would take the snapshot when the first run command of a stage arrives and swap in its own copy when a
// later one arrives – all peers hold the same state at that tick, so they swap to the same world. The run command
// itself stays the only input (docs/SKRIPTE.md#neustart-je-etappe).

import { saveGame, loadGame } from './serialize.js';

/** Key of the current stage: the active sub-goals. A new sub-goal (or one more done) gives a new key. */
export function stageKey(sim) {
  return sim.mission?.stageKey() ?? '';
}

/**
 * Does "Run" restart the stage? Only in levels with a player program, until the end of the mission. Scenario
 * field `reset: false` switches it off, the mission program decides at runtime with reset(False) / reset().
 * @param {import('./sim.js').Sim} sim
 */
export function resetEnabled(sim) {
  const m = sim.mission;
  const sc = m?.def?.scenario;
  if (!sc || !m.script || m.state.result) return false;
  if (!(sc.sections ?? []).some((s) => s.level === 'player')) return false;
  const own = m.script.state.reset;
  return typeof own === 'boolean' ? own : sc.reset !== false;
}

/**
 * Restore a snapshot. Counters that only number messages for the UI (dialogue lines, console, notes) carry on from
 * the current world, so panel and dialogue box treat everything after the restart as new. They are not part of the
 * state hash: a restored world hashes like the snapshot. Everything else – also program.runs and with it the
 * random numbers of the player program – is as in the snapshot, so the same program gives the same run again.
 * @param {any} data snapshot (save game)
 * @param {import('./sim.js').Sim|null} current the world before the restart
 */
export function restoreStage(data, current) {
  const sim = loadGame(data);
  carryCounters(current, sim);
  return sim;
}

/**
 * Display counters (dialogue, console, notes) of the new world carry on from the old one – after a stage restart and
 * after the world switcher – so that dialogue box and panel treat everything after the swap as new. Not in the hash.
 * @param {import('./sim.js').Sim|null} current @param {import('./sim.js').Sim} sim
 */
export function carryCounters(current, sim) {
  const a = current?.mission, b = sim.mission;
  if (!a || !b) return;
  b.state.seq = Math.max(b.state.seq ?? 0, a.state.seq ?? 0);
  b.state.dialogSkip = Math.max(b.state.dialogSkip ?? 0, a.state.dialogSkip ?? 0);
  if (a.script && b.script) {
    const x = a.script.state, y = b.script.state;
    y.seq = Math.max(y.seq ?? 0, x.seq ?? 0);
    y.skipSeq = Math.max(y.skipSeq ?? 0, x.skipSeq ?? 0);
  }
}

/** The snapshot of the current stage (kept by the engine, saved in the envelope `extra.stage`). */
export class StageSnapshot {
  /** @param {{ key: string, data: any }|null} [saved] */
  constructor(saved = null) {
    this.key = saved?.key ?? null;
    this.data = saved?.data ?? null;
  }

  /**
   * Right before the run command: the first run of a stage remembers the world and returns null; every later run
   * of the same stage returns a fresh copy of the remembered world to continue with.
   * @param {import('./sim.js').Sim} sim @param {any} [extra] extra data of the save game (AI states)
   * @returns {import('./sim.js').Sim|null}
   */
  beforeRun(sim, extra = {}) {
    if (!resetEnabled(sim)) { this.clear(); return null; }
    const key = stageKey(sim);
    if (this.data && this.key === key) return restoreStage(this.data, sim);
    this.key = key;
    this.data = JSON.parse(JSON.stringify(saveGame(sim, extra, { clone: false })));
    return null;
  }

  clear() { this.key = null; this.data = null; }

  /** For the save game envelope. */
  toJSON() { return this.data ? { key: this.key, data: this.data } : null; }
}
