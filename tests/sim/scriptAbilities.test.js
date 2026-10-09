// Hero abilities and "To arms!" in the scripting API: nelia.use(…), ready(), cooldown(), abilities(), call_to_arms(),
// back_to_work(), serf.militia and @on_event("attacked"). Every action is the same sim command as the UI button –
// a script and a direct command lead to the same state hash.
import { describe, it, expect } from 'vitest';
import { createScenarioSim } from '../../src/sim/missions/runtime.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { scriptErrorText, i18n } from '../../src/i18n/index.js';
import { HEROES } from '../../src/sim/data/units.js';

const run = (sim, ticks) => { for (let i = 0; i < ticks && !sim.mission.state.result; i++) sim.step(); };
const runCode = (sim, code) => sim.command({ type: 'script', player: 0, action: 'run', sections: { player: code } });
const out = (sim) => sim.mission.script.state.console.filter((c) => c.level === 'player' && !c.err).map((c) => c.text);
const errors = (sim) => sim.mission.script.state.errors.filter((e) => e.level === 'player');
const heroOf = (sim, id) => [...sim.entities.values()].find((e) => e.kind === 'hero' && e.hero === id && e.owner === 0);
const serfsOf = (sim, owner = 0) => [...sim.entities.values()].filter((e) => e.kind === 'unit' && e.owner === owner);
/** Hash of the game without the script programs (they differ: one sim runs a program, the other does not). */
const gameHash = (sim) => { const m = sim.mission; const keep = m.hash; m.hash = () => {}; try { return sim.hash(); } finally { m.hash = keep; } };
const errText = (sim, lang = 'de') => {
  const old = i18n.lang;
  i18n.lang = lang;
  try { return errors(sim).map((e) => scriptErrorText(e).text); } finally { i18n.lang = old; }
};

/** Castle, four serfs, three heroes and plenty of taler; a bandit squad three tiles east of the heroes. */
function scenario({ bandits = true, gold = 1000 } = {}) {
  const mission = bandits ? 'spawn(BANDITS, "sword1", (orrin.x + 3, orrin.y), soldiers=2, spread=False)\n' : 'pass\n';
  return createScenarioSim({
    format: 'kronland-scenario', version: 2, id: 'abilities', kind: 'adventure', end: 'script',
    world: { base: 'flat', width: 40, height: 28, fog: false, starts: [{ x: 10, y: 12 }] },
    players: [
      { kind: 'human', heroes: ['nelia', 'orrin', 'taran'], hq: true, serfs: 4, stock: { gold, wood: 500, clay: 500, stone: 500 } },
      { kind: 'bandits' },
    ],
    sections: [
      { id: 'm', level: 'mission', code: mission },
      { id: 'player', level: 'player', editable: true, code: '' },
    ],
  });
}

/**
 * Run `code` as player program in one sim; in a twin sim, issue `cmd(sim)` directly in the tick in which the script
 * gave its command (after the scripts of that tick, where the program runs). Both must end in the same game state.
 */
function sameAsCommand(code, cmd, opts) {
  const a = scenario(opts), b = scenario(opts);
  runCode(a, code);
  let at = -1;
  for (let i = 0; i < 40 && at < 0; i++) {
    const tick = a.tick;
    if (a.step().some((e) => e.type === 'ability' || e.type === 'bribed')) at = tick;
  }
  expect(at, 'script used the ability').toBeGreaterThanOrEqual(0);
  const update = b.mission.update.bind(b.mission);
  b.mission.update = (s) => {
    update(s);
    if (s.tick === at) expect(s.applyCommand({ player: 0, ...cmd(s) })).toBe(true);
  };
  run(b, a.tick - b.tick);
  expect(b.tick).toBe(a.tick);
  expect(errors(a)).toEqual([]);
  expect(gameHash(b)).toBe(gameHash(a));
  run(a, 30); run(b, 30);
  expect(gameHash(b)).toBe(gameHash(a));
  return a;
}

