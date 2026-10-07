// Layout of the code panel: split screen or sheet, width limits, stored settings – src/ui/script/splitLayout.js.
import { describe, it, expect } from 'vitest';
import { layoutMode, clampWidth, panelWidth, fracFromPointer, loadSplit, saveSplit, SPLIT_KEY, SPLIT_DEFAULT, PANEL_MIN, GAME_MIN, STRIP_W } from '../../src/ui/script/splitLayout.js';

const memory = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};

describe('layoutMode', () => {
  it('split on desktop and landscape tablets, sheet on phones and portrait tablets', () => {
    expect(layoutMode(1440, 900)).toBe('split');
    expect(layoutMode(1024, 768)).toBe('split');
    expect(layoutMode(412, 915)).toBe('sheet'); // Pixel 7
    expect(layoutMode(915, 412)).toBe('sheet'); // phone landscape (too low)
    expect(layoutMode(820, 1180)).toBe('sheet'); // tablet portrait
    expect(layoutMode(700, 900)).toBe('sheet');
  });
});

describe('clampWidth', () => {
  it('keeps the panel and the game usable', () => {
    expect(clampWidth(100, 1440)).toBe(PANEL_MIN);
    expect(clampWidth(5000, 1440)).toBe(1440 - GAME_MIN);
    expect(clampWidth(600.4, 1440)).toBe(600);
    // Window too small for both: the panel keeps its minimum
    expect(clampWidth(500, 600)).toBe(PANEL_MIN);
    expect(clampWidth(NaN, 1000)).toBe(Math.round(1000 * SPLIT_DEFAULT));
  });

  it('panel width from the stored share, collapsed only the strip', () => {
    expect(panelWidth({ frac: 0.5, collapsed: false }, 1440)).toBe(720);
    expect(panelWidth({ frac: 0.9, collapsed: false }, 1440)).toBe(1440 - GAME_MIN);
    expect(panelWidth({ frac: 0.5, collapsed: true }, 1440)).toBe(STRIP_W);
  });

  it('share after dragging the divider', () => {
    expect(fracFromPointer(720, 1440)).toBeCloseTo(0.5);
    expect(fracFromPointer(10, 1440)).toBeCloseTo((1440 - GAME_MIN) / 1440);
    expect(fracFromPointer(1430, 1440)).toBeCloseTo(PANEL_MIN / 1440);
  });
});

describe('stored settings', () => {
  it('round trip and defaults for broken values', () => {
    const s = memory();
    expect(loadSplit(s)).toEqual({ frac: SPLIT_DEFAULT, collapsed: false });
    saveSplit({ frac: 0.53219, collapsed: true }, s);
    expect(JSON.parse(s.m.get(SPLIT_KEY))).toEqual({ frac: 0.532, collapsed: true });
    expect(loadSplit(s)).toEqual({ frac: 0.532, collapsed: true });
    expect(loadSplit(memory({ [SPLIT_KEY]: '{oops' }))).toEqual({ frac: SPLIT_DEFAULT, collapsed: false });
    expect(loadSplit(memory({ [SPLIT_KEY]: '{"frac":3}' })).frac).toBe(SPLIT_DEFAULT);
    // Storage that throws (private mode)
    const bad = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } };
    expect(loadSplit(bad)).toEqual({ frac: SPLIT_DEFAULT, collapsed: false });
    expect(() => saveSplit({ frac: 0.5, collapsed: false }, bad)).not.toThrow();
  });
});
