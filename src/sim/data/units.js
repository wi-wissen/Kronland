// Military units. Roles, tiers and squad strengths per the model (manual, dedk.de troop analysis);
// numbers own, tuned with scripts/troop-duels.js so that the balance of power stays similar (A).
// Attack/armour/HP apply to the squad leader; soldiers have their own HP.

/**
 * @typedef {Object} UnitDef
 * @property {string} id
 * @property {string} name
 * @property {string} line  sword | spear | bow | lightCav | heavyCav | cannon | rifle (Erweiterung)
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
  sword1: u({ id: 'sword1', name: 'Kurzschwert', line: 'sword', tier: 1, attack: 11, armor: 2, hp: 210, soldierHp: 140, soldiers: 4, attackType: 'slash', armorType: 'leather', range: melee, cooldown: 15, speed: 190, pop: 1, leaderCost: { gold: 90, iron: 45 }, soldierCost: { gold: 30, iron: 20 }, building: 'barracks' }),
  sword2: u({ id: 'sword2', name: 'Breitschwert', line: 'sword', tier: 2, attack: 13, armor: 3, hp: 215, soldierHp: 140, soldiers: 4, attackType: 'slash', armorType: 'leather', range: melee, cooldown: 15, speed: 190, pop: 1, leaderCost: { gold: 140, iron: 55 }, soldierCost: { gold: 40, iron: 25 }, building: 'barracks' }),
  sword3: u({ id: 'sword3', name: 'Langschwert', line: 'sword', tier: 3, attack: 15, armor: 4, hp: 220, soldierHp: 145, soldiers: 8, attackType: 'slash', armorType: 'leather', range: melee, cooldown: 15, speed: 190, pop: 1, leaderCost: { gold: 190, iron: 70 }, soldierCost: { gold: 50, iron: 35 }, building: 'barracks' }),
  sword4: u({ id: 'sword4', name: 'Bastardschwert', line: 'sword', tier: 4, attack: 17, armor: 5, hp: 225, soldierHp: 150, soldiers: 8, attackType: 'slash', armorType: 'leather', range: melee, cooldown: 15, speed: 190, pop: 1, leaderCost: { gold: 240, iron: 85 }, soldierCost: { gold: 60, iron: 45 }, building: 'barracks' }),
  spear1: u({ id: 'spear1', name: 'Langspeer', line: 'spear', tier: 1, attack: 11, armor: 1, hp: 200, soldierHp: 135, soldiers: 4, attackType: 'pierce', armorType: 'padded', range: 1500, cooldown: 16, speed: 190, pop: 1, leaderCost: { gold: 70, wood: 45 }, soldierCost: { gold: 25, wood: 20 }, building: 'barracks' }),
  spear2: u({ id: 'spear2', name: 'Lanze', line: 'spear', tier: 2, attack: 13, armor: 2, hp: 205, soldierHp: 135, soldiers: 4, attackType: 'pierce', armorType: 'padded', range: 1500, cooldown: 16, speed: 190, pop: 1, leaderCost: { gold: 110, wood: 55 }, soldierCost: { gold: 35, wood: 30 }, building: 'barracks' }),
  spear3: u({ id: 'spear3', name: 'Streitlanze', line: 'spear', tier: 3, attack: 15, armor: 3, hp: 210, soldierHp: 140, soldiers: 8, attackType: 'pierce', armorType: 'padded', range: 1500, cooldown: 16, speed: 190, pop: 1, leaderCost: { gold: 150, wood: 65 }, soldierCost: { gold: 45, wood: 40 }, building: 'barracks' }),
  spear4: u({ id: 'spear4', name: 'Hellebarde', line: 'spear', tier: 4, attack: 16, armor: 4, hp: 215, soldierHp: 145, soldiers: 8, attackType: 'pierce', armorType: 'padded', range: 1500, cooldown: 16, speed: 190, pop: 1, leaderCost: { gold: 190, wood: 75 }, soldierCost: { gold: 55, wood: 50 }, building: 'barracks' }),
  bow1: u({ id: 'bow1', name: 'Kurzbogen', line: 'bow', tier: 1, attack: 7, armor: 0, hp: 160, soldierHp: 90, soldiers: 4, attackType: 'pierce', armorType: 'padded', range: 6000, cooldown: 20, speed: 180, pop: 1, leaderCost: { gold: 130, wood: 50 }, soldierCost: { gold: 30, wood: 25 }, building: 'archery' }),
  bow2: u({ id: 'bow2', name: 'Langbogen', line: 'bow', tier: 2, attack: 9, armor: 1, hp: 160, soldierHp: 90, soldiers: 4, attackType: 'pierce', armorType: 'padded', range: 6500, cooldown: 20, speed: 180, pop: 1, leaderCost: { gold: 180, wood: 65 }, soldierCost: { gold: 40, wood: 35 }, building: 'archery' }),
  bow3: u({ id: 'bow3', name: 'Armbrust', line: 'bow', tier: 3, attack: 12, armor: 2, hp: 165, soldierHp: 95, soldiers: 8, attackType: 'pierce', armorType: 'padded', range: 6500, cooldown: 22, speed: 180, pop: 1, leaderCost: { gold: 230, iron: 60 }, soldierCost: { gold: 50, iron: 35 }, building: 'archery' }),
  bow4: u({ id: 'bow4', name: 'Arbalest', line: 'bow', tier: 4, attack: 14, armor: 2, hp: 170, soldierHp: 100, soldiers: 8, attackType: 'pierce', armorType: 'padded', range: 7000, cooldown: 22, speed: 180, pop: 1, leaderCost: { gold: 280, iron: 75 }, soldierCost: { gold: 60, iron: 45 }, building: 'archery' }),
  lightCav1: u({ id: 'lightCav1', name: 'Berittene Bogenschützen', line: 'lightCav', tier: 1, attack: 9, armor: 0, hp: 150, soldierHp: 130, soldiers: 3, attackType: 'pierce', armorType: 'none', range: 5500, cooldown: 18, speed: 300, pop: 2, leaderCost: { gold: 180, wood: 55 }, soldierCost: { gold: 70, iron: 25 }, building: 'stable' }),
  lightCav2: u({ id: 'lightCav2', name: 'Berittene Armbrustschützen', line: 'lightCav', tier: 2, attack: 12, armor: 1, hp: 170, soldierHp: 150, soldiers: 3, attackType: 'pierce', armorType: 'none', range: 6000, cooldown: 18, speed: 300, pop: 2, leaderCost: { gold: 230, wood: 65 }, soldierCost: { gold: 90, iron: 35 }, building: 'stable' }),
  heavyCav1: u({ id: 'heavyCav1', name: 'Ritter', line: 'heavyCav', tier: 1, attack: 25, armor: 4, hp: 300, soldierHp: 235, soldiers: 3, attackType: 'chaos', armorType: 'iron', range: melee, cooldown: 16, speed: 280, pop: 2, leaderCost: { gold: 240, iron: 70 }, soldierCost: { gold: 110, iron: 40 }, building: 'stable' }),
  heavyCav2: u({ id: 'heavyCav2', name: 'Streitaxtreiter', line: 'heavyCav', tier: 2, attack: 32, armor: 5, hp: 330, soldierHp: 250, soldiers: 3, attackType: 'chaos', armorType: 'iron', range: melee, cooldown: 16, speed: 280, pop: 2, leaderCost: { gold: 320, iron: 85 }, soldierCost: { gold: 140, iron: 50 }, building: 'stable' }),
  cannon1: u({ id: 'cannon1', name: 'Bombarde', line: 'cannon', tier: 1, attack: 32, armor: 2, hp: 180, soldierHp: 0, soldiers: 0, attackType: 'slash', armorType: 'none', range: 7000, cooldown: 50, speed: 120, pop: 5, leaderCost: { gold: 140, iron: 60, sulfur: 90 }, soldierCost: {}, building: 'foundry' }),
  cannon2: u({ id: 'cannon2', name: 'Bronzekanone', line: 'cannon', tier: 2, attack: 42, armor: 2, hp: 200, soldierHp: 0, soldiers: 0, attackType: 'slash', armorType: 'none', range: 7500, cooldown: 50, speed: 120, pop: 5, leaderCost: { gold: 190, iron: 60, sulfur: 110 }, soldierCost: {}, building: 'foundry' }),
  cannon3: u({ id: 'cannon3', name: 'Eisenkanone', line: 'cannon', tier: 3, attack: 60, armor: 2, hp: 240, soldierHp: 0, soldiers: 0, attackType: 'siege', armorType: 'none', range: 8000, cooldown: 60, speed: 110, pop: 5, leaderCost: { gold: 280, iron: 110, sulfur: 140 }, soldierCost: {}, building: 'foundry' }),
  // Add-on: riflemen (firearms, attack type 'shot'; values (A))
  rifle1: u({ id: 'rifle1', name: 'Hakenbüchse', line: 'rifle', tier: 1, attack: 18, armor: 1, hp: 160, soldierHp: 110, soldiers: 4, attackType: 'shot', armorType: 'leather', range: 7000, cooldown: 30, speed: 175, pop: 1, leaderCost: { gold: 200, sulfur: 80 }, soldierCost: { gold: 50, sulfur: 30 }, building: 'gunsmith', addon: true }),
  rifle2: u({ id: 'rifle2', name: 'Muskete', line: 'rifle', tier: 2, attack: 24, armor: 2, hp: 160, soldierHp: 110, soldiers: 6, attackType: 'shot', armorType: 'leather', range: 7500, cooldown: 30, speed: 175, pop: 1, leaderCost: { gold: 260, sulfur: 100 }, soldierCost: { gold: 60, sulfur: 40 }, building: 'gunsmith', addon: true }),
  cannon4: u({ id: 'cannon4', name: 'Belagerungskanone', line: 'cannon', tier: 4, attack: 80, armor: 2, hp: 260, soldierHp: 0, soldiers: 0, attackType: 'siege', armorType: 'none', range: 8500, cooldown: 60, speed: 100, pop: 5, leaderCost: { gold: 320, iron: 180, sulfur: 180 }, soldierCost: {}, building: 'foundry' }),
};

export const LINES = {
  sword: { name: 'Schwertkämpfer', building: 'barracks', refiner: 'smithy' },
  spear: { name: 'Speerträger', building: 'barracks', refiner: 'sawmill' },
  bow: { name: 'Bogenschützen', building: 'archery', refiner: 'sawmill' },
  lightCav: { name: 'Leichte Reiterei', building: 'stable', refiner: null },
  heavyCav: { name: 'Schwere Reiterei', building: 'stable', refiner: null },
  cannon: { name: 'Kanonen', building: 'foundry', refiner: null },
  rifle: { name: 'Büchsenschützen', building: 'gunsmith', refiner: null, addon: true },
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
export const MILITIA = { attack: 9, armor: 1, attackType: 'slash', armorType: 'none', range: 1300, cooldown: 15 };
export const SERF_COMBAT = { attack: 5, armor: 0, attackType: 'slash', armorType: 'none', range: 1300, cooldown: 15 };
export const WORKER_COMBAT = { hp: 150, armor: 0, armorType: 'none' }; // (A)

/** Towers per tier (watchtower → ballista tower → cannon tower). */
export const TOWER = [
  { attack: 0, range: 0, cooldown: 0, attackType: 'chaos' },
  { attack: 28, range: 7000, cooldown: 30, attackType: 'chaos' },
  { attack: 44, range: 8000, cooldown: 40, attackType: 'chaos' },
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
// Add-on: two more heroes (own figures, abilities modelled on the master marksman and
// the mist witch from "Nebelreich"; values (A)). Abilities see src/sim/systems/addon.js.
HEROES.falk = {
  name: 'Falk', title: 'Meisterschütze', attack: 20, armor: 3, hp: 550, range: 6500, cooldown: 18, speed: 230, addon: true, ranged: true,
  abilities: {
    aimedShot: { name: 'Gezielter Schuss', cooldown: 600, range: 9000, damage: 160 },
    eagleEye: { name: 'Adlerauge', cooldown: 1200, radius: 6000, duration: 600, rangeBonus: 1500, attackPercent: 125 },
  },
};
HEROES.morla = {
  name: 'Morla', title: 'Nebelhexe', attack: 14, armor: 3, hp: 600, range: 1300, cooldown: 14, speed: 220, addon: true,
  abilities: {
    poisonFog: { name: 'Giftnebel', cooldown: 1200, radius: 3500, duration: 120, interval: 10, damage: 14, slowPercent: 60 },
    mistVeil: { name: 'Nebelschleier', cooldown: 1800, radius: 6000, duration: 300 },
  },
};
export const HERO_COMMON = { attackType: 'hero', armorType: 'hero' };

/** Cost to raise a line from tier n to n+1 (tiering per the model, numbers own (A)). */
export const LINE_UPGRADE_COST = {
  sword1: { gold: 280, iron: 220 }, sword2: { gold: 450, iron: 450 }, sword3: { gold: 650, iron: 520 },
  spear1: { gold: 260, wood: 180 }, spear2: { gold: 420, wood: 280 }, spear3: { gold: 580, iron: 280 },
  bow1: { gold: 380, wood: 220 }, bow2: { gold: 560, iron: 380 }, bow3: { gold: 640, iron: 420 },
  lightCav1: { gold: 480, wood: 380 }, heavyCav1: { gold: 520, iron: 420 },
  cannon1: { gold: 320, iron: 180 }, cannon2: { gold: 420, iron: 280 }, cannon3: { gold: 520, iron: 380 },
  rifle1: { gold: 500, sulfur: 400 }, // (A)
};
