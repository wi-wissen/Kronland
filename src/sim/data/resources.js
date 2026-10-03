// Resources. Each has an account "raw" and "refined"; both can be built with.

/** @typedef {'gold'|'clay'|'wood'|'stone'|'iron'|'sulfur'} ResourceId */

/** @type {ResourceId[]} */
export const RESOURCES = ['gold', 'clay', 'wood', 'stone', 'iron', 'sulfur'];

export const RESOURCE_NAMES = {
  gold: 'Taler', clay: 'Lehm', wood: 'Holz', stone: 'Stein', iron: 'Eisen', sulfur: 'Schwefel',
};

/** Starting resources for difficulty "Normal" (source: EMS script, dedk.de). */
export const START_RESOURCES = {
  gold: 500, clay: 2400, wood: 1750, stone: 700, iron: 50, sulfur: 50,
};

/** @returns {Record<ResourceId, number>} */
export const emptyStock = () => ({ gold: 0, clay: 0, wood: 0, stone: 0, iron: 0, sulfur: 0 });
