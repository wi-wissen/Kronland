// One list of save games from the device and (signed in) the account: the same game in both places is one row.
// Identity of a game: when it was saved, which mission and how far it got (a copy keeps all three).

const sig = (e) => `${e.savedAt}|${e.mission ?? ''}|${e.tick}`;

/**
 * @param {Array<any>} device entries of the device store @param {Array<any>} cloud entries of the account
 * @returns {Array<any>} rows, newest first: the entry fields plus `key`, `device` and `cloud` (the entry in that place or null)
 */
export function mergeSaves(device, cloud = []) {
  /** @type {any[]} */
  const rows = device.map((e) => ({ ...e, key: `d:${e.id}`, device: e, cloud: null }));
  // A copy in the account belongs to the first device row of the same game that has none yet (two identical device saves stay two rows)
  for (const e of cloud) {
    const hit = rows.find((r) => r.device && !r.cloud && sig(r) === sig(e));
    if (hit) hit.cloud = e;
    else rows.push({ ...e, key: `c:${e.id}`, device: null, cloud: e });
  }
  return rows.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
}
