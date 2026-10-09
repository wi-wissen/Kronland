// Scripted playthroughs: tutorial and mission 1, only with player commands.

import { createMissionSim } from '../../src/sim/missions/runtime.js';
import { BUILDINGS } from '../../src/sim/data/buildings.js';
import { P, act, build, gatherWood, idle, serfs, own, leaders, hero, until, attackMove, tileOf, stepId, ref, refIds, talkTo, objective } from './missionBot.js';

/** Play the tutorial from start to finish. @returns {{ sim, log: string[] }} */
export function playTutorial(seed) {
  const sim = createMissionSim('tutorial', seed ? { seed } : {});
  const m = sim.mission;
  const log = [];
  const expectStep = (id) => {
    if (stepId(sim) !== id) throw new Error(`Expected step ${id}, is ${stepId(sim)} (tick ${sim.tick})`);
    log.push(id);
  };
  const waitStep = (id, max = 600) => {
    if (!until(sim, () => stepId(sim) !== id || m.state.result, max)) throw new Error(`Step ${id} hangs (tick ${sim.tick})`);
  };

  expectStep('welcome');
  act(sim, { type: 'mission', action: 'next' });
  expectStep('camera');
  act(sim, { type: 'mission', action: 'ui', check: 'camera' });
  sim.step();
  expectStep('select');
  act(sim, { type: 'mission', action: 'ui', check: 'selectSerfs' });
  sim.step();
  expectStep('wood');
  const tree = sim.entities.get(ref(sim, 'tree'));
  const [s1, s2, s3, s4] = serfs(sim);
  act(sim, { type: 'assignWork', units: [s1.id, s2.id], target: tree.id });
  sim.step();
  expectStep('pile');
  act(sim, { type: 'assignWork', units: [s3.id], target: ref(sim, 'pile') });
  sim.step();
  expectStep('residence');
  act(sim, { type: 'buySerf', count: 4 }); // more hands (the step for it comes later, but does no harm)
  build(sim, 'residence', 2);
  sim.step();
  expectStep('farm');
  build(sim, 'farm', 2);
  sim.step();
  expectStep('workers');
  // farmers need a finished farm; serfs help with building
  const farm = own(sim, 'farm')[0];
  act(sim, { type: 'assignWork', units: idle(sim).map((u) => u.id), target: farm.id });
  waitStep('workers', 3000);
  expectStep('mine');
  const sh = ref(sim, 'shaft');
  build(sim, 'clayMine', 3, sh);
  sim.step();
  expectStep('refiner');
  build(sim, 'brickworks', 3);
  sim.step();
  expectStep('serfs');
  act(sim, { type: 'buySerf', count: 1 });
  sim.step();
  expectStep('research');
  act(sim, { type: 'research', building: ref(sim, 'college'), tech: 'education' });
  sim.step();
  expectStep('taxes');
  act(sim, { type: 'mission', action: 'next' });
  expectStep('upgrade');
  // house must be finished
  const home = own(sim, 'residence')[0];
  act(sim, { type: 'assignWork', units: idle(sim).map((u) => u.id), target: home.id });
  until(sim, () => sim.entities.get(home.id).done, 3000, () => { if (!sim.entities.get(home.id).done) { const ids = idle(sim).map((u) => u.id); if (ids.length) sim.command({ player: P, type: 'assignWork', units: ids, target: home.id }); } });
  act(sim, { type: 'upgradeBuilding', building: home.id, units: idle(sim).slice(0, 4).map((u) => u.id) });
  sim.step();
  expectStep('recruit');
  act(sim, { type: 'recruit', building: ref(sim, 'barracks'), line: 'sword', full: true });
  sim.step();
  expectStep('fight');
  const army = [...leaders(sim).map((l) => l.id), hero(sim).id];
  const foes = refIds(sim, 'bandits');
  const target = sim.entities.get(foes[0]);
  attackMove(sim, army, tileOf(target));
  waitStep('fight', 2500);
  expectStep('ability');
  act(sim, { type: 'ability', hero: hero(sim).id, ability: 'courage' });
  sim.step();
  expectStep('end');
  act(sim, { type: 'mission', action: 'next' });
  log.push('result');
  return { sim, log };
}

