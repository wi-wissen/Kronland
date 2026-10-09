// Scenario format version 2: level folders, texts inline, objectives with progress, end rule, victory(reason),
// @on_event, the module program, one table for places, scenario embedded in the save game.

import { describe, it, expect } from 'vitest';
import { createMissionSim, createScenarioSim } from '../../src/sim/missions/runtime.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { validateScenario, packLevel, unpackLevel, scenarioToDef } from '../../src/sim/scripting/scenario.js';
import { LEVELS, ADVENTURES } from '../../src/sim/missions/levels/index.js';
import { getMission } from '../../src/sim/missions/registry.js';

const run = (sim, ticks) => { for (let i = 0; i < ticks && !sim.mission.state.result; i++) sim.step(); };
const runCode = (sim, code) => sim.command({ type: 'script', player: 0, action: 'run', sections: { player: code } });
const errors = (sim) => sim.mission.script.state.errors.map((e) => `${e.code} ${JSON.stringify(e.params)}`);

function level(mission, extra = {}) {
  return {
    format: 'kronland-scenario', version: 2, id: 'v2test', kind: 'adventure',
    world: { base: 'flat', width: 24, height: 16, fog: false, starts: [{ x: 4, y: 8 }], places: { goal: { x: 10, y: 8, r: 0 } } },
    players: [{ kind: 'human', hero: 'nelia', hq: false }],
    sections: [
      { id: 'mission', level: 'mission', code: mission },
      { id: 'player', level: 'player', editable: true, code: '' },
    ],
    ...extra,
  };
}

describe('Level folders', () => {
  it('every bundled level is a folder with scenario.json and .py files, packed and valid', () => {
    expect(LEVELS.map((l) => l.folder)).toEqual(['adv1-treasure', 'adv2-corner', 'adv3-wood', 'adv4-stones', 'adv5-village', 'c1-lindgrund', 'c2-beaucroix', 'c4-eisenhain', 'm1-raid', 'r1-4-blizzard', 'tutorial']);
    for (const l of LEVELS) {
      expect(validateScenario(l), l.id).toEqual([]);
      expect(l.version).toBe(2);
      for (const s of l.sections) expect(s.file, `${l.id}/${s.id}`).toMatch(/^\w+\.py$/);
      // texts stand in the code, no key table any more
      expect(l.texts).toBeUndefined();
    }
    expect(ADVENTURES.map((a) => a.id)).toEqual(['adv1', 'adv2', 'adv3', 'adv4', 'adv5', 'r1-4']);
  });

  it('pack and unpack are inverse: files ↔ code', () => {
    const s = LEVELS.find((l) => l.id === 'adv4');
    const { json, files } = unpackLevel(s);
    expect(Object.keys(files)).toEqual(['world.py', 'mission.py', 'player.py']);
    expect(json.sections.every((x) => x.code === undefined)).toBe(true);
    expect(packLevel(json, (n) => files[n])).toEqual(s);
    // CRLF and BOM from Windows editors are normalised
    expect(packLevel(json, (n) => '﻿' + files[n].replace(/\n/g, '\r\n'))).toEqual(s);
    // a missing file is reported by the validation
    const broken = packLevel(json, (n) => (n === 'mission.py' ? null : files[n]));
    expect(validateScenario(broken).join()).toContain('file mission.py missing');
  });

  it('unpack gives every section its own file name, also without a file entry', () => {
    const { files, json } = unpackLevel(level('x = 1\n', { sections: [
      { id: 'mission', level: 'mission', code: 'a = 1\n' },
      { id: 'mission', level: 'mission', code: 'b = 2\n' },
      { id: '1 bad/name', level: 'player', code: 'c = 3\n' },
    ] }));
    expect(Object.keys(files)).toEqual(['mission.py', 'mission_2.py', 's_1_bad_name.py']);
    expect(json.sections.map((s) => s.file)).toEqual(['mission.py', 'mission_2.py', 's_1_bad_name.py']);
  });

  it('validation of the new fields', () => {
    expect(validateScenario(level('', { end: 'never' })).join()).toContain('end must be');
    expect(validateScenario(level('', { version: 3 })).join()).toContain('version 3');
    expect(validateScenario(level('', { victoryTexts: { gold: 5 } })).join()).toContain('victoryTexts.gold');
    expect(validateScenario(level('', { available: { buildings: ['farm', 'residence'] } }))).toEqual([]);
    expect(validateScenario(level('', { available: { buildings: ['__proto__'] } })).join()).toContain('available');
    expect(validateScenario(level('', { available: { buildings: [1] } })).join()).toContain('available');
    const bad = level('');
    bad.sections[0].file = '../evil.py';
    expect(validateScenario(bad).join()).toContain('file must be');
    // version 1 ends only by script, version 2 by its objectives unless `end` says otherwise
    expect(scenarioToDef({ ...level(''), version: 1 }).end).toBe('script');
    expect(scenarioToDef(level('')).end).toBe('objectives');
    expect(scenarioToDef(level('', { end: 'script' })).end).toBe('script');
  });
});

