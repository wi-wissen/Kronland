// General balance values. "A" = own assumption, no source found.

export const BALANCE = {
  serf: {
    cost: { gold: 50 },
    hp: 200, attack: 5, armor: 0,
    speed: 200,              // milli-tiles per tick = 2 tiles/s (A)
    maxBuildersPerSite: 4,
    chopTicks: 40,           // one chop cycle of wood (A)
    chopYield: 2,            // wood per cycle; wood goes about twice as fast (A)
    mineTicks: 40,           // one mining cycle at piles (A)
    mineYield: 1,            // (A)
    searchRadius: 12,        // tiles: radius for follow-up work (A)
  },
  tree: { wood: 30 },        // wood per tree (A)
  pile: { amount: 400 },     // supply of a resource pile (A)
  paydayTicks: 1200,         // payday every 120 s
  tax: {
    perWorker: 5,            // taler per worker at "normal" (A)
    factorsPercent: [0, 50, 100, 150, 200], // none … very high; "very high" = 2x normal (source)
    motivation: [8, 4, 0, -6, -12], // percentage points per payday (A)
    defaultLevel: 2,
  },
  wagePerLeader: 10,         // pay per squad leader at payday (A)
  startSerfs: 4,             // (A)
  maxSlope: 300,             // max. height difference (cm) under a building (A)
};
