// Events caused by script commands reach the event handlers: a program hears its own build() one tick later,
// the mission program hears the commands of the player program, every event arrives exactly once, and a save
// game between the command tick and the delivery tick continues identically (state.carry).
import { describe, it, expect } from 'vitest';
import { createScenarioSim, createMissionSim } from '../../src/sim/missions/runtime.js';
import { spawnTroop } from '../../src/sim/missions/setupApi.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';

const run = (sim, ticks) => { for (let i = 0; i < ticks && !sim.mission.state.result; i++) sim.step(); };
const runCode = (sim, code) => sim.command({ type: 'script', player: 0, action: 'run', sections: { player: code } });
const out = (sim) => sim.mission.script.state.console.filter((c) => !c.err).map((c) => `${c.level}: ${c.text}`);
const errors = (sim) => sim.mission.script.state.errors.map((e) => `${e.level} ${e.code} ${JSON.stringify(e.params)} line ${e.sline}`);

function level(mission = 'pass', player = '') {
  return createScenarioSim({
    format: 'kronland-scenario', version: 2, id: 'ownevents', kind: 'mission', end: 'script',
    world: { base: 'flat', width: 40, height: 40, fog: false, starts: [{ x: 12, y: 12 }] },
    players: [{ kind: 'human', hero: 'nelia', serfs: 3, stock: { gold: 5000, clay: 5000, wood: 5000, stone: 5000, iron: 500, sulfur: 100 } }],
    sections: [
      { id: 'm', level: 'mission', code: mission },
      { id: 'player', level: 'player', editable: true, code: player },
    ],
  });
}

/** Free spot for a farm near the castle (same on every run). */
const spot = (sim, near = { x: 18, y: 12 }) => sim.findPlacement(0, 'farm', near.x, near.y, 8);

describe('Events of script commands', () => {
  it('the mission program hears its own build() once, one tick later', () => {
    const sim = level([
      '@on_building_placed(kind="farm")',
      'def placed(b):',
      '    print("placed", b.type, round(time() * 10))',
      '@on_start',
      'def go():',
      '    p = find_spot("farm", (18, 12), 8)',
      '    b = build("farm", p[0], p[1])',
      '    print("built", round(time() * 10), b is not None)',
    ].join('\n'));
    run(sim, 5);
    expect(errors(sim)).toEqual([]);
    const lines = out(sim);
    expect(lines.length).toBe(2);
    const [, t0] = lines[0].match(/built (\d+) True/).map(Number);
    expect(lines[1]).toBe(`mission: placed farm ${t0 + 1}`);
  });

  it('the player program hears its own build(); the mission hears it too – each exactly once', () => {
    const sim = level([
      '@on_building_placed(kind="farm")',
      'def placed(b):',
      '    print("mission saw", b.type)',
    ].join('\n'));
    const p = spot(sim);
    runCode(sim, [
      '@on_building_placed(kind="farm")',
      'def placed(b):',
      '    print("player saw", b.type)',
      `build("farm", ${p.x}, ${p.y})`,
    ].join('\n'));
    run(sim, 10);
    expect(errors(sim)).toEqual([]);
    expect(out(sim).sort()).toEqual(['mission: mission saw farm', 'player: player saw farm']);
  });

  it('a UI command reaches both programs in the same tick, exactly once', () => {
    const sim = level('@on_building_placed(kind="farm")\ndef placed(b):\n    print("mission", round(time() * 10))\n');
    runCode(sim, '@on_building_placed(kind="farm")\ndef placed(b):\n    print("player", round(time() * 10))\n');
    run(sim, 2);
    const p = spot(sim);
    const t = sim.tick;
    sim.step([{ type: 'placeBuilding', player: 0, building: 'farm', x: p.x, y: p.y }]);
    run(sim, 10);
    expect(out(sim)).toEqual([`mission: mission ${t}`, `player: player ${t}`]);
  });

  it('events arrive in the order they happened (carried ones first)', () => {
    const sim = level('@on_building_placed()\ndef placed(b):\n    print(b.type)\n');
    const a = spot(sim, { x: 18, y: 12 });
    runCode(sim, `build("farm", ${a.x}, ${a.y})\np = find_spot("residence", (12, 18), 8)\nbuild("residence", p[0], p[1])\n`);
    run(sim, 5);
    expect(errors(sim)).toEqual([]);
    expect(out(sim)).toEqual(['mission: farm', 'mission: residence']);
  });

  it('saving between the command tick and the delivery tick continues identically', () => {
    const mission = '@on_building_placed(kind="farm")\ndef placed(b):\n    print("mission saw", round(time() * 10))\n';
    const make = () => {
      const s = level(mission);
      const p = spot(s);
      runCode(s, `@on_building_placed(kind="farm")\ndef placed(b):\n    print("player saw", round(time() * 10))\nbuild("farm", ${p.x}, ${p.y})\n`);
      return s;
    };
    const ref = make();
    run(ref, 20);
    const sim = make();
    run(sim, 1); // the run command and build() in this tick: the event waits in state.carry
    expect(sim.mission.script.state.carry?.player?.[0]).toMatchObject({ type: 'buildingPlaced', buildingType: 'farm' });
    expect(sim.mission.script.state.carry?.mission?.[0]).toMatchObject({ type: 'buildingPlaced', buildingType: 'farm' });
    const loaded = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    expect(loaded.hash()).toBe(sim.hash());
    run(loaded, 19);
    expect(loaded.hash()).toBe(ref.hash());
    expect(out(loaded)).toEqual(out(ref));
    expect(out(ref).length).toBe(2);
  });

  it('complete() and show_objective() of the mission reach its own @on_objective once', () => {
    const sim = level([
      'objective("a", lambda: False, de="A", en="A")',
      'objective("b", lambda: False, hidden=True, de="B", en="B")',
      '@on_objective("a")',
      'def a(id, status):',
      '    print(id, status)',
      '@on_objective("b")',
      'def b(id, status):',
      '    print(id, status)',
      '@on_start',
      'def go():',
      '    show_objective("b")',
      '    complete("a")',
    ].join('\n'));
    run(sim, 5);
    expect(errors(sim)).toEqual([]);
    expect(out(sim)).toEqual(['mission: b active', 'mission: a done']);
  });

  it('m1: showing the camp objective does not win the mission (handlers wait for "done")', () => {
    const sim = createMissionSim('m1');
    const hq = [...sim.entities.values()].find((e) => e.type === 'headquarters' && e.owner === 0);
    for (let i = 0; i < 3; i++) spawnTroop(sim, 0, 'sword1', { x: hq.x + 4 + i * 3, y: hq.y + 6 }, 3);
    const camp = () => sim.mission.state.objectives.find((o) => o.id === 'camp');
    for (let i = 0; i < 2000 && camp()?.status !== 'active'; i++) sim.step();
    run(sim, 50);
    const status = Object.fromEntries(sim.mission.state.objectives.map((o) => [o.id, o.status]));
    expect(status).toMatchObject({ army: 'done', camp: 'active' });
    expect(sim.mission.state.result).toBeFalsy();
  });

  it('a new run does not inherit the events of the previous one', () => {
    const sim = level();
    const p = spot(sim);
    runCode(sim, `build("farm", ${p.x}, ${p.y})\n`);
    run(sim, 1);
    expect(sim.mission.script.state.carry?.player?.length).toBe(1);
    runCode(sim, '@on_building_placed()\ndef placed(b):\n    print("old event")\n');
    run(sim, 5);
    expect(out(sim)).toEqual([]);
    expect(sim.mission.script.state.carry).toBeUndefined();
  });
});
