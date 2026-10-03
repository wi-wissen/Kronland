// Military units. Values from dedk.de (troop analysis) and manual; "(A)" = assumption.
// Attack/armour/HP apply to the squad leader; soldiers have their own HP.

/**
 * @typedef {Object} UnitDef
 * @property {string} id
 * @property {string} name
 * @property {string} line  sword | spear | bow | lightCav | heavyCav | cannon
 * @property {number} tier 1…4
 * @property {number} attack @property {number} armor @property {number} hp @property {number} soldierHp
 * @property {number} soldiers maximum soldiers
 * @property {string} attackType @property {string} armorType
 * @property {number} range milli-tiles
 * @property {number} cooldown ticks between two attacks
 * @property {number} speed milli-tiles per tick
 * @property {number} pop population slots per man
 * @property {Record<string, number>} leaderCost
 * @property {Record<string, number>} soldierCost
 * @property {string} building
 */

const melee = 1300;
const u = (o) => o;

/** @type {Record<string, UnitDef>} */
export const UNITS = {
  sword1: u({ id: 'sword1', name: 'Kurzschwert', line: 'sword', tier: 1, attack: 12, armor: 2, hp: 200, soldierHp: 150, soldiers: 4, attackType: 'slash', armorType: 'leather', range: melee, cooldown: 15, speed: 190, pop: 1, leaderCost: { gold: 100, iron: 50 }, soldierCost: { gold: 30, iron: 20 }, building: 'barracks' }),
  sword2: u({ id: 'sword2', name: 'Breitschwert', line: 'sword', tier: 2, attack: 14, armor: 3, hp: 200, soldierHp: 150, soldiers: 4, attackType: 'slash', armorType: 'leather', range: melee, cooldown: 15, speed: 190, pop: 1, leaderCost: { gold: 150, iron: 60 }, soldierCost: { gold: 40, iron: 30 }, building: 'barracks' }),
  sword3: u({ id: 'sword3', name: 'Langschwert', line: 'sword', tier: 3, attack: 16, armor: 4, hp: 200, soldierHp: 150, soldiers: 8, attackType: 'slash', armorType: 'leather', range: melee, cooldown: 15, speed: 190, pop: 1, leaderCost: { gold: 200, iron: 70 }, soldierCost: { gold: 50, iron: 40 }, building: 'barracks' }),
  sword4: u({ id: 'sword4', name: 'Bastardschwert', line: 'sword', tier: 4, attack: 18, armor: 5, hp: 200, soldierHp: 150, soldiers: 8, attackType: 'slash', armorType: 'leather', range: melee, cooldown: 15, speed: 190, pop: 1, leaderCost: { gold: 250, iron: 80 }, soldierCost: { gold: 60, iron: 50 }, building: 'barracks' }),
  spear1: u({ id: 'spear1', name: 'Langspeer', line: 'spear', tier: 1, attack: 12, armor: 1, hp: 200, soldierHp: 150, soldiers: 4, attackType: 'pierce', armorType: 'padded', range: 1500, cooldown: 16, speed: 190, pop: 1, leaderCost: { gold: 80, wood: 50 }, soldierCost: { gold: 30, wood: 20 }, building: 'barracks' }),
  spear2: u({ id: 'spear2', name: 'Lanze', line: 'spear', tier: 2, attack: 14, armor: 2, hp: 200, soldierHp: 150, soldiers: 4, attackType: 'pierce', armorType: 'padded', range: 1500, cooldown: 16, speed: 190, pop: 1, leaderCost: { gold: 120, wood: 60 }, soldierCost: { gold: 40, wood: 30 }, building: 'barracks' }),
  spear3: u({ id: 'spear3', name: 'Streitlanze', line: 'spear', tier: 3, attack: 16, armor: 3, hp: 200, soldierHp: 150, soldiers: 8, attackType: 'pierce', armorType: 'padded', range: 1500, cooldown: 16, speed: 190, pop: 1, leaderCost: { gold: 160, wood: 70 }, soldierCost: { gold: 50, wood: 40 }, building: 'barracks' }),
  spear4: u({ id: 'spear4', name: 'Hellebarde', line: 'spear', tier: 4, attack: 18, armor: 4, hp: 200, soldierHp: 150, soldiers: 8, attackType: 'pierce', armorType: 'padded', range: 1500, cooldown: 16, speed: 190, pop: 1, leaderCost: { gold: 200, wood: 80 }, soldierCost: { gold: 60, wood: 50 }, building: 'barracks' }),
  bow1: u({ id: 'bow1', name: 'Kurzbogen', line: 'bow', tier: 1, attack: 8, armor: 0, hp: 150, soldierHp: 100, soldiers: 4, attackType: 'pierce', armorType: 'padded', range: 6000, cooldown: 20, speed: 180, pop: 1, leaderCost: { gold: 150, wood: 60 }, soldierCost: { gold: 30, wood: 30 }, building: 'archery' }),
  bow2: u({ id: 'bow2', name: 'Langbogen', line: 'bow', tier: 2, attack: 10, armor: 1, hp: 150, soldierHp: 100, soldiers: 4, attackType: 'pierce', armorType: 'padded', range: 6500, cooldown: 20, speed: 180, pop: 1, leaderCost: { gold: 200, wood: 70 }, soldierCost: { gold: 40, wood: 40 }, building: 'archery' }),
  bow3: u({ id: 'bow3', name: 'Armbrust', line: 'bow', tier: 3, attack: 12, armor: 2, hp: 150, soldierHp: 100, soldiers: 8, attackType: 'pierce', armorType: 'padded', range: 6500, cooldown: 22, speed: 180, pop: 1, leaderCost: { gold: 250, iron: 70 }, soldierCost: { gold: 50, iron: 40 }, building: 'archery' }),
  bow4: u({ id: 'bow4', name: 'Arbalest', line: 'bow', tier: 4, attack: 14, armor: 3, hp: 150, soldierHp: 100, soldiers: 8, attackType: 'pierce', armorType: 'padded', range: 7000, cooldown: 22, speed: 180, pop: 1, leaderCost: { gold: 300, iron: 80 }, soldierCost: { gold: 60, iron: 50 }, building: 'archery' }),
  lightCav1: u({ id: 'lightCav1', name: 'Berittene Bogenschützen', line: 'lightCav', tier: 1, attack: 8, armor: 0, hp: 150, soldierHp: 150, soldiers: 3, attackType: 'pierce', armorType: 'none', range: 5500, cooldown: 18, speed: 300, pop: 2, leaderCost: { gold: 200, wood: 60 }, soldierCost: { gold: 80, iron: 30 }, building: 'stable' }),
  lightCav2: u({ id: 'lightCav2', name: 'Berittene Armbrustschützen', line: 'lightCav', tier: 2, attack: 12, armor: 1, hp: 150, soldierHp: 150, soldiers: 3, attackType: 'pierce', armorType: 'none', range: 6000, cooldown: 18, speed: 300, pop: 2, leaderCost: { gold: 250, wood: 70 }, soldierCost: { gold: 100, iron: 40 }, building: 'stable' }),
  heavyCav1: u({ id: 'heavyCav1', name: 'Ritter', line: 'heavyCav', tier: 1, attack: 26, armor: 4, hp: 300, soldierHp: 250, soldiers: 3, attackType: 'chaos', armorType: 'iron', range: melee, cooldown: 16, speed: 280, pop: 2, leaderCost: { gold: 250, iron: 80 }, soldierCost: { gold: 120, iron: 40 }, building: 'stable' }),
  heavyCav2: u({ id: 'heavyCav2', name: 'Streitaxtreiter', line: 'heavyCav', tier: 2, attack: 32, armor: 6, hp: 300, soldierHp: 250, soldiers: 3, attackType: 'chaos', armorType: 'iron', range: melee, cooldown: 16, speed: 280, pop: 2, leaderCost: { gold: 350, iron: 90 }, soldierCost: { gold: 150, iron: 50 }, building: 'stable' }),
  cannon1: u({ id: 'cannon1', name: 'Bombarde', line: 'cannon', tier: 1, attack: 30, armor: 2, hp: 190, soldierHp: 0, soldiers: 0, attackType: 'slash', armorType: 'none', range: 7000, cooldown: 50, speed: 120, pop: 5, leaderCost: { gold: 150, iron: 50, sulfur: 100 }, soldierCost: {}, building: 'foundry' }),
  cannon2: u({ id: 'cannon2', name: 'Bronzekanone', line: 'cannon', tier: 2, attack: 40, armor: 2, hp: 190, soldierHp: 0, soldiers: 0, attackType: 'slash', armorType: 'none', range: 7500, cooldown: 50, speed: 120, pop: 5, leaderCost: { gold: 200, iron: 50, sulfur: 120 }, soldierCost: {}, building: 'foundry' }),
  cannon3: u({ id: 'cannon3', name: 'Eisenkanone', line: 'cannon', tier: 3, attack: 65, armor: 2, hp: 230, soldierHp: 0, soldiers: 0, attackType: 'siege', armorType: 'none', range: 8000, cooldown: 60, speed: 110, pop: 5, leaderCost: { gold: 300, iron: 100, sulfur: 150 }, soldierCost: {}, building: 'foundry' }),
  cannon4: u({ id: 'cannon4', name: 'Belagerungskanone', line: 'cannon', tier: 4, attack: 75, armor: 2, hp: 230, soldierHp: 0, soldiers: 0, attackType: 'siege', armorType: 'none', range: 8500, cooldown: 60, speed: 100, pop: 5, leaderCost: { gold: 300, iron: 200, sulfur: 200 }, soldierCost: {}, building: 'foundry' }),
};