describe('Mission API version 2', () => {
  it('texts inline with de=/en=, one language as a plain string', () => {
    const sim = createScenarioSim(level('@on_start\ndef go():\n    say("nelia", de="Hallo", en="Hello")\n    message("Nur deutsch")\n    say("orrin", text={"de": "A", "en": "B"})\n'));
    run(sim, 400);
    expect(errors(sim)).toEqual([]);
    expect(sim.mission.state.messages.map((m) => m.text)).toEqual([{ de: 'Hallo', en: 'Hello' }, 'Nur deutsch', { de: 'A', en: 'B' }]);
  });

  it('say without any text is a readable error', () => {
    const sim = createScenarioSim(level('say("nelia")\n'));
    expect(errors(sim)[0]).toContain('err.script.argMissing');
    expect(errors(sim)[0]).toContain('"arg":"text"');
  });

  it('objective(id, condition, de=, en=) with a pair as progress; the old order still works', () => {
    const sim = createScenarioSim(level([
      'objective("trees", lambda: (len(trees_near(place("goal"), 20)), 3), de="Pflanze 3 Bäume", en="Plant 3 trees")',
      'objective("old", "Alter Text", lambda: False)',
      'objective("bare", lambda: False)',
      '',
    ].join('\n')));
    run(sim, 2);
    expect(errors(sim)).toEqual([]);
    const ui = () => sim.mission.uiState(sim).objectives;
    expect(ui().map((o) => [o.id, o.text, o.progress])).toEqual([
      ['trees', { de: 'Pflanze 3 Bäume', en: 'Plant 3 trees' }, [0, 3]],
      ['old', 'Alter Text', null],
      ['bare', 'bare', null],
    ]);
    const plant = (x, y) => sim.mission.script.apis.mission.natives.add_tree({ vm: sim.mission.script.vms.mission, task: null }, [x, y], {});
    plant(12, 3);
    plant(13, 3);
    sim.step();
    expect(ui()[0].progress).toEqual([2, 3]);
    plant(14, 3);
    sim.step();
    expect(sim.mission.state.objectives[0].status).toBe('done');
  });

  it('only a tuple of numbers is a progress pair; anything else in a pair is an error that switches the condition off', () => {
    const sim = createScenarioSim(level('objective("x", lambda: (1.7, 2))\nobjective("y", lambda: ("a", 2))\nobjective("z", lambda: [1, 2], primary=False)\n', { end: 'script' }));
    run(sim, 2);
    expect(errors(sim)).toHaveLength(1);
    expect(errors(sim)[0]).toContain('err.script.type');
    expect(sim.mission.state.objectives.map((o) => [o.status, o.progress])).toEqual([['active', [1, 2]], ['active', [0, 1]], ['done', [1, 1]]]);
  });

  it('end "objectives": all primary goals done wins, a failed primary goal loses', () => {
    const win = createScenarioSim(level('objective("a", lambda: True)\nobjective("b", lambda: False, primary=False)\n'));
    run(win, 3);
    expect(win.mission.state.result).toMatchObject({ won: true, reason: 'objectives' });
    const lose = createScenarioSim(level('objective("a", lambda: False)\n@on_start\ndef s():\n    fail("a")\n'));
    run(lose, 3);
    expect(lose.mission.state.result).toMatchObject({ won: false, reason: 'a' });
    // end "script": goals alone do not end the level
    const script = createScenarioSim(level('objective("a", lambda: True)\n', { end: 'script' }));
    run(script, 5);
    expect(script.mission.state.result).toBeNull();
  });

  it('victory(reason) picks victory text and epilogue of that reason; de=/en= give them inline', () => {
    const texts = {
      victoryTexts: { gold: { de: 'Reich!', en: 'Rich!' } },
      debriefs: { gold: { de: 'Später …', en: 'Later …' } },
      defeatTexts: { ice: { de: 'Eingebrochen.', en: 'Fell through.' } },
    };
    const a = createScenarioSim(level('victory("gold")\n', texts));
    expect(a.mission.uiState(a).result).toMatchObject({ won: true, reason: 'gold', text: { de: 'Reich!' }, debrief: { de: 'Später …' } });
    const b = createScenarioSim(level('defeat("ice")\n', texts));
    expect(b.mission.uiState(b).result).toMatchObject({ won: false, text: { en: 'Fell through.' } });
    const c = createScenarioSim(level('victory(de="Selbst geschrieben", en="Own words")\n', texts));
    expect(c.mission.uiState(c).result).toMatchObject({ reason: 'script', text: { de: 'Selbst geschrieben', en: 'Own words' }, debrief: null });
    // unknown reason: the general text; no Object.prototype keys
    const d = createScenarioSim(level('victory("constructor")\n', { victoryText: { de: 'Allgemein', en: 'General' } }));
    expect(d.mission.uiState(d).result.text).toEqual({ de: 'Allgemein', en: 'General' });
  });

  it('@on_event(name, …) is the same as the short forms; unknown names suggest a correct one', () => {
    const sim = createScenarioSim(level([
      '@on_event("start")',
      'def a():',
      '    print("start")',
      '@on_event("enter", target="goal")',
      'def b(u):',
      '    print("enter", u.name)',
      '@on_event("every", seconds=1)',
      'def c():',
      '    print("tick")',
      '',
    ].join('\n')));
    runCode(sim, 'for i in range(6):\n    hero.step()\n');
    run(sim, 200);
    const out = sim.mission.script.state.console.map((c) => c.text);
    expect(out[0]).toBe('start');
    expect(out).toContain('enter nelia');
    expect(out.filter((t) => t === 'tick').length).toBeGreaterThan(3);
    const bad = createScenarioSim(level('@on_event("tlak", id="x")\ndef f(h):\n    pass\n'));
    expect(errors(bad)[0]).toContain('script.game.eventUnknown');
    expect(errors(bad)[0]).toContain('"suggestion":"talk"');
    const bare = createScenarioSim(level('@on_event\ndef f():\n    pass\n'));
    expect(errors(bare)[0]).toContain('script.game.eventName');
  });

  it('program.status, program.runs and program.get(name) read the player program (a copy)', () => {
    const sim = createScenarioSim(level([
      'objective("guess", lambda: program.status == "done" and program.get("guess") == 7)',
      '@on_start',
      'def watch():',
      '    print("runs", program.runs, program.status, program.get("guess", "none"))',
      '    wait_until(lambda: program.status == "done")',
      '    data = program.get("data")',
      '    data.append(99)',
      '    print(program.get("data"), data, program.get("f"))',
      '',
    ].join('\n')));
    run(sim, 2);
    runCode(sim, 'guess = 7\ndata = [1, {"a": (2, 3.5)}]\ndef f():\n    pass\n');
    run(sim, 20);
    const out = sim.mission.script.state.console.map((c) => c.text);
    expect(out[0]).toBe('runs 0 idle none');
    expect(out[1]).toBe("[1, {'a': (2, 3.5)}] [1, {'a': (2, 3.5)}, 99] None");
    expect(sim.mission.state.result).toMatchObject({ won: true });
  });

  it('places of scenario.json, make_place and the runtime are one table', () => {
    const sim = createScenarioSim(level('make_place("well", 5, 5, 2)\nobjective("go", lambda: False)\n'));
    expect(sim.mission.pointOf(sim, 'goal')).toEqual({ x: 10, y: 8, r: 0 });
    expect(sim.mission.pointOf(sim, 'well')).toEqual({ x: 5, y: 5, r: 2 });
    expect(sim.mission.pointOf(sim, 'constructor')).toBeNull();
    expect(sim.mission.state.refs.goal).toBeUndefined();
  });
});