describe('Hero abilities in scripts', () => {
  for (const [hero, ability, script] of [
    ['nelia', 'courage', 'courage'], ['nelia', 'farsight', 'farsight'], ['orrin', 'salve', 'salve'],
    ['orrin', 'bribe', 'bribe'], ['taran', 'shieldBash', 'shield_bash'], ['taran', 'intimidate', 'intimidate'],
  ]) {
    it(`${hero}.use("${script}") is the same command as the button`, () => {
      const sim = sameAsCommand(`${hero}.use("${script}")\n`, (s) => ({ type: 'ability', hero: heroOf(s, hero).id, ability }));
      expect(heroOf(sim, hero).ready[ability]).toBeGreaterThan(0);
    });
  }

  it('an aimed ability takes a target tile, the same as the command with x/y', () => {
    sameAsCommand('nelia.use("farsight", (nelia.x + 4, nelia.y))\n', (s) => {
      const h = heroOf(s, 'nelia');
      return { type: 'ability', hero: h.id, ability: 'farsight', x: (h.px / 1000 | 0) + 4, y: h.py / 1000 | 0 };
    });
  });

  it('bribe costs taler and wins the squad over', () => {
    const sim = scenario();
    const gold = sim.available(0, 'gold');
    runCode(sim, 'orrin.use("bribe")\nprint(len(troops()))\n');
    run(sim, 3);
    expect(errors(sim)).toEqual([]);
    const cost = HEROES.orrin.abilities.bribe.gold + 2 * HEROES.orrin.abilities.bribe.goldPerSoldier;
    expect(sim.available(0, 'gold')).toBe(gold - cost);
    expect(out(sim)).toEqual(['1']);
  });

  it('ready(), cooldown() and abilities()', () => {
    const sim = scenario({ bandits: false });
    const cd = HEROES.nelia.abilities.courage.cooldown / 10;
    runCode(sim, 'print(nelia.abilities(), taran.abilities())\nprint(nelia.ready("courage"), nelia.cooldown("courage"))\nnelia.use("courage")\n'
      + 'print(nelia.ready("courage"), nelia.cooldown("courage"), nelia.ready("farsight"))\nwait(10)\nprint(nelia.cooldown("courage"))\n'
      + 'wait_until(lambda: nelia.ready("courage"))\nprint("again", nelia.cooldown("courage"))\nnelia.use("courage")\n');
    run(sim, cd * 10 + 140);
    expect(errors(sim)).toEqual([]);
    expect(out(sim)).toEqual([
      "['farsight', 'courage'] ['shield_bash', 'intimidate']", 'True 0', `False ${cd} True`, `${cd - 10}`, 'again 0',
    ]);
  });

  it('beginner errors: not ready, unknown, another hero\'s, target not needed or too far (de/en)', () => {
    const cases = [
      ['nelia.use("courage")\nnelia.use("courage")\n', 'Mut machen ist erst in 120 s wieder bereit', 'Rally is ready again in 120 s'],
      ['nelia.use("corage")\n', 'Die Fähigkeit „corage“ gibt es nicht. Nelia kann: farsight, courage. Meintest du „courage“?', null],
      ['taran.use("shieldBash")\n', 'Meintest du „shield_bash“?', null],
      ['nelia.use("bribe")\n', 'Bestechen ist eine Fähigkeit von Orrin, nicht von Nelia. Nelia kann: farsight, courage.', 'is an ability of Orrin, not of Nelia'],
      ['nelia.use("courage", (1, 1))\n', 'Mut machen braucht kein Ziel', 'needs no target'],
      ['nelia.use("farsight", (nelia.x + 9, nelia.y))\n', 'reicht höchstens 6 Kacheln weit, das Ziel liegt 9 Kacheln entfernt', 'reaches at most 6 tiles'],
    ];
    for (const [code, de, en] of cases) {
      const sim = scenario({ bandits: false });
      runCode(sim, code);
      run(sim, 3);
      expect(errText(sim, 'de')[0], code).toContain(de);
      if (en) expect(errText(sim, 'en')[0], code).toContain(en);
    }
  });

  it('bribe errors: no squad in range, not enough taler', () => {
    let sim = scenario({ bandits: false });
    runCode(sim, 'orrin.use("bribe")\n');
    run(sim, 3);
    expect(errText(sim)[0]).toContain('Kein gegnerischer Trupp in Reichweite: Bestechen wirkt nur bis 5 Kacheln um Orrin');
    sim = scenario({ gold: 120 });
    runCode(sim, 'orrin.use("bribe")\n');
    run(sim, 3);
    expect(errText(sim)[0]).toMatch(/Bestechen kostet für diesen Trupp 300 Taler, du hast nur 1\d\d\./);
    expect(errText(sim, 'en')[0]).toMatch(/costs 300 thalers for this squad/);
    // nothing was paid, the cooldown did not start
    expect(heroOf(sim, 'orrin').ready.bribe ?? 0).toBe(0);
  });

  it('player programs cannot use the abilities of another player\'s hero', () => {
    const sim = createScenarioSim({
      format: 'kronland-scenario', version: 2, id: 'foreign', kind: 'adventure', end: 'script',
      world: { base: 'flat', width: 40, height: 20, fog: false, starts: [{ x: 6, y: 8 }, { x: 30, y: 8 }] },
      players: [{ kind: 'human', hero: 'nelia' }, { kind: 'ai', hero: 'malvor' }],
      sections: [{ id: 'player', level: 'player', editable: true, code: '' }],
    });
    runCode(sim, 'malvor.use("caltrops")\n');
    run(sim, 3);
    expect(errors(sim).map((e) => e.params.reason)).toEqual(['script.game.notYours']);
  });

  it('missions use any hero\'s abilities by the same rules', () => {
    const sim = createScenarioSim({
      format: 'kronland-scenario', version: 2, id: 'mission', kind: 'adventure', end: 'script',
      world: { base: 'flat', width: 40, height: 20, fog: false, starts: [{ x: 6, y: 8 }, { x: 30, y: 8 }] },
      players: [{ kind: 'human', hero: 'nelia' }, { kind: 'ai', hero: 'malvor' }],
      sections: [{ id: 'm', level: 'mission', code: '@on_start\ndef go():\n    malvor.use("field_gun", (malvor.x - 2, malvor.y))\n    print(malvor.ready("field_gun"))\n' }],
    });
    run(sim, 3);
    expect(sim.mission.script.state.errors).toEqual([]);
    expect([...sim.entities.values()].filter((e) => e.kind === 'turret').length).toBe(1);
  });

  it('@on_event("ability") reports the script name', () => {
    const sim = scenario({ bandits: false });
    runCode(sim, '@on_event("ability", ability="shield_bash")\ndef used(hero, ability):\n    print(hero.name, ability)\n');
    run(sim, 2);
    // the buttons of the hero panel
    sim.step([{ type: 'ability', player: 0, hero: heroOf(sim, 'taran').id, ability: 'shieldBash' }, { type: 'ability', player: 0, hero: heroOf(sim, 'nelia').id, ability: 'courage' }]);
    run(sim, 3);
    expect(out(sim)).toEqual(['taran shield_bash']);
  });
});

