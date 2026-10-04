// Weather cycle of the map: [state, duration in ticks]. (A) – set per map in the original.
// Summer: no effect. Rain: ranged combat weaker. Winter: water freezes over, units slower.

export const WEATHER_NAMES = { summer: 'Sommer', rain: 'Regen', winter: 'Winter' };

// Effects per weather (A): percentage factors on ranged attack and walking speed, water frozen/walkable.
// Read by the simulation (systems/military.js, sim.js) and by the compendium.
export const WEATHER_EFFECTS = {
  summer: { rangedAttackPercent: 100, speedPercent: 100, freezesWater: false },
  rain: { rangedAttackPercent: 70, speedPercent: 100, freezesWater: false },
  winter: { rangedAttackPercent: 100, speedPercent: 75, freezesWater: true },
};

export const WEATHER_CYCLE = [
  ['summer', 6000],
  ['rain', 1200],
  ['summer', 6000],
  ['winter', 1800],
];

// Weather tower and weather plant (alchemist technologies "Wettervorhersage" / "Meteorologie").
// Values (A): the original charges weather energy via workers in the plant; a change needs a full charge.
export const WEATHER_CONTROL = {
  maxEnergy: 1000,      // storage per player (A)
  changeCost: 1000,     // energy per weather change (A)
  duration: 1800,       // ticks that the induced weather lasts (3 min) (A)
  cooldown: 1800,       // ticks until the next change by the same player (A)
  forecastCount: 3,     // this many upcoming weathers are shown by the weather tower
};
