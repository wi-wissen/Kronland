// General balance values. "A" = own assumption, no source found.

export const BALANCE = {
  serf: {
    cost: { gold: 50 },
    hp: 200, attack: 5, armor: 0,
    fleeTicks: 60,           // attacked: flee this long, then return to work (A; model: serfs flee)
    fleeTiles: 8,            // escape distance away from the attacker if the castle is no refuge (A)
    speed: 200,              // milli-tiles per tick = 2 tiles/s (A)
    maxBuildersPerSite: 4,
    chopTicks: 40,           // one chop cycle of wood (A)
    chopYield: 2,            // wood per cycle; wood goes about twice as fast (A)
    mineTicks: 40,           // one mining cycle at piles (A)
    mineYield: 1,            // (A)
    searchRadius: 12,        // tiles: radius for follow-up work (A)
    gatherersPerTree: 1,     // serfs per tree; others look for the nearest free tree
    gatherersPerPile: 4,     // serfs per resource pile
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
  // Building on slopes (docs/SPIELREGELN.md §6a): largest height difference (cm) within the footprint.
  // The area is levelled to the mean when building. 400 cm ≈ 1.1 tile widths (A, justified in §6a).
  maxSlope: 400,
};
