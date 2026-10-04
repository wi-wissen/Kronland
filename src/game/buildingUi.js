// UI data for building systems (building research, market, weather, repair).
// Contains only IDs, numbers and i18n codes ('err.*'); names and texts are made by the UI
// (src/ui/hud/systems/*, src/i18n).

import { techsOfBuilding, BUILDING_TECHS } from '../sim/data/buildingTechs.js';
import { buildingTechPoints, buildingMaxHp, researchRate } from '../sim/systems/techs.js';
import { MARKET } from '../sim/data/market.js';
import { RESOURCES } from '../sim/data/resources.js';
import { checkTrade, tradeCost, activeTraders, tradeProgressPercent } from '../sim/systems/market.js';
import { WEATHER_CONTROL, WEATHER_NAMES } from '../sim/data/weather.js';
import { BUILDINGS } from '../sim/data/buildings.js';
import { forecast, checkWeatherChange } from '../sim/systems/weather.js';
import { isDamaged, DAMAGE } from '../sim/systems/damage.js';
import { checkBuildingResearch } from '../sim/systems/techs.js';
import { BALANCE } from '../sim/data/balance.js';

/**
 * Additional fields for a selected building.
 * @param {import('../sim/sim.js').Sim} sim
 * @param {number} player
 * @param {any} b building
 */
export function buildingSystemsUi(sim, player, b) {
  const own = b.owner === player;
  const pl = sim.players[player];
  const out = { techs: null, market: null, weather: null, repair: null, burning: !!b.burning, maxHp: buildingMaxHp(sim, b) };
  if (!own) return out;

  const list = techsOfBuilding(b.type).filter((t) => !t.addon || sim.addon);
  if (list.length && b.done) {
    out.techs = list.map((t) => {
      const running = b.research?.tech === t.id;
      return {
        id: t.id, cost: Object.entries(t.cost), time: t.time, prev: t.prev, minLevel: t.minLevel,
        fortress: !!t.fortress, unlocks: t.unlocks ?? null, icon: techIcon(t),
        done: pl.techs.has(t.id),
        running: running ? Math.floor((b.research.progress / buildingTechPoints(t.id)) * 100) : null,
        reason: pl.techs.has(t.id) || running ? null : checkBuildingResearch(sim, player, b, t.id),
      };
    });
    const slots = BUILDINGS[b.type].levels[b.level].workers ?? 0;
    out.researchRate = b.research && BUILDING_TECHS[b.research.tech] ? researchRate(sim, b) : null;
    // Pace relative to fully staffed (1 = nominal time); buildings without workplaces research at a fixed 1
    out.researchSpeed = out.researchRate === null ? null : slots ? Math.round((out.researchRate / slots) * 10) / 10 : 1;
    out.techResearching = b.research && BUILDING_TECHS[b.research.tech]
      ? { tech: b.research.tech, progress: Math.floor((b.research.progress / buildingTechPoints(b.research.tech)) * 100) } : null;
  }

  if (b.type === 'storehouse' && b.level >= 1 && b.done) {
    const amount = MARKET.step;
    out.market = {
      step: MARKET.step, maxAmount: MARKET.maxAmount,
      // Price per unit in thalers (per mille → thalers with decimals)
      prices: RESOURCES.map((r) => ({ res: r, price: sim.market.prices[r] / 1000, base: MARKET.basePrice[r] / 1000 })),
      // Cost and reason for each combination give→take and each amount (preview in the trade dialogue)
      quotes: Object.fromEntries(RESOURCES.flatMap((give) => RESOURCES.filter((take) => take !== give).map((take) => [
        `${give}>${take}`,
        amounts(MARKET).map((n) => ({ amount: n, cost: tradeCost(sim, give, take, n), reason: checkTrade(sim, player, b, give, take, n) })),
      ]))),
      traders: activeTraders(sim, b),
      trade: b.trade ? { ...b.trade, percent: tradeProgressPercent(b) } : null,
      // Suggestions: buy against thalers and sell against thalers, each 50
      offers: RESOURCES.filter((r) => r !== 'gold').map((r) => ({
        res: r, amount,
        buy: { give: 'gold', take: r, cost: tradeCost(sim, 'gold', r, amount), reason: checkTrade(sim, player, b, 'gold', r, amount) },
        // Selling: so much of r that it brings in at least 50 thalers
        sell: { give: r, take: 'gold', cost: tradeCost(sim, r, 'gold', amount), reason: checkTrade(sim, player, b, r, 'gold', amount) },
      })),
    };
  }

  if ((b.type === 'weatherTower' || b.type === 'weatherPlant') && b.done) {
    out.weather = {
      current: sim.weather.state, type: b.type,
      endsIn: Math.ceil((sim.weather.until - sim.tick) / 10),
      forecast: forecast(sim).map((f) => ({ state: f.state, in: Math.ceil(f.inTicks / 10), duration: Math.ceil(f.duration / 10) })),
      durationChange: Math.ceil(WEATHER_CONTROL.duration / 10), cooldownTotal: Math.ceil(WEATHER_CONTROL.cooldown / 10),
      energy: b.type === 'weatherPlant' ? pl.weatherEnergy ?? 0 : null,
      maxEnergy: WEATHER_CONTROL.maxEnergy, cost: WEATHER_CONTROL.changeCost,
      cooldown: Math.max(0, Math.ceil(((pl.weatherReadyAt ?? 0) - sim.tick) / 10)),
      options: b.type === 'weatherPlant' ? Object.keys(WEATHER_NAMES).map((s) => ({ state: s, reason: checkWeatherChange(sim, player, b, s) })) : null,
    };
  }

  if (b.done) {
    const damaged = isDamaged(sim, b);
    out.repair = {
      damaged, burning: !!b.burning, repairers: damaged ? b.builders.length : 0,
      max: BALANCE.serf.maxBuildersPerSite, hpPerSecond: b.builders.length * DAMAGE.repairHpPerTick * 10,
    };
  }
  return out;
}

/** Possible trade amounts (multiples of step up to maxAmount). */
function amounts(M) {
  const out = [];
  for (let n = M.step; n <= M.maxAmount; n += M.step) out.push(n);
  return out;
}

/** Icon name for a building technology by its main effect. */
function techIcon(t) {
  if (t.unlocks) return `b-${t.unlocks}`;
  const fx = t.effects[0] ?? {};
  if (fx.target === 'buildings') return 'b-stonemason';
  if (fx.target === 'militia') return 'militia';
  if (fx.target === 'serfs' || fx.target === 'workers') return fx.speed ? 'speed' : 'serf';
  if (fx.sight) return 'target';
  if (fx.speed) return 'speed';
  if (fx.attack) return 'attack';
  if (fx.armor) return 'hold';
  return 'research';
}
