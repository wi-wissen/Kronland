// Technologies researched in individual buildings (smithy, sawmill, alchemist,
// stonemason, castle, village centre, military buildings). University technologies: technologies.js.
//
// Sources: manual (which technology in which building), siedlercommunity.de (armour/attack
// +2 per tier, cost of the military building techs 200/200). "(A)" = own assumption.
//
// Fields:
//   building  building in which it is researched
//   minLevel  required upgrade level of the building (0-based). Refiners only have 2 levels here;
//             the original's third armour tier (fine smithy) therefore sits on level 2 (index 1) behind
//             its predecessor and additionally needs the fortress (fortress: true) (A)
//   prev      predecessor (must be researched)
//   time      seconds with the building fully staffed (2 workers; without workers: 1 s = 1 s)
//   effects   list of { target, lines?, attack?, armor?, range?, speed?, sight?, hpPercent? }
//             target: 'units' (troop lines in `lines`), 'serfs', 'workers', 'militia',
//                     'buildings', 'leaders' (all squad leaders, e.g. vision range)
//             speed/hpPercent in percent, range in milli-tiles, sight in tiles
//   unlocks   building that the technology unlocks

/**
 * @typedef {Object} TechEffect
 * @property {'units'|'serfs'|'workers'|'militia'|'buildings'|'leaders'} target
 * @property {string[]} [lines]
 * @property {number} [attack] @property {number} [armor] @property {number} [range]
 * @property {number} [speed] @property {number} [sight] @property {number} [hpPercent]
 */

/**
 * @typedef {Object} BuildingTechDef
 * @property {string} id
 * @property {string} name
 * @property {string} building
 * @property {number} minLevel
 * @property {string|null} prev
 * @property {Partial<Record<import('./resources.js').ResourceId, number>>} cost
 * @property {number} time
 * @property {TechEffect[]} effects
 * @property {string} [unlocks]
 * @property {string} desc short effect (German) for the UI
 */

const MELEE_HEAVY = ['sword', 'heavyCav'];
const LIGHT = ['spear', 'bow', 'lightCav'];
const SHOOTERS = ['bow', 'lightCav'];

