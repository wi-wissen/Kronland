// Buildings. Cost per level; levels[0] = new build, levels[1] = upgrade to level 2 etc.
// Sources: original XMLs/dedk.de/Fandom. "(A)" = own assumption. Build/upgrade times and builders: original
// config/entities/PB_*.xml (github.com/mcb5637/s5HEmodification, identical in base/extra1/extra2).
// placement: 'free' (build anywhere), 'settlement' (settlement spot only), 'shaft' (shaft only)

/**
 * @typedef {Object} BuildingLevel
 * @property {string} name
 * @property {Partial<Record<import('./resources.js').ResourceId, number>>} cost
 * @property {number} buildTime seconds: new build (levels[0]) with ONE serf – n serfs need buildTime/n
 *   (original: ConstructionInfo/Time); upgrade (levels[1+]) runs on its own without serfs (original: Upgrade/Time)
 * @property {number} hp
 * @property {number} [beds]
 * @property {number} [seats]
 * @property {number} [population]
 * @property {number} [workers]
 */

/**
 * @typedef {Object} BuildingDef
 * @property {string} id
 * @property {number} w width in tiles
 * @property {number} h depth in tiles
 * @property {'free'|'settlement'|'shaft'|'bridge'} placement
 * @property {boolean} [buildable] false = cannot be built by the player (castle)
 * @property {string} [shaftResource]
 * @property {string} [requires] technology that unlocks it
 * @property {number} builders max serfs building or repairing at the same time (original: number of BuilderSlots)
 * @property {BuildingLevel[]} levels
 */

