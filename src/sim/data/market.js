// Marketplace (storehouse level 2): trade resources in steps of 50.
// Source (manual): prices rise and fall with supply and demand; whoever sells a lot
// pushes the price down for the other players too. Concrete numbers are assumptions (A).

export const MARKET = {
  step: 50,                 // trade amount is a multiple of this
  maxAmount: 500,           // at most this much per trade (A)
  /** Base value per unit in per-mille taler (A). Taler is the fixed currency (price does not change). */
  basePrice: { gold: 1000, clay: 800, wood: 800, stone: 900, iron: 1200, sulfur: 1200 },
  changePercent: 4,         // per 50 traded units (in % of base value): bought goods get more expensive, paid ones cheaper (A)
  minPercent: 25,           // price limits relative to the base value (A)
  maxPercent: 400,
  recoverTicks: 300,        // every 30 s every price moves … (A)
  recoverPercent: 1,        // … 1 % of the base value back towards the base value (A)
  pointsPer50: 200,         // work per 50 units; each tick every trader counts 1 → 2 traders: 10 s per 50 (A)
};
