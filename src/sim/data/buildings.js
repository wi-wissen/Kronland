// Buildings. Cost per level; levels[0] = new build, levels[1] = upgrade to level 2 etc.
// Sources: original XMLs/dedk.de/Fandom. "(A)" = own assumption.
// placement: 'free' (build anywhere), 'settlement' (settlement spot only), 'shaft' (shaft only)

/**
 * @typedef {Object} BuildingLevel
 * @property {string} name
 * @property {Partial<Record<import('./resources.js').ResourceId, number>>} cost
 * @property {number} buildTime seconds with 4 serfs
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
 * @property {BuildingLevel[]} levels
 * @property {boolean} [addon] only with expansion content
 */

/** @type {Record<string, BuildingDef>} */
export const BUILDINGS = {
  headquarters: {
    id: 'headquarters', w: 5, h: 5, placement: 'free', buildable: false,
    levels: [
      { name: 'Burg', cost: {}, buildTime: 0, hp: 2500 },
      { name: 'Festung', cost: { gold: 450, clay: 250, stone: 300 }, buildTime: 120, hp: 3200 },
      { name: 'Zitadelle', cost: { gold: 600, clay: 400, stone: 500 }, buildTime: 150, hp: 4100 }, // (A)
    ],
  },
  villageCenter: {
    id: 'villageCenter', w: 4, h: 4, placement: 'settlement',
    levels: [
      { name: 'Dorfzentrum', cost: { wood: 300, clay: 300 }, buildTime: 90, hp: 1500, population: 75 }, // cost (A)
      { name: 'Gemeindezentrum', cost: { gold: 150, stone: 300, clay: 200 }, buildTime: 60, hp: 2000, population: 100 },
      { name: 'Stadtzentrum', cost: { gold: 200, stone: 400, clay: 300 }, buildTime: 70, hp: 2500, population: 125 },
    ],
  },
  residence: {
    id: 'residence', w: 3, h: 3, placement: 'free',
    levels: [
      { name: 'Wohnhaus', cost: { wood: 150, clay: 100 }, buildTime: 80, hp: 600, beds: 6 },
      { name: 'Mittleres Wohnhaus', cost: { wood: 50, stone: 150 }, buildTime: 40, hp: 800, beds: 9 },
      { name: 'Großes Wohnhaus', cost: { wood: 150, stone: 200 }, buildTime: 50, hp: 1000, beds: 12 },
    ],
  },
  farm: {
    id: 'farm', w: 4, h: 3, placement: 'free',
    levels: [
      { name: 'Bauernhof', cost: { wood: 200, clay: 150 }, buildTime: 80, hp: 600, seats: 8, workers: 1 },
      { name: 'Mühle', cost: { wood: 50, stone: 100 }, buildTime: 40, hp: 800, seats: 10, workers: 2 },
      { name: 'Gut', cost: { wood: 150, stone: 300 }, buildTime: 50, hp: 1000, seats: 12, workers: 3 },
    ],
  },
  university: {
    id: 'university', w: 4, h: 4, placement: 'free',
    levels: [
      { name: 'Hochschule', cost: { wood: 200, clay: 300 }, buildTime: 90, hp: 1000, workers: 2 },
      { name: 'Universität', cost: { gold: 300, stone: 400, wood: 200 }, buildTime: 80, hp: 1500, workers: 4 }, // (A)
    ],
  },
  clayMine: shaftMine('clayMine', 'clay', 'Lehmgrube', 'Lehmstollen', 'Lehmbergwerk'),
  stoneMine: shaftMine('stoneMine', 'stone', 'Steingrube', 'Steinstollen', 'Steinbergwerk'),
  ironMine: shaftMine('ironMine', 'iron', 'Eisengrube', 'Eisenstollen', 'Eisenbergwerk'),
  sulfurMine: shaftMine('sulfurMine', 'sulfur', 'Schwefelgrube', 'Schwefelstollen', 'Schwefelbergwerk'),
  brickworks: refiner('brickworks', 'Ziegelhütte', 'Ziegelei', { wood: 200, stone: 150 }, 'construction', 4),
  sawmill: refiner('sawmill', 'Sägemühle', 'Sägewerk', { wood: 150, stone: 150 }, 'construction', 3), // cost (A)
  stonemason: refiner('stonemason', 'Steinmetzhütte', 'Steinmetze', { wood: 150, clay: 150 }, 'gears', 3), // cost (A)
  smithy: refiner('smithy', 'Schmiede', 'Grobschmiede', { wood: 200, stone: 200 }, 'alchemy', 3), // cost (A)
  alchemist: refiner('alchemist', 'Alchimistenhütte', 'Laboratorium', { wood: 200, clay: 200 }, 'alchemy', 3), // cost (A)
  bank: refiner('bank', 'Bank', 'Schatzkammer', { stone: 300, clay: 200 }, 'printing', 3), // cost (A)
  chapel: {
    id: 'chapel', w: 3, h: 4, placement: 'free', requires: 'education',
    levels: [
      { name: 'Kapelle', cost: { wood: 200, stone: 200 }, buildTime: 80, hp: 1000, workers: 2 }, // (A)
      { name: 'Kirche', cost: { gold: 200, stone: 300 }, buildTime: 60, hp: 1500, workers: 4 }, // (A)
      { name: 'Kathedrale', cost: { gold: 400, stone: 500 }, buildTime: 80, hp: 2000, workers: 6 }, // (A)
    ],
  },
  storehouse: {
    id: 'storehouse', w: 3, h: 3, placement: 'free', requires: 'education',
    levels: [
      { name: 'Lager', cost: { wood: 200, clay: 100 }, buildTime: 60, hp: 800 }, // (A)
      { name: 'Marktplatz', cost: { gold: 200, stone: 200 }, buildTime: 60, hp: 1000, workers: 2 }, // (A)
    ],
  },
};

