// Directory of all missions. New mission: create a level folder in levels/ (levels/index.js) – campaign chapters and
// the tutorial are found by their kind; older chapters are still mission files in campaign/ registered here.

import c3 from './campaign/c3-hagenfurt.js';
import c6 from './campaign/c6-thronsee.js';
import showcase from './showcase.js';
import stress from './stress.js';
import { SCENARIOS, ADVENTURES as ADVENTURE_JSON, SCRIPT_MISSIONS as SCRIPT_JSON, CAMPAIGN_LEVELS } from './levels/index.js';
import { scenarioToDef } from '../scripting/scenario.js';

/** Campaign chapters and tutorial from level folders (Python), by id. */
const LEVEL_DEFS = Object.fromEntries(CAMPAIGN_LEVELS.map((s) => [s.id, scenarioToDef(s)]));
const tutorial = LEVEL_DEFS.tutorial;
const c1 = LEVEL_DEFS.c1;
const c2 = LEVEL_DEFS.c2;
const c4 = LEVEL_DEFS.c4;
const c5 = LEVEL_DEFS.c5;

export const TUTORIAL_ID = tutorial.id;

/** Campaign in playing order. */
export const CAMPAIGN = [c1, c2, c3, c4, c5, c6];

/** Showcase: all objects on one map (not a campaign mission). */
export const SHOWCASE = showcase;
/** Stress test: very many figures and buildings (check rendering under load). */
export const STRESS = stress;

/** Special maps: individual finished maps without a campaign (start menu → "Sonderkarten"). Register new ones here. */
export const SPECIAL_MAPS = [showcase, stress];

/** Coding adventures (mission definitions from scenario JSON), chained: after the victory the next one follows. */
export const ADVENTURES = ADVENTURE_JSON.map((s, i) => ({ ...scenarioToDef(s), next: s.next ?? ADVENTURE_JSON[i + 1]?.id ?? null }));
/** Script missions (Python instead of a mission file). */
export const SCRIPT_MISSIONS = SCRIPT_JSON.map(scenarioToDef);

const ALL = new Map([tutorial, ...CAMPAIGN, ...SPECIAL_MAPS, ...ADVENTURES, ...SCRIPT_MISSIONS].map((m) => [m.id, m]));

/** @returns {any|null} mission definition */
export const getMission = (id) => ALL.get(id) ?? null;

/** Scenario JSON of a bundled mission (or null). */
export const getScenario = (id) => SCENARIOS.find((s) => s.id === id) ?? CAMPAIGN_LEVELS.find((s) => s.id === id) ?? null;

export const allMissions = () => [...ALL.values()];