describe('Save games', () => {
  it('carry the scenario with its code, so a changed level never breaks an old save', () => {
    const sim = createMissionSim('adv1');
    runCode(sim, 'for i in range(3):\n    hero.step()\n');
    run(sim, 30);
    const data = JSON.parse(JSON.stringify(saveGame(sim)));
    expect(data.mission.scenario.id).toBe('adv1');
    expect(data.mission.scenario.sections.find((s) => s.id === 'mission').code).toContain('objective("goal"');
    expect(data.mission.custom).toBe(false);
    // A later edit of the bundled level: the save keeps running with its own code
    const sec = getMission('adv1').scenario.sections.find((s) => s.id === 'mission');
    const before = sec.code;
    sec.code += '\nprint("changed")\n';
    let back;
    try { back = loadGame(data); } finally { sec.code = before; }
    expect(back.mission.def.next).toBe('adv2');
    expect(back.mission.def.custom).toBe(false);
    for (let i = 0; i < 50; i++) { sim.step(); back.step(); }
    expect(back.hash()).toBe(sim.hash());
  });

  it('own levels stay own levels after loading (no campaign progress)', () => {
    const sim = createScenarioSim(level('x = 1\n', { id: 'adv1' }));
    const back = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    expect(back.mission.def.custom).toBe(true);
    expect(back.mission.def.next).toBeNull();
  });
});

