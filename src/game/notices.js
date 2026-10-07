// Notices (toasts): categories, priority, merging and selection of the visible entries – pure rendering,
// testable without Engine and DOM (tests/game/notices.test.js). Times are performance.now() milliseconds.

/**
 * Notice categories. `prio`: smaller = more important (sits on top, displaced last);
 * `limit`: at most this many transient notices of this category at once (the oldest drops out).
 * Persistent notices (attack, fire, hero unconscious) are built by the Engine from the current state, see docs/ARCHITEKTUR.md.
 */
export const CATEGORIES = {
  alarm: { prio: 0, limit: 2 }, // attack, building destroyed, hero unconscious/back up
  fire: { prio: 1, limit: 1 }, // burning buildings
  feedback: { prio: 2, limit: 1 }, // answer to own inputs (err.*, "Keine untätigen …")
  system: { prio: 3, limit: 1 }, // saving, loading, settings
  build: { prio: 4, limit: 2 }, // building/extension/bridge finished, repaired
  research: { prio: 5, limit: 1 }, // research, squad levels
  economy: { prio: 6, limit: 2 }, // trade, resources exhausted, campfire, worker left
  military: { prio: 7, limit: 2 }, // recruited, promotions
  world: { prio: 8, limit: 1 }, // weather, collapsed bridges
  info: { prio: 9, limit: 1 }, // everything else
  script: { prio: 10, limit: 1 }, // print() of the player program (newest wins, a loop bundles into one entry)
};

/** Key → category (keys without an entry: `err.*` = feedback, `saves.*` = system, otherwise info) */
const KEY_CATEGORY = {
  'toast.attackBuilding': 'alarm', 'toast.attackSettlers': 'alarm', 'toast.attackTroops': 'alarm',
  'toast.buildingDestroyed': 'alarm', 'toast.heroDown': 'alarm', 'toast.heroesDown': 'alarm', 'toast.heroRevived': 'alarm',
  'toast.buildingBurning': 'fire', 'toast.buildingsBurning': 'fire',
  'toast.noIdleSerfs': 'feedback', 'toast.noArmy': 'feedback', 'toast.groupSaved': 'feedback', 'toast.noIdleNear': 'feedback',
  'toast.saved': 'system', 'toast.saveFailed': 'system', 'toast.loadFailed': 'system', 'toast.qualityLater': 'system',
  'toast.buildingDone': 'build', 'toast.upgradeDone': 'build', 'toast.bridgeBuilt': 'build', 'toast.repaired': 'build',
  'toast.researchDone': 'research', 'toast.buildingResearchDone': 'research', 'toast.lineUpgraded': 'research',
  'toast.tradeDone': 'economy', 'toast.noMoreNodes': 'economy', 'toast.nodeDepleted': 'economy', 'toast.campLit': 'economy', 'toast.workerLeft': 'economy',
  'toast.recruited': 'military', 'toast.promoted': 'military',
  'toast.print': 'script',
  'toast.weather': 'world', 'toast.weatherChanged': 'world', 'toast.weatherChangedEnemy': 'world', 'toast.bridgeCollapsed': 'world',
};

/**
 * Notices that merge into one entry with a counter despite different parameters, and the text
 * for it (placeholder like the single text plus `{n}`). Identical notices (key and parameters) always merge ("×3").
 */
export const MERGE = {
  'toast.promoted': 'toast.promotedMany',
  'toast.recruited': 'toast.recruitedMany',
  'toast.buildingDone': 'toast.buildingDoneMany',
  'toast.tradeDone': 'toast.tradeDoneMany',
  'toast.print': 'toast.printMany',
};

/** @param {string} key @returns {keyof typeof CATEGORIES} */
export function categoryOf(key) {
  if (KEY_CATEGORY[key]) return KEY_CATEGORY[key];
  if (key.startsWith('err.')) return 'feedback';
  if (key.startsWith('saves.')) return 'system';
  return 'info';
}

/** @param {string} cat */
export const prioOf = (cat) => (CATEGORIES[cat] ?? CATEGORIES.info).prio;

/**
 * @typedef {Object} Notice
 * @property {number|string} id
 * @property {string} key @property {Record<string, any>|null} params
 * @property {string} icon @property {string} tone @property {{x:number,y:number}|null} pos
 * @property {number} at last refreshed @property {number} ttl
 * @property {string} cat @property {number} count merged notices
 * @property {string|null} many text for several merged (MERGE)
 * @property {boolean} [sticky] persistent notice (derived from the state, does not expire)
 */

