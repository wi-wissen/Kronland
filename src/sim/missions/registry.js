// Directory of all missions. New mission: create a file and register it here.

import tutorial from './tutorial.js';
import c1 from './campaign/c1-new-start.js';
import c2 from './campaign/c2-fire.js';
import c3 from './campaign/c3-ford.js';
import c4 from './campaign/c4-ice.js';
import c5 from './campaign/c5-crown.js';

export const TUTORIAL_ID = tutorial.id;

/** Campaign in playing order. */
export const CAMPAIGN = [c1, c2, c3, c4, c5];

const ALL = new Map([tutorial, ...CAMPAIGN].map((m) => [m.id, m]));

/** @returns {any|null} mission definition */
export const getMission = (id) => ALL.get(id) ?? null;

export const allMissions = () => [...ALL.values()];
