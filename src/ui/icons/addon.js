// Icons of the expansion content (drawn in code, 32×32 grid, same style as index.js).
// Taken over into ICONS in index.js: b-<building>, u-rifle, hero-<hero>, ab-<ability>, sp-<specialist>.

const O = '#2b1d12';
const SW = 'stroke="' + O + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"';
const p = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${SW} ${extra}/>`;
const c = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${SW} ${extra}/>`;
const r = (x, y, w, h, fill, rx = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${SW}/>`;
const hl = (d, op = 0.55) => `<path d="${d}" fill="#fff" opacity="${op}"/>`;
const ln = (d, color = O, w = 1.6) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const WALL = '#f3e3c0', TIMBER = '#7a4f28';

const BUILDING = {
  tavern: [
    r(6, 14, 20, 13, WALL, 1), ln('M6 19h20', TIMBER, 1.2), p('M4 15 16 6l12 9z', '#9c4a26'),
    r(13.5, 20, 5, 7, TIMBER, 0.6), ln('M24 11v-4h4', TIMBER, 1.4), p('M25.5 9h4v5h-4z', '#f5c542'), p('M26.4 10h2.2v3h-2.2z', '#fff8e0'),
  ].join(''),
  gunsmith: [
    r(4, 14, 20, 13, '#a9a39a', 1), p('M2.5 15 13 8l10.5 7z', '#5d7080'), r(23, 9, 5, 18, '#7d776f', 0.6),
    p('M7 21l13-4 .6 2-13 4z', '#3b3f46'), p('M7 21l-1.5 4 3 .6.6-3.6z', '#b07a43'),
  ].join(''),
  bridge: [
    p('M2 26c4-9 24-9 28 0z', '#4d7bc0'), p('M2 18h28v4H2z', '#b07a43'),
    ln('M4 18v-5M10 18v-5M16 18v-5M22 18v-5M28 18v-5', TIMBER, 1.6), ln('M3 13h26', TIMBER, 1.8),
    ln('M6 22c3-3.4 7-3.4 10 0 3-3.4 7-3.4 10 0', '#7a4f28', 1.4),
  ].join(''),
  fountain: [
    `<ellipse cx="16" cy="24" rx="12" ry="4.4" fill="#cfc9bf" ${SW}/>`, `<ellipse cx="16" cy="22.6" rx="9" ry="2.6" fill="#7fb4e0" ${SW}/>`,
    r(14.4, 11, 3.2, 11, '#cfc9bf', 1), ln('M16 11c-3-4-6-3-8 2M16 11c3-4 6-3 8 2', '#7fb4e0', 2), c(16, 9.6, 1.8, '#9fd0f0'),
  ].join(''),
  statue: [
    r(9, 22, 14, 6, '#a9a39a', 0.6), r(11, 19, 10, 3, '#cfc9bf', 0.4),
    p('M13 19l.8-6h4.4l.8 6z', '#c8b071'), c(16, 10.5, 2.6, '#c8b071'), p('M18 13l5-6 1 1-4.6 6.4z', '#c8b071'),
    hl('M14.4 18l.6-4.4h1l-.4 4.4z', 0.4),
  ].join(''),
};

const UNIT = {
  rifle: [
    p('M3 21 24 10l2 3.2L5 24.6z', '#5d7080'), hl('M5 21.2 23.6 11.4l.5.8L5.6 22z', 0.45),
    p('M3 21l-1 4.6 4.4.4 1-3.2z', '#b07a43'), p('M12 18.6l1.6 3.4 2-1-1.4-3.2z', '#b07a43'), c(26.6, 9, 1.4, '#f5a623'),
  ].join(''),
};

const HERO = {
  falk: [
    c(16, 13, 6, '#f0c39a'), p('M9 12c0-5 3-8.4 7-8.4s7 3.4 7 8.4c-2-1.4-4.4-2.2-7-2.2S11 10.6 9 12z', '#3f5a3a'),
    p('M21 6.4l5-3 .8 1.2-4.8 3.4z', '#c9503c'), ln('M13 13.6h2M17 13.6h2', O, 1.3),
    p('M7 29c0-5 4-8 9-8s9 3 9 8z', '#5f7a48'), ln('M22 22l6-8', '#b07a43', 2),
  ].join(''),
  morla: [
    p('M7 15c0-3 1.4-6 4-7.4L16 2l5 5.6c2.6 1.4 4 4.4 4 7.4z', '#5b3f7a'), c(16, 15, 5.4, '#e3d0b6'),
    ln('M13.4 15h1.6M17 15h1.6', '#5b3f7a', 1.4), p('M7 29c0-5.4 4-8.4 9-8.4s9 3 9 8.4z', '#4a3566'),
    p('M2 22c3-2 5-1 7 0-2 1.2-5 1.6-7 0zM23 24c3-1.6 5-.6 7 .4-2.4 1-5 1.2-7-.4z', '#c9c1d6'),
  ].join(''),
};

const ABILITY = {
  aimedShot: [c(16, 16, 11, '#f3e3c0'), c(16, 16, 7, '#c9503c'), c(16, 16, 3, '#f3e3c0'), ln('M16 2v6M16 24v6M2 16h6M24 16h6', O, 2)].join(''),
  eagleEye: [
    p('M3 16c4-6.6 8.6-9 13-9s9 2.4 13 9c-4 6.6-8.6 9-13 9s-9-2.4-13-9z', '#f3e3c0'), c(16, 16, 5, '#c8a040'), c(16, 16, 2.2, O),
    hl('M14 13.4a2 2 0 0 1 2.4-.8', 0.8),
  ].join(''),
  poisonFog: [
    p('M5 22a5 5 0 0 1 3-9 7 7 0 0 1 13-2 5.5 5.5 0 0 1 5.6 8.6A4 4 0 0 1 24 26H8a4.4 4.4 0 0 1-3-4z', '#8fbf5a'),
    c(12, 18, 1.6, '#5b3f7a'), c(18, 15, 1.4, '#5b3f7a'), c(21, 20, 1.2, '#5b3f7a'),
  ].join(''),
  mistVeil: [
    p('M10 27V15c0-4 2.6-7 6-7s6 3 6 7v12l-2-2-2 2-2-2-2 2-2-2z', '#d9d3e6', 'opacity="0.9"'),
    ln('M3 12c4-2 7 2 11 0M18 8c4-2 7 2 11 0M2 20c4-2 7 2 10 0M21 23c3-2 6 1 9 0', '#9a8fb3', 1.6), c(14, 15, 1, O), c(18, 15, 1, O),
  ].join(''),
  steal: [
    p('M9 12c0-3 3-5 7-5s7 2 7 5l3 13c-3 3-17 3-20 0z', '#b08452'), ln('M11 12h10', O, 1.8), ln('M14 7l-2-4M18 7l2-4', TIMBER, 1.4),
    c(16, 19, 3.4, '#f5c542'), ln('M16 17.4v3.2', '#b07a14', 1.2),
  ].join(''),
  sabotage: [
    r(7, 12, 14, 15, '#9c4a26', 2), ln('M7 17h14M7 22h14', '#5e2416', 1.4), ln('M14 12c0-4 3-6 7-6', '#7a4f28', 1.6),
    p('M22 2.5l1 2.4 2.5.6-2.2 1.4.2 2.6-1.8-1.8-2.4.8 1.2-2.2-1.4-2.2 2.6.4z', '#f5a623'),
  ].join(''),
  torch: [
    p('M14 30l-1-14h6l-1 14z', '#b07a43'), p('M12 15h8l-1 3h-6z', '#7d776f'),
    p('M16 2c4 3 5 6 4 9s-2 4-4 4-4-1.6-4.4-4C11 8 13 5 16 2z', '#f5a623'), p('M16 6.4c2 1.6 2.4 3.4 1.8 5S16.6 13 16 13s-2-.6-2-2.4c0-1.6.6-2.8 2-4.2z', '#ffe08a'),
  ].join(''),
  findResources: [
    c(13, 13, 8, '#d6e2ea'), c(13, 13, 5.4, '#9fd0f0'), p('M18.6 18.6l3-3 7.4 7.4-3 3z', '#7a4f28'),
    p('M10 15l2-4 2 3 1.6-1.6 1.4 2.6z', '#a9a39a'), hl('M9.4 10.6a4 4 0 0 1 3-2', 0.7),
  ].join(''),
  stop: [r(8, 8, 16, 16, '#c9503c', 2), r(12, 12, 8, 8, '#f3e3c0', 1)].join(''),
};

const SPECIALIST = {
  thief: [
    p('M7 16c0-6 4-11 9-11s9 5 9 11v3H7z', '#3b3f46'), c(16, 16, 5, '#e3c8a4'), p('M10.6 14.6h10.8v2.6H10.6z', '#2b1d12'),
    c(13.6, 15.9, 0.9, '#f3e3c0'), c(18.4, 15.9, 0.9, '#f3e3c0'), p('M6 29c0-5 4.4-8 10-8s10 3 10 8z', '#4a4f57'),
  ].join(''),
  scout: [
    c(16, 14, 5.6, '#f0c39a'), p('M9 12.6c0-4.6 3-8 7-8s7 3.4 7 8l-3-1.6h-8z', '#5f7a48'), p('M21.4 7.4l5.6-1.4-.4 2.4z', '#e2c99a'),
    p('M7 29c0-5 4-8 9-8s9 3 9 8z', '#7a6a48'), p('M23 19l2-6 1.6.4-1.4 6.2z', '#b07a43'), p('M24.4 10.6c1.6 1 2 2.4 1.4 3.4h-2.4c-.4-1 0-2.2 1-3.4z', '#f5a623'),
  ].join(''),
};

export const ADDON_ICONS = {
  ...Object.fromEntries(Object.entries(BUILDING).map(([k, v]) => [`b-${k}`, v])),
  ...Object.fromEntries(Object.entries(UNIT).map(([k, v]) => [`u-${k}`, v])),
  ...Object.fromEntries(Object.entries(HERO).map(([k, v]) => [`hero-${k}`, v])),
  ...Object.fromEntries(Object.entries(ABILITY).map(([k, v]) => [`ab-${k}`, v])),
  ...Object.fromEntries(Object.entries(SPECIALIST).map(([k, v]) => [`sp-${k}`, v])),
};
