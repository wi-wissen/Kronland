// Weather cycle of the map: [state, duration in ticks]. (A) – set per map in the original.
// Summer: no effect. Rain: ranged combat weaker. Winter: water freezes over, units slower.

export const WEATHER_NAMES = { summer: 'Sommer', rain: 'Regen', winter: 'Winter' };

export const WEATHER_CYCLE = [
  ['summer', 6000],
  ['rain', 1200],
  ['summer', 6000],
  ['winter', 1800],
];
