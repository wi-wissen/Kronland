// Marketplace: trade resources in steps of 50. Prices are the same for all players and
// change after every completed trade; over time they return to the base value.
// A trade takes time, depending on the number of working traders.

import { MARKET } from '../data/market.js';
import { RESOURCES } from '../data/resources.js';
import { REASONS } from '../reasons.js';

/** Initial state of the market. */
export function createMarket() {
  return { prices: { ...MARKET.basePrice } };
}

/** Price after `steps` steps of 50 of demand (+) or supply (−), within the limits. Taler stays fixed. */
function priceAfter(prices, res, steps) {
  if (res === 'gold') return prices.gold;
  const base = MARKET.basePrice[res];
  const lo = Math.trunc((base * MARKET.minPercent) / 100), hi = Math.trunc((base * MARKET.maxPercent) / 100);
  return Math.max(lo, Math.min(hi, prices[res] + Math.trunc((base * MARKET.changePercent * steps) / 100)));
}

/**
 * Cost in `give` to get `amount` units of `take` (rounded up).
 * Each step of 50 is charged at the price that it causes itself (bought goods more
 * expensive, paid goods cheaper). This way trading back and forth never pays off.
 * @param {any} sim
 */
export function tradeCost(sim, give, take, amount) {
  const p = sim.market.prices;
  const steps = Math.max(1, Math.trunc(amount / MARKET.step));
  const per = Math.trunc(amount / steps);
  // Compute in integer thousandths (determinism), round up at the end
  let milli = 0;
  for (let i = 1; i <= steps; i++) milli += Math.ceil((per * priceAfter(p, take, i) * 1000) / priceAfter(p, give, -i));
  return Math.ceil(milli / 1000);
}

/**
 * Trade output per tick: number of traders at the marketplace (overtime ×2). Traders count
 * as long as they are assigned to the marketplace – also while they eat or sleep (A).
 */
export function activeTraders(sim, b) {
  const n = b.workers.length;
  return b.overtime ? n * 2 : n;
}

/** Reason why a trade is not possible, or null. */
export function checkTrade(sim, owner, b, give, take, amount) {
  if (!b || b.kind !== 'building' || b.owner !== owner) return REASONS.notOwnBuilding;
  if (b.type !== 'storehouse' || b.level < 1) return REASONS.needMarket;
  if (!b.done) return REASONS.notReady;
  if (b.trade) return REASONS.tradeRunning;
  if (!RESOURCES.includes(give) || !RESOURCES.includes(take) || give === take) return REASONS.badTrade;
  if (!Number.isInteger(amount) || amount <= 0 || amount % MARKET.step !== 0 || amount > MARKET.maxAmount) return { code: REASONS.badAmount, params: { step: MARKET.step, max: MARKET.maxAmount } };
  if (!b.workers.length) return REASONS.noTraders;
  if (sim.available(owner, give) < tradeCost(sim, give, take, amount)) return REASONS.noResources;
  return null;
}

/** Start a trade: the payment goods are debited immediately, the goods arrive after the trade time. */
export function startTrade(sim, owner, b, give, take, amount) {
  const cost = tradeCost(sim, give, take, amount);
  sim.pay(owner, { [give]: cost });
  b.trade = { give, take, amount, cost, progress: 0, need: (amount / MARKET.step) * MARKET.pointsPer50 };
  sim.events.push({ type: 'tradeStarted', player: owner, building: b.id, give, take, amount, cost });
}


function finishTrade(sim, b) {
  const t = b.trade;
  b.trade = null;
  sim.players[b.owner].stock[t.take] += t.amount;
  // Demand: bought goods get more expensive, paid goods cheaper
  const steps = t.amount / MARKET.step;
  const prices = sim.market.prices;
  const take = priceAfter(prices, t.take, steps), give = priceAfter(prices, t.give, -steps);
  prices[t.take] = take; prices[t.give] = give;
  sim.events.push({ type: 'tradeDone', player: b.owner, building: b.id, give: t.give, take: t.take, amount: t.amount, cost: t.cost });
}

/** Tick: continue running trades, slowly return prices to the base value. */
export function updateMarket(sim) {
  for (const b of sim.entities.values()) {
    if (b.kind !== 'building' || !b.trade) continue;
    if (!b.done) continue;
    b.trade.progress += activeTraders(sim, b);
    if (b.trade.progress >= b.trade.need) finishTrade(sim, b);
  }
  if ((sim.tick + 1) % MARKET.recoverTicks === 0) {
    const prices = sim.market.prices;
    for (const r of RESOURCES) {
      const base = MARKET.basePrice[r];
      const step = Math.max(1, Math.trunc((base * MARKET.recoverPercent) / 100));
      if (prices[r] > base) prices[r] = Math.max(base, prices[r] - step);
      else if (prices[r] < base) prices[r] = Math.min(base, prices[r] + step);
    }
  }
}

/** Progress of a running trade in percent, or null. */
export function tradeProgressPercent(b) {
  return b.trade ? Math.min(100, Math.floor((b.trade.progress * 100) / b.trade.need)) : null;
}
