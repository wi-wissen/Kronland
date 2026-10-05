// Player colours: ONE place for the mapping player number → colour (3D, models, minimap, UI).
// Rendering only: the simulation only knows player numbers; the colour choice changes neither state nor state hash.
// No dependencies (not even Three.js), so UI and tests can use it directly.
//
// Rule: every player has a default slot (player 0 → blue, 1 → red, 2 → green, 3 → ochre). If the human picks
// another colour, they swap with the player who otherwise owns that colour. Players from number 4 (e.g. bandits
// or villages in missions) get, in turn, only the three colours that are not the human's – so the human's colour
// is never assigned twice.

/** Colour names (i18n: set.color.<id>) in palette order. */
export const PLAYER_COLOR_IDS = ['blue', 'red', 'green', 'ochre'];
/** 3D colours (models, team areas of the figures). */
export const PLAYER_COLOR_HEX = [0x2f5d9e, 0xa8323a, 0x3d8a4a, 0xc08a2a];
/** The same colours for the UI (slightly lighter, as the models look in the light). */
export const PLAYER_COLOR_CSS = ['#3b6fbf', '#c03a3f', '#46a052', '#d79a2c'];
/** Additional UI colours for players 4 and 5 (minimap), unchanged as before. */
const EXTRA_CSS = ['#8a5cc0', '#4a4a4a'];
/** Colour for "no owner". */
export const NO_OWNER_HEX = 0x8a6a4a;
export const NO_OWNER_CSS = '#8a8a8a';

const N = PLAYER_COLOR_HEX.length;

/** Current choice: which player the human is and which colour they have. */
const state = { human: 0, color: 0 };

/**
 * Set the colour choice (before loading the models and building the renderer, i.e. at game start).
 * @param {{ human?: number, color?: number }} opts
 */
export function setPlayerColors({ human = 0, color = 0 } = {}) {
  state.human = Number.isInteger(human) && human >= 0 ? human : 0;
  state.color = Number.isInteger(color) && color >= 0 && color < N ? color : 0;
}

/** Current choice (copy). */
export const playerColorState = () => ({ ...state });

/** Default slot of a player without colour choice (players 0–3: own number; after that in turn without the human's slot). */
function defaultSlot(owner, human) {
  if (owner < N) return owner;
  const hs = human % N;
  const others = [];
  for (let s = 0; s < N; s++) if (s !== hs) others.push(s);
  return others[(owner - N) % others.length];
}

/**
 * Colour index (0…3) of a player, −1 without owner.
 * @param {number} owner
 * @param {{ human: number, color: number }} [sel] choice (default: the one set)
 */
export function playerColorIndex(owner, sel = state) {
  if (!(owner >= 0)) return -1;
  const hs = sel.human % N;
  if (owner === sel.human) return sel.color;
  const slot = defaultSlot(owner, sel.human);
  if (slot === sel.color) return hs; // swap: whoever would otherwise have the human's colour gets their default colour
  return slot;
}

/** 3D colour of a player. @param {number} owner */
export const playerHex = (owner) => (owner >= 0 ? PLAYER_COLOR_HEX[playerColorIndex(owner)] : NO_OWNER_HEX);

/** CSS colour of a player (minimap, selection card, preview images). @param {number} owner */
export function playerCss(owner) {
  if (!(owner >= 0)) return NO_OWNER_CSS;
  if (owner >= N && owner < N + EXTRA_CSS.length) return EXTRA_CSS[owner - N];
  return PLAYER_COLOR_CSS[playerColorIndex(owner)];
}
