import { describe, it, expect } from 'vitest';
import { newSim, quickBuild, hqOf, serfsOf } from './helpers.js';
import { BUILDING_TECHS, techsOfBuilding, RESEARCH_BUILDINGS } from '../../src/sim/data/buildingTechs.js';
import { BUILDINGS } from '../../src/sim/data/buildings.js';
import { MILITIA } from '../../src/sim/data/units.js';
import { combatStats, maxHp } from '../../src/sim/systems/military.js';
import { techBonus, buildingTechPoints, grantBuildingTech, buildingMaxHp } from '../../src/sim/systems/techs.js';
import { serfSpeed } from '../../src/sim/systems/serfs.js';
import { REASONS } from '../../src/sim/reasons.js';

const rich = (sim, owner = 0) => { for (const r of Object.keys(sim.players[owner].stock)) sim.players[owner].stock[r] = 20000; };
const rejectOf = (ev) => ev.find((e) => e.type === 'rejected')?.reason;

describe('Building technologies: data', () => {
  it('every technology belongs to an existing building and predecessors exist', () => {
    for (const t of Object.values(BUILDING_TECHS)) {
      expect(BUILDINGS[t.building], t.id).toBeTruthy();
      expect(BUILDINGS[t.building].levels[t.minLevel], t.id).toBeTruthy();
      if (t.prev) expect(BUILDING_TECHS[t.prev].building).toBe(t.building);
      if (t.unlocks) expect(BUILDINGS[t.unlocks].requires).toBe(t.id);
    }
  });

  it('all required researches exist', () => {
    const names = Object.values(BUILDING_TECHS).map((t) => t.name);
    for (const n of ['Kettenlederrüstung', 'Weiches Leder', 'Kettenhemd', 'Wattiertes Leder', 'Meisterschmied', 'Plattenharnisch',
      'Verstärktes Leder', 'Eisengießen', 'Holz härten', 'Drechseln', 'Befiederung', 'Bodkinpfeile', 'Schießpulver',
      'Glühende Geschosse', 'Wettervorhersage', 'Meteorologie', 'Maurerhandwerk', 'Fährtenlesen', 'Stadtwache', 'Webrahmen',
      'Hochwertige Schuhe', 'Marschieren', 'Hufbeschlag', 'Verbessertes Fahrgestell', 'Meisterschütze']) expect(names).toContain(n);
    expect(RESEARCH_BUILDINGS).toEqual(expect.arrayContaining(['smithy', 'sawmill', 'alchemist', 'stonemason', 'headquarters', 'villageCenter', 'barracks']));
  });
});