export const LINES = {
  sword: { name: 'Schwertkämpfer', building: 'barracks', refiner: 'smithy' },
  spear: { name: 'Speerträger', building: 'barracks', refiner: 'sawmill' },
  bow: { name: 'Bogenschützen', building: 'archery', refiner: 'sawmill' },
  lightCav: { name: 'Leichte Reiterei', building: 'stable', refiner: null },
  heavyCav: { name: 'Schwere Reiterei', building: 'stable', refiner: null },
  cannon: { name: 'Kanonen', building: 'foundry', refiner: null },
};

/** Unit of a line at a tier. */
export const unitOf = (line, tier) => Object.values(UNITS).find((d) => d.line === line && d.tier === tier) ?? null;

/** Cost of a full unit. */
export function fullCost(def) {
  const c = { ...def.leaderCost };
  for (const [r, n] of Object.entries(def.soldierCost)) c[r] = (c[r] ?? 0) + n * def.soldiers;
  return c;
}

/** Further fighters. */
export const MILITIA = { attack: 10, armor: 1, attackType: 'slash', armorType: 'none', range: 1300, cooldown: 15 };
export const SERF_COMBAT = { attack: 5, armor: 0, attackType: 'slash', armorType: 'none', range: 1300, cooldown: 15 };
export const WORKER_COMBAT = { hp: 150, armor: 0, armorType: 'none' }; // (A)

