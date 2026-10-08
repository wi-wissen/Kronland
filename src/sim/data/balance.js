// General balance values. "A" = own assumption, no source found.

export const BALANCE = {
  serf: {
    cost: { gold: 50 },
    hp: 200, attack: 5, armor: 0,
    fleeTicks: 60,           // attacked: flee this long, then return to work (A; model: serfs flee)
    fleeTiles: 8,            // escape distance away from the attacker if the castle is no refuge (A)
    speed: 200,              // milli-tiles per tick = 2 tiles/s (A)
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
  // Computer opponent: extra thalers every aiBonusTicks per difficulty (the original's "refresh" for hard; A)
  aiBonusGold: { easy: 0, normal: 0, hard: 250 },
  aiBonusTicks: 1200,
  startSerfs: 4,             // (A)
  // Building on slopes (docs/SPIELREGELN.md §6a): largest height difference (cm) within the footprint.
  // The area is levelled to the mean when building. 400 cm ≈ 1.1 tile widths (A, justified in §6a).
  maxSlope: 400,
  // Ground (docs/SPIELREGELN.md, Spuren und Gegenstände): items on tiles and tracks. Only looks and sensors,
  // no effect on speed or pathfinding.
  ground: {
    coinValue: 1,            // thalers per coin picked up / put down (A)
    itemTicks: 5,            // take()/put() take 0.5 s (A)
    tracks: {
      max: 48,               // strongest track (bytes per tile, A)
      fadeSeconds: 30,       // each tile loses one level in this time (A)
      threshold: { summer: 8, rain: 8, winter: 1 }, // strength from which a tile counts as "track": in snow every step (A)
    },
  },
};