describe('Building technologies: research', () => {
  it('smithy researches chain leather armour with workers; costs are paid immediately', () => {
    const sim = newSim();
    const p = sim.players[0];
    p.techs.add('alchemy');
    rich(sim);
    const smithy = quickBuild(sim, 'smithy');
    const gold = p.stock.gold;
    const ev = sim.step([{ type: 'research', player: 0, building: smithy.id, tech: 'leatherMail' }]);
    expect(ev.some((e) => e.type === 'researchStarted' && e.tech === 'leatherMail')).toBe(true);
    expect(p.stock.gold).toBe(gold - BUILDING_TECHS.leatherMail.cost.gold);
    expect(smithy.research.tech).toBe('leatherMail');
    let t = 0;
    while (!p.techs.has('leatherMail') && t < 20000) { sim.step(); t++; }
    expect(p.techs.has('leatherMail')).toBe(true);
    // fully staffed ≈ 30 s; with the workers' start-up time (moving in, walking, campfire) clearly more, but bounded
    expect(t).toBeGreaterThanOrEqual(BUILDING_TECHS.leatherMail.time * 10);
    expect(t).toBeLessThan(BUILDING_TECHS.leatherMail.time * 10 * 8);
    expect(smithy.research).toBe(null);
  });

  it('without workers research in a workshop makes no progress', () => {
    const sim = newSim();
    sim.players[0].techs.add('alchemy');
    rich(sim);
    // remove the village centre: no new workers
    sim.removeEntity(sim.findBuilding(0, 'villageCenter'));
    const smithy = quickBuild(sim, 'smithy');
    sim.step([{ type: 'research', player: 0, building: smithy.id, tech: 'leatherMail' }]);
    sim.run(500);
    expect(smithy.workers.length).toBe(0);
    expect(smithy.research.progress).toBe(0);
  });

  it('castle and military buildings research without workers in exactly the given time', () => {
    const sim = newSim();
    rich(sim);
    const hq = hqOf(sim);
    sim.step([{ type: 'research', player: 0, building: hq.id, tech: 'tracking' }]);
    let t = 1; // the command tick counts too
    while (!sim.players[0].techs.has('tracking') && t < 5000) { sim.step(); t++; }
    expect(t).toBe(BUILDING_TECHS.tracking.time * 10);
    expect(buildingTechPoints('tracking')).toBe(BUILDING_TECHS.tracking.time * 10);
  });

  it('checks building, level, predecessor, duplicate research and costs', () => {
    const sim = newSim();
    const p = sim.players[0];
    p.techs.add('alchemy');
    const smithy = quickBuild(sim, 'smithy');
    const hq = hqOf(sim);
    const send = (b, tech) => rejectOf(sim.step([{ type: 'research', player: 0, building: b.id, tech }]));
    expect(send(hq, 'leatherMail')).toBe(REASONS.wrongBuilding);
    expect(send(smithy, 'chainMail')).toBe(REASONS.needPrevTech);
    p.stock.gold = 0; p.raw.gold = 0;
    expect(send(smithy, 'leatherMail')).toBe(REASONS.noResources);
    rich(sim);
    p.techs.add('leatherMail');
    expect(send(smithy, 'chainMail')).toBe(REASONS.needLevel);
    expect(send(smithy, 'leatherMail')).toBe(REASONS.alreadyResearched);
    expect(send(smithy, 'nope')).toBe(REASONS.unknownTech);
    expect(send(smithy, 'masterSmith')).toBe(REASONS.needLevel);
    smithy.level = 1;
    p.techs.add('chainMail');
    expect(send(smithy, 'plateArmor')).toBe(REASONS.needFortress);
    expect(send(smithy, 'softLeather')).toBeUndefined();
    expect(send(smithy, 'masterSmith')).toBe(REASONS.researchRunning);
    const smithy2 = quickBuild(sim, 'smithy');
    smithy2.level = 1;
    expect(send(smithy2, 'softLeather')).toBe(REASONS.researchElsewhere);
    // foreign building
    const enemyHq = hqOf(sim, 1);
    expect(send(enemyHq, 'tracking')).toBe(REASONS.notOwnBuilding);
    // university research keeps working independently
    expect(rejectOf(sim.step([{ type: 'research', player: 0, building: smithy.id, tech: 'education' }]))).toBe('err.universityNeeded');
  });

  it('building technologies do not count towards the university upgrade (4 university technologies)', () => {
    const sim = newSim();
    rich(sim);
    const uni = quickBuild(sim, 'university');
    for (const t of ['leatherMail', 'softLeather', 'tracking', 'loom']) sim.players[0].techs.add(t);
    expect(sim.checkUpgrade(0, uni)).toBe('err.fourTechs');
  });
});

