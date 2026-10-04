// Icons for bridge, well and monument (drawn in code, 32×32 grid, same style as index.js).
// Adopted into ICONS in index.js (b-<building>).

const O = '#2b1d12';
const SW = 'stroke="' + O + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"';
const p = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${SW} ${extra}/>`;
const c = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${SW} ${extra}/>`;
const r = (x, y, w, h, fill, rx = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${SW}/>`;
const hl = (d, op = 0.55) => `<path d="${d}" fill="#fff" opacity="${op}"/>`;
const ln = (d, color = O, w = 1.6) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const WALL = '#f3e3c0', TIMBER = '#7a4f28';

const BUILDING = {
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

export const EXTRA_ICONS = {
  ...Object.fromEntries(Object.entries(BUILDING).map(([k, v]) => [`b-${k}`, v])),
};
