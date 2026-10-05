// Directory of all missions. New mission: create a file and register it here.
// Scenarios (coding adventures, script missions) are in scenarios/index.js.

import tutorial from './tutorial.js';
import c1 from './campaign/c1-lindgrund.js';
import c2 from './campaign/c2-beaucroix.js';
import c3 from './campaign/c3-hagenfurt.js';
import c4 from './campaign/c4-eisenhain.js';
import c5 from './campaign/c5-morvale.js';
import c6 from './campaign/c6-thronsee.js';
import showcase from './showcase.js';
import { SCENARIOS, ADVENTURES as ADVENTURE_JSON, SCRIPT_MISSIONS as SCRIPT_JSON } from './scenarios/index.js';
import { scenarioToDef } from '../scripting/scenario.js';

export const TUTORIAL_ID = tutorial.id;

/** Campaign in playing order. */
export const CAMPAIGN = [c1, c2, c3, c4, c5, c6];

/** Showcase: all objects on one map (not a campaign mission). */
export const SHOWCASE = showcase;

/** Coding adventures (mission definitions from scenario JSON), chained: after the victory the next one follows. */
export const ADVENTURES = ADVENTURE_JSON.map((s, i) => ({ ...scenarioToDef(s), next: s.next ?? ADVENTURE_JSON[i + 1]?.id ?? null }));
/** Script missions (Python instead of a mission file). */
export const SCRIPT_MISSIONS = SCRIPT_JSON.map(scenarioToDef);

const ALL = new Map([tutorial, ...CAMPAIGN, showcase, ...ADVENTURES, ...SCRIPT_MISSIONS].map((m) => [m.id, m]));

/** @returns {any|null} mission definition */
export const getMission = (id) => ALL.get(id) ?? null;

/** Scenario JSON of a bundled mission (or null). */
export const getScenario = (id) => SCENARIOS.find((s) => s.id === id) ?? null;

export const allMissions = () => [...ALL.values()];
