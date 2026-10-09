// "Run" restarts the stage: snapshot at the first run of a sub-goal, every further run restores it (src/sim/stage.js).
import { describe, it, expect } from 'vitest';
import { createScenarioSim } from '../../src/sim/missions/runtime.js';
import { StageSnapshot, stageKey, resetEnabled, restoreStage } from '../../src/sim/stage.js';
import { validateScenario } from '../../src/sim/scripting/scenario.js';

const run = (sim, ticks) => { for (let i = 0; i < ticks && !sim.mission.state.result; i++) sim.step(); };
const runCode = (sim, code) => sim.command({ type: 'script', player: 0, action: 'run', sections: { player: code } });
const hero = (sim) => [...sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === 0);
const tile = (sim) => { const e = hero(sim); return [Math.floor(e.px / 1000), Math.floor(e.py / 1000)]; };

const MISSION = [
  'add_tree(12, 8)',
  'add_item("coin", 6, 8)',
  'objective("walk", lambda: nelia.x >= 10, de="Lauf bis vor den Baum", en="Walk up to the tree")',
  '@on_objective("walk", status="done")',
  'def next_goal(id, status):',
  '    objective("back", lambda: nelia.x <= 5, de="Zurück", en="Back")',
  '',
].join('\n');

function scenario(extra = {}, mission = MISSION) {
  return createScenarioSim({
    format: 'kronland-scenario', version: 2, id: 'stage', kind: 'adventure', end: 'script',
    world: { base: 'flat', width: 24, height: 16, fog: false, starts: [{ x: 4, y: 8 }] },
    players: [{ kind: 'human', hero: 'nelia', hq: false }],
    sections: [
      { id: 'm', level: 'mission', code: mission },
      { id: 'player', level: 'player', editable: true, code: '' },
    ],
    ...extra,
  });
}

describe('Stage restart', () => {
  it('the first run remembers the world, the next one restores it with the same hash', () => {
    let sim = scenario();
    run(sim, 3);
    const stage = new StageSnapshot();
    expect(stageKey(sim)).toBe('walk');
    expect(stage.beforeRun(sim)).toBeNull();
    const hash = sim.hash(), tick = sim.tick;
    runCode(sim, 'nelia.step(2)\nnelia.take()\n');
    run(sim, 80);
    expect(tile(sim)).toEqual([6, 8]);
    expect(sim.map.items.size).toBe(0);
    // Second run: back to the snapshot
    sim = stage.beforeRun(sim);
    expect(sim.hash()).toBe(hash);
    expect(sim.tick).toBe(tick);
    expect(tile(sim)).toEqual([4, 8]);
    expect(sim.map.items.size).toBe(1);
  });

  it('the same program gives the same run after every restart', () => {
    let sim = scenario();
    run(sim, 3);
    const stage = new StageSnapshot();
    stage.beforeRun(sim);
    const code = 'import random\nfor i in range(random.randint(1, 3)):\n    nelia.step()\nprint("done")\n';
    const results = [];
    for (let k = 0; k < 3; k++) {
      if (k) sim = stage.beforeRun(sim);
      runCode(sim, code);
      run(sim, 60);
      results.push([hero(sim).px, sim.mission.script.state.player.status, tile(sim).join(',')]);
    }
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });

  it('a new sub-goal takes a new snapshot', () => {
    let sim = scenario();
    run(sim, 3);
    const stage = new StageSnapshot();
    stage.beforeRun(sim);
    runCode(sim, 'nelia.step(6)\n');
    run(sim, 150);
    expect(stageKey(sim)).toBe('back');
    // First run of the new goal: snapshot here (Nelia stays where she is)
    expect(stage.beforeRun(sim)).toBeNull();
    const at = tile(sim);
    runCode(sim, 'nelia.turn_left()\nnelia.turn_left()\nnelia.step(2)\n');
    run(sim, 80);
    expect(tile(sim)).not.toEqual(at);
    sim = stage.beforeRun(sim);
    expect(tile(sim)).toEqual(at);
  });

  it('message counters run on, so the UI sees new dialogue lines as new', () => {
    let sim = scenario({}, `${MISSION}@every(1)\ndef talk():\n    message("tick")\n`);
    run(sim, 3);
    const stage = new StageSnapshot();
    stage.beforeRun(sim);
    run(sim, 40);
    const seq = sim.mission.state.seq;
    sim = stage.beforeRun(sim);
    expect(sim.mission.state.seq).toBe(seq);
    run(sim, 12);
    expect(sim.mission.state.messages.at(-1).seq).toBeGreaterThan(seq);
  });

  it('can be switched off: scenario field reset: false and reset(False) in the mission', () => {
    const off = scenario({ reset: false });
    expect(resetEnabled(off)).toBe(false);
    const stage = new StageSnapshot();
    expect(stage.beforeRun(off)).toBeNull();
    expect(stage.beforeRun(off)).toBeNull();
    expect(stage.data).toBeNull();
    const py = scenario({}, `${MISSION}reset(False)\n`);
    expect(resetEnabled(py)).toBe(false);
    const on = scenario({ reset: false }, `${MISSION}reset()\n`);
    expect(resetEnabled(on)).toBe(true);
    expect(validateScenario({ format: 'kronland-scenario', version: 2, id: 'x', players: [{ kind: 'human' }], reset: 'no' })).toContain('reset must be true or false');
  });

  it('the snapshot travels in the save game envelope', () => {
    const sim = scenario();
    run(sim, 3);
    const stage = new StageSnapshot();
    stage.beforeRun(sim);
    const back = new StageSnapshot(JSON.parse(JSON.stringify(stage.toJSON())));
    const hash = sim.hash();
    runCode(sim, 'nelia.step(3)\n');
    run(sim, 60);
    expect(back.beforeRun(sim).hash()).toBe(hash);
    expect(restoreStage(stage.data, null).hash()).toBe(hash);
  });

  it('every restore of a real mission equals the snapshot and runs the same program the same way (r1-4, three worlds)', async () => {
    const { createMissionSim } = await import('../../src/sim/missions/runtime.js');
    const code = 'guess = 0\nsteps = 0\nwhile nelia.can_step():\n    nelia.step()\n    steps = steps + 1\nprint(steps)\n';
    for (const world of ['normal', 'near', 'far']) {
      let sim = createMissionSim('r1-4', { world });
      run(sim, 90);
      const stage = new StageSnapshot();
      expect(stage.beforeRun(sim)).toBeNull();
      const hash = sim.hash();
      const results = [];
      for (let k = 0; k < 3; k++) {
        if (k) {
          // (the display counter mission.seq carries on from the world before the restore and is part of the hash,
          // so compare with a plain restore of the snapshot)
          sim = stage.beforeRun(sim);
          expect(restoreStage(stage.data, null).hash()).toBe(hash);
        }
        runCode(sim, code);
        run(sim, 120);
        results.push([hero(sim).px, sim.mission.script.state.player.status, tile(sim).join(',')]);
      }
      expect(results[1]).toEqual(results[0]);
      expect(results[2]).toEqual(results[0]);
    }
  });
});