describe('Talk figures', () => {
  const mission = [
    'alchemist = npc("alchemist", look="worker.alchemist", at=(12, 8), name={"de": "Alchemist", "en": "Alchemist"})',
    'talks = 0',
    '@on_talk("alchemist")',
    'def talk(hero):',
    '    global talks',
    '    talks += 1',
    '    print("talk", hero.name, talks)',
    '    if talks == 2:',
    '        alchemist.stop_talking()',
    '',
  ].join('\n');
  const npcOf = (sim) => [...sim.entities.values()].find((e) => e.kind === 'npc');
  const heroOf = (sim) => [...sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === 0);
  const talk = (sim) => sim.applyCommand({ type: 'order', player: 0, units: [heroOf(sim).id], order: 'talk', target: npcOf(sim).id });
  const out = (sim) => sim.mission.script.state.console.map((c) => c.text);

  it('npc() places a figure; walking past does nothing, a talk order starts @on_talk on arrival', () => {
    const sim = createScenarioSim(level(mission, { end: 'script' }));
    expect(errors(sim)).toEqual([]);
    const n = npcOf(sim);
    expect(n).toMatchObject({ npc: 'alchemist', look: 'worker.alchemist', talk: true, owner: -1 });
    // Walking right past it: no talk
    sim.command({ type: 'order', player: 0, units: [heroOf(sim).id], order: 'move', x: 13, y: 8 });
    for (let i = 0; i < 150; i++) sim.step();
    expect(out(sim)).toEqual([]);
    // Talk order: the hero walks next to it, the mission program reacts
    expect(talk(sim)).toBe(true);
    for (let i = 0; i < 150 && !out(sim).length; i++) sim.step();
    expect(out(sim)).toEqual(['talk nelia 1']);
    // The UI gets snapshots: a dialogue line added later must show up as a change (uiMerge compares snapshots)
    const a = sim.mission.uiState(sim), b = sim.mission.uiState(sim);
    expect(a.messages).not.toBe(sim.mission.state.messages);
    expect(a.messages).not.toBe(b.messages);
    const h = heroOf(sim);
    expect(h.talkTo).toBeUndefined();
    expect(Math.max(Math.abs(h.px - n.px), Math.abs(h.py - n.py))).toBeLessThanOrEqual(2500);
    // Talking again, then the mission switches the figure off
    talk(sim);
    for (let i = 0; i < 50; i++) sim.step();
    expect(out(sim)).toEqual(['talk nelia 1', 'talk nelia 2']);
    expect(npcOf(sim).talk).toBe(false);
    expect(talk(sim)).toBe(false);
    expect(sim.events.at(-1)).toMatchObject({ type: 'rejected', reason: 'err.noTalk' });
  });

  it('another order cancels the talk; save and load mid-way keep the same course', () => {
    const sim = createScenarioSim(level(mission, { end: 'script' }));
    talk(sim);
    sim.step();
    sim.command({ type: 'order', player: 0, units: [heroOf(sim).id], order: 'move', x: 4, y: 3 });
    for (let i = 0; i < 200; i++) sim.step();
    expect(out(sim)).toEqual([]);
    talk(sim);
    for (let i = 0; i < 3; i++) sim.step();
    const back = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    for (let i = 0; i < 200; i++) { sim.step(); back.step(); }
    expect(out(back)).toEqual(['talk nelia 1']);
    expect(back.hash()).toBe(sim.hash());
  });

  it('readable errors: look, missing place, the same name twice', () => {
    expect(errors(createScenarioSim(level('npc("a", look="https://x/y.glb", at=(3, 3))\n')))[0]).toContain('err.script.value');
    expect(errors(createScenarioSim(level('npc("a", look="assets/a.glb", at=(3, 3))\nnpc("b", look="hero.orrin", at=(5, 3))\n')))).toEqual([]);
    expect(errors(createScenarioSim(level('npc("a")\n')))[0]).toContain('"arg":"at"');
    expect(errors(createScenarioSim(level('npc("a", at=(3, 3))\nnpc("a", at=(4, 4))\n')))[0]).toContain('script.game.npcExists');
  });

  it('only heroes talk, only to figures with an exclamation mark', () => {
    const sim = createScenarioSim(level(mission + 'spawn(HUMAN, "sword1", (6, 6))\n', { end: 'script' }));
    expect(sim.applyCommand({ type: 'order', player: 0, units: [heroOf(sim).id], order: 'talk', target: heroOf(sim).id })).toBe(false);
    const troop = [...sim.entities.values()].find((e) => e.kind === 'leader');
    expect(sim.applyCommand({ type: 'order', player: 0, units: [troop.id], order: 'talk', target: npcOf(sim).id })).toBe(false);
    expect(sim.events.at(-1)).toMatchObject({ type: 'rejected', reason: 'err.talkHeroOnly' });
  });
});

