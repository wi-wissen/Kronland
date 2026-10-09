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
    // Tracks (docs/SPIELREGELN.md §14, all A): one byte strength per tile (0…max). A figure leaving a tile adds
    // gain·(max − s)/max there (rounded up, at least 1): quick at first, then less and less – only frequent traffic
    // reaches a path. A broom visits every tile once per sweepSeconds and takes `decay` away (`pathDecay` from the
    // path threshold on: bare earth needs longer to grow over than flattened grass). Steady state for a tile passed
    // every I seconds: s ≈ max·(1 − decay·I / (gain·p/100·sweepSeconds)). With 20 walkers (p = 100 %) in summer: path
    // for I ≲ 27 s, trodden up to I ≈ 43 s; 5 walkers: path up to 53 s; 150 walkers: path only for I ≲ 10 s
    // (table in docs/SPIELREGELN.md §14).
    tracks: {
      max: 255,              // strongest track (one byte per tile)
      sweepSeconds: 10,      // the broom visits every tile once in this time (cost per tick: tiles / 100)
      // Trampling relative to the walkers of the player (figures outside: serfs, workers, soldiers, heroes): the gain
      // is scaled by √(refWalkers / walkers) in percent, clamped to minPercent…maxPercent. A village of 5–10 serfs
      // makes paths after a few passes, a town of 150 only on its main routes.
      walkers: { ref: 20, minPercent: 35, maxPercent: 200 },
      // Ground under the feet: gain = first pass; faint = barely visible; trodden = counts as "track" (sensor,
      // clearly visible); path = bare earth path (summer) or trodden lane (snow); full = finished in the picture
      grass: { gain: 16, faint: 8, trodden: 48, path: 128, full: 208 },
      snow: { gain: 48, faint: 16, trodden: 16, path: 144, full: 224 },
      // Per weather: ground and decay per broom visit (below / from the path threshold on). Rain like summer:
      // grass does not grow back faster, wet paths stay paths. Snowfall covers tracks faster than grass recovers.
      weather: {
        summer: { ground: 'grass', decay: 3, pathDecay: 2 },
        rain: { ground: 'grass', decay: 3, pathDecay: 2 },
        winter: { ground: 'snow', decay: 5, pathDecay: 5 },
      },
      // Game option "tracks" (settings, command setTracks, a level may fix it): off = no tracks from figures,
      // fading = the model above, permanent = no fading at all (also no covering by snow or thaw)
      modes: ['off', 'fading', 'permanent'],
      defaultMode: 'fading',
    },
  },
};
