// Pure display logic of the code panel (ScriptPanel.vue): which error and console lines are shown,
// file names and text for download/open. No DOM, testable (tests/ui/scriptPanel.test.js).

/** Largest file the editor opens (bytes); the simulation takes at most 100 000 characters per section anyway */
export const MAX_FILE_BYTES = 200_000;

/**
 * The error of the player program that the panel shows (box and gutter marker), or null.
 * An error disappears as soon as its section was edited after the run (it may no longer be in the program).
 * @param {{ status?: string, error?: any }|null|undefined} player ui.mission.script.player
 * @param {Record<string, boolean>} dirty sections edited since the last run
 */
export function shownError(player, dirty) {
  const e = player?.status === 'error' ? player.error : null;
  return e && !dirty[e.section] ? e : null;
}

/**
 * Status for the badge: an error that was edited away reads as "ready" again.
 * @param {{ status?: string, error?: any }|null|undefined} player @param {Record<string, boolean>} dirty
 */
export function shownStatus(player, dirty) {
  const s = player?.status ?? 'idle';
  return s === 'error' && !shownError(player, dirty) ? 'idle' : s;
}

/**
 * Console lines for the panel: output of the player program only from the current run (`player.since`),
 * mission output only in the world editor. Errors appear in the error box and not a second time here;
 * errors of edited sections vanish.
 * @param {{ seq: number, level: string, text: string, err?: any }[]} lines ui.mission.script.console
 * @param {{ mode: string, since?: number, error?: any, dirty: Record<string, boolean>, max?: number }} o
 */
export function consoleView(lines, { mode, since = 0, error = null, dirty, max = 60 }) {
  return (lines ?? []).filter((c) => {
    if (c.level === 'player' ? c.seq <= since : mode !== 'editor') return false;
    if (c.err && (c.err.seq === error?.seq || dirty[c.err.section])) return false;
    return true;
  }).slice(-max);
}

/**
 * Hints the panel shows (amber line marker and box): valid code that rarely does what was meant, the program keeps
 * running (src/script/hints.js). Player hints of the current run; in the world editor also those of the mission
 * sections. Like errors, hints of a section disappear as soon as it was edited; at most `max` boxes, the rest is
 * counted. The same hint on the same line counts once.
 * @param {{ player?: { hints?: any[] }, missionHints?: any[] }|null|undefined} script ui.mission.script
 * @param {{ mode: string, dirty: Record<string, boolean>, max?: number }} o
 * @returns {{ list: any[], more: number, lines: Record<string, number[]> }} lines: marked lines per section
 */
export function shownHints(script, { mode, dirty, max = 2 }) {
  const all = [...(script?.player?.hints ?? []), ...(mode === 'editor' ? script?.missionHints ?? [] : [])];
  const seen = new Set();
  const list = [];
  /** @type {Record<string, number[]>} */
  const lines = {};
  for (const h of all) {
    if (!h || dirty[h.section]) continue;
    const key = `${h.section}:${h.sline}:${h.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(h);
    if (h.sline > 0 && !(lines[h.section] ??= []).includes(h.sline)) lines[h.section].push(h.sline);
  }
  return { list: list.slice(0, max), more: Math.max(0, list.length - max), lines };
}

/**
 * File name for the download: scenario id (or title) as a safe name with .py.
 * @param {string} [name]
 */
export function fileName(name) {
  const base = String(name ?? '').replace(/ß/g, 'ss').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return (base || 'programm') + '.py';
}

/**
 * Text of an opened file for the editor: without byte order mark, line ends as \n, tabs stay.
 * Returns null if it does not look like text (zero bytes).
 * @param {string} text
 */
export function sourceFromFile(text) {
  const s = String(text ?? '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  return s.includes('\0') ? null : s;
}
