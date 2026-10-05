// Own icon set (drawn in code, no external sources). 32×32 grid.
// Two families:
//  - Crest icons (resources, buildings, units, weather, abilities): coloured areas with a dark
//    outline, matching the bright KayKit style of the 3D models.
//  - Control icons (pause, menu, close …): single colour in currentColor, they take over the text colour.
// Usage: <Icon name="gold" /> (src/ui/icons/Icon.vue) or iconFor*(id) for game data.

import { EXTRA_ICONS } from './extras.js';

const O = '#2b1d12';
const SW = 'stroke="' + O + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"';
const p = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${SW} ${extra}/>`;
const c = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${SW} ${extra}/>`;
const r = (x, y, w, h, fill, rx = 0, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${SW} ${extra}/>`;
/** Highlight without outline */
const hl = (d, op = 0.55) => `<path d="${d}" fill="#fff" opacity="${op}"/>`;
/** Line without fill */
const ln = (d, color = O, w = 1.6) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
/** Control icon: outline in currentColor */
const g = (d, w = 2.4) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const gf = (d) => `<path d="${d}" fill="currentColor"/>`;

// ---------- House kit for building icons ----------
const WALL = '#f3e3c0', TIMBER = '#7a4f28', ROOF = '#c9503c', ROOF_B = '#4d7bc0', ROOF_G = '#5f9c48', ROOF_S = '#8b8f97';
function house(roof = ROOF, emblem = '') {
  return [
    r(7, 15, 18, 12, WALL, 1),
    ln('M7 20h18', TIMBER, 1.2),
    p('M4.5 16.5 16 6l11.5 10.5z', roof),
    hl('M9 14.5 16 8.4l2 1.8-7.5 6.3z', 0.3),
    r(14, 20.5, 4, 6.5, TIMBER, 0.6),
    emblem,
  ].join('');
}

// ---------- Resources ----------
const RES = {
  gold: [
    `<ellipse cx="13" cy="22" rx="8.5" ry="4" fill="#d99a1e" ${SW}/>`,
    `<ellipse cx="13" cy="19" rx="8.5" ry="4" fill="#f5c542" ${SW}/>`,
    `<ellipse cx="19" cy="14" rx="8.5" ry="4" fill="#d99a1e" ${SW}/>`,
    `<ellipse cx="19" cy="11" rx="8.5" ry="4" fill="#f5c542" ${SW}/>`,
    hl('M14 10.4c2-1.6 7.4-1.8 9.6-.2-2.6-.7-6.6-.6-9.6.2z', 0.8),
    ln('M19 9.2v3.6', '#b07a14', 1.4),
  ].join(''),
  clay: [
    p('M5 21.5 9 12.5 22 10l5 8.5-4 6.5L9 26z', '#c8693a'),
    p('M9 12.5 22 10l5 8.5-13 2.5z', '#de8653'),
    ln('M14 21 9 12.5', '#9c4a26', 1.2),
    hl('M12 13.2 20.5 11.6l1.3 2-8.4 1.6z', 0.35),
  ].join(''),
  wood: [
    p('M4 20 22 9.5l4.5 7.5L8.5 27.5z', '#b07a43'),
    `<ellipse cx="6.3" cy="23.8" rx="3.2" ry="4.4" transform="rotate(-30 6.3 23.8)" fill="#e2b77c" ${SW}/>`,
    `<ellipse cx="6.3" cy="23.8" rx="1.2" ry="1.8" transform="rotate(-30 6.3 23.8)" fill="none" stroke="#b07a43" stroke-width="1"/>`,
    ln('M12 18.6 20.5 13.6M14 22.4l7.4-4.4', '#7a4f28', 1.1),
    p('M20 6.5 27 3l1.5 3.4-6 3.4z', '#7a4f28'),
  ].join(''),
  stone: [
    p('M4 24.5 7 14l9-5 10 3.5 2 11-7 4.5H9z', '#a9a39a'),
    p('M7 14l9-5 10 3.5-9 4.5z', '#cfc9bf'),
    ln('M17 17v11M17 17l11 6.5', '#7d776f', 1.3),
    hl('M9.5 13.6 16 10.2l4 1.4-6.4 3.4z', 0.45),
  ].join(''),
  iron: [
    p('M3.5 21.5 8 15h17l3.5 6.5z', '#8fa3b3'),
    p('M3.5 21.5h25l-2 5h-21z', '#5d7080'),
    p('M8 15h17l-2.6 4H10.6z', '#b8c8d4'),
    hl('M11 16h11l-1.2 1.6h-8.6z', 0.6),
    p('M7 12.5 11 8h12l4 4.5z', '#8fa3b3'),
  ].join(''),
  sulfur: [
    p('M6 27 9.5 13 14 27z', '#e6c723'),
    p('M12 27l5-20 6 20z', '#f2dc3c'),
    p('M20 27l3.5-12 3.5 12z', '#d9b81a'),
    hl('M16.5 10.5 15 18h1.8z', 0.7),
    ln('M4 27h24', O, 1.6),
  ].join(''),
};

// ---------- Control icons ----------
const GLYPH = {
  pause: gf('M9 7h4.5v18H9zM18.5 7H23v18h-4.5z'),
  play: gf('M10 6.5v19l15-9.5z'),
  speed: gf('M5 7.5v17L15 16zM16 7.5v17L26 16z'),
  menu: g('M6 9h20M6 16h20M6 23h20', 2.8),
  close: g('M8.5 8.5l15 15M23.5 8.5l-15 15', 2.8),
  back: g('M19 7l-9 9 9 9', 3),
  next: g('M13 7l9 9-9 9', 3),
  chevronDown: g('M8 12l8 8 8-8', 2.8),
  chevronUp: g('M8 20l8-8 8 8', 2.8),
  check: g('M6.5 16.5l6 6L25.5 9', 3.2),
  plus: g('M16 7v18M7 16h18', 3),
  minus: g('M7 16h18', 3),
  settings: g('M16 11.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6zM16 4v3.4M16 24.6V28M4 16h3.4M24.6 16H28M7.5 7.5l2.4 2.4M22.1 22.1l2.4 2.4M7.5 24.5l2.4-2.4M22.1 9.9l2.4-2.4', 2.4),
  globe: g('M16 4.5a11.5 11.5 0 1 0 0 23 11.5 11.5 0 0 0 0-23zM4.5 16h23M16 4.5c-3.6 3.4-4.8 7.2-4.8 11.5s1.2 8.1 4.8 11.5M16 4.5c3.6 3.4 4.8 7.2 4.8 11.5S19.6 24.1 16 27.5', 2),
  sound: gf('M5 12h5l7-6v20l-7-6H5z') + g('M21 11.5c1.8 2.4 1.8 6.6 0 9M24.5 8.5c3.4 4.2 3.4 10.8 0 15', 2.2),
  mute: gf('M5 12h5l7-6v20l-7-6H5z') + g('M21 12.5l7 7M28 12.5l-7 7', 2.4),
  music: gf('M12 23.5a3.5 3.5 0 1 1-2-3.2V7.5l14-3v15.5a3.5 3.5 0 1 1-2-3.2V9.4l-10 2.1z'),
  effects: g('M16 4v5M16 23v5M4 16h5M23 16h5M8 8l3.4 3.4M20.6 20.6 24 24M8 24l3.4-3.4M20.6 11.4 24 8', 2.4),
  display: g('M5 7h22v14H5zM12 26h8M16 21v5', 2.4),
  scale: g('M5 5h8M5 5v8M27 27h-8M27 27v-8M5 5l8.5 8.5M27 27l-8.5-8.5', 2.4),
  edge: g('M4 10V4h6M28 10V4h-6M4 22v6h6M28 22v6h-6') + gf('M16 10l4 5h-8zM16 22l-4-5h8z'),
  hint: g('M12 12a4 4 0 1 1 5.6 3.7c-1 .5-1.6 1.4-1.6 2.5v1.3', 2.6) + gf('M14.4 23h3.2v3.2h-3.2z'),
  keyboard: g('M4 9h24v14H4zM8 13h1M12 13h1M16 13h1M20 13h1M24 13h0M9 18h14', 2.2),
  save: g('M6 6h16l4 4v16H6zM10 6v6h10V6M10 26v-8h12v8', 2.2),
  load: g('M5 10V7h8l2 3h12v15H5zM16 14v8M12.5 18.5 16 22l3.5-3.5', 2.2),
  quit: g('M13 6H6v20h7M14 16h13M22 11l5 5-5 5', 2.4),
  map: g('M4 8l7-3 10 3 7-3v19l-7 3-10-3-7 3zM11 5v19M21 8v19', 2.2),
  idle: gf('M8 9h8l-8 9h8v2.5H5.5v-2l7.6-8.5H8zM19 17h6l-6 6.5h6V26h-9v-2l5.8-6.4H19z'),
  all: gf('M11 9.5a3.5 3.5 0 1 1 0 .01zM21 9.5a3.5 3.5 0 1 1 0 .01zM4.5 25c0-5 2.6-8 6.5-8s6.5 3 6.5 8zM14.5 25c0-5 2.6-8 6.5-8s6.5 3 6.5 8z'),
  lock: g('M9 14V10.5a7 7 0 0 1 14 0V14', 2.6) + gf('M6.5 14h19v13h-19z'),
  warning: gf('M16 3.5 29 27H3zM14.5 11v8h3v-8zM14.5 21.5v3h3v-3z'),
  info: g('M16 4.5a11.5 11.5 0 1 0 0 23 11.5 11.5 0 0 0 0-23z', 2.2) + gf('M14.5 14h3v9h-3zM14.5 9h3v3h-3z'),
  target: g('M16 5a11 11 0 1 0 0 22 11 11 0 0 0 0-22zM16 10a6 6 0 1 0 0 12 6 6 0 0 0 0-12z', 2.2) + gf('M14 14h4v4h-4z'),
  dice: g('M6 6h20v20H6z', 2.4) + gf('M10 10h3v3h-3zM19 10h3v3h-3zM14.5 14.5h3v3h-3zM10 19h3v3h-3zM19 19h3v3h-3z'),
  jump: g('M16 4v6M16 22v6M4 16h6M22 16h6M16 10a6 6 0 1 0 0 12 6 6 0 0 0 0-12z', 2.4),
  // Save games
  edit: g('M20.5 6.5l5 5L12 25H7v-5zM17.5 9.5l5 5', 2.4),
  trash: g('M6 9h20M13 9V6h6v3M8.5 9l1.5 17h12l1.5-17M13.5 13.5v8M18.5 13.5v8', 2.3),
  download: g('M16 5v14M10 13.5l6 6 6-6M6 22v4h20v-4', 2.6),
  upload: g('M16 20V6M10 11.5l6-6 6 6M6 22v4h20v-4', 2.6),
};

// ---------- Display crests ----------
const EMBLEM = {
  population: [
    c(10, 11, 3.6, '#f0c39a'), p('M3.5 26c0-6 2.8-9 6.5-9s6.5 3 6.5 9z', '#4d7bc0'),
    c(22, 10, 4, '#f0c39a'), p('M14.5 27c0-6.5 3.2-10 7.5-10s7.5 3.5 7.5 10z', '#c9503c'),
  ].join(''),
  motivation: [
    c(16, 16, 11.5, '#f5c542'), hl('M8.5 11c1.6-3.4 5-5.2 8.2-5.2-3.6 1.2-6 2.8-8.2 5.2z', 0.7),
    `<circle cx="12" cy="13.5" r="1.7" fill="${O}"/><circle cx="20" cy="13.5" r="1.7" fill="${O}"/>`,
    ln('M10.5 18.5c2.8 4 8.2 4 11 0', O, 2),
  ].join(''),
  motivationLow: [
    c(16, 16, 11.5, '#e0a24a'),
    `<circle cx="12" cy="13.5" r="1.7" fill="${O}"/><circle cx="20" cy="13.5" r="1.7" fill="${O}"/>`,
    ln('M11 22c2.8-3.6 7.2-3.6 10 0', O, 2),
  ].join(''),
  faith: [
    p('M12.5 27V13h7v14z', '#f3e3c0'), p('M16 4.5c2.8 3 3.2 5.2 0 8-3.2-2.8-2.8-5 0-8z', '#f5a623'),
    hl('M16 6.5c1 1.4 1.1 2.6 0 4z', 0.8), ln('M16 12.5V13', O), p('M9.5 27h13v2.5h-13z', '#b07a43'),
  ].join(''),
  payday: [
    p('M10 11c-4 3-6 7-6 10.5 0 4 3.5 6 12 6s12-2 12-6c0-3.5-2-7.5-6-10.5z', '#c9a46a'),
    p('M11 11l-2.2-5.5c2.6 1.2 4.6-.8 7.2-.8s4.6 2 7.2.8L21 11z', '#c9a46a'),
    ln('M11 11h10', O, 1.6),
    `<circle cx="16" cy="20" r="4.2" fill="#f5c542" ${SW}/>`, ln('M16 17.6v4.8', '#b07a14', 1.3),
  ].join(''),
  hp: p('M16 27S4 19.5 4 11.8C4 8 6.8 5 10.4 5c2.4 0 4.3 1.3 5.6 3.3C17.3 6.3 19.2 5 21.6 5 25.2 5 28 8 28 11.8 28 19.5 16 27 16 27z', '#d24b3f') + hl('M7.5 10c.6-2 2-3 3.6-3-1.3.8-2.3 1.8-3.6 3z', 0.7),
  time: [c(16, 16, 11.5, '#f3e3c0'), ln('M16 9v7l5 3', O, 2), `<circle cx="16" cy="16" r="1.4" fill="${O}"/>`].join(''),
  crown: [
    p('M4.5 24 3 10l7 6 6-9 6 9 7-6-1.5 14z', '#f5c542'), p('M4.5 24h23v3.5h-23z', '#d99a1e'),
    c(16, 7, 1.8, '#d24b3f'), c(3, 10, 1.6, '#4d7bc0'), c(29, 10, 1.6, '#4d7bc0'),
    hl('M7 19.5 6 13l3 2.6z', 0.6),
  ].join(''),
  skull: [
    p('M16 4c-6.6 0-11 4.6-11 10.4 0 3.6 1.8 6 4 7.2V26h14v-4.4c2.2-1.2 4-3.6 4-7.2C27 8.6 22.6 4 16 4z', '#e9e1cf'),
    `<circle cx="11.5" cy="14.5" r="2.8" fill="${O}"/><circle cx="20.5" cy="14.5" r="2.8" fill="${O}"/>`,
    ln('M13 22v4M16 22v4M19 22v4', O, 1.4), p('M16 17.5l-1.6 3h3.2z', O),
  ].join(''),
  banner: [
    ln('M7 3v26', O, 2.2), p('M8 5h17l-4 6 4 6H8z', '#c9503c'), hl('M9.5 6.5h11.5l-1 1.5H9.5z', 0.35),
  ].join(''),
  scroll: [
    p('M8 6h15a3 3 0 0 1 3 3v16H11a3 3 0 0 1-3-3z', '#f3e3c0'), p('M5 6a3 3 0 0 1 6 0v3H5z', '#e2c99a'),
    ln('M13 12h9M13 16h9M13 20h6', '#9c7a4a', 1.4),
  ].join(''),
  objective: [
    c(16, 16, 12, '#f3e3c0'), c(16, 16, 8, '#c9503c'), c(16, 16, 4, '#f3e3c0'), `<circle cx="16" cy="16" r="1.6" fill="${O}"/>`,
  ].join(''),
  objectiveDone: [c(16, 16, 12, '#6fbf4a'), ln('M10 16.5l4 4 8-9', '#fff', 3)].join(''),
  objectiveFailed: [c(16, 16, 12, '#d24b3f'), ln('M11 11l10 10M21 11 11 21', '#fff', 3)].join(''),
  attack: [
    p('M5 5l3.5-.5L22 18l-2 2L6.5 6.5z', '#d6e2ea'), p('M27 5l-3.5-.5L10 18l2 2L25.5 6.5z', '#d6e2ea'),
    p('M18.5 21.5l5-5 2 2-5 5z', '#7a4f28'), p('M13.5 21.5l-5-5-2 2 5 5z', '#7a4f28'),
    p('M22 24l2.5-2.5 3 3-2.5 2.5zM10 24l-2.5-2.5-3 3 2.5 2.5z', '#f5c542'),
  ].join(''),
  hold: [
    p('M16 4 26 8v8c0 6-4.4 10-10 12C10.4 26 6 22 6 16V8z', '#4d7bc0'), p('M16 4v24c5.6-2 10-6 10-12V8z', '#3a5f9a'),
    hl('M8 9l8-3.2V8L8 11z', 0.35), ln('M11 15h10', '#f3e3c0', 2.4),
  ].join(''),
  defend: [
    p('M16 4 26 8v8c0 6-4.4 10-10 12C10.4 26 6 22 6 16V8z', '#6fbf4a'), p('M16 4v24c5.6-2 10-6 10-12V8z', '#4f9a35'),
    ln('M16 9v14M10.5 15h11', '#f3e3c0', 2.4),
  ].join(''),
  refill: [
    c(12, 10, 3.6, '#f0c39a'), p('M5.5 26c0-6 2.8-9 6.5-9s6.5 3 6.5 9z', '#8fa3b3'),
    c(23, 20, 6.5, '#6fbf4a'), ln('M23 16.5v7M19.5 20h7', '#fff', 2.4),
  ].join(''),
  militia: [
    p('M8 27 22 6l2.4 1.6L10.4 28.6z', '#b07a43'), p('M20 4.5 26.5 3l-1.5 6.4-3.2-2.2z', '#d6e2ea'),
    c(9, 9, 3.4, '#f0c39a'), p('M3 22c0-5 2.4-8 6-8 2.4 0 4 1.2 5 3.2L9 25H3z', '#c39a5e'),
  ].join(''),
  upgrade: [c(16, 16, 12, '#6fbf4a'), p('M16 7.5l7.5 8H19V24h-6v-8.5H8.5z', '#f3e3c0')].join(''),
  demolish: [
    p('M4 26h24v2.5H4z', '#7d776f'), p('M6 26l2-6h5l1 6zM15 26l1.5-4h4l2 4z', '#a9a39a'),
    p('M18 4.5 27 9l-2 3.6-9-4.6z', '#8fa3b3'), p('M19.5 9.8 11.5 22l2.2 1.4 8-12.2z', '#b07a43'),
  ].join(''),
  overtime: [
    c(14, 17, 10, '#f3e3c0'), ln('M14 11v6l4 2.5', O, 2),
    p('M22 3.5 28 3l-1 6-1.8-1.6L21 11.5l-2-2 4.2-4.2z', '#f5a623'),
  ].join(''),
  research: [
    p('M12 4h8v2h-1v6.5l7 11.5a2.8 2.8 0 0 1-2.4 4.2H8.4A2.8 2.8 0 0 1 6 24l7-11.5V6h-1z', '#e8f3f8'),
    p('M9.4 19.5h13.2l3.4 4.5a2.8 2.8 0 0 1-2.4 4.2H8.4A2.8 2.8 0 0 1 6 24z', '#6fbf4a'),
    `<circle cx="14" cy="23.5" r="1.3" fill="#fff"/><circle cx="18.5" cy="25" r="1" fill="#fff"/>`,
  ].join(''),
  tax: [
    p('M6 8h20v18H6z', '#f3e3c0'), ln('M10 13h12M10 17h12M10 21h7', '#9c7a4a', 1.4),
    `<circle cx="23" cy="23" r="5.5" fill="#f5c542" ${SW}/>`, ln('M23 20.5v5', '#b07a14', 1.3),
  ].join(''),
  serf: [
    c(14, 9, 4.2, '#f0c39a'), p('M7 28c0-7.5 3-11.5 7-11.5S21 20.5 21 28z', '#c39a5e'),
    ln('M7.5 21.5 5 28', O, 1.4), p('M22.5 4l2.6.6-2.6 17-2.6-.6z', '#b07a43'),
    p('M18.6 21.5l5.6 1.2-1.4 6-5.4-1.2z', '#a9a39a'),
  ].join(''),
  worker: [
    c(16, 9.5, 4.2, '#f0c39a'), p('M10.5 6.5c1-3 3-4 5.5-4s4.5 1 5.5 4z', '#c9503c'),
    p('M8.5 28c0-7.5 3.3-11.5 7.5-11.5s7.5 4 7.5 11.5z', '#4d7bc0'), ln('M16 17v11', '#3a5f9a', 1.2),
  ].join(''),
  bed: [
    p('M4 15h24v9H4z', '#e2c99a'), p('M4 11h7v4H4z', '#f3e3c0'), p('M11 12h17v3H11z', '#4d7bc0'),
    ln('M4 9v19M28 15v13', '#7a4f28', 2.4),
  ].join(''),
  seat: [
    p('M5 15h22c0 6-4.8 10.5-11 10.5S5 21 5 15z', '#c8693a'), hl('M8 17h16c-.6 1-1.6 2-2.6 2.6H10.6C9.6 19 8.6 18 8 17z', 0.35),
    p('M9.5 15c0-3 2.8-4.5 6.5-4.5s6.5 1.5 6.5 4.5z', '#f5c542'), ln('M13 5c-1 1.6 1 2.6 0 4.2M19 5c-1 1.6 1 2.6 0 4.2', '#9c7a4a', 1.3),
  ].join(''),
  soldiers: [
    p('M7 6l3-1.6L11.5 22H8.5z', '#d6e2ea'), p('M5 21h9v2.4H5z', '#7a4f28'),
    c(21, 10, 4, '#f0c39a'), p('M17 9c0-4 2-5.5 4-5.5S25 5 25 9z', '#8fa3b3'),
    p('M14 28c0-6.5 3-10 7-10s7 3.5 7 10z', '#c9503c'),
  ].join(''),
  castle: [
    p('M5 12h4v-3h3v3h2v-3h4v3h2v-3h3v3h4v16H5z', '#cfc9bf'), p('M12 28v-7a4 4 0 0 1 8 0v7z', '#7a4f28'),
    p('M14.5 3v6M14.5 3.5 21 5.2l-6.5 1.8', '#c9503c'), ln('M5 16h22', '#a9a39a', 1.1),
  ].join(''),
  // Game systems
  fire: [
    p('M16 3c1.4 4.6 7.6 7 7.6 14.2A7.6 7.6 0 0 1 16 28a7.6 7.6 0 0 1-7.6-7.6c0-3.6 2-5.6 3.4-7.6.6 2 1.4 3 2.6 3.4C14 12 14.6 7.4 16 3z', '#f07a2a'),
    p('M16 14.5c.8 2.6 4 4 4 7.6a4 4 0 0 1-8 0c0-1.8.8-2.8 1.6-3.8.4 1 .8 1.4 1.4 1.6-.2-2 .2-3.8 1-5.4z', '#f5c542'),
    hl('M13 19c.2-1.4.8-2.4 1.6-3.2-.4 1.2-.6 2.2-.6 3.4z', 0.6),
  ].join(''),
  repair: [
    p('M5 23.5 16.5 12l3.5 3.5L8.5 27a2.5 2.5 0 0 1-3.5-3.5z', '#b07a43'),
    p('M18 6.5a6 6 0 0 1 7.8-1.6l-3.6 3.6.4 2.9 2.9.4 3.6-3.6A6 6 0 0 1 21 16.5a6 6 0 0 1-3-10z', '#8fa3b3'),
    hl('M19.4 8c.8-1.2 2-1.9 3.3-2.1l-1.9 1.9z', 0.6),
  ].join(''),
  star: p('M16 3.5l3.7 7.6 8.3 1.2-6 5.9 1.4 8.3L16 22.6l-7.4 3.9 1.4-8.3-6-5.9 8.3-1.2z', '#f5c542') + hl('M14.2 9.5 16 6l1 2.2z', 0.7),
  starEmpty: p('M16 3.5l3.7 7.6 8.3 1.2-6 5.9 1.4 8.3L16 22.6l-7.4 3.9 1.4-8.3-6-5.9 8.3-1.2z', '#5a4632'),
  trade: [
    p('M4 9h15V5l8 6-8 6v-4H4z', '#6fbf4a'),
    p('M28 21H13v-4l-8 6 8 6v-4h15z', '#e0a24a'),
  ].join(''),
  energy: [
    p('M18.5 3 7 18h7.5L12 29l13-16h-7.8z', '#f5c542'), hl('M17 6.5 10.6 15h2.4z', 0.6),
  ].join(''),
  market: [
    r(5, 15, 22, 12, '#f3e3c0', 1), p('M3 15l3-7h20l3 7z', '#c9503c'),
    ln('M8.5 8l-1.5 7M13 8l-.6 7M19 8l.6 7M23.5 8l1.5 7', '#f3e3c0', 1.4),
    `<circle cx="11" cy="21.5" r="2.6" fill="#f5c542" ${SW}/>`, p('M17 19.5h7v5h-7z', '#b07a43'),
  ].join(''),
  player: c(16, 16, 10, '#4d7bc0') + hl('M10 12c1.2-2.6 3.4-4 6-4-2.4 1-4.4 2.2-6 4z', 0.5),
};

// ---------- Weather ----------
const WEATHER = {
  summer: [
    `<g stroke="${O}" stroke-width="1.6" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M16 2.8v4.4" transform="rotate(${a} 16 16)" stroke="#f5a623" stroke-width="3"/>`).join('')}</g>`,
    c(16, 16, 7.4, '#f5c542'), hl('M11.5 13.5c.8-2 2.6-3.2 4.6-3.2-2 .8-3.4 1.8-4.6 3.2z', 0.8),
  ].join(''),
  rain: [
    p('M8.5 20a5.5 5.5 0 0 1-.6-11A7.5 7.5 0 0 1 22 8a5.5 5.5 0 0 1 1.5 10.8z', '#d6e2ea'),
    hl('M10 12c1-2.6 3.6-4 6.4-3.6-2.6.6-4.6 1.8-6.4 3.6z', 0.8),
    ln('M10 23l-1.5 4M16 23l-1.5 4M22 23l-1.5 4', '#4a8fd8', 2.4),
  ].join(''),
  winter: [
    `<g fill="none" stroke="${O}" stroke-width="4.6" stroke-linecap="round">${[0, 60, 120].map((a) => `<path d="M16 4v24" transform="rotate(${a} 16 16)"/>`).join('')}</g>`,
    `<g fill="none" stroke="#bfe3f6" stroke-width="2.4" stroke-linecap="round">${[0, 60, 120].map((a) => `<path d="M16 4v24M12.5 6.5 16 9.5l3.5-3M12.5 25.5 16 22.5l3.5 3" transform="rotate(${a} 16 16)"/>`).join('')}</g>`,
  ].join(''),
};