/** @type {BuildingTechDef[]} */
const list = [
  // ---------- Smithy: armour and blades ----------
  { id: 'leatherMail', name: 'Kettenlederrüstung', building: 'smithy', minLevel: 0, prev: null,
    cost: { gold: 150, iron: 150 }, time: 30, // cost/time (A)
    effects: [{ target: 'units', lines: MELEE_HEAVY, armor: 2 }], desc: 'Schwertkämpfer, schwere Reiter: Rüstung +2' },
  { id: 'softLeather', name: 'Weiches Leder', building: 'smithy', minLevel: 0, prev: null,
    cost: { gold: 150, iron: 150 }, time: 30, // (A)
    effects: [{ target: 'units', lines: LIGHT, armor: 2 }], desc: 'Speerträger, Bogenschützen, leichte Reiter: Rüstung +2' },
  { id: 'chainMail', name: 'Kettenhemd', building: 'smithy', minLevel: 1, prev: 'leatherMail',
    cost: { gold: 250, iron: 250 }, time: 45, // (A)
    effects: [{ target: 'units', lines: MELEE_HEAVY, armor: 2 }], desc: 'Schwertkämpfer, schwere Reiter: Rüstung +2' },
  { id: 'paddedLeather', name: 'Wattiertes Leder', building: 'smithy', minLevel: 1, prev: 'softLeather',
    cost: { gold: 250, iron: 250 }, time: 45, // (A)
    effects: [{ target: 'units', lines: LIGHT, armor: 2 }], desc: 'Speerträger, Bogenschützen, leichte Reiter: Rüstung +2' },
  { id: 'masterSmith', name: 'Meisterschmied', building: 'smithy', minLevel: 1, prev: null,
    cost: { gold: 300, iron: 300 }, time: 45, // effect and cost (A)
    effects: [{ target: 'units', lines: MELEE_HEAVY, attack: 2 }], desc: 'Schwertkämpfer, schwere Reiter: Angriff +2' },
  { id: 'plateArmor', name: 'Plattenharnisch', building: 'smithy', minLevel: 1, fortress: true, prev: 'chainMail',
    cost: { gold: 400, iron: 400 }, time: 60, // (A)
    effects: [{ target: 'units', lines: MELEE_HEAVY, armor: 2 }], desc: 'Schwertkämpfer, schwere Reiter: Rüstung +2' },
  { id: 'reinforcedLeather', name: 'Verstärktes Leder', building: 'smithy', minLevel: 1, fortress: true, prev: 'paddedLeather',
    cost: { gold: 400, iron: 400 }, time: 60, // (A)
    effects: [{ target: 'units', lines: LIGHT, armor: 2 }], desc: 'Speerträger, Bogenschützen, leichte Reiter: Rüstung +2' },
  { id: 'ironCasting', name: 'Eisengießen', building: 'smithy', minLevel: 1, fortress: true, prev: 'masterSmith',
    cost: { gold: 400, iron: 400 }, time: 60, // effect and cost (A)
    effects: [{ target: 'units', lines: MELEE_HEAVY, attack: 2 }], desc: 'Schwertkämpfer, schwere Reiter: Angriff +2' },

  // ---------- Sawmill: spears and arrows ----------
  { id: 'woodHardening', name: 'Holz härten', building: 'sawmill', minLevel: 0, prev: null,
    cost: { gold: 150, wood: 250 }, time: 30, // (A)
    effects: [{ target: 'units', lines: ['spear'], attack: 2 }], desc: 'Speerträger: Angriff +2' },
  { id: 'turnery', name: 'Drechseln', building: 'sawmill', minLevel: 0, prev: 'woodHardening',
    cost: { gold: 250, wood: 350 }, time: 45, // (A); range +300 instead of +1 tile so that spears stay melee
    effects: [{ target: 'units', lines: ['spear'], attack: 2, range: 300 }], desc: 'Speerträger: Angriff +2, etwas mehr Reichweite' },
  { id: 'fletching', name: 'Befiederung', building: 'sawmill', minLevel: 1, prev: null,
    cost: { gold: 200, wood: 300 }, time: 45, // (A)
    effects: [{ target: 'units', lines: SHOOTERS, attack: 2 }], desc: 'Bogenschützen, berittene Schützen: Angriff +2' },
  { id: 'bodkin', name: 'Bodkinpfeile', building: 'sawmill', minLevel: 1, prev: 'fletching',
    cost: { gold: 300, iron: 300 }, time: 60, // (A)
    effects: [{ target: 'units', lines: SHOOTERS, attack: 2 }], desc: 'Bogenschützen, berittene Schützen: Angriff +2' },

  // ---------- Alchemist's hut: cannons and weather ----------
  { id: 'gunpowder', name: 'Schießpulver', building: 'alchemist', minLevel: 0, prev: null,
    cost: { gold: 200, sulfur: 300 }, time: 40, // (A); range +1 tile (A)
    effects: [{ target: 'units', lines: ['cannon'], attack: 2, range: 1000 }], desc: 'Kanonen: Angriff +2, Reichweite +1' },
  { id: 'heatedShots', name: 'Glühende Geschosse', building: 'alchemist', minLevel: 1, prev: 'gunpowder',
    cost: { gold: 300, sulfur: 400 }, time: 60, // (A)
    effects: [{ target: 'units', lines: ['cannon'], attack: 4 }], desc: 'Kanonen: Angriff +4' },
  { id: 'weatherForecast', name: 'Wettervorhersage', building: 'alchemist', minLevel: 0, prev: null,
    cost: { gold: 150, sulfur: 150 }, time: 30, unlocks: 'weatherTower', // (A)
    effects: [], desc: 'Schaltet den Wetterturm frei' },
  { id: 'meteorology', name: 'Meteorologie', building: 'alchemist', minLevel: 1, prev: 'weatherForecast',
    cost: { gold: 300, sulfur: 300, iron: 200 }, time: 60, unlocks: 'weatherPlant', // (A)
    effects: [], desc: 'Schaltet das Wetterkraftwerk frei' },

  // ---------- Stonemason's hut ----------
  { id: 'masonry', name: 'Maurerhandwerk', building: 'stonemason', minLevel: 0, prev: null,
    cost: { gold: 200, stone: 300 }, time: 40, // effect and cost (A)
    effects: [{ target: 'buildings', armor: 2, hpPercent: 20 }], desc: 'Gebäude: Rüstung +2, Lebenspunkte +20 %' },

  // Add-on: bridge building (in the original mathematics/architect's office; here in the stonemason's hut (A))
  { id: 'mathematics', name: 'Mathematik', building: 'stonemason', minLevel: 0, prev: null, addon: true,
    cost: { gold: 200, stone: 250 }, time: 40, unlocks: 'bridge', // (A)
    effects: [], desc: 'Schaltet den Brückenbau an Brückenstellen frei' },

  // ---------- Castle ----------
  { id: 'tracking', name: 'Fährtenlesen', building: 'headquarters', minLevel: 0, prev: null,
    cost: { gold: 200, wood: 200 }, time: 30, // (A)
    effects: [{ target: 'leaders', sight: 2 }], desc: 'Truppen erkennen Feinde 2 Kacheln früher' },
  { id: 'cityGuard', name: 'Stadtwache', building: 'headquarters', minLevel: 1, prev: null,
    cost: { gold: 300, iron: 200 }, time: 40, // (A)
    effects: [{ target: 'militia', attack: 4, armor: 2 }], desc: 'Miliz: Angriff +4, Rüstung +2' },

  // ---------- Village centre ----------
  { id: 'loom', name: 'Webrahmen', building: 'villageCenter', minLevel: 0, prev: null,
    cost: { gold: 150, wood: 150 }, time: 30, // (A)
    effects: [{ target: 'serfs', armor: 2 }, { target: 'workers', armor: 2 }], desc: 'Leibeigene und Arbeiter: Rüstung +2' },
  { id: 'shoes', name: 'Hochwertige Schuhe', building: 'villageCenter', minLevel: 1, prev: null,
    cost: { gold: 200, clay: 200 }, time: 40, // (A)
    effects: [{ target: 'serfs', speed: 20 }, { target: 'workers', speed: 20 }], desc: 'Leibeigene und Arbeiter: Tempo +20 %' },

  // ---------- Military buildings (cost: siedlercommunity.de, effect (A)) ----------
  { id: 'marching', name: 'Marschieren', building: 'barracks', minLevel: 0, prev: null,
    cost: { gold: 200, iron: 200 }, time: 30,
    effects: [{ target: 'units', lines: ['sword', 'spear'], speed: 20 }], desc: 'Schwertkämpfer, Speerträger: Tempo +20 %' },
  { id: 'masterShooter', name: 'Meisterschütze', building: 'archery', minLevel: 0, prev: null,
    cost: { gold: 200, wood: 200 }, time: 30,
    effects: [{ target: 'units', lines: ['bow'], range: 1000, attack: 1 }], desc: 'Bogenschützen: Reichweite +1, Angriff +1' },
  { id: 'horseshoe', name: 'Hufbeschlag', building: 'stable', minLevel: 0, prev: null,
    cost: { gold: 200, iron: 200 }, time: 30,
    effects: [{ target: 'units', lines: ['lightCav', 'heavyCav'], speed: 20 }], desc: 'Reiterei: Tempo +20 %' },
  { id: 'rifling', name: 'Gezogene Läufe', building: 'gunsmith', minLevel: 0, prev: null, addon: true,
    cost: { gold: 250, sulfur: 250 }, time: 40, // (A)
    effects: [{ target: 'units', lines: ['rifle'], attack: 2, range: 500 }], desc: 'Büchsenschützen: Angriff +2, etwas mehr Reichweite' },
  { id: 'undercarriage', name: 'Verbessertes Fahrgestell', building: 'foundry', minLevel: 0, prev: null,
    cost: { wood: 200, iron: 200 }, time: 30,
    effects: [{ target: 'units', lines: ['cannon'], speed: 25 }], desc: 'Kanonen: Tempo +25 %' },
];

/** @type {Record<string, BuildingTechDef>} */
export const BUILDING_TECHS = Object.fromEntries(list.map((t) => [t.id, t]));

/** Technologies of a building type in display order. */
export const techsOfBuilding = (type) => list.filter((t) => t.building === type);

/** Building types in which something can be researched. */
export const RESEARCH_BUILDINGS = [...new Set(list.map((t) => t.building))];
