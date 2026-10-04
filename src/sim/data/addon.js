// Add-on content modelled on the Settlers 5 expansions (Nebelreich 2005, Legenden 2006):
// Tavern with thief and scout, hidden deposits, bridge building, musketeers,
// two further heroes, two ornamental buildings. Names and values are original; "(A)" = assumption.
// Research and rationale: docs/ADDON.md.
//
// All values are integers: distances in milli-tiles (1000 = 1 tile), times in ticks (10 = 1 s).
// New buildings, troops, heroes and technologies are in the usual tables
// (buildings.js, units.js, buildingTechs.js) with `addon: true`; here only the specialists and rules.

/**
 * @typedef {Object} SpecialistDef
 * @property {string} id
 * @property {string} name
 * @property {string} building building in which it is recruited
 * @property {Record<string, number>} cost
 * @property {number} hp
 * @property {number} armor
 * @property {number} speed milli-tiles per tick
 * @property {number} pop population slots
 * @property {number} sight Sichtweite in Kacheln
 * @property {number} max maximum per player
 * @property {Record<string, any>} abilities abilities (cooldown in ticks)
 * @property {string} desc short description (German, for the compendium/UI)
 */

/** @type {Record<string, SpecialistDef>} */
export const SPECIALISTS = {
  thief: {
    id: 'thief', name: 'Dieb', building: 'tavern', cost: { gold: 300, iron: 50 }, hp: 160, armor: 1, speed: 230, pop: 1, sight: 8, max: 3,
    abilities: {
      // steal resources from an opponent's castle or storehouse and bring them to one's own castle
      steal: { cooldown: 900, ticks: 40, goldPercent: 15, goldMax: 250, goods: 120 },
      // plant an explosive charge on an enemy building (also bridges)
      sabotage: { cooldown: 1200, fuse: 100, damage: 500, bridgePercent: 300, radius: 1500, unitDamage: 40 },
    },
    desc: 'Für Gegner unsichtbar (außer nahe Türmen und Kundschaftern); stiehlt Rohstoffe, legt Sprengladungen.',
  },
  scout: {
    id: 'scout', name: 'Kundschafter', building: 'tavern', cost: { gold: 200, wood: 50 }, hp: 220, armor: 2, speed: 260, pop: 1, sight: 18, max: 3,
    abilities: {
      // torch: lights up a region in the fog for a while
      torch: { cooldown: 600, range: 8000, radius: 11, duration: 600 },
      // search for resources: uncover hidden deposits in the surroundings
      findResources: { cooldown: 900, radius: 26 },
    },
    desc: 'Sieht sehr weit, entdeckt Diebe in der Nähe, wirft Fackeln in den Nebel und findet verborgene Lagerstätten.',
  },
};

/** Further rules of the add-on. */
export const ADDON = {
  /** Thieves are invisible to opponents, except within these distances (tiles) of towers (from the building edge) or scouts (A) */
  detect: { buildings: { tower: 9 }, scout: 6 },
  /** Hidden deposits (add-on only): per player, in the middle, distance to the castle in tiles (A) */
  deposits: { perPlayer: 3, center: 2, minDist: 18, maxDist: 42, amount: 700, res: ['iron', 'sulfur', 'stone', 'clay'] },
  /** Bridge sites (map generator): length over water in tiles (width always 2), minimum distance between two sites */
  bridge: { minLen: 2, maxLen: 9, spacing: 12 },
};

/** Result codes of the specialist and bridge commands (texts in src/i18n, keys 'err.*'). */
export const ADDON_REASONS = {
  addonOff: 'err.addonOff',
  notOwnSpecialist: 'err.notOwnSpecialist',
  tavernNeeded: 'err.tavernNeeded',
  specialistMax: 'err.specialistMax',
  badTarget: 'err.badTarget',
  noTarget: 'err.noTarget',
  notReady: 'err.notReady',
  outOfRange: 'err.outOfRange',
  carrying: 'err.carrying',
  unknownAction: 'err.unknownAction',
};

/** Buildings a thief can steal from. */
export const STEAL_FROM = ['headquarters', 'storehouse', 'villageCenter'];
