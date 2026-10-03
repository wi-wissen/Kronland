// Payday every 120 s: workers' taxes, squad leaders' pay.

import { BALANCE } from '../data/balance.js';
import { paydayMotivation } from './workers.js';

export function countWorkers(sim, owner) {
  let n = 0;
  for (const e of sim.entities.values()) if (e.kind === 'worker' && e.owner === owner) n++;
  return n;
}

export function countLeaders(sim, owner) {
  let n = 0;
  for (const e of sim.entities.values()) if (e.kind === 'leader' && e.owner === owner) n++;
  return n;
}

/** Tax income of a player for one payday. */
export function taxIncome(workers, taxLevel) {
  return Math.trunc((workers * BALANCE.tax.perWorker * BALANCE.tax.factorsPercent[taxLevel]) / 100);
}

export function updatePayday(sim) {
  // At the end of every 120 s period (tick 1199, 2399, …)
  if ((sim.tick + 1) % BALANCE.paydayTicks !== 0) return;
  for (const p of sim.players) {
    if (p.defeated) continue;
    const income = taxIncome(countWorkers(sim, p.id), p.taxLevel);
    const wages = countLeaders(sim, p.id) * BALANCE.wagePerLeader;
    p.stock.gold = Math.max(0, p.stock.gold + income - wages);
    sim.events.push({ type: 'payday', player: p.id, income, wages });
    const delta = BALANCE.tax.motivation[p.taxLevel];
    if (delta) paydayMotivation(sim, p.id, delta);
  }
}
