// Figures in Python: heroes, serfs and troops share the basic commands (step, turn, sensors); serfs chop by the rules
// of the game; troops get orders like in the UI. Waiting rule, figures_near with fog, stop, weather – src/sim/scripting/api.js.

import { describe, it, expect } from 'vitest';
import { createScenarioSim } from '../../src/sim/missions/runtime.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';

const run = (sim, ticks) => { for (let i = 0; i < ticks && !sim.mission.state.result; i++) sim.step(); };
const runCode = (sim, code) => sim.command({ type: 'script', player: 0, action: 'run', sections: { player: code } });
const tileOf = (e) => [Math.floor(e.px / 1000), Math.floor(e.py / 1000)];
const consoleText = (sim) => sim.mission.script.state.console.map((c) => c.text).filter(Boolean).join('\n');
const errors = (sim) => sim.mission.script.state.errors;
const all = (sim, kind) => [...sim.entities.values()].filter((e) => e.kind === kind && e.owner === 0);

function scenario(world, extra = {}) {
  return {
    format: 'kronland-scenario', version: 2, id: 'figures', kind: 'adventure', end: 'script',
    world: { base: 'flat', width: 40, height: 32, fog: false, starts: [{ x: 8, y: 8 }], places: {}, ...(extra.world ?? {}) },
    players: extra.players ?? [{ kind: 'human', hero: 'nelia', hq: true, serfs: 2 }],
    sections: [
      { id: 'world', level: 'mission', code: world || 'pass\n' },
      { id: 'player', level: 'player', editable: true, code: '' },
    ],
  };
}

describe('Serfs step by step', () => {
  it('serfs() have the basic commands; chop() fells the tree in front by the rules of the game', () => {
    const sim = createScenarioSim(scenario('s = serfs()[0]\ns.teleport((20, 20))\nadd_tree(21, 20, amount=2)\nadd_tree(20, 19)\n'));
    const wood0 = sim.available(0, 'wood');
    runCode(sim, [
      's = serfs()[0]',
      'print(s.facing, s.front(), s.left(), s.can_step())',
      't0 = time()',
      's.chop()',
      'print(s.front(), s.x, s.y, s.idle, time() - t0 >= 4)',
      's.step(2)',
      'print(s.x, s.y)',
      's.turn_left()',
      'print(s.facing)',
    ].join('\n'));
    run(sim, 300);
    expect(errors(sim)).toEqual([]);
    expect(consoleText(sim)).toBe('east tree tree False\nfree 20 20 True True\n22 20\nnorth');
    // the wood came through the job system (raw goods of the serf's cycles), the tree beside stays
    expect(sim.available(0, 'wood') - wood0).toBe(2);
    expect([...sim.entities.values()].filter((e) => e.kind === 'tree').length).toBe(1);
    // A serf with nothing in front cannot chop
    runCode(sim, 'serfs()[0].chop()\n');
    run(sim, 3);
    expect(errors(sim).at(-1)).toMatchObject({ kind: 'GameError', params: { reason: 'script.game.noTree', reasonParams: { what: 'free' } } });
  });

  it('waiting rule: steps wait, orders that keep running return at once', () => {
    const sim = createScenarioSim(scenario('add_tree(30, 20)\nfor s in serfs():\n    s.teleport((20, 20))\n'));
    runCode(sim, [
      'a, b = serfs()',
      't = time()',
      'a.move_to((26, 20), wait=False)',
      'b.work_on(trees_near((30, 20), 1)[0])',
      'print(time() - t, a.idle, b.job)',
      'a.move_to((26, 20))',
      'print(a.is_at((26, 20)), time() - t > 1)',
    ].join('\n'));
    run(sim, 200);
    expect(errors(sim)).toEqual([]);
    expect(consoleText(sim)).toBe('0.0 False gather\nTrue True');
  });

  it('save and load in the middle of chop() continues identically', () => {
    const mk = () => createScenarioSim(scenario('s = serfs()[0]\ns.teleport((20, 20))\nadd_tree(21, 20, amount=4)\n'));
    const code = 's = serfs()[0]\ns.chop()\ns.step(3)\nprint(s.x)\n';
    const ref = mk();
    runCode(ref, code);
    run(ref, 300);
    const sim = mk();
    runCode(sim, code);
    run(sim, 37);
    const loaded = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    expect(loaded.hash()).toBe(sim.hash());
    run(loaded, 263);
    expect(loaded.hash()).toBe(ref.hash());
    expect(consoleText(loaded)).toBe('23');
  });
});