// ---------- Buildings ----------
const pick = [p('M10 10l12 0', 'none'), ''];
const BUILDING = {
  headquarters: EMBLEM.castle,
  villageCenter: [
    r(6, 15, 20, 12, WALL, 1), p('M4 16 16 6l12 10z', ROOF_B), r(13.5, 19.5, 5, 7.5, TIMBER, 2.4),
    c(16, 12.2, 2, '#f5c542'), ln('M4.5 27h23', O, 1.6),
  ].join(''),
  residence: house(ROOF, r(9, 17.5, 3.2, 3.2, '#9fd0f0', 0.4) + r(19.8, 17.5, 3.2, 3.2, '#9fd0f0', 0.4)),
  farm: [
    p('M3 27c2-4 5-6 13-6s11 2 13 6z', '#e6c45a'),
    ln('M7 25l1.4-4M11.5 25l.8-4.5M16 25v-4.6M20.5 25l-.8-4.5M25 25l-1.4-4', '#b07a14', 1.4),
    r(8, 11, 13, 9, '#c9503c', 0.6), p('M6 12 14.5 5 23 12z', '#7a4f28'), r(12.5, 14, 4, 6, '#f3e3c0', 0.4),
    p('M22.5 9.5h4V20h-4z', '#cfc9bf'), p('M22.5 9.5a2 2 0 0 1 4 0z', ROOF_B),
  ].join(''),
  university: [
    p('M4 11 16 5l12 6z', ROOF_B), r(5, 11, 22, 2.4, '#e2c99a'),
    r(7, 13.4, 2.6, 11, WALL), r(12, 13.4, 2.6, 11, WALL), r(17.4, 13.4, 2.6, 11, WALL), r(22.4, 13.4, 2.6, 11, WALL),
    r(4, 24.4, 24, 3, '#e2c99a'),
  ].join(''),
  chapel: [
    r(8, 14, 16, 13, WALL, 1), p('M6 15 16 7l10 8z', ROOF_S), p('M14 7V3h4v4', '#cfc9bf'), ln('M16 1v4M14.4 2.4h3.2', '#f5c542', 1.6),
    p('M13.5 27v-5a2.5 2.5 0 0 1 5 0v5z', TIMBER), c(16, 17.5, 1.8, '#9fd0f0'),
  ].join(''),
  storehouse: [
    r(4, 13, 24, 14, '#b07a43', 1), ln('M4 13l24 14M28 13 4 27', '#7a4f28', 1.4), r(4, 13, 24, 14, 'none', 1),
    p('M2.5 14 16 6l13.5 8z', ROOF_G),
  ].join(''),
  clock: [
    r(11, 10, 10, 18, '#cfc9bf', 0.6), p('M9.5 11 16 3l6.5 8z', ROOF_B), c(16, 16, 4, '#f3e3c0'), ln('M16 13.6V16l1.8 1.2', O, 1.3),
    r(14, 22, 4, 6, TIMBER, 0.6),
  ].join(''),
  windwheel: [
    p('M14 28l1-14h2l1 14z', '#b07a43'),
    p('M16 13 9 4l-2.5 2.2zM16 13l9-7 1.6 2.8zM16 13l-1.4 10 2.8.3z', '#f3e3c0'),
    p('M16 13 9.5 20l2.4 1.8z', '#f3e3c0'), c(16, 13, 2, '#c9503c'),
  ].join(''),
  tower: [
    p('M10 28l1.5-17h9L22 28z', '#cfc9bf'), p('M9 8h3V5h2.4v3h3.2V5H20v3h3v4H9z', '#a9a39a'),
    r(14, 15, 4, 5, '#2b1d12', 2), ln('M10.8 20h10.4', '#a9a39a', 1.1),
  ].join(''),
  barracks: [
    r(5, 14, 22, 13, '#c39a5e', 1), p('M3 15 16 7l13 8z', '#c9503c'), r(13, 19, 6, 8, TIMBER, 0.6),
    p('M8 9 11 3.5l1.5.8-2.6 5.4zM24 9l-3-5.5-1.5.8 2.6 5.4z', '#d6e2ea'),
  ].join(''),
  archery: [
    r(4, 18, 24, 9, '#c39a5e', 1), p('M2.5 19 16 12l13.5 7z', ROOF_G),
    c(16, 7, 5, '#f3e3c0'), c(16, 7, 3, '#c9503c'), `<circle cx="16" cy="7" r="1" fill="#f3e3c0"/>`,
  ].join(''),
  stable: [
    r(4, 14, 24, 13, '#b07a43', 1), p('M2.5 15 16 6l13.5 9z', '#c9503c'), r(8, 18, 6, 9, TIMBER), r(18, 18, 6, 9, TIMBER),
    ln('M8 22.5h6M18 22.5h6', '#e2b77c', 1.2),
  ].join(''),
  foundry: [
    r(4, 13, 18, 14, '#a9a39a', 1), p('M2.5 14 13 7l10.5 7z', ROOF_S), r(22, 5, 5, 22, '#7d776f', 0.6),
    `<path d="M24.5 4c-1.6-1.6 1.6-2.4 0-4" fill="none" stroke="#cfc9bf" stroke-width="1.6"/>`,
    r(9, 18, 8, 9, '#f5a623', 3.5),
  ].join(''),
  weatherTower: [
    p('M11 28l1.5-16h7L21 28z', '#cfc9bf'), ln('M12.2 20h7.6', '#a9a39a', 1.1),
    p('M10 12h12l-2-3h-8z', ROOF_B), ln('M16 9V3', O, 1.6),
    p('M16 3.5l5 1.6-5 1.6z', '#f3e3c0'), c(16, 16, 1.8, '#9fd0f0'),
    p('M22.5 7.5a3 3 0 0 1 5.4.8 2.4 2.4 0 0 1-.4 4.7h-4.6a2.6 2.6 0 0 1-.4-5.5z', '#e8f3f8'),
  ].join(''),
  weatherPlant: [
    r(3, 15, 18, 12, '#a9a39a', 1), p('M1.5 16 12 8.5 22.5 16z', ROOF_S), r(9.5, 20, 5, 7, TIMBER, 0.5),
    p('M24 27V9h4v18z', '#7d776f'), c(26, 7.5, 3.2, '#9fd0f0'),
    p('M15.5 18.5 12 23h2.6l-1.2 3.6 4.4-5.2h-2.6l1.4-2.9z', '#f5c542'),
  ].join(''),
  banditCamp: [
    p('M4 27 13 8l9 19z', '#7a4f28'), p('M13 8l2.5 19H22z', '#5c3b1e'), p('M17 27 23 15l6 12z', '#9b2f27'),
    ln('M13 8l-2-4M13 8l2-4', O, 1.4),
  ].join(''),
};
/** Mines: shaft entrance with resource chunks */
function mine(res) {
  const col = { clay: '#c8693a', stone: '#a9a39a', iron: '#8fa3b3', sulfur: '#f2dc3c' }[res];
  return [
    p('M3 27 9 12l7-5 7 5 6 15z', '#8b7b66'), p('M11 27v-7a5 5 0 0 1 10 0v7z', '#2b1d12'),
    ln('M11 20h10M12 23.5h8', '#b07a43', 1.6),
    p('M20 27l2.4-4.5 4 1 1.6 3.5z', col), p('M5 27l1.8-3.6 3.4.6.8 3z', col),
  ].join('');
}
BUILDING.clayMine = mine('clay');
BUILDING.stoneMine = mine('stone');
BUILDING.ironMine = mine('iron');
BUILDING.sulfurMine = mine('sulfur');
/** Refining: small workshop house with tool badge */
function workshop(roof, emblem) {
  return [r(4, 15, 16, 12, WALL, 1), p('M2.5 16 12 8l9.5 8z', roof), r(9.5, 20, 4, 7, TIMBER, 0.5), emblem].join('');
}
BUILDING.brickworks = workshop(ROOF, [r(19, 18, 10, 4, '#c8693a', 0.5), r(21, 22, 8, 4, '#de8653', 0.5), r(19, 26, 10, 2, '#9c4a26')].join(''));
BUILDING.sawmill = workshop(ROOF_G, [c(24, 19, 6, '#d6e2ea'), `<g fill="${O}">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M24 12.2l1 1.8h-2z" transform="rotate(${a} 24 19)"/>`).join('')}</g>`, c(24, 19, 1.6, '#7a4f28')].join(''));
BUILDING.stonemason = workshop(ROOF_S, [p('M19 21l5-3 5 3v6H19z', '#cfc9bf'), p('M21 9l2-1 4 7-2 1z', '#8fa3b3'), p('M22.6 15.4l-2.6 1.4', 'none')].join(''));
BUILDING.smithy = workshop('#5c4a3a', [p('M18 17h11l-2 3h-3v3h3v3H18v-3h3v-3h-1.5z', '#5d7080'), hl('M19.5 17.6h8l-.6 1h-7z', 0.4)].join(''));
BUILDING.alchemist = workshop('#7d5aa6', [p('M22.5 13h3v4l3.5 6.5a2 2 0 0 1-1.8 3H20.8a2 2 0 0 1-1.8-3l3.5-6.5z', '#e8f3f8'), p('M20.4 21h7.2l1.4 2.5a2 2 0 0 1-1.8 3H20.8a2 2 0 0 1-1.8-3z', '#6fbf4a')].join(''));
BUILDING.bank = workshop(ROOF_B, [p('M18 20h11v7H18z', '#b07a43'), p('M18 20c0-3 2.4-4.6 5.5-4.6S29 17 29 20z', '#7a4f28'), r(22, 21, 3, 3, '#f5c542', 0.4)].join(''));
void pick;

// ---------- Build menu categories ----------
const CATEGORY = {
  home: house(ROOF),
  raw: [
    p('M3.5 27 7 18l6-4 6 2.5 4 8.5-3 2z', '#a9a39a'), p('M7 18l6-4 6 2.5-6 3.5z', '#cfc9bf'),
    p('M14.5 25.5 25 9l2.2 1.4L16.7 27z', '#b07a43'),
    p('M17.5 6.5c4.4-2.6 9.6-2.2 12.5.8-3.4-.8-6.8-.2-9.6 1.6z', '#8fa3b3'), p('M20.4 8.9l-2.9-2.4 1.6-1z', '#8fa3b3'),
  ].join(''),
  refine: [
    p('M4 12h16l-3 4h-2v4h5v4H8v-4h5v-4h-1.8z', '#5d7080'), hl('M6 12.8h12.4l-.6 1H6.6z', 0.45),
    p('M21 5.5 28 12l-2.2 2.2-7-6.5z', '#8fa3b3'), p('M22.5 11.5 15 20l1.8 1.6 7.6-8.4z', '#b07a43'),
  ].join(''),
  military: [
    p('M16 4 26 8v8c0 6-4.4 10-10 12C10.4 26 6 22 6 16V8z', '#c9503c'), p('M16 4v24c5.6-2 10-6 10-12V8z', '#9b2f27'),
    p('M11 10l10 10M21 10 11 20', 'none'), ln('M11 10l10 10M21 10 11 20', '#f3e3c0', 2.4),
  ].join(''),
  admin: [
    p('M7 5h18v22l-9-4-9 4z', '#4d7bc0'), p('M16 5h9v22l-9-4z', '#3a5f9a'), c(16, 13, 3.6, '#f5c542'),
  ].join(''),
};

// ---------- Units (lines) ----------
const UNIT = {
  sword: [
    p('M14.5 3h3l.5 17h-4z', '#d6e2ea'), hl('M15.2 4h1v15h-1z', 0.6), p('M9 20h14v2.6H9z', '#f5c542'),
    p('M14.6 22.6h2.8V28h-2.8z', '#7a4f28'), c(16, 29, 1.4, '#f5c542'),
  ].join(''),
  spear: [
    p('M15 9h2v20h-2z', '#b07a43'), p('M16 2l3.5 7.5h-7z', '#d6e2ea'), p('M12.5 12.5h7v2h-7z', '#c9503c'),
  ].join(''),
  bow: [
    ln('M10 3.5c10 3 13 9.5 13 12.5s-3 9.5-13 12.5', O, 4.2), ln('M10 3.5c10 3 13 9.5 13 12.5s-3 9.5-13 12.5', '#b07a43', 2.4),
    ln('M10 3.5v25', '#f3e3c0', 1.1), p('M4 16h17', 'none'), ln('M5 16h18', O, 1.6), p('M23 16l-4-2.5v5z', '#d6e2ea'),
  ].join(''),
  lightCav: [
    p('M5 26l2-9c1-4 4-6 8-6h5l4-5 2.5 2.5-1.5 4 2 5-3 1-2-3-2 1v4l-3 6h-3l2-6h-5l-3 6z', '#c39a5e'),
    ln('M7 17c-2 0-3 1-3.6 3', O, 1.6), p('M14 11V5l4 2.5-4 2.5', '#4d7bc0'),
  ].join(''),
  heavyCav: [
    p('M5 26l2-9c1-4 4-6 8-6h5l4-5 2.5 2.5-1.5 4 2 5-3 1-2-3-2 1v4l-3 6h-3l2-6h-5l-3 6z', '#7a5a42'),
    p('M10 15c2-2 6-2 9-1v4c-3 1-6 1-9 0z', '#8fa3b3'), p('M13 11V4l2 1v6z', '#d6e2ea'),
  ].join(''),
  cannon: [
    p('M4 17l18-7 3 6-18 6z', '#5d7080'), hl('M6 16.4 21 10.6l.6 1.2L6.6 17.4z', 0.4), c(23.5, 13, 2.6, '#2b1d12'),
    c(12, 23, 5, '#b07a43'), c(12, 23, 1.6, '#7a4f28'),
  ].join(''),
};

// ---------- Heroes and abilities ----------
const HERO = {
  // Placeholder portraits of the heroes (until own icons emerge from the concept sheets)
  nelia: [
    p('M8.6 13c0-5.4 3.2-9 7.4-9s7.4 3.6 7.4 9c0 3-1 6-2.4 8.4L16 22l-5-.6C9.6 19 8.6 16 8.6 13z', '#9c4a26'),
    c(16, 13.4, 5.6, '#f0c39a'), p('M9.6 10.6c2-3 4-4 6.4-4s4.4 1 6.4 4l-1 1.4c-1.6-1.8-3.4-2.6-5.4-2.6s-3.8.8-5.4 2.6z', '#c64a9a'),
    ln('M13.6 14h1.4M17 14h1.4', O, 1.3), p('M20.4 18c1.6 2 2 4.4 1 7l-1.4-.4c.6-2.2.4-4.2-.8-5.8z', '#9c4a26'),
    p('M7 29c0-5 4-8 9-8s9 3 9 8z', '#b08452'), p('M13 21.6l3 3 3-3z', '#c64a9a'),
  ].join(''),
  orrin: [
    c(16, 15, 6, '#f0c39a'), p('M7.6 11.4c0-4 3.8-6.8 8.4-6.8s8.4 2.8 8.4 6.8c-2.4-1-5.2-1.4-8.4-1.4s-6 .4-8.4 1.4z', '#c64a9a'),
    p('M22 5.4c2-2 4.4-2.4 6-1.6-1.4.4-3.2 1.8-4.6 3.6z', '#f3e3c0'), ln('M13.4 14.4h1.4M17.2 14.4h1.4', O, 1.3),
    p('M12.4 18c1.2-.8 2.4-.8 3.6 0 1.2-.8 2.4-.8 3.6 0-1.2 1.2-2.4 1.2-3.6.4-1.2.8-2.4.8-3.6-.4z', '#6b4a2c'),
    p('M15 19.6h2l-1 3z', '#6b4a2c'), p('M6 29c0-5 4.4-8 10-8s10 3 10 8z', '#c26a3a'), p('M8 26h16v2H8z', '#c64a9a'),
  ].join(''),
  taran: [
    c(16, 15, 6, '#e8b890'), p('M9 13c0-5 3-8 7-8s7 3 7 8z', '#8a9198'), p('M15 5c0-2 1-3 2-3.4V5z', '#c64a9a'),
    p('M10.6 17.4c1 3.4 3 5 5.4 5s4.4-1.6 5.4-5c-1.4 1-3.2 1.4-5.4 1.4s-4-.4-5.4-1.4z', '#4a3222'),
    ln('M13.4 14.6h1.4M17.2 14.6h1.4', O, 1.3), ln('M13 12.4l1.6 1', '#b0715a', 0.8),
    p('M6 29c0-5 4.4-8 10-8s10 3 10 8z', '#6a6f76'), p('M12 22h8v7h-8z', '#c64a9a'),
  ].join(''),
  malvor: [
    c(16, 14.4, 5.6, '#e6c0a0'), p('M10.4 12c0-4.4 2.4-7 5.6-7s5.6 2.6 5.6 7c-1.6-1.6-3.4-2.2-5.6-2.2s-4 .6-5.6 2.2z', '#9a9a9e'),
    p('M9.6 9c1-3 3.6-5 6.4-5s5.4 2 6.4 5c-2-1.2-4-1.6-6.4-1.6S11.6 7.8 9.6 9z', '#c64a9a'),
    ln('M13.6 14h1.6M16.8 14h1.6', O, 1.3), p('M14.6 18.4c.8.6 2 .6 2.8 0l-.4 3.4h-2z', '#8a8a8e'),
    p('M6 29c0-5 4.4-8 10-8s10 3 10 8z', '#c64a9a'), p('M10 22.6c1.8-1 3.8-1.6 6-1.6s4.2.6 6 1.6V29H10z', '#3d4a5e'),
    p('M11 22c2 1.6 3.4 2.4 5 2.4s3-.8 5-2.4l.6 1.2c-2 1.8-3.6 2.6-5.6 2.6s-3.6-.8-5.6-2.6z', '#6a6a70'),
  ].join(''),
};
const ABILITY = {
  farsight: [
    p('M3 16c4-6.6 8.6-9 13-9s9 2.4 13 9c-4 6.6-8.6 9-13 9s-9-2.4-13-9z', '#f3e3c0'), c(16, 16, 5, '#5b86c4'), c(16, 16, 2.2, O),
    hl('M14 13.4a2 2 0 0 1 2.4-.8', 0.8),
  ].join(''),
  bribe: [
    p('M9 13c0-3 3-5 7-5s7 2 7 5l3 12c-3 3-17 3-20 0z', '#b08452'), ln('M11 13h10', O, 1.8), ln('M14 8l-2-4M18 8l2-4', '#7a4f28', 1.4),
    c(16, 19.6, 3.6, '#f5c542'), ln('M16 17.8v3.6', '#b07a14', 1.2),
  ].join(''),
  intimidate: [
    p('M5 12h5l7-6v20l-7-6H5z', '#8a9198'), hl('M6 13h3.4v1.6H6z', 0.5),
    ln('M21 11c1.6 1.4 1.6 8.6 0 10M24.4 8c3 3 3 13 0 16', '#c9503c', 2.2),
  ].join(''),
  shieldBash: [
    ln('M16 6a10 10 0 1 1-9.4 6.6', O, 4.4), ln('M16 6a10 10 0 1 1-9.4 6.6', '#f5c542', 2.4),
    p('M4 9.5l4.5 1.2-1.4 4.4z', '#f5c542'), p('M14.6 10h2.8l.4 9h-3.6z', '#d6e2ea'), p('M12 19h8v2.2h-8z', '#7a4f28'),
  ].join(''),
  courage: [
    p('M10 28V16l-3-2 1.5-7.5L12 9V5h3v6h2V4h3v7h2V6h3v10l-3 3v9z', '#f0c39a'),
    ln('M4 4l3 3M28 4l-3 3M3 14h3M26 14h3', '#f5a623', 2.2),
  ].join(''),
  salve: [c(16, 16, 12, '#6fbf4a'), p('M13 8h6v5h5v6h-5v5h-6v-5H8v-6h5z', '#f3e3c0')].join(''),
  caltrops: [
    p('M4 22h24v4H4z', '#7d776f'),
    p('M6 22l2.5-8 2.5 8 2.5-8 2.5 8 2.5-8 2.5 8 2.5-8 2.5 8z', '#d6e2ea'),
    p('M14 6h4v6h-4z', '#6fbf4a'), p('M12 9c2-3 6-3 8 0', 'none'),
  ].join(''),
  fieldGun: [
    p('M6 27l4-8h12l4 8z', '#b07a43'), p('M9 18l12-7 3 4-12 7z', '#5d7080'), c(23, 13, 2, '#2b1d12'),
    c(13, 22, 3, '#7a4f28'),
  ].join(''),
};

/** All icons: name → SVG content (viewBox 0 0 32 32). */
export const ICONS = {
  ...RES, ...GLYPH, ...EMBLEM,
  ...Object.fromEntries(Object.entries(WEATHER).map(([k, v]) => [`weather-${k}`, v])),
  ...Object.fromEntries(Object.entries(BUILDING).map(([k, v]) => [`b-${k}`, v])),
  ...Object.fromEntries(Object.entries(CATEGORY).map(([k, v]) => [`cat-${k}`, v])),
  ...Object.fromEntries(Object.entries(UNIT).map(([k, v]) => [`u-${k}`, v])),
  ...Object.fromEntries(Object.entries(HERO).map(([k, v]) => [`hero-${k}`, v])),
  ...Object.fromEntries(Object.entries(ABILITY).map(([k, v]) => [`ab-${k}`, v])),
};

// Bridge and decorations (own file)
Object.assign(ICONS, EXTRA_ICONS);

/** Icon names drawn in a single colour (currentColor). */
export const GLYPHS = new Set(Object.keys(GLYPH));

export const iconForBuilding = (type) => (ICONS[`b-${type}`] ? `b-${type}` : 'cat-home');
export const iconForLine = (line) => (ICONS[`u-${line}`] ? `u-${line}` : 'soldiers');
export const iconForHero = (hero) => (ICONS[`hero-${hero}`] ? `hero-${hero}` : 'crown');
export const iconForAbility = (id) => (ICONS[`ab-${id}`] ? `ab-${id}` : 'target');
export const iconForWeather = (state) => (ICONS[`weather-${state}`] ? `weather-${state}` : 'weather-summer');
/** Technology line (0–3) → icon */
export const TECH_LINE_ICONS = ['scroll', 'cat-home', 'research', 'cat-military'];
