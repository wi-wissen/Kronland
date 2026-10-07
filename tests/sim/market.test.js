import { describe, it, expect } from 'vitest';
import { newSim, quickBuild } from './helpers.js';
import { MARKET } from '../../src/sim/data/market.js';
import { tradeCost } from '../../src/sim/systems/market.js';
import { REASONS } from '../../src/sim/reasons.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';

const rejectOf = (ev) => ev.find((e) => e.type === 'rejected')?.reason;

/** Set up a marketplace with traders. */
function setup(seed = 42) {
  const sim = newSim(seed);
  const m = quickBuild(sim, 'storehouse');
  m.level = 1;
  sim.players[0].stock.gold = 5000;
  sim.players[0].stock.iron = 5000;
  let t = 0;
  while (m.workers.length < 2 && t < 2000) { sim.step(); t++; }
  return { sim, m };
}

const trade = (sim, m, give, take, amount, player = 0) => sim.step([{ type: 'trade', player, building: m.id, give, take, amount }]);

describe('Marketplace', () => {
  it('buys 100 wood for thalers; goods arrive after the trade time, prices change afterwards', () => {
    const { sim, m } = setup();
    const p = sim.players[0];
    const gold = p.stock.gold, wood = p.stock.wood;
    const cost = tradeCost(sim, 'gold', 'wood', 100);
    expect(cost).toBeGreaterThan(80); // base price 0.8, rises within the trade
    const ev = trade(sim, m, 'gold', 'wood', 100);
    expect(ev.find((e) => e.type === 'tradeStarted')).toMatchObject({ cost, amount: 100 });
    expect(p.stock.gold).toBe(gold - cost);
    expect(p.stock.wood).toBe(wood);
    expect(sim.market.prices.wood).toBe(MARKET.basePrice.wood); // only after completion
    let t = 0;
    while (m.trade && t < 2000) { sim.step(); t++; }
    expect(p.stock.wood).toBe(wood + 100);
    // 2 traders, 2 × 50 steps at 200 points → 200 ticks (+ rounding)
    expect(t).toBeGreaterThanOrEqual(190);
    expect(t).toBeLessThanOrEqual(210);
    expect(sim.market.prices.wood).toBe(MARKET.basePrice.wood * (100 + 2 * MARKET.changePercent) / 100);
    // thalers are the fixed currency
    expect(sim.market.prices.gold).toBe(MARKET.basePrice.gold);
  });

  it('more traders trade faster, overtime doubles', () => {
    const { sim, m } = setup();
    const run = () => { trade(sim, m, 'gold', 'clay', 50); let t = 0; while (m.trade) { sim.step(); t++; } return t; };
    const t2 = run();
    m.overtime = true;
    const t4 = run();
    expect(t4).toBeLessThan(t2);
    expect(Math.abs(t2 - 2 * t4)).toBeLessThanOrEqual(2);
  });

  it('selling lowers the price, also for other players; round-trip trading does not pay off', () => {
    const { sim, m } = setup();
    const p = sim.players[0];
    const iron0 = p.stock.iron, gold0 = p.stock.gold;
    trade(sim, m, 'iron', 'gold', 200);
    while (m.trade) sim.step();
    expect(sim.market.prices.iron).toBeLessThan(MARKET.basePrice.iron);
    const ironFor100 = tradeCost(sim, 'gold', 'iron', 100);
    // player 1 sees the same (reduced) price
    expect(tradeCost(sim, 'gold', 'iron', 50)).toBeLessThan(Math.ceil(50 * 1.2));
    // buying back: less iron than before
    const gotGold = p.stock.gold - gold0;
    const back = Math.floor(gotGold / ironFor100) * 100;
    expect(back).toBeLessThan(iron0 - p.stock.iron + 1);
  });

  it('prices recover over time towards the base value', () => {
    const { sim, m } = setup();
    trade(sim, m, 'iron', 'gold', 500);
    while (m.trade) sim.step();
    const low = sim.market.prices.iron;
    sim.run(MARKET.recoverTicks * 3);
    expect(sim.market.prices.iron).toBeGreaterThan(low);
    sim.run(MARKET.recoverTicks * 200);
    expect(sim.market.prices.iron).toBe(MARKET.basePrice.iron);
  }, 180_000); // long run, slow on loaded machines

  it('prices stay within their limits', () => {
    const { sim, m } = setup();
    sim.players[0].stock.iron = 1e6;
    for (let i = 0; i < 30; i++) { trade(sim, m, 'iron', 'gold', 500); while (m.trade) sim.step(); }
    expect(sim.market.prices.iron).toBe(Math.trunc(MARKET.basePrice.iron * MARKET.minPercent / 100));
  });

  it('rejects invalid trades', () => {
    const { sim, m } = setup();
    expect(rejectOf(trade(sim, m, 'gold', 'wood', 30))).toBe(REASONS.badAmount);
    expect(rejectOf(trade(sim, m, 'gold', 'wood', 1000))).toBe(REASONS.badAmount);
    expect(rejectOf(trade(sim, m, 'gold', 'gold', 50))).toBe(REASONS.badTrade);
    expect(rejectOf(trade(sim, m, 'gold', 'diamonds', 50))).toBe(REASONS.badTrade);
    sim.players[0].stock.sulfur = 0; sim.players[0].raw.sulfur = 0;
    expect(rejectOf(trade(sim, m, 'sulfur', 'wood', 50))).toBe(REASONS.noResources);
    expect(rejectOf(trade(sim, m, 'gold', 'wood', 50, 1))).toBe(REASONS.notOwnBuilding);
    trade(sim, m, 'gold', 'wood', 50);
    expect(rejectOf(trade(sim, m, 'gold', 'stone', 50))).toBe(REASONS.tradeRunning);
    // storehouse level 1 does not trade
    const store = quickBuild(sim, 'storehouse');
    expect(rejectOf(trade(sim, store, 'gold', 'wood', 50))).toBe(REASONS.needMarket);
  });

  it('without traders no trade', () => {
    const sim = newSim();
    sim.removeEntity(sim.findBuilding(0, 'villageCenter'));
    const m = quickBuild(sim, 'storehouse');
    m.level = 1;
    expect(rejectOf(trade(sim, m, 'gold', 'wood', 50))).toBe(REASONS.noTraders);
  });

  it('running trade and prices survive saving and loading exactly', () => {
    const { sim, m } = setup();
    trade(sim, m, 'iron', 'wood', 200);
    sim.run(50);
    const sim2 = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    expect(sim2.hash()).toBe(sim.hash());
    sim.run(400); sim2.run(400);
    expect(sim2.hash()).toBe(sim.hash());
    expect(sim2.market.prices).toEqual(sim.market.prices);
    expect(sim2.market.prices.wood).toBeGreaterThan(MARKET.basePrice.wood);
  });
});
