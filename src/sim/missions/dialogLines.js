// Every dialogue line of the bundled missions, for the voice tools (scripts/asset-gen/voice.mjs) and the test that
// all of them are recorded: say() lines of the level folders (read from the Python code, src/sim/scripting/outline.js)
// and the lines of the developer maps (`lines` of showcase.js).

import { allMissions } from './registry.js';
import { scenarioLines } from '../scripting/outline.js';

/**
 * @returns {{ mission: string, speaker: string, text: any }[]} text is {de, en} (or a plain text of a one-language level)
 */
export function missionLines() {
  const out = [];
  for (const m of allMissions()) {
    for (const l of m.lines ?? []) out.push({ mission: m.id, ...l });
    if (m.scenario) for (const l of scenarioLines(m.scenario)) out.push({ mission: m.id, ...l });
  }
  return out;
}
