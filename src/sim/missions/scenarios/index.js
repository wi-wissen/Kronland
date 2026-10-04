// Bundled scenarios (coding adventures and script missions). Register new files here.
// Each file exports pure scenario JSON (docs/SKRIPTE.md).

import adv1 from './adv1-treasure.js';
import adv2 from './adv2-corner.js';
import adv3 from './adv3-wood.js';
import adv4 from './adv4-stones.js';
import adv5 from './adv5-village.js';
import m1 from './m1-raid.js';

/** Coding adventures in order. */
export const ADVENTURES = [adv1, adv2, adv3, adv4, adv5];

/** Scenarios that are played like missions (Python instead of a mission file). */
export const SCRIPT_MISSIONS = [m1];

export const SCENARIOS = [...ADVENTURES, ...SCRIPT_MISSIONS];
