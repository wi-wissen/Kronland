// Directory of all missions. New mission: create a level folder in levels/ (levels/index.js) – campaign chapters,
// the tutorial, script missions and adventures are found by their kind. Only the developer maps (showcase, stress)
// are JS modules registered here.

import showcase from './showcase.js';
import stress from './stress.js';
import { SCENARIOS, ADVENTURES as ADVENTURE_JSON, SCRIPT_MISSIONS as SCRIPT_JSON, CAMPAIGN_LEVELS } from './levels/index.js';
import { scenarioToDef } from '../scripting/scenario.js';

/** Campaign chapters and tutorial from level folders (Python), by id. */
const LEVEL_DEFS = Object.fromEntries(CAMPAIGN_LEVELS.map((s) => [s.id, scenarioToDef(s)]));
const tutorial = LEVEL_DEFS.tutorial;

export const TUTORIAL_ID = tutorial.id;

/** Campaign in playing order (level folders of kind "campaign", sorted by `order`). */
export const CAMPAIGN = CAMPAIGN_LEVELS.filter((s) => s.kind === 'campaign').map((s) => LEVEL_DEFS[s.id]);

/** Showcase: all objects on one map (not a campaign mission). */
export const SHOWCASE = showcase;
/** Stress test: very many figures and buildings (check rendering under load). */
export const STRESS = stress;

/** Special maps: individual finished maps without a campaign (start menu → "Sonderkarten"). Register new ones here. */
export const SPECIAL_MAPS = [showcase, stress];

/** Coding adventures (mission definitions from scenario JSON), chained: after the victory the next one follows. */
export const ADVENTURES = ADVENTURE_JSON.map((s, i) => ({ ...scenarioToDef(s), next: s.next ?? ADVENTURE_JSON[i + 1]?.id ?? null }));
/** Script missions (kind "mission": played like a campaign mission, code panel hidden). */
export const SCRIPT_MISSIONS = SCRIPT_JSON.map(scenarioToDef);

const ALL = new Map([tutorial, ...CAMPAIGN, ...SPECIAL_MAPS, ...ADVENTURES, ...SCRIPT_MISSIONS].map((m) => [m.id, m]));

/** @returns {any|null} mission definition */
export const getMission = (id) => ALL.get(id) ?? null;

/** Scenario JSON of a bundled mission (or null). */
export const getScenario = (id) => SCENARIOS.find((s) => s.id === id) ?? CAMPAIGN_LEVELS.find((s) => s.id === id) ?? null;

export const allMissions = () => [...ALL.values()];
