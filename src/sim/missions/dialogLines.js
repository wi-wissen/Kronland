// Every dialogue line of the bundled missions, for the voice tools (scripts/asset-gen/voice.mjs) and the test that
// all of them are recorded: dialogue actions of mission files and say() lines of level folders (read from the
// Python code, src/sim/scripting/outline.js).

import { allMissions } from './registry.js';
import { scenarioLines } from '../scripting/outline.js';

/**
 * @returns {{ mission: string, speaker: string, text: any }[]} text is {de, en} (or a plain text of a one-language level)
 */
export function missionLines() {
  const out = [];
  for (const m of allMissions()) {
    const walk = (o) => {
      if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === 'object') {
        if (o.type === 'dialog' && o.speaker && o.text) out.push({ mission: m.id, speaker: o.speaker, text: o.text });
        for (const [k, v] of Object.entries(o)) if (k !== 'scenario') walk(v);
      }
    };
    walk(m);
    if (m.scenario) for (const l of scenarioLines(m.scenario)) out.push({ mission: m.id, ...l });
  }
  return out;
}
