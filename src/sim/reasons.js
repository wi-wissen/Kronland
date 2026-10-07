// Rejection reasons of the game systems (building research, market, weather, repair) as
// language-independent i18n codes. Texts are in src/i18n/de.js and en.js (keys 'err.*').
// Reasons with parameters (predecessor technology, required upgrade level) are assembled by the
// respective check…() function as { code, params }.

export const REASONS = {
  unknownTech: 'err.unknownTech',
  wrongBuilding: 'err.wrongBuilding',
  notReady: 'err.underConstruction',
  researchRunning: 'err.busyResearching',
  alreadyResearched: 'err.alreadyResearched',
  researchElsewhere: 'err.beingResearched',
  needPrevTech: 'err.techFirst',          // params: { tech }
  needLevel: 'err.upgradeFirst',          // params: { building, level }
  needFortress: 'err.fortressFirst',
  noResources: 'err.notEnoughResources',
  notOwnBuilding: 'err.notOwnBuilding',
  needMarket: 'err.needMarket',
  tradeRunning: 'err.tradeRunning',
  badTrade: 'err.badTrade',
  badAmount: 'err.badAmount',             // params: { step, max }
  noTraders: 'err.noTraders',
  needWeatherBuilding: 'err.needWeatherBuilding',
  needMeteorology: 'err.needMeteorology',
  badWeather: 'err.badWeather',
  sameWeather: 'err.sameWeather',
  noEnergy: 'err.noEnergy',
  weatherCooldown: 'err.weatherCooldown',
  noRepairNeeded: 'err.noRepairNeeded',
  repairFull: 'err.repairFull',
  siteFull: 'err.siteFull',
  upgradeNoSerfs: 'err.upgradeNoSerfs',
};