/** @type {Record<string, BuildingDef>} */
export const BUILDINGS = {
  headquarters: {
    id: 'headquarters', w: 5, h: 5, placement: 'free', buildable: false, builders: 8,
    levels: [
      { name: 'Burg', cost: {}, buildTime: 0, hp: 2600 },
      { name: 'Festung', cost: { gold: 450, clay: 250, stone: 300 }, buildTime: 90, hp: 3400 },
      { name: 'Zitadelle', cost: { gold: 600, clay: 400, stone: 500 }, buildTime: 120, hp: 4200 }, // cost (A)
    ],
  },
  villageCenter: {
    id: 'villageCenter', w: 4, h: 4, placement: 'settlement', builders: 6,
    levels: [
      { name: 'Dorfzentrum', cost: { wood: 300, clay: 300 }, buildTime: 110, hp: 1500, population: 75 }, // cost (A)
      { name: 'Gemeindezentrum', cost: { gold: 150, stone: 300, clay: 200 }, buildTime: 40, hp: 2000, population: 100 },
      { name: 'Stadtzentrum', cost: { gold: 200, stone: 400, clay: 300 }, buildTime: 40, hp: 2500, population: 125 },
    ],
  },
  residence: {
    id: 'residence', w: 3, h: 3, placement: 'free', builders: 4,
    levels: [
      { name: 'Wohnhaus', cost: { wood: 150, clay: 100 }, buildTime: 80, hp: 600, beds: 6 },
      { name: 'Mittleres Wohnhaus', cost: { wood: 50, stone: 150 }, buildTime: 40, hp: 800, beds: 9 },
      { name: 'Großes Wohnhaus', cost: { wood: 150, stone: 200 }, buildTime: 50, hp: 1000, beds: 12 },
    ],
  },
  farm: {
    id: 'farm', w: 4, h: 3, placement: 'free', builders: 4,
    levels: [
      { name: 'Bauernhof', cost: { wood: 200, clay: 150 }, buildTime: 80, hp: 600, seats: 8, workers: 1 },
      { name: 'Mühle', cost: { wood: 50, stone: 100 }, buildTime: 40, hp: 800, seats: 10, workers: 2 },
      { name: 'Gut', cost: { wood: 150, stone: 300 }, buildTime: 50, hp: 1000, seats: 12, workers: 3 },
    ],
  },
  university: {
    id: 'university', w: 4, h: 4, placement: 'free', builders: 6,
    levels: [
      { name: 'Hochschule', cost: { wood: 200, clay: 300 }, buildTime: 90, hp: 1000, workers: 2 },
      { name: 'Universität', cost: { gold: 300, stone: 400, wood: 200 }, buildTime: 50, hp: 1500, workers: 4 }, // cost (A)
    ],
  },
  clayMine: shaftMine('clayMine', 'clay', 'Lehmgrube', 'Lehmstollen', 'Lehmbergwerk', 80),
  stoneMine: shaftMine('stoneMine', 'stone', 'Steingrube', 'Steinstollen', 'Steinbergwerk', 80),
  ironMine: shaftMine('ironMine', 'iron', 'Eisengrube', 'Eisenstollen', 'Eisenbergwerk', 80),
  sulfurMine: shaftMine('sulfurMine', 'sulfur', 'Schwefelgrube', 'Schwefelstollen', 'Schwefelbergwerk', 110),
  // refiner(id, names, cost, requires, workers, build time, builders) – time and builders from PB_*1.xml
  brickworks: refiner('brickworks', 'Ziegelhütte', 'Ziegelei', { wood: 200, stone: 150 }, 'construction', 4, 110, 4),
  sawmill: refiner('sawmill', 'Sägemühle', 'Sägewerk', { wood: 150, stone: 150 }, 'construction', 3, 110, 6), // cost (A)
  stonemason: refiner('stonemason', 'Steinmetzhütte', 'Steinmetze', { wood: 150, clay: 150 }, 'gears', 3, 80, 4), // cost (A)
  smithy: refiner('smithy', 'Schmiede', 'Grobschmiede', { wood: 200, stone: 200 }, 'alchemy', 3, 110, 4), // cost (A)
  alchemist: refiner('alchemist', 'Alchimistenhütte', 'Laboratorium', { wood: 200, clay: 200 }, 'alchemy', 3, 80, 4), // cost (A)
  bank: refiner('bank', 'Bank', 'Schatzkammer', { stone: 300, clay: 200 }, 'printing', 3, 130, 8), // cost (A)
  chapel: {
    id: 'chapel', w: 3, h: 4, placement: 'free', requires: 'education', builders: 8,
    levels: [ // times: PB_Monastery1/2; cost, HP, workers (A)
      { name: 'Kapelle', cost: { wood: 200, stone: 200 }, buildTime: 140, hp: 1000, workers: 2 },
      { name: 'Kirche', cost: { gold: 200, stone: 300 }, buildTime: 60, hp: 1500, workers: 4 },
      { name: 'Kathedrale', cost: { gold: 400, stone: 500 }, buildTime: 90, hp: 2000, workers: 6 },
    ],
  },
  storehouse: {
    id: 'storehouse', w: 3, h: 3, placement: 'free', requires: 'education', builders: 4,
    levels: [ // times: PB_Market1; cost, HP (A)
      { name: 'Lager', cost: { wood: 200, clay: 100 }, buildTime: 80, hp: 800 },
      { name: 'Marktplatz', cost: { gold: 200, stone: 200 }, buildTime: 40, hp: 1000, workers: 2 },
    ],
  },
};

function shaftMine(id, res, n1, n2, n3, buildTime) {
  return {
    id, w: 3, h: 3, placement: 'shaft', shaftResource: res, builders: 4,
    levels: [ // times: PB_*Mine1/2; cost of level 1, everything of levels 2/3 except time (A)
      { name: n1, cost: { wood: 250, clay: 150 }, buildTime, hp: 800, workers: 5 },
      { name: n2, cost: { wood: 200, stone: 250 }, buildTime: 40, hp: 1000, workers: 6 },
      { name: n3, cost: { wood: 250, stone: 400 }, buildTime: 50, hp: 1200, workers: 7 },
    ],
  };
}

