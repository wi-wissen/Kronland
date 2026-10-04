import { describe, it, expect } from 'vitest';
import { newSim, quickBuild } from './helpers.js';
import { WEATHER_CONTROL as WC, WEATHER_CYCLE } from '../../src/sim/data/weather.js';
import { forecast, hasForecast } from '../../src/sim/systems/weather.js';
import { REASONS } from '../../src/sim/reasons.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';

const rejectOf = (ev) => ev.find((e) => e.type === 'rejected')?.reason;

describe('Weather tower and weather power plant', () => {
  it('weather tower needs "weather forecast", power plant "meteorology"', () => {
    const sim = newSim();
    const p = sim.players[0];
    for (const r of Object.keys(p.stock)) p.stock[r] = 5000;
    expect(sim.checkPlacement(0, 'weatherTower', 0, 0)).toEqual({ code: 'err.techMissing', params: { tech: 'weatherForecast' } });
    p.techs.add('weatherForecast');
    const hq = sim.findBuilding(0, 'headquarters');
    expect(sim.findPlacement(0, 'weatherTower', hq.x, hq.y)).not.toBe(null);
    expect(sim.findPlacement(0, 'weatherPlant', hq.x, hq.y)).toBe(null);
    p.techs.add('meteorology');
    expect(sim.findPlacement(0, 'weatherPlant', hq.x, hq.y)).not.toBe(null);
  });

  it('forecast follows the weather cycle with countdown', () => {
    const sim = newSim();
    expect(hasForecast(sim, 0)).toBe(false);
    quickBuild(sim, 'weatherTower');
    expect(hasForecast(sim, 0)).toBe(true);
    sim.run(100);
    const f = forecast(sim);
    expect(f.length).toBe(WC.forecastCount);
    expect(f[0]).toMatchObject({ state: WEATHER_CYCLE[1][0], inTicks: WEATHER_CYCLE[0][1] - 100 });
    expect(f[1]).toMatchObject({ state: WEATHER_CYCLE[2][0], inTicks: WEATHER_CYCLE[0][1] + WEATHER_CYCLE[1][1] - 100 });
    // forecast arrives
    // (the change happens in the tick in which sim.tick reaches the value)
    sim.run(f[0].inTicks);
    expect(sim.weather.state).toBe(WEATHER_CYCLE[0][0]);
    sim.run(1);
    expect(sim.weather.state).toBe(f[0].state);
  });

  it('weather technicians generate energy; changing costs energy and has a cooldown', () => {
    const sim = newSim();
    const p = sim.players[0];
    p.techs.add('meteorology');
    const plant = quickBuild(sim, 'weatherPlant');
    const change = (state) => rejectOf(sim.step([{ type: 'changeWeather', player: 0, building: plant.id, state }]));
    expect(change('rain')).toBe(REASONS.noEnergy);
    let t = 0;
    while ((p.weatherEnergy ?? 0) < WC.changeCost && t < 30000) { sim.step(); t++; }
    expect(p.weatherEnergy).toBe(WC.maxEnergy);
    expect(plant.workers.length).toBeGreaterThan(0);
    expect(change('summer')).toBe(REASONS.sameWeather);
    expect(change('storm')).toBe(REASONS.badWeather);
    const ev = sim.step([{ type: 'changeWeather', player: 0, building: plant.id, state: 'winter' }]);
    expect(rejectOf(ev)).toBeUndefined();
    expect(ev.some((e) => e.type === 'weatherChanged' && e.state === 'winter')).toBe(true);
    expect(sim.weather.state).toBe('winter');
    expect(sim.map.frozen).toBe(true);
    expect(p.weatherEnergy).toBe(WC.maxEnergy - WC.changeCost);
    p.weatherEnergy = WC.maxEnergy;
    expect(change('rain')).toBe(REASONS.weatherCooldown);
    // after the duration the cycle continues with the next entry
    const next = WEATHER_CYCLE[(sim.weather.index + 1) % WEATHER_CYCLE.length][0];
    sim.run(WC.duration);
    expect(sim.weather.state).toBe(next);
    expect(sim.map.frozen).toBe(next === 'winter');
  });

  it('tower cannot change, foreign power plant cannot switch either', () => {
    const sim = newSim();
    sim.players[0].techs.add('meteorology');
    sim.players[0].weatherEnergy = WC.maxEnergy;
    const tower = quickBuild(sim, 'weatherTower');
    expect(rejectOf(sim.step([{ type: 'changeWeather', player: 0, building: tower.id, state: 'rain' }]))).toBe(REASONS.needWeatherBuilding);
    const plant = quickBuild(sim, 'weatherPlant');
    expect(rejectOf(sim.step([{ type: 'changeWeather', player: 1, building: plant.id, state: 'rain' }]))).toBe(REASONS.notOwnBuilding);
  });

  it('energy and cooldown are saved', () => {
    const sim = newSim();
    sim.players[0].techs.add('meteorology');
    const plant = quickBuild(sim, 'weatherPlant');
    sim.players[0].weatherEnergy = WC.maxEnergy;
    sim.step([{ type: 'changeWeather', player: 0, building: plant.id, state: 'rain' }]);
    sim.run(300);
    const sim2 = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    expect(sim2.hash()).toBe(sim.hash());
    sim.run(2000); sim2.run(2000);
    expect(sim2.hash()).toBe(sim.hash());
    expect(sim2.players[0].weatherEnergy).toBe(sim.players[0].weatherEnergy);
  });
});
