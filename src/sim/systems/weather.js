// Weather tower (forecast) and weather plant (weather energy, change weather).

import { WEATHER_CONTROL as WC, WEATHER_NAMES } from '../data/weather.js';
import { REASONS } from '../reasons.js';

/** Does the player have a finished weather tower or a weather plant? */
export function hasForecast(sim, owner) {
  for (const e of sim.entities.values()) {
    if (e.kind === 'building' && e.owner === owner && e.done && (e.type === 'weatherTower' || e.type === 'weatherPlant')) return true;
  }
  return false;
}

/**
 * The next weathers according to the cycle.
 * @returns {{state:string, name:string, inTicks:number, duration:number}[]}
 */
export function forecast(sim, count = WC.forecastCount) {
  const out = [];
  const cyc = sim.weatherCycle;
  let at = sim.weather.until, i = sim.weather.index;
  for (let k = 0; k < count; k++) {
    i = (i + 1) % cyc.length;
    const [state, dur] = cyc[i];
    out.push({ state, name: WEATHER_NAMES[state], inTicks: Math.max(0, at - sim.tick), duration: dur });
    at += dur;
  }
  return out;
}

/** Credit weather energy (workers in the weather plant). */
export function addWeatherEnergy(sim, owner, n) {
  const p = sim.players[owner];
  p.weatherEnergy = Math.min(WC.maxEnergy, (p.weatherEnergy ?? 0) + n);
}

/** Reason why the weather cannot be changed, or null. */
export function checkWeatherChange(sim, owner, b, state) {
  if (!b || b.kind !== 'building' || b.owner !== owner) return REASONS.notOwnBuilding;
  if (b.type !== 'weatherPlant') return REASONS.needWeatherBuilding;
  if (!b.done) return REASONS.notReady;
  const p = sim.players[owner];
  if (!p.techs.has('meteorology')) return REASONS.needMeteorology;
  if (typeof state !== 'string' || !Object.hasOwn(WEATHER_NAMES, state)) return REASONS.badWeather;
  if (sim.weather.state === state) return REASONS.sameWeather;
  if ((p.weatherReadyAt ?? 0) > sim.tick) return REASONS.weatherCooldown;
  if ((p.weatherEnergy ?? 0) < WC.changeCost) return REASONS.noEnergy;
  return null;
}

export function changeWeather(sim, owner, state) {
  const p = sim.players[owner];
  p.weatherEnergy -= WC.changeCost;
  p.weatherReadyAt = sim.tick + WC.cooldown;
  sim.setWeather(state, WC.duration);
  sim.events.push({ type: 'weatherChanged', player: owner, state });
}