function refiner(id, n1, n2, cost, requires, workers, buildTime, builders) {
  return {
    id, w: 3, h: 3, placement: 'free', requires, builders,
    levels: [ // upgrade time 40 s for all refiners (PB_*1.xml); cost and HP of level 2 (A)
      { name: n1, cost, buildTime, hp: 800, workers },
      { name: n2, cost: { gold: 200, stone: 300 }, buildTime: 40, hp: 1000, workers: workers + 2 },
    ],
  };
}

// Military (cost and HP (A), armour per dedk.de; times and builders from PB_*1.xml)
BUILDINGS.barracks = {
  id: 'barracks', w: 4, h: 4, placement: 'free', requires: 'conscription', armor: 4, builders: 6,
  levels: [
    { name: 'Kaserne', cost: { wood: 300, stone: 250 }, buildTime: 90, hp: 1600 },
    { name: 'Garnison', cost: { gold: 200, stone: 400 }, buildTime: 40, hp: 2100 },
  ],
};
BUILDINGS.archery = {
  id: 'archery', w: 4, h: 3, placement: 'free', requires: 'standingArmy', armor: 4, builders: 6,
  levels: [
    { name: 'Schießplatz', cost: { wood: 300, stone: 200 }, buildTime: 90, hp: 1400 },
    { name: 'Schießanlage', cost: { gold: 200, stone: 400 }, buildTime: 40, hp: 1900 },
  ],
};
BUILDINGS.stable = {
  id: 'stable', w: 4, h: 4, placement: 'free', requires: 'tactics', armor: 4, builders: 8,
  levels: [
    { name: 'Reiterei', cost: { wood: 400, stone: 300 }, buildTime: 120, hp: 1600 },
    { name: 'Stall', cost: { gold: 300, stone: 400 }, buildTime: 40, hp: 2100 },
  ],
};
BUILDINGS.foundry = {
  id: 'foundry', w: 4, h: 3, placement: 'free', requires: 'metallurgy', armor: 3, builders: 6,
  levels: [
    { name: 'Kanonengießerei', cost: { stone: 400, iron: 300 }, buildTime: 110, hp: 1300 },
    { name: 'Kanonenmanufaktur', cost: { gold: 300, stone: 400, iron: 300 }, buildTime: 40, hp: 1900 },
  ],
};
BUILDINGS.tower = {
  id: 'tower', w: 2, h: 2, placement: 'free', requires: 'construction', armor: 6, builders: 4,
  levels: [
    { name: 'Wachturm', cost: { wood: 200, stone: 300 }, buildTime: 80, hp: 900 },
    { name: 'Ballistaturm', cost: { stone: 300, iron: 100 }, buildTime: 15, hp: 1150 },
    { name: 'Kanonenturm', cost: { stone: 400, iron: 200, sulfur: 100 }, buildTime: 15, hp: 1400 },
  ],
};

// Ornamental buildings: raise the maximum motivation permanently and the current one once (source: dedk.de).
// Original ornaments (PB_Beautification*) have one builder slot each, build times 10–40 s. Windwheel ≈ 12
// (gear wheel, 20 s), statue ≈ 07 (printing, 30 s); clock and fountain have no clear counterpart, time (A).
BUILDINGS.clock = {
  id: 'clock', w: 2, h: 2, placement: 'free', requires: 'construction', motivationEffect: 4, builders: 1,
  levels: [{ name: 'Uhr', cost: { gold: 300, wood: 100 }, buildTime: 20, hp: 400 }],
};
BUILDINGS.windwheel = {
  id: 'windwheel', w: 2, h: 2, placement: 'free', requires: 'alchemy', motivationEffect: 4, builders: 1,
  levels: [{ name: 'Windrad', cost: { gold: 200, iron: 100 }, buildTime: 20, hp: 400 }],
};

