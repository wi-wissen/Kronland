import { describe, it, expect, afterEach } from 'vitest';
import {
  playerColorIndex, playerHex, playerCss, setPlayerColors, playerColorState,
  PLAYER_COLOR_HEX, PLAYER_COLOR_CSS, PLAYER_COLOR_IDS,
} from '../../src/render/playerColors.js';
import { PLAYER_COLORS, teamMaterial } from '../../src/render/models.js';
import { Sim } from '../../src/sim/sim.js';

const sel = (color, human = 0) => ({ human, color });
const indices = (s, n) => Array.from({ length: n }, (_, o) => playerColorIndex(o, s));

afterEach(() => setPlayerColors({ human: 0, color: 0 }));

describe('Player colours', () => {
  it('default = previous behaviour (players 0–3: blue, red, green, ochre)', () => {
    expect(indices(sel(0), 4)).toEqual([0, 1, 2, 3]);
    expect(playerColorState()).toEqual({ human: 0, color: 0 });
    for (let o = 0; o < 4; o++) {
      expect(playerHex(o)).toBe(PLAYER_COLOR_HEX[o]);
      expect(playerCss(o)).toBe(PLAYER_COLOR_CSS[o]);
    }
    expect(PLAYER_COLORS).toBe(PLAYER_COLOR_HEX);
    expect(PLAYER_COLOR_IDS).toHaveLength(PLAYER_COLOR_HEX.length);
  });

  it('swaps with the player who would otherwise have the chosen colour', () => {
    expect(indices(sel(1), 4)).toEqual([1, 0, 2, 3]); // red: player 1 becomes blue
    expect(indices(sel(2), 4)).toEqual([2, 1, 0, 3]);
    expect(indices(sel(3), 4)).toEqual([3, 1, 2, 0]);
    // human on another slot
    expect(indices(sel(0, 2), 4)).toEqual([2, 1, 0, 3]);
  });

  it('assigns no colour twice (up to 4 players) and never the human colour (also robbers, villages from player 4)', () => {
    for (let c = 0; c < 4; c++) for (let h = 0; h < 4; h++) {
      const s = sel(c, h);
      for (let n = 1; n <= 4; n++) expect(new Set(indices(s, n)).size).toBe(n);
      const all = indices(s, 9);
      expect(all[h]).toBe(c);
      all.forEach((idx, o) => {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(4);
        if (o !== h) expect(idx).not.toBe(c);
      });
    }
    expect(playerColorIndex(-1)).toBe(-1);
  });

  it('setPlayerColors affects models and UI; invalid values fall back to blue', () => {
    setPlayerColors({ human: 0, color: 1 });
    expect(playerHex(0)).toBe(PLAYER_COLOR_HEX[1]);
    expect(playerHex(1)).toBe(PLAYER_COLOR_HEX[0]);
    expect(playerCss(0)).toBe(PLAYER_COLOR_CSS[1]);
    expect(playerCss(4)).toBe('#8a5cc0'); // extra colours of the minimap stay
    expect(playerCss(-1)).toBe('#8a8a8a');
    setPlayerColors({ human: 0, color: 9 });
    expect(playerColorState().color).toBe(0);
  });

  it('team-colour materials follow the colour, not the player number', () => {
    const src = { uuid: 'x', clone() { return { onBeforeCompile: null }; } };
    const blue0 = teamMaterial(src, 0);
    setPlayerColors({ human: 0, color: 1 });
    const red0 = teamMaterial(src, 0);
    expect(red0).not.toBe(blue0);
    expect(teamMaterial(src, 1)).toBe(blue0); // player 1 now has blue
  });

  it('does not change the sim state hash', () => {
    const run = (color) => {
      setPlayerColors({ human: 0, color });
      const sim = new Sim({ seed: 7, players: 2 });
      for (let i = 0; i < 30; i++) sim.step([]);
      return sim.hash();
    };
    expect(run(2)).toBe(run(0));
  });
});

describe('Player colour setting', () => {
  it('is validated, saved and only applied with applyPlayerColor', async () => {
    const { set, get, applyPlayerColor, DEFAULTS } = await import('../../src/ui/settings.js');
    expect(DEFAULTS.playerColor).toBe(0);
    set('playerColor', 7);
    expect(get('playerColor')).toBe(0);
    set('playerColor', 1);
    expect(get('playerColor')).toBe(1);
    expect(playerColorState().color).toBe(0); // not yet applied (takes effect from game start)
    applyPlayerColor();
    expect(playerColorState()).toEqual({ human: 0, color: 1 });
    set('playerColor', 0);
  });
});
