// Scenarios: missions, coding adventures and self-built worlds in one common JSON format.
// A scenario becomes a mission definition for the existing mission runtime (runtime.js);
// its Python sections are executed by the ScriptHost. Format: docs/SKRIPTE.md.

export const SCENARIO_FORMAT = 'kronland-scenario';
export const SCENARIO_VERSION = 1;

/** Visibility of a section in the code panel. */
export const VISIBILITY = ['open', 'collapsed', 'hidden'];

/**
 * Check a scenario. Returns a list of problems (empty = fine).
 * @param {any} s
 * @returns {string[]}
 */
export function validateScenario(s) {
  const out = [];
  if (!s || typeof s !== 'object') return ['not an object'];
  if (s.format !== SCENARIO_FORMAT) out.push(`format must be "${SCENARIO_FORMAT}"`);
  if (s.version !== SCENARIO_VERSION) out.push(`version ${s.version} is not supported`);
  if (typeof s.id !== 'string' || !/^[\w-]+$/.test(s.id)) out.push('id missing or contains invalid characters');
  if (!Array.isArray(s.players) || !s.players.length) out.push('players missing');
  else if (s.players[0].kind !== 'human') out.push('players[0] must be the human');
  for (const [i, sec] of (s.sections ?? []).entries()) {
    if (typeof sec.id !== 'string') out.push(`sections[${i}].id missing`);
    if (typeof sec.code !== 'string') out.push(`sections[${i}].code missing`);
    if (sec.level && !['mission', 'player'].includes(sec.level)) out.push(`sections[${i}].level invalid`);
    if (sec.visibility && !VISIBILITY.includes(sec.visibility)) out.push(`sections[${i}].visibility invalid`);
  }
  const ids = (s.sections ?? []).map((x) => x.id);
  if (new Set(ids).size !== ids.length) out.push('duplicate section ids');
  const w = s.world ?? {};
  if (w.terrain && (!w.terrain.heights || !w.terrain.flags)) out.push('world.terrain incomplete');
  return out;
}

/**
 * Scenario → mission definition (same fields as campaign/*.js).
 * @param {any} s scenario JSON
 */
export function scenarioToDef(s) {
  const world = s.world ?? {};
  return {
    id: s.id,
    order: s.order ?? 100,
    kind: s.kind ?? 'mission',
    title: s.title ?? { de: s.id, en: s.id },
    summary: s.summary ?? null,
    briefing: s.briefing ?? null,
    victoryText: s.victoryText ?? { de: 'Geschafft!', en: 'Well done!' },
    defeatText: s.defeatText ?? { de: 'Leider verloren.', en: 'Defeat.' },
    defeatTexts: s.defeatTexts ?? {},
    debrief: s.debrief ?? null,
    next: s.next ?? null,
    seed: world.seed ?? s.seed ?? 1,
    size: world.size ?? 64,
    world: {
      base: world.base ?? (world.terrain ? 'terrain' : 'generate'),
      seed: world.seed, size: world.size, width: world.width, height: world.height,
      terrain: world.terrain ?? null, starts: world.starts ?? null,
    },
    fog: world.fog ?? s.fog ?? true,
    vision: world.vision ?? (world.startReveal ? { startReveal: world.startReveal } : undefined),
    weatherCycle: s.weatherCycle,
    players: s.players,
    objectives: s.objectives ?? [],
    events: s.events ?? [],
    start: s.start ?? [],
    scenario: s,
  };
}

/** Game settings for the simulation: castle yes/no per player. */
export const playerSetupOf = (def) => def.players.filter((p) => p.kind !== 'bandits').map((p) => ({ hq: p.hq !== false }));

/**
 * Empty scenario for the editor.
 * @param {{ id?: string, size?: number }} [o]
 */
export function emptyScenario(o = {}) {
  return {
    format: SCENARIO_FORMAT,
    version: SCENARIO_VERSION,
    id: o.id ?? 'custom-world',
    kind: o.kind ?? 'adventure',
    title: { de: 'Eigene Welt', en: 'My world' },
    summary: { de: '', en: '' },
    world: { base: 'flat', size: o.size ?? 32, fog: false, places: {} },
    players: [{ kind: 'human', hero: 'bertram', hq: false }],
    texts: {},
    sections: [
      { id: 'world', title: { de: 'Welt aufbauen', en: 'Build the world' }, level: 'mission', visibility: 'collapsed', editable: false, code: '# Weltaufbau: plant_trees(…), add_pile(…), make_place(…)\n' },
      { id: 'mission', title: { de: 'Mission', en: 'Mission' }, level: 'mission', visibility: 'hidden', editable: false, code: '@on_start\ndef intro():\n    say("bertram", "Los geht\'s!")\n' },
      { id: 'player', title: { de: 'Dein Programm', en: 'Your program' }, level: 'player', visibility: 'open', editable: true, code: 'hero.step()\n' },
    ],
  };
}
