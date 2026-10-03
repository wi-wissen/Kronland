// University technologies: 4 lines × 4 tiers (source: dedk.de).
// Tier 2 needs the fortress (castle level 2), tier 3–4 the university (college level 2).

/**
 * @typedef {Object} TechDef
 * @property {string} id
 * @property {string} name
 * @property {number} line 0–3
 * @property {number} tier 1–4
 * @property {Partial<Record<import('./resources.js').ResourceId, number>>} cost
 * @property {number} time seconds with a fully staffed college
 * @property {string|null} prev predecessor in the line
 */

const raw = [
  // Line 0: administration
  ['education', 'Bildung', 0, 1, { gold: 50, wood: 150 }, 20],
  ['trade', 'Handelswesen', 0, 2, { gold: 300 }, 40],
  ['printing', 'Buchdruck', 0, 3, { gold: 200, iron: 200 }, 40],
  ['libraries', 'Büchereien', 0, 4, { gold: 500, wood: 300 }, 80],
  // Line 1: construction
  ['construction', 'Konstruktion', 1, 1, { wood: 200, clay: 150 }, 20],
  ['gears', 'Zahnräder', 1, 2, { stone: 400, iron: 200 }, 40],
  ['pulley', 'Flaschenzug', 1, 3, { wood: 200, stone: 300 }, 40],
  ['architecture', 'Architektur', 1, 4, { stone: 600, iron: 500 }, 80],
  // Line 2: alchemy
  ['alchemy', 'Alchimie', 2, 1, { wood: 50, sulfur: 150 }, 20],
  ['alloys', 'Legierungen', 2, 2, { iron: 200, sulfur: 300 }, 40],
  ['metallurgy', 'Metallurgie', 2, 3, { iron: 400, sulfur: 400 }, 60],
  ['chemistry', 'Chemie', 2, 4, { iron: 500, sulfur: 600 }, 80],
  // Line 3: military
  ['conscription', 'Wehrpflicht', 3, 1, { gold: 50, wood: 150 }, 20],
  ['standingArmy', 'Stehendes Heer', 3, 2, { gold: 100, iron: 200 }, 40],
  ['tactics', 'Taktiken', 3, 3, { gold: 400, iron: 400 }, 60],
  ['horseBreeding', 'Pferdezucht', 3, 4, { gold: 600, iron: 600 }, 80],
];

/** @type {Record<string, TechDef>} */
export const TECHS = {};
const lastInLine = {};
for (const [id, name, line, tier, cost, time] of raw) {
  TECHS[id] = { id, name, line, tier, cost, time, prev: lastInLine[line] ?? null };
  lastInLine[line] = id;
}

export const TECH_LINES = ['Verwaltung', 'Bauwesen', 'Alchimie', 'Militär'];

/** Research points per tick and working scholar; requirement = time × 10 × 2 scholars. */
export const researchPoints = (tech) => TECHS[tech].time * 10 * 2;
