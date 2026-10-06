// Spots of resting figures in a circle around their target (A): resters at the campfire, waiters in front of a building,
// serfs at a tree and resource pile. Values in milli-tiles (1000 = one tile). The number of spots
// per ring must divide 72 (directions in a 5° grid, src/sim/dirs.js).
export const SPOTS = {
  // Smallest distance between two resting figures (also to builders and to spots of other targets)
  minGap: 600,
  // Campfire: a circle of 8 seats, all in the 8 neighbouring tiles of the fire
  camp: { rings: [{ radius: 1100, slots: 8 }] },
  // Tree: close to the trunk (axe reach), 8 spots
  tree: { rings: [{ radius: 900, slots: 8 }] },
  // Resource pile: somewhat further out (the pile is wider than a trunk)
  pile: { rings: [{ radius: 950, slots: 8 }] },
  // Building (waiting outside): circle around the centre, radius = half the footprint diagonal + margin,
  // second ring `gap` further out and offset by half a spot. Spots per ring: as many as fit so that
  // neighbours stand at least `spacing` apart.
  building: { margin: 400, gap: 900, rings: 2, spacing: 1000 },
};