/** Mission 1: put Nelia next to Orrin on the village square and send her to him (tap) until he has joined. */
export function meetOrrin(sim) {
  const st = sim.mission.state;
  const n = sim.entities.get(st.npcs.stranger.entity), nelia = sim.entities.get(st.refs.nelia);
  nelia.px = n.px + 1000; nelia.py = n.py; nelia.path = [];
  talkTo(sim, [nelia.id], 'stranger');
  // The conversation runs (after the arrival lines), then Orrin is a hero
  until(sim, () => hero(sim) && [...sim.entities.values()].some((e) => e.kind === 'hero' && e.hero === 'orrin' && e.owner === P), 2000);
}

/** Win mission 1 with a simple build-up strategy: Nelia to the root, both heroes against the collectors. */

export function playMission1(seed) {
  const sim = createMissionSim('c1', seed ? { seed } : {});
  const m = sim.mission;
  const hq = sim.findBuilding(P, 'headquarters');
  meetOrrin(sim);
  const orrinId = () => [...sim.entities.values()].find((e) => e.kind === 'hero' && e.hero === 'orrin' && e.owner === P)?.id;
  const heroIds = () => [m.state.refs.nelia, orrinId()].filter(Boolean);
  let phase = '';
  const keepBusy = () => {
    const col = refIds(sim, 'collectors').map((id) => sim.entities.get(id)).find(Boolean);
    // both heroes follow the collectors until they are gone
    if (col) { phase = 'fight'; attackMove(sim, heroIds(), tileOf(col)); }
    else if (!col && phase === '') { phase = 'root'; const r = ref(sim, 'oldRoot'); act(sim, { type: 'order', units: [m.state.refs.nelia], order: 'move', x: r.x, y: r.y }); }
    // construction sites first, then wood
    const sites = [...sim.entities.values()].filter((e) => e.kind === 'building' && e.owner === P && !e.done && e.builders.length < 4);
    for (const s of sites) {
      // idle ones first; a completely empty construction site fetches gatherers (otherwise the pile of beams holds them)
      const pool = idle(sim).length || s.builders.length ? idle(sim) : serfs(sim).filter((u) => u.job?.kind === 'gather');
      const ids = pool.slice(0, 4 - s.builders.length).map((u) => u.id);
      if (ids.length) sim.command({ player: P, type: 'assignWork', units: ids, target: s.id });
    }
    gatherWood(sim);
  };
  // The old tree brings three serfs; first the village centre on the old foundations
  const r = ref(sim, 'oldRoot');
  act(sim, { type: 'order', units: [m.state.refs.nelia], order: 'move', x: r.x, y: r.y });
  until(sim, () => objective(sim, 'root').status === 'done', 1500);
  const vc = ref(sim, 'vcRuin');
  act(sim, { type: 'placeBuilding', building: 'villageCenter', x: vc.x, y: vc.y, units: idle(sim).map((u) => u.id) });
  until(sim, () => sim.findBuilding(P, 'villageCenter')?.done, 3000, () => gatherWood(sim));
  act(sim, { type: 'buySerf', count: 4 });
  // Collect wood before every build until the costs are covered
  const later = (type, near) => {
    until(sim, () => sim.canPay(P, BUILDINGS[type].levels[0].cost), 3000, keepBusy);
    build(sim, type, 3, near);
  };
  const shaft = ref(sim, 'clayShaft');
  later('residence', { x: hq.x + 2, y: hq.y + 9 });
  later('farm', { x: hq.x + 8, y: hq.y + 6 });
  later('clayMine', shaft);
  later('residence', { x: hq.x - 4, y: hq.y + 8 });
  later('farm', { x: hq.x + 8, y: hq.y - 2 });
  const ok = until(sim, () => m.state.result, 20000, keepBusy);
  return { sim, ok };
}