function shaftMine(id, res, n1, n2, n3) {
  return {
    id, w: 3, h: 3, placement: 'shaft', shaftResource: res,
    levels: [
      { name: n1, cost: { wood: 250, clay: 150 }, buildTime: 70, hp: 800, workers: 5 },    // cost (A)
      { name: n2, cost: { wood: 200, stone: 250 }, buildTime: 50, hp: 1000, workers: 6 },  // (A)
      { name: n3, cost: { wood: 250, stone: 400 }, buildTime: 60, hp: 1200, workers: 7 },  // (A)
    ],
  };
}

function refiner(id, n1, n2, cost, requires, workers) {
  return {
    id, w: 3, h: 3, placement: 'free', requires,
    levels: [
      { name: n1, cost, buildTime: 70, hp: 800, workers },                                  // build time (A)
      { name: n2, cost: { gold: 200, stone: 300 }, buildTime: 50, hp: 1000, workers: workers + 2 }, // (A)
    ],
  };
}

// Military (cost (A), HP/armor from dedk.de)
BUILDINGS.barracks = {
  id: 'barracks', w: 4, h: 4, placement: 'free', requires: 'conscription', armor: 4,
  levels: [
    { name: 'Kaserne', cost: { wood: 300, stone: 250 }, buildTime: 90, hp: 1500 },
    { name: 'Garnison', cost: { gold: 200, stone: 400 }, buildTime: 70, hp: 2000 },
  ],
};
BUILDINGS.archery = {
  id: 'archery', w: 4, h: 3, placement: 'free', requires: 'standingArmy', armor: 4,
  levels: [
    { name: 'Schießplatz', cost: { wood: 300, stone: 200 }, buildTime: 80, hp: 1500 },
    { name: 'Schießanlage', cost: { gold: 200, stone: 400 }, buildTime: 70, hp: 2000 },
  ],
};
BUILDINGS.stable = {
  id: 'stable', w: 4, h: 4, placement: 'free', requires: 'tactics', armor: 4,
  levels: [
    { name: 'Reiterei', cost: { wood: 400, stone: 300 }, buildTime: 90, hp: 1500 },
    { name: 'Stall', cost: { gold: 300, stone: 400 }, buildTime: 80, hp: 2000 },
  ],
};
BUILDINGS.foundry = {
  id: 'foundry', w: 4, h: 3, placement: 'free', requires: 'metallurgy', armor: 3,
  levels: [
    { name: 'Kanonengießerei', cost: { stone: 400, iron: 300 }, buildTime: 90, hp: 1200 },
    { name: 'Kanonenmanufaktur', cost: { gold: 300, stone: 400, iron: 300 }, buildTime: 80, hp: 2000 },
  ],
};
BUILDINGS.tower = {
  id: 'tower', w: 2, h: 2, placement: 'free', requires: 'construction', armor: 6,
  levels: [
    { name: 'Wachturm', cost: { wood: 200, stone: 300 }, buildTime: 60, hp: 1000 },
    { name: 'Ballistaturm', cost: { stone: 300, iron: 100 }, buildTime: 50, hp: 1200 },
    { name: 'Kanonenturm', cost: { stone: 400, iron: 200, sulfur: 100 }, buildTime: 60, hp: 1400 },
  ],
};