/** Merge key: notices with a MERGE entry per key, otherwise key + parameters. */
const mergeId = (key, params) => (MERGE[key] ? key : `${key}|${params ? JSON.stringify(params) : ''}`);

/**
 * Queue a notice: merge identical ones (counter up, text/location of the newest, time refreshed), otherwise append;
 * then per category at most `limit` entries (the oldest drop out). Changes `list` and returns the entry.
 * @param {Notice[]} list @param {Omit<Notice, 'cat'|'count'|'many'> & { cat?: string }} n @param {number} now
 * @returns {Notice}
 */
export function addNotice(list, n, now) {
  const cat = n.cat ?? categoryOf(n.key);
  const mid = mergeId(n.key, n.params);
  const same = list.find((o) => o.mid === mid);
  if (same) {
    same.count++;
    Object.assign(same, { params: n.params, pos: n.pos ?? same.pos, icon: n.icon, tone: n.tone, at: now, ttl: Math.max(same.ttl, n.ttl) });
    return same;
  }
  const t = { ...n, cat, at: now, count: 1, many: MERGE[n.key] ?? null, mid };
  list.push(t);
  const limit = (CATEGORIES[cat] ?? CATEGORIES.info).limit;
  const mine = list.filter((o) => o.cat === cat);
  for (let i = 0; i < mine.length - limit; i++) list.splice(list.indexOf(mine[i]), 1);
  return t;
}

/** Remove expired notices (changes `list`). @param {Notice[]} list @param {number} now */
export function expireNotices(list, now) {
  for (let i = list.length - 1; i >= 0; i--) if (now - list[i].at >= list[i].ttl) list.splice(i, 1);
  return list;
}

/**
 * Choose visible notices: first the persistent ones (at most max − 1, as long as transient ones wait), then per
 * category the newest (by priority), then the remaining slots by priority and age. This way every category gets
 * a slot, even if another one (e.g. promotions in combat) is currently producing many notices.
 * Result sorted: most important category on top, within it persistent ones first, otherwise oldest first.
 * @param {Notice[]} transient @param {Notice[]} persistent @param {number} max
 * @returns {Notice[]}
 */
export function pickVisible(transient, persistent, max) {
  const byPrio = (a, b) => prioOf(a.cat) - prioOf(b.cat);
  const sticky = [...persistent].sort(byPrio).slice(0, transient.length ? Math.max(1, max - 1) : max);
  const out = [...sticky];
  // transient: most important category first, within it newest first
  const rest = [...transient].sort((a, b) => byPrio(a, b) || b.at - a.at);
  const seen = new Set(out.map((o) => o.cat));
  for (const t of rest) {
    if (out.length >= max) break;
    if (!seen.has(t.cat)) { seen.add(t.cat); out.push(t); }
  }
  for (const t of rest) {
    if (out.length >= max) break;
    if (!out.includes(t)) out.push(t);
  }
  return out.sort((a, b) => byPrio(a, b) || (b.sticky ? 1 : 0) - (a.sticky ? 1 : 0) || a.at - b.at);
}

/** Rank of an attack target for the persistent notice of an attack place: castle > building > settler > squads */
export function attackInfo(t, pos) {
  if (t.kind === 'building') return { rank: t.type === 'headquarters' ? 3 : 2, key: 'toast.attackBuilding', params: { building: t.type, level: t.level }, pos };
  if (t.kind === 'worker' || t.kind === 'unit') return { rank: 1, key: 'toast.attackSettlers', params: null, pos };
  return { rank: 0, key: 'toast.attackTroops', params: null, pos };
}

/** At most this many attack places as their own persistent notice (the youngest) */
export const ATTACK_NOTICES = 2;

/**
 * Persistent notices for attack places (active places from alerts.js with `info` from attackInfo): one per place,
 * the most recently hit first; dismissed (`muted`) ones stay away until the place expires.
 * @param {import('./alerts.js').Alert[]} zones
 * @returns {Notice[]}
 */
export function attackNotices(zones) {
  return zones.filter((z) => z.info && !z.muted).sort((a, b) => b.last - a.last).slice(0, ATTACK_NOTICES).map((z) => ({
    id: `attack-${z.id}`, key: z.info.key, params: z.info.params, icon: 'attack', tone: 'bad', pos: z.info.pos,
    at: z.first, ttl: Infinity, cat: 'alarm', count: 1, many: null, sticky: true,
  }));
}