describe('"To arms!" in scripts', () => {
  it('call_to_arms() and back_to_work() are the militia command of the castle', () => {
    const a = scenario({ bandits: false }), b = scenario({ bandits: false });
    runCode(a, 'print(call_to_arms(), [s.militia for s in serfs()])\nwait(3)\nprint(back_to_work(), back_to_work())\n');
    run(a, 1);
    b.step([{ type: 'militia', player: 0, on: true }]);
    // the script ran at the end of tick 0, the command at its start – compare after both took effect
    expect(serfsOf(a).every((e) => e.militia)).toBe(true);
    expect(serfsOf(b).every((e) => e.militia)).toBe(true);
    run(a, 40);
    expect(errors(a)).toEqual([]);
    expect(out(a)).toEqual(['4 [True, True, True, True]', '4 0']);
    expect(serfsOf(a).some((e) => e.militia)).toBe(false);
  });

  it('a list of serfs arms only those; same hash as the command with units', () => {
    const a = scenario({ bandits: false }), b = scenario({ bandits: false });
    runCode(a, 'call_to_arms(serfs()[:2])\n');
    run(a, 1);
    const ids = serfsOf(b).map((e) => e.id).sort((x, y) => x - y).slice(0, 2);
    const update = b.mission.update.bind(b.mission);
    b.mission.update = (s) => { update(s); if (s.tick === 0) s.applyCommand({ type: 'militia', player: 0, on: true, units: ids }); };
    run(b, 1);
    expect(serfsOf(a).filter((e) => e.militia).length).toBe(2);
    expect(gameHash(b)).toBe(gameHash(a));
    run(a, 50); run(b, 50);
    expect(gameHash(b)).toBe(gameHash(a));
  });

  it('only serfs, only own ones', () => {
    const sim = scenario({ bandits: false });
    runCode(sim, 'call_to_arms([nelia])\n');
    run(sim, 2);
    expect(errText(sim)[0]).toContain('call_to_arms() nimmt nur Leibeigene, keinen Helden.');
    expect(errText(sim, 'en')[0]).toContain('call_to_arms() only takes serfs, not a hero.');
    const other = scenario();
    runCode(other, 'back_to_work([hq()])\n');
    run(other, 2);
    expect(errText(other)[0]).toContain('back_to_work() nimmt nur Leibeigene, kein Gebäude.');
    expect(errText(other, 'en')[0]).toContain('not a building.');
  });
});

describe('@on_event("attacked")', () => {
  it('fires for own figures hit by an enemy, at most every 5 seconds per handler', () => {
    const sim = scenario();
    runCode(sim, 'n = 0\n@on_event("attacked")\ndef alarm(target, attacker):\n    global n\n    n += 1\n    if n == 1:\n        print(target.side, attacker.side)\n        call_to_arms()\n');
    run(sim, 200);
    expect(errors(sim)).toEqual([]);
    expect(out(sim)).toEqual(['own enemy']);
    const n = sim.mission.script.playerVariable('n');
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(5);
    expect(serfsOf(sim).some((e) => e.militia)).toBe(true);
  });
});

describe('Determinism and saving', () => {
  const code = '@on_event("attacked")\ndef alarm(target, attacker):\n    call_to_arms()\n    if nelia.ready("courage"):\n        nelia.use("courage")\n'
    + 'taran.use("shield_bash")\nwait(2)\norrin.use("salve")\n';

  it('loading mid-program continues with the same hash', () => {
    const ref = scenario();
    runCode(ref, code);
    run(ref, 150);
    const sim = scenario();
    runCode(sim, code);
    run(sim, 37);
    const loaded = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    expect(loaded.hash()).toBe(sim.hash());
    run(loaded, 113);
    expect(loaded.tick).toBe(ref.tick);
    expect(loaded.hash()).toBe(ref.hash());
    expect(errors(loaded)).toEqual([]);
  });
});
