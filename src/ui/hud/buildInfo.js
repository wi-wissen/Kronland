// Info strip of the build menu (hover or long press on a building tile): pure helpers that turn an
// entry of Engine.uiState().buildOptions into rows. Texts arise in the component via i18n keys.

/**
 * Build time in seconds with n serfs building at once (buildTime = seconds with ONE serf,
 * each further serf adds the same progress per tick; at most `builders` spots).
 * @param {number} buildTime seconds with one serf
 * @param {number} n serfs
 * @param {number} [builders] builder spots of the building
 */
export function buildSeconds(buildTime, n, builders = Infinity) {
  const k = Math.max(1, Math.min(n, builders));
  return Math.ceil(buildTime / k);
}

/** Reason code of a build option (string or { code, params }). */
export const reasonCode = (r) => (!r ? null : typeof r === 'string' ? r : r.code);

/**
 * Rows of the info strip: [icon, i18n key, params].
 * @param {{ buildTime: number, builders: number, workers?: number, prof?: string|null, beds?: number, seats?: number, population?: number }} o
 * @returns {[string, string, Record<string, any>][]}
 */
export function buildInfoRows(o) {
  const rows = [['time', 'binfo.timeOne', { s: buildSeconds(o.buildTime, 1) }]];
  if (o.builders > 1) rows.push(['serf', 'binfo.timeAll', { s: buildSeconds(o.buildTime, o.builders, o.builders), n: o.builders }]);
  if (o.workers && o.prof) rows.push(['worker', 'binfo.workers', { n: o.workers, prof: o.prof }]);
  if (o.beds) rows.push(['bed', 'binfo.beds', { n: o.beds }]);
  if (o.seats) rows.push(['seat', 'binfo.seats', { n: o.seats }]);
  if (o.population) rows.push(['population', 'binfo.population', { n: o.population }]);
  return rows;
}

/**
 * Why the building cannot be placed now: tech missing (with where to research it) or too expensive.
 * @param {{ reason: any, requires?: string|null, researchAt?: string|null }} o
 * @returns {{ tech: boolean, code: string, params?: object, researchAt: string|null }|null}
 */
export function buildInfoReason(o) {
  const code = reasonCode(o.reason);
  if (!code) return null;
  const tech = code === 'err.techMissing';
  return { tech, code, params: typeof o.reason === 'object' ? o.reason.params : undefined, researchAt: tech ? o.researchAt ?? null : null };
}