// Ornamental buildings: raise the maximum motivation permanently and the current one once (source: dedk.de).
BUILDINGS.clock = {
  id: 'clock', w: 2, h: 2, placement: 'free', requires: 'construction', motivationEffect: 4,
  levels: [{ name: 'Uhr', cost: { gold: 300, wood: 100 }, buildTime: 20, hp: 400 }],
};
BUILDINGS.windwheel = {
  id: 'windwheel', w: 2, h: 2, placement: 'free', requires: 'alchemy', motivationEffect: 4,
  levels: [{ name: 'Windrad', cost: { gold: 200, iron: 100 }, buildTime: 20, hp: 400 }],
};

// Weather (alchemist technologies). Size, cost, HP (A).
BUILDINGS.weatherTower = {
  id: 'weatherTower', w: 2, h: 2, placement: 'free', requires: 'weatherForecast',
  levels: [{ name: 'Wetterturm', cost: { gold: 100, wood: 100, stone: 250 }, buildTime: 50, hp: 800 }],
};
BUILDINGS.weatherPlant = {
  id: 'weatherPlant', w: 4, h: 3, placement: 'free', requires: 'meteorology',
  levels: [{ name: 'Wetterkraftwerk', cost: { gold: 300, stone: 300, iron: 200 }, buildTime: 80, hp: 1200, workers: 3 }],
};

// Bandit camp (missions only): not buildable, placed by mission scripts (A).
BUILDINGS.banditCamp = {
  id: 'banditCamp', w: 3, h: 3, placement: 'free', buildable: false, armor: 3,
  levels: [{ name: 'Räuberlager', cost: {}, buildTime: 0, hp: 1200 }],
};

// ---------- Expansion (only with expansion content, `addon: true`; cost/values (A)) ----------
// Inn: recruits thief and scout (src/sim/data/addon.js)
BUILDINGS.tavern = {
  id: 'tavern', w: 3, h: 3, placement: 'free', requires: 'education', addon: true,
  levels: [
    { name: 'Wirtshaus', cost: { wood: 150, clay: 250 }, buildTime: 60, hp: 900 },
    { name: 'Gasthof', cost: { gold: 200, stone: 250 }, buildTime: 50, hp: 1200 },
  ],
};
// Gunsmith: trains riflemen (line 'rifle')
BUILDINGS.gunsmith = {
  id: 'gunsmith', w: 4, h: 3, placement: 'free', requires: 'alloys', armor: 4, addon: true,
  levels: [
    { name: 'Büchsenmacherei', cost: { wood: 250, stone: 300, sulfur: 100 }, buildTime: 80, hp: 1400 },
    { name: 'Büchsenmanufaktur', cost: { gold: 300, stone: 400, iron: 150 }, buildTime: 70, hp: 2000 },
  ],
};
// Bridge: only at predefined bridge sites over rivers (placement 'bridge', position from the map generator).
// Width/depth follow from the site; walkable for everyone once built.
BUILDINGS.bridge = {
  id: 'bridge', w: 2, h: 2, placement: 'bridge', requires: 'mathematics', armor: 5, addon: true,
  levels: [{ name: 'Brücke', cost: { wood: 300, stone: 250 }, buildTime: 70, hp: 900 }],
};
// Ornamental buildings of the expansion (raise the maximum and, once, the current motivation)
BUILDINGS.fountain = {
  id: 'fountain', w: 2, h: 2, placement: 'free', requires: 'construction', motivationEffect: 3, addon: true,
  levels: [{ name: 'Brunnen', cost: { gold: 150, stone: 150 }, buildTime: 20, hp: 400 }],
};
BUILDINGS.statue = {
  id: 'statue', w: 2, h: 2, placement: 'free', requires: 'printing', motivationEffect: 6, addon: true,
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
  tavern: [null, 'trade'],
  gunsmith: [null, 'chemistry'],
};

/** Armor of a building (source: dedk.de, otherwise 3). */
export function buildingArmor(type, level) {
  if (type === 'headquarters') return 6 + level;
  return BUILDINGS[type].armor ?? 3;
}