describe('Building technologies: effect', () => {
  it('armour and attack for the right troop types', () => {
    const sim = newSim();
    const hq = hqOf(sim);
    const sw = sim.spawnLeader(0, 'sword1', hq.x + 8, hq.y + 8, 0);
    const sp = sim.spawnLeader(0, 'spear1', hq.x + 9, hq.y + 8, 0);
    const bow = sim.spawnLeader(0, 'bow1', hq.x + 10, hq.y + 8, 0);
    const base = (e) => combatStats(sim, e);
    const b0 = { sw: base(sw), sp: base(sp), bow: base(bow) };
    for (const t of ['leatherMail', 'chainMail', 'plateArmor', 'masterSmith', 'ironCasting']) grantBuildingTech(sim, 0, t);
    expect(base(sw).armor).toBe(b0.sw.armor + 6);
    expect(base(sw).attack).toBe(b0.sw.attack + 4);
    expect(base(sp).armor).toBe(b0.sp.armor);
    for (const t of ['softLeather', 'woodHardening', 'turnery', 'fletching', 'bodkin', 'masterShooter']) grantBuildingTech(sim, 0, t);
    expect(base(sp).armor).toBe(b0.sp.armor + 2);
    expect(base(sp).attack).toBe(b0.sp.attack + 4);
    expect(base(sp).range).toBe(b0.sp.range + 300);
    expect(base(bow).attack).toBe(b0.bow.attack + 5);
    expect(base(bow).range).toBe(b0.bow.range + 1000);
    // opponent stays untouched
    const enemy = sim.spawnLeader(1, 'sword1', hq.x + 12, hq.y + 8, 0);
    expect(combatStats(sim, enemy).armor).toBe(b0.sw.armor);
  });

  it('cannons: gunpowder and incendiary shots, chassis', () => {
    const sim = newSim();
    const hq = hqOf(sim);
    const c = sim.spawnLeader(0, 'cannon1', hq.x + 8, hq.y + 8, 0);
    const s0 = combatStats(sim, c);
    for (const t of ['gunpowder', 'heatedShots', 'undercarriage']) grantBuildingTech(sim, 0, t);
    const s1 = combatStats(sim, c);
    expect(s1.attack).toBe(s0.attack + 6);
    expect(s1.range).toBe(s0.range + 1000);
    expect(s1.speed).toBe(Math.trunc((s0.speed * 125) / 100));
  });

  it('marching and horseshoeing speed up the troops', () => {
    const sim = newSim();
    const hq = hqOf(sim);
    const sw = sim.spawnLeader(0, 'sword1', hq.x + 8, hq.y + 8, 0);
    const cav = sim.spawnLeader(0, 'heavyCav1', hq.x + 9, hq.y + 8, 0);
    const v0 = combatStats(sim, sw).speed, c0 = combatStats(sim, cav).speed;
    grantBuildingTech(sim, 0, 'marching');
    expect(combatStats(sim, sw).speed).toBe(Math.trunc((v0 * 120) / 100));
    expect(combatStats(sim, cav).speed).toBe(c0);
    grantBuildingTech(sim, 0, 'horseshoe');
    expect(combatStats(sim, cav).speed).toBe(Math.trunc((c0 * 120) / 100));
  });

  it('masonry: building armour +2 and HP +20 %, existing buildings keep their share', () => {
    const sim = newSim();
    const hq = hqOf(sim);
    const a0 = combatStats(sim, hq).armor;
    const full = BUILDINGS.headquarters.levels[0].hp;
    hq.hp = full >> 1; // half HP
    grantBuildingTech(sim, 0, 'masonry');
    expect(combatStats(sim, hq).armor).toBe(a0 + 2);
    expect(maxHp(sim, hq)).toBe(Math.trunc((full * 120) / 100));
    expect(hq.hp).toBe(Math.trunc(((full >> 1) * 120) / 100));
    const res = quickBuild(sim, 'residence');
    expect(res.hp).toBe(buildingMaxHp(sim, res));
    expect(res.hp).toBe(720);
  });

  it('loom and quality shoes: serfs and workers', () => {
    const sim = newSim();
    const serf = serfsOf(sim)[0];
    const s0 = combatStats(sim, serf), v0 = serfSpeed(sim, serf);
    grantBuildingTech(sim, 0, 'loom');
    grantBuildingTech(sim, 0, 'shoes');
    expect(combatStats(sim, serf).armor).toBe(s0.armor + 2);
    expect(serfSpeed(sim, serf)).toBe(Math.trunc((v0 * 120) / 100));
    expect(techBonus(sim, 0, 'workers')).toMatchObject({ armor: 2, speed: 20 });
  });

  it('town watch only strengthens the militia, tracking extends the vision', () => {
    const sim = newSim();
    const serf = serfsOf(sim)[0];
    const hq = hqOf(sim);
    const L = sim.spawnLeader(0, 'sword1', hq.x + 8, hq.y + 8, 0);
    const sight0 = combatStats(sim, L).sight;
    grantBuildingTech(sim, 0, 'cityGuard');
    grantBuildingTech(sim, 0, 'tracking');
    const plain = combatStats(sim, serf).attack;
    sim.step([{ type: 'militia', player: 0, on: true }]);
    expect(combatStats(sim, serf).attack).toBe(MILITIA.attack + 4);
    expect(plain).toBe(5);
    expect(combatStats(sim, L).sight).toBe(sight0 + 2);
  });

  it('every research can be completed in its building with full equipment', () => {
    const sim = newSim(5);
    const p = sim.players[0];
    rich(sim);
    for (const t of ['alchemy', 'construction', 'gears', 'conscription', 'standingArmy', 'tactics', 'metallurgy', 'pulley', 'alloys']) p.techs.add(t);
    const order = Object.values(BUILDING_TECHS).sort((a, b) => a.minLevel - b.minLevel);
    const built = {};
    hqOf(sim).level = 2;
    const get = (type) => {
      if (type === 'headquarters') return hqOf(sim);
      if (type === 'villageCenter') { const v = sim.findBuilding(0, 'villageCenter'); v.level = 2; return v; }
      if (!built[type]) { built[type] = quickBuild(sim, type); built[type].level = BUILDINGS[type].levels.length - 1; }
      return built[type];
    };
    for (const t of order) {
      const b = get(t.building);
      // credit the predecessor directly, we only check reachability
      if (t.prev) p.techs.add(t.prev);
      const ev = sim.step([{ type: 'research', player: 0, building: b.id, tech: t.id }]);
      expect(rejectOf(ev), t.id).toBeUndefined();
      b.research = null;
      p.techs.add(t.id);
    }
    expect(techsOfBuilding('smithy').length).toBe(8);
  });
});