describe('Troops and heroes: orders like in the UI', () => {
  it('troops step, turn and take hold/defend/attack orders; militia can be moved by script', () => {
    const sim = createScenarioSim(scenario('spawn(HUMAN, "sword1", (20, 12), soldiers=2)\n'));
    runCode(sim, [
      't = troops()[0]',
      'x, y = t.x, t.y',
      'print(t.facing, t.front(), t.idle)',
      't.step(2)',
      'print(t.x - x, t.y - y)',
      't.hold()',
      'print(t.idle)',
      't.defend()',
      't.turn_to("south")',
      't.step()',
      'print(t.x - x, t.y - y, t.facing)',
    ].join('\n'));
    run(sim, 200);
    expect(errors(sim)).toEqual([]);
    expect(consoleText(sim)).toBe('east free True\n2 0\nFalse\n2 1 south');
    // Militia: a serf with arms moves like a troop (order instead of walk command)
    const u = all(sim, 'unit')[0];
    sim.applyCommand({ type: 'militia', player: 0, on: true, units: [u.id] });
    expect(u.militia).toBe(true);
    runCode(sim, `m = [s for s in serfs() if s.id == ${u.id}][0]\nm.move_to((14, 22))\nprint(m.is_at((14, 22)))\n`);
    run(sim, 300);
    expect(errors(sim)).toEqual([]);
    expect(consoleText(sim).split('\n').at(-1)).toBe('True');
  });

  it('two heroes without a castle start on different tiles; stop halts all of them', () => {
    const sim = createScenarioSim(scenario('', { players: [{ kind: 'human', heroes: ['nelia', 'orrin', 'taran'], hq: false }] }));
    const heroes = all(sim, 'hero');
    expect(new Set(heroes.map((h) => tileOf(h).join(','))).size).toBe(3);
    runCode(sim, 'nelia.move_to((30, 8), wait=False)\norrin.move_to((30, 20), wait=False)\ntaran.step(10)\n');
    run(sim, 10);
    expect(heroes.every((h) => h.order?.type === 'move')).toBe(true);
    sim.command({ type: 'script', player: 0, action: 'stop' });
    run(sim, 2);
    const at = heroes.map((h) => tileOf(h).join(','));
    run(sim, 30);
    expect(heroes.map((h) => tileOf(h).join(','))).toEqual(at);
    expect(heroes.every((h) => h.order.type === 'idle')).toBe(true);
  });
});

describe('figures_near, weather, forecast', () => {
  it('figures_near: nearest first, kind and side filters, never the figure itself', () => {
    const sim = createScenarioSim(scenario('spawn(HUMAN, "sword1", (14, 8), soldiers=3)\nspawn(BANDITS, "bow1", (12, 12), soldiers=0)\nfor s in serfs():\n    s.teleport((10, 9))\n', {
      players: [{ kind: 'human', hero: 'nelia', hq: true, serfs: 2 }, { kind: 'bandits' }],
    }));
    runCode(sim, [
      'print([f.kind for f in figures_near((10, 9), 8)])',
      'print([f.kind for f in figures_near(serfs()[0], 8, kind="serf")])',
      'print([(f.type, f.side) for f in figures_near((10, 9), 8, side="enemy")])',
      'print(len(figures_near((10, 9), 8, side="own")), figures_near((10, 9), 8, kind="sword1")[0].type)',
    ].join('\n'));
    run(sim, 3);
    expect(errors(sim)).toEqual([]);
    const lines = consoleText(sim).split('\n');
    expect(lines[0]).toMatch(/^\['serf', 'serf', /);
    expect(lines[1]).toBe("['serf']");
    expect(lines[2]).toBe("[('bow1', 'enemy')]");
  });

  it('figures_near respects the fog for player programs, missions see everything', () => {
    const sc = scenario('spawn(BANDITS, "sword1", (36, 28), soldiers=0)\nprint(len(figures_near((36, 28), 3)))\n', {
      world: { fog: true }, players: [{ kind: 'human', hero: 'nelia', hq: true }, { kind: 'bandits' }],
    });
    const sim = createScenarioSim(sc);
    runCode(sim, 'print(len(figures_near((36, 28), 3)), len(figures_near((36, 28), 3, side="enemy")))\n');
    run(sim, 3);
    expect(consoleText(sim)).toBe('1\n0 0');
  });

  it('weather() and forecast() (players need a weather tower)', () => {
    const sim = createScenarioSim(scenario('', { players: [{ kind: 'human', hero: 'nelia', hq: true, stock: { gold: 2000, clay: 2000, wood: 2000, stone: 2000 } }] }));
    runCode(sim, 'print(weather())\nprint(forecast())\n');
    run(sim, 3);
    expect(consoleText(sim)).toBe('summer');
    expect(errors(sim).at(-1)).toMatchObject({ kind: 'GameError', params: { reason: 'script.game.noForecast' } });
    const hq = sim.findBuilding(0, 'headquarters');
    sim.createBuilding(0, 'weatherTower', hq.x + 8, hq.y, true);
    runCode(sim, 'f = forecast()\nprint(len(f), f[0][0], f[0][1] > 0)\n');
    run(sim, 3);
    expect(consoleText(sim).split('\n').at(-1)).toBe('3 rain True');
  });
});
