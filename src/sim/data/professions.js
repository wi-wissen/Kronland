// Worker professions. One work cycle lasts `cycle` ticks and costs 100 stamina. "(A)" = assumption.
// kind: 'none' (only pays taxes), 'mine' (raw goods), 'refine' (raw goods → refined),
//       'gold' (Taler), 'faith' (Glaube), 'research' (Forschungspunkte)

export const PROFESSIONS = {
  farmer:     { name: 'Bauer',          building: 'farm',       kind: 'none',     cycle: 60 },
  scholar:    { name: 'Gelehrter',      building: 'university', kind: 'research', cycle: 50 },
  miner:      { name: 'Bergmann',       building: null,         kind: 'mine',     cycle: 50, yield: 5 },        // 4x serf (source) (A)
  brickmaker: { name: 'Ziegelbrenner',  building: 'brickworks', kind: 'refine',   cycle: 40, res: 'clay', yield: 2 },
  sawyer:     { name: 'Sägewerker',     building: 'sawmill',    kind: 'refine',   cycle: 50, res: 'wood', yield: 2 },
  mason:      { name: 'Steinmetz',      building: 'stonemason', kind: 'refine',   cycle: 30, res: 'stone', yield: 2 },
  smith:      { name: 'Schmied',        building: 'smithy',     kind: 'refine',   cycle: 40, res: 'iron', yield: 2 },
  alchemist:  { name: 'Alchimist',      building: 'alchemist',  kind: 'refine',   cycle: 35, res: 'sulfur', yield: 2 },
  treasurer:  { name: 'Schatzmeister',  building: 'bank',       kind: 'gold',     cycle: 50, yield: 3 },
  priest:     { name: 'Priester',       building: 'chapel',     kind: 'faith',    cycle: 50, yield: 25 },
  trader:     { name: 'Händler',        building: 'storehouse', kind: 'none',     cycle: 60 },
};

/** Profession for a work building. */
export function professionFor(buildingType) {
  if (buildingType.endsWith('Mine')) return 'miner';
  for (const [id, p] of Object.entries(PROFESSIONS)) if (p.building === buildingType) return id;
  return null;
}

/** Blessings of the chapel: which professions benefit (source: dedk.de). */
export const BLESSINGS = {
  bell:        { name: 'Glocke läuten', professions: ['farmer', 'brickmaker', 'sawyer', 'mason', 'miner'] },
  indulgence:  { name: 'Ablassbriefe',  professions: ['scholar', 'priest'] },
  bibles:      { name: 'Bibeln',        professions: ['smith', 'alchemist'] },
  collection:  { name: 'Kollekte',      professions: ['treasurer', 'trader'] },
  canonize:    { name: 'Heiligsprechung', professions: null, minLevel: 2 }, // all, cathedral only
};

export const WORKER = {
  speed: 200,             // like serfs (A)
  maxStamina: 600,
  cycleCost: 100,
  eatGain: 200,           // stamina from farm × motivation effect (A, farm:house 1:4 of the original, softened)
  sleepGain: 400,         // Ausdauer durch Wohnhaus (A)
  campGain: 40,           // Lagerfeuer (A)
  eatTicks: 20,           // 2 s (original EatWait)
  sleepTicks: 30,         // 3 s (original RestWait)
  campTicks: 150,         // (A)
  fetchAmount: 5,         // raw goods per trip (original TransportAmount)
  maxDistance: 40,        // tiles workplace → house/farm (A)
  spawnTicks: 30,         // one new worker per village centre every 3 s (A)
  startMotivation: 100,
  baseMaxMotivation: 150, // (A)
  hardMaxMotivation: 300,
  leaveBelow: 25,
  noNewSettlersBelow: 30,
  overtimeSpeedPercent: 150, // (A)
  overtimeMotivation: -1,    // per work cycle (A)
  blessingFaith: 1000,       // (A)
  blessingMotivation: 25,    // (A)
};
