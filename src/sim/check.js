// „Prüfen“: run the player's program headless in every world of a mission (docs/SKRIPTE.md#prüfen).
//
// For each world a fresh simulation starts with the start options { world, stage, check: true }: the mission program
// jumps to the stage (world.stage), then the program runs as with "Run". Solved means: every goal of the stage is done
// (or the mission is won). No rendering, no AI, no UI – plain Sim.step(), also in Node (tests, scripts).
// A check game is deterministic like every game; its result goes into the real game as a command (MissionRuntime.applyCheck).

import { createDefSim } from './missions/runtime.js';

/** Ticks a world may take to reach the stage (mission program up to the stage, dialogue lines do not wait). */
export const CHECK_SETUP_TICKS = 1200;
/** Ticks the program may run per world (10 game minutes) – a loop that never ends is "too long", not a hang. */
export const CHECK_RUN_TICKS = 6000;
/** Ticks after the end of the program (also by an error) in which the mission may still count the stage as solved. */
const GRACE_TICKS = 20;

/**
 * @typedef {{ world: string, status: 'solved'|'failed'|'error'|'timeout'|'nostage', error?: any, ticks: number }} WorldResult
 */

/**
 * Check of one world, tick by tick: `advance(n)` runs up to n ticks and returns the result once it is known.
 */
export class WorldCheck {
  /**
   * @param {any} def mission definition (sim.mission.def)
   * @param {string} world id @param {string} stage key of the stage (active goals, src/sim/stage.js)
   * @param {Record<string, string>} sections code of the editable player sections
   * @param {{ seed?: number, setupTicks?: number, runTicks?: number }} [o]
   */
  constructor(def, world, stage, sections, o = {}) {
    this.world = world;
    this.stage = stage;
    this.goals = stage.split(',').filter(Boolean);
    this.sections = sections;
    this.setupTicks = o.setupTicks ?? CHECK_SETUP_TICKS;
    this.runTicks = o.runTicks ?? CHECK_RUN_TICKS;
    this.sim = createDefSim(def, { world, stage, check: true, ...(Number.isInteger(o.seed) ? { seed: o.seed } : {}) });
    this.phase = 'setup';
    this.ticks = 0;
    this.since = 0;
    this.ended = -1;
    /** @type {WorldResult|null} */
    this.result = null;
  }

  finish(status, extra = {}) {
    this.result = { world: this.world, status, ticks: this.ticks, ...extra };
    return this.result;
  }

  /** Run up to n ticks. @returns {WorldResult|null} */
  advance(n) {
    const sim = this.sim, m = sim.mission;
    for (let i = 0; i < n && !this.result; i++) {
      if (this.phase === 'setup') {
        if (m.stageKey() === this.stage) {
          this.phase = 'run';
          this.since = this.ticks;
          sim.command({ type: 'script', player: m.state.human, action: 'run', sections: this.sections });
        } else if (m.state.result || this.ticks >= this.setupTicks) return this.finish('nostage');
      } else {
        const st = m.state, p = m.script.state.player;
        if (st.result) return this.finish(st.result.won ? 'solved' : 'failed');
        const objs = this.goals.map((id) => st.objectives.find((o) => o.id === id));
        if (objs.length && objs.every((o) => o?.status === 'done')) return this.finish('solved');
        if (objs.some((o) => o?.status === 'failed')) return this.finish('failed');
        // A program that ended – also with an error: a prediction may count a note that breaks off at a tree
        if (p.status === 'error' || p.status === 'done' || p.status === 'stopped' || p.status === 'idle') {
          if (this.ended < 0) this.ended = this.ticks;
          else if (this.ticks - this.ended >= GRACE_TICKS) return p.status === 'error' ? this.finish('error', { error: p.error ?? null }) : this.finish('failed');
        } else this.ended = -1;
        if (this.ticks - this.since >= this.runTicks) return this.finish('timeout');
      }
      sim.step();
      this.ticks++;
    }
    return this.result;
  }
}

/**
 * Worlds to check: all worlds of the level (one world: just that one).
 * @param {any} def
 */
export const checkWorlds = (def) => (def.worlds?.length ? def.worlds.map((w) => w.id) : [null]);

/**
 * Check a program in all worlds, synchronously (Node, tests). The game checks in slices (src/game/worldCheck.js).
 * @param {any} def @param {string} stage @param {Record<string, string>} sections
 * @param {{ seed?: number, worlds?: (string|null)[] }} [o]
 * @returns {{ stage: string, passed: boolean, results: WorldResult[] }}
 */
export function checkProgram(def, stage, sections, o = {}) {
  const results = (o.worlds ?? checkWorlds(def)).map((w) => {
    const c = new WorldCheck(def, w, stage, sections, o);
    return c.advance(Infinity);
  });
  return { stage, passed: results.every((r) => r.status === 'solved'), results };
}