describe('Outline without running the code', () => {
  it('objectives of a level: new and old order, texts inline or from the table, computed ones fall back to the id', async () => {
    const { scenarioGoals } = await import('../../src/sim/scripting/outline.js');
    const s = level([
      'objective("homes", lambda: (count("residence"), 2), de="Baue 2 Wohnhäuser", en="Build 2 residences")',
      'objective("old", "Alter Text", lambda: False, False)',
      'objective("key", "k1", None, hidden=True)',
      'objective("dict", text={"de": "A", "en": "B"})',
      'objective(name_from_code, lambda: True)',
      'objective("calc", lambda: True, de=f"{1}")',
      'def later():',
      '    objective("inside", lambda: True, en="Only English")',
      '',
    ].join('\n'), { texts: { k1: { de: 'Aus der Tabelle', en: 'From the table' } } });
    expect(scenarioGoals(s)).toEqual([
      { id: 'homes', text: { de: 'Baue 2 Wohnhäuser', en: 'Build 2 residences' }, primary: true, hidden: false },
      { id: 'old', text: 'Alter Text', primary: false, hidden: false },
      { id: 'key', text: { de: 'Aus der Tabelle', en: 'From the table' }, primary: true, hidden: true },
      { id: 'dict', text: { de: 'A', en: 'B' }, primary: true, hidden: false },
      { id: 'calc', text: 'calc', primary: true, hidden: false },
      { id: 'inside', text: { en: 'Only English' }, primary: true, hidden: false },
    ]);
    // A syntax error just gives nothing
    expect(scenarioGoals(level('objective("x",\n'))).toEqual([]);
    expect(scenarioToDef(LEVELS.find((l) => l.id === 'm1')).goals.map((g) => g.id)).toEqual(['barracks', 'army', 'camp']);
  });
});
