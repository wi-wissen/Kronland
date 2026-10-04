// Vision and fog of war. Vision ranges in tiles (radius around the figure's tile or the centre
// of the building; for buildings half the edge length is added). Values modelled on Settlers 5
// (towers and castle see far, workers barely beyond their farm); numbers are assumptions (A).
//
// Fighters always see at least as far as they attack enemies themselves (COMBAT.sight + technologies
// + experience), plus FIGHTER_EXTRA. The extra is ≥ the largest weather penalty, so that no squad ever
// attacks a target in the fog.

export const VISION = {
  /** Vision is recomputed every n ticks (0.5 s) */
  updateTicks: 5,
  /** Tiles around each castle that are explored at game start (A) */
  startReveal: 20,
  /** Lower bound after weather penalty */
  minRadius: 3,
  /** Weather: penalty in tiles (A). Rain: less vision, winter: snowfall */
  weather: { summer: 0, rain: 2, winter: 1 },
  /** Figures without combat vision */
  units: { serf: 7, worker: 5, militia: 11, hero: 13, turret: 9, trap: 2, bomb: 2, charge: 2, cloud: 3 },
  /** Bonus on combat vision (COMBAT.sight = 9, tracking +2, Feldwebel +2) per troop line */
  fighterExtra: { sword: 2, spear: 2, bow: 3, lightCav: 4, heavyCav: 3, cannon: 2, rifle: 3 },
  /** Buildings: number or list per upgrade level; if a type is missing, `building` applies */
  building: 6,
  /** Construction sites see little */
  site: 4,
  buildings: {
    headquarters: [16, 18, 20],
    villageCenter: [10, 11, 12],
    tower: [14, 16, 18],
    weatherTower: 22,
    barracks: 8, archery: 8, stable: 8, foundry: 8,
    banditCamp: 9,
    tavern: 8, gunsmith: 8, bridge: 3,
  },
};

/** Vision range of a building (without weather). */
export function buildingSight(type, level, done) {
  if (!done) return VISION.site;
  const v = VISION.buildings[type] ?? VISION.building;
  return Array.isArray(v) ? v[Math.min(level, v.length - 1)] : v;
}
