// "Stats for nerds": lines from the measurements (DevTools.stats()) – for display and as text
// to copy. Pure functions (testable).

/** Compact number: 1234 → 1.2 k, 2 500 000 → 2.50 M */
export const fmtNum = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + ' M' : n >= 1e4 ? (n / 1e3).toFixed(1) + ' k' : String(Math.round(n)));

/** Display order of the entities. */
const KIND_ORDER = ['unit', 'worker', 'leader', 'soldier', 'hero', 'building', 'tree', 'pile', 'ruin'];

/**
 * @param {any} s measurements from DevTools.stats()
 * @param {(key: string, params?: any) => string} t translation
 * @returns {[string, string][]} [label, value]
 */
export function statsRows(s, t) {
  const kinds = Object.entries(s.entities ?? {}).sort((a, b) => {
    const ia = KIND_ORDER.indexOf(a[0]), ib = KIND_ORDER.indexOf(b[0]);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a[0].localeCompare(b[0]);
  });
  const total = kinds.reduce((n, [, v]) => n + v, 0);
  const lod = (k) => (s.lod?.[k] ?? []).join('/') || '–';
  const rows = [
    [t('dev.st.fps'), s.fps.toFixed(1)],
    [t('dev.st.frame'), `${s.frameMs.toFixed(1)} ms (max ${s.frameMax.toFixed(0)})`],
    [t('dev.st.sim'), `${s.simMs.toFixed(2)} ms (max ${s.simMax.toFixed(1)}) · ${t('dev.st.ai')} ${s.aiMs.toFixed(2)} ms`],
    [t('dev.st.tick'), `${s.tick} · ${t('dev.st.speed')} ${s.speed}×${s.paused ? ' · ' + t('dev.st.paused') : ''}`],
    [t('dev.st.hash'), `${s.hash} @${s.hashTick}`],
    [t('dev.st.calls'), String(s.calls)],
    [t('dev.st.tris'), fmtNum(s.triangles)],
    [t('dev.st.gpuMem'), `${s.geometries} / ${s.textures} / ${s.programs}`],
    [t('dev.st.heap'), s.heap ? `${s.heap.used.toFixed(0)} / ${s.heap.limit.toFixed(0)} MB` : '–'],
    [t('dev.st.entities'), `${total}: ${kinds.map(([k, v]) => `${k} ${v}`).join(', ')}`],
    [t('dev.st.figures'), `${s.chars?.drawn ?? 0} / ${(s.chars?.drawn ?? 0) + (s.chars?.culled ?? 0)}`],
    [t('dev.st.lod'), `B ${lod('building')} · T ${lod('tree')} · F ${lod('character')}`],
    [t('dev.st.res'), `${s.width}×${s.height} @${(+s.dpr).toFixed(2)} = ${Math.round(s.width * s.dpr)}×${Math.round(s.height * s.dpr)}`],
    [t('dev.st.tier'), String(s.tier)],
    [t('dev.st.gpu'), String(s.gpu)],
    [t('dev.st.cam'), `x ${s.camera.x.toFixed(1)} z ${s.camera.z.toFixed(1)} · yaw ${(s.camera.yaw * 180 / Math.PI).toFixed(0)}° · pitch ${(s.camera.pitch * 180 / Math.PI).toFixed(0)}° · zoom ${s.camera.dist.toFixed(1)}`],
  ];
  return rows;
}

/** Text to copy (one line per value). */
export function statsText(s, t, title = 'Kronland') {
  const rows = statsRows(s, t);
  const w = Math.max(...rows.map((r) => r[0].length));
  return [title, ...rows.map(([k, v]) => `${k.padEnd(w)}  ${v}`)].join('\n');
}