// Weather (alchemist technologies). Size, cost, HP (A); time and builders: PB_WeatherTower1, PB_PowerPlant1.
BUILDINGS.weatherTower = {
  id: 'weatherTower', w: 2, h: 2, placement: 'free', requires: 'weatherForecast', builders: 4,
  levels: [{ name: 'Wetterturm', cost: { gold: 100, wood: 100, stone: 250 }, buildTime: 40, hp: 800 }],
};
BUILDINGS.weatherPlant = {
  id: 'weatherPlant', w: 4, h: 3, placement: 'free', requires: 'meteorology', builders: 4,
  levels: [{ name: 'Wetterkraftwerk', cost: { gold: 300, stone: 300, iron: 200 }, buildTime: 40, hp: 1200, workers: 3 }],
};

// Bandit camp (missions only): not buildable, placed by mission scripts (A).
BUILDINGS.banditCamp = {
  id: 'banditCamp', w: 3, h: 3, placement: 'free', buildable: false, armor: 3, builders: 4,
  levels: [{ name: 'Räuberlager', cost: {}, buildTime: 0, hp: 1200 }],
};

// ---------- Bridge and ornaments (model: Settlers 5 expansions; cost/values (A)) ----------
// Bridge: only at predefined bridge sites over rivers (placement 'bridge', position from the map generator).
// Width/depth follow from the site; walkable for everyone once built.
BUILDINGS.bridge = {
  id: 'bridge', w: 2, h: 2, placement: 'bridge', requires: 'mathematics', armor: 5, builders: 4,
  levels: [{ name: 'Brücke', cost: { wood: 300, stone: 250 }, buildTime: 80, hp: 900 }], // time: PB_Bridge1–4
};
// More ornamental buildings (raise the maximum and once the current motivation)
BUILDINGS.fountain = {
  id: 'fountain', w: 2, h: 2, placement: 'free', requires: 'construction', motivationEffect: 3, builders: 1,
  levels: [{ name: 'Brunnen', cost: { gold: 150, stone: 150 }, buildTime: 20, hp: 400 }],
};
BUILDINGS.statue = {
  id: 'statue', w: 2, h: 2, placement: 'free', requires: 'printing', motivationEffect: 6, builders: 1,
  levels: [{ name: 'Denkmal', cost: { gold: 400, stone: 300 }, buildTime: 30, hp: 600 }],
};

/** Technology that an upgrade to level i (1-based from level 2) requires. null = none. */
export const UPGRADE_REQUIRES = {
  headquarters: [null, null, 'printing'],          // citadel (A)
  villageCenter: [null, 'education', 'trade'],
  residence: [null, 'construction', 'architecture'],
  farm: [null, 'gears', 'architecture'],
  university: [null, 'university4'],                // 4 techs researched (special rule)
  clayMine: [null, 'gears', 'chemistry'],
  stoneMine: [null, 'gears', 'chemistry'],
  ironMine: [null, 'gears', 'chemistry'],
  sulfurMine: [null, 'gears', 'chemistry'],
  brickworks: [null, 'alloys'],
  sawmill: [null, 'pulley'],
  stonemason: [null, 'pulley'],
  smithy: [null, 'alloys'],
  alchemist: [null, 'metallurgy'],
  bank: [null, 'libraries'],
  chapel: [null, 'printing', 'libraries'],
  storehouse: [null, 'trade'],
  barracks: [null, 'pulley'],
  archery: [null, 'pulley'],
  stable: [null, 'horseBreeding'],
  foundry: [null, 'chemistry'],
  tower: [null, 'gears', 'metallurgy'],
};

/** Armor of a building (source: dedk.de, otherwise 3). */
export function buildingArmor(type, level) {
  if (type === 'headquarters') return 6 + level;
  return BUILDINGS[type].armor ?? 3;
}

/** Max serfs building or repairing a building of this type at the same time (original: BuilderSlots). */
export function buildersOf(type) {
  return BUILDINGS[type].builders;
}

/**
 * Is the building being upgraded? An upgrade runs on its own (original: building upgrade without serfs,
 * the upgrade site is only scaffolding); while it runs, `done` is false and `level` already the new level.
 * @param {{ kind?: string, done: boolean, level: number }} b
 */
export function isUpgrading(b) {
  return !b.done && b.level > 0;
}
