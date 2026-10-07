// Figures that speak in missions. Own names and story (campaign "Krone aus Eis",
// see docs/KAMPAGNE.md). Only the four main figures are named; minor figures stay nameless.
// color: colour of the name tag/coat of arms in the UI.

export const SPEAKERS = {
  nelia: { name: { de: 'Nelia', en: 'Nelia' }, color: '#c9733a', initial: 'N' },
  orrin: { name: { de: 'Orrin, Händler', en: 'Orrin, Merchant' }, color: '#c9a35a', initial: 'O' },
  taran: { name: { de: 'Hauptmann Taran', en: 'Captain Taran' }, color: '#8fa0a8', initial: 'T' },
  malvor: { name: { de: 'Malvor, Statthalter von Hagenfurt', en: 'Malvor, Governor of Hagenfurt' }, color: '#7d5aa6', initial: 'M' },
  // Minor figures
  elder: { name: { de: 'Dorfälteste', en: 'Village Elder' }, color: '#6faa6a', initial: 'D' },
  villager: { name: { de: 'Dorfbewohnerin', en: 'Villager' }, color: '#a8925a', initial: 'D' },
  collector: { name: { de: 'Eintreiber', en: 'Tax Collector' }, color: '#b8433f', initial: 'E' },
  guard: { name: { de: 'Wache', en: 'Guard' }, color: '#b8433f', initial: 'W' },
  merchant: { name: { de: 'Kaufmann', en: 'Merchant' }, color: '#5b86c4', initial: 'K' },
  bandit: { name: { de: 'Räuberhauptmann', en: 'Bandit Captain' }, color: '#b8433f', initial: 'R' },
  prisoner: { name: { de: 'Gefangener', en: 'Prisoner' }, color: '#8a7a66', initial: 'G' },
  miner: { name: { de: 'Bergmeister', en: 'Mine Master' }, color: '#7d776f', initial: 'B' },
  herald: { name: { de: 'Herold', en: 'Herald' }, color: '#7d5aa6', initial: 'H' },
  scholar: { name: { de: 'Gelehrte', en: 'Scholar' }, color: '#5b86c4', initial: 'G' },
  // Example script mission (scenarios/m1-raid.js)
  kunz: { name: { de: 'Kunz der Rote, Räuberhauptmann', en: 'Kunz the Red, Bandit Captain' }, color: '#b8433f', initial: 'K' },
};