/** Towers per tier (watchtower → ballista tower → cannon tower). */
export const TOWER = [
  { attack: 0, range: 0, cooldown: 0, attackType: 'chaos' },
  { attack: 30, range: 7000, cooldown: 30, attackType: 'chaos' },
  { attack: 40, range: 8000, cooldown: 40, attackType: 'chaos' },
];

/** Heroes: own figures modelled on the original (values taken from there). */
export const HEROES = {
  bertram: {
    name: 'Bertram', title: 'Ritter', attack: 16, armor: 4, hp: 600, range: 1300, cooldown: 14, speed: 220,
    abilities: {
      whirl: { name: 'Wirbelschlag', cooldown: 1200, radius: 3000, damage: 80 },
      might: { name: 'Aura der Stärke', cooldown: 1200, radius: 6000, duration: 600, attackPercent: 200 },
    },
  },
  hedda: {
    name: 'Hedda', title: 'Kräuterkundige', attack: 16, armor: 3, hp: 600, range: 1300, cooldown: 14, speed: 220,
    abilities: {
      heal: { name: 'Heilen', cooldown: 1200, radius: 6000, amount: 170 },
      trap: { name: 'Falle', cooldown: 1800, damage: 36, radius: 2500, hp: 500 },
    },
  },
  gerold: {
    name: 'Gerold', title: 'Sprengmeister', attack: 22, armor: 4, hp: 600, range: 1300, cooldown: 14, speed: 220,
    abilities: {
      bomb: { name: 'Bombe legen', cooldown: 600, damage: 50, radius: 3000, fuse: 20 },
      turret: { name: 'Selbstschuss-Kanone', cooldown: 1800, attack: 14, range: 6000, shots: 4 },
    },
  },
};
export const HERO_COMMON = { attackType: 'hero', armorType: 'hero' };

/** Cost to raise a line from tier n to n+1 (source: dedk.de). */
export const LINE_UPGRADE_COST = {
  sword1: { gold: 300, iron: 250 }, sword2: { gold: 500, iron: 500 }, sword3: { gold: 600, iron: 500 },
  spear1: { gold: 300, wood: 200 }, spear2: { gold: 400, wood: 300 }, spear3: { gold: 600, iron: 300 },
  bow1: { gold: 400, wood: 200 }, bow2: { gold: 600, iron: 400 }, bow3: { gold: 600, iron: 400 },
  lightCav1: { gold: 500, wood: 400 }, heavyCav1: { gold: 500, iron: 400 },
  cannon1: { gold: 300, iron: 200 }, cannon2: { gold: 400, iron: 300 }, cannon3: { gold: 500, iron: 400 },
};
