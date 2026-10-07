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
