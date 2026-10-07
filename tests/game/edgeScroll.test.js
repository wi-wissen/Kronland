import { describe, it, expect } from 'vitest';
import { edgeDir, nextArmed, edgeScrollDir, EDGE_PX } from '../../src/game/edgeScroll.js';

// Split screen: game canvas 0…900, code panel (divider at 900) to the right, window 1440×900
const W = 1440, H = 900;
const R = { left: 0, top: 0, right: 900, bottom: 900 };
const at = (x, y, o = {}) => ({ x, y, buttons: 0, inGame: true, uiDrag: false, ...o });

describe('edgeDir', () => {
  it('pushes at all four edges of the canvas, inner edge included', () => {
    expect(edgeDir(2, 400, R, W, H)).toEqual([1, 0]);
    expect(edgeDir(898, 400, R, W, H)).toEqual([-1, 0]);
    expect(edgeDir(400, 1, R, W, H)).toEqual([0, 1]);
    expect(edgeDir(400, 897, R, W, H)).toEqual([0, -1]);
    expect(edgeDir(1, 1, R, W, H)).toEqual([1, 1]);
  });
  it('nothing in the middle or outside the canvas (over the code panel)', () => {
    expect(edgeDir(400, 400, R, W, H)).toEqual([0, 0]);
    expect(edgeDir(900, 400, R, W, H)).toEqual([0, 0]);
    expect(edgeDir(905, 400, R, W, H)).toEqual([0, 0]);
    expect(edgeDir(900 - 1 - EDGE_PX - 1, 400, R, W, H)).toEqual([0, 0]);
  });
});

describe('nextArmed / edgeScrollDir', () => {
  it('normal edge scrolling from the map to the edge', () => {
    let armed = nextArmed(true, at(400, 400), at(897, 400), R, W, H);
    expect(armed).toBe(true);
    expect(edgeScrollDir(at(897, 400), armed, R, W, H)).toEqual([-1, 0]);
    // coming in from outside the window straight into the strip also scrolls
    armed = nextArmed(true, null, at(1, 400), R, W, H);
    expect(edgeScrollDir(at(1, 400), armed, R, W, H)).toEqual([1, 0]);
  });

  it('no scrolling while a button is held or a UI drag runs', () => {
    expect(edgeScrollDir(at(897, 400, { buttons: 1 }), true, R, W, H)).toEqual([0, 0]);
    expect(edgeScrollDir(at(897, 400, { uiDrag: true }), true, R, W, H)).toEqual([0, 0]);
    expect(nextArmed(true, at(950, 400, { inGame: false }), at(500, 400, { uiDrag: true, buttons: 1, inGame: false }), R, W, H)).toBe(false);
  });

  it('dragging the divider: neither during nor after the drop', () => {
    // hover over the divider, press, drag left over the canvas (pointer captured by the divider), release
    let armed = true;
    let prev = at(905, 400, { inGame: false });
    const steps = [
      at(905, 400, { inGame: false, uiDrag: true, buttons: 1 }),
      at(700, 400, { inGame: false, uiDrag: true, buttons: 1 }),
      at(700, 400, { inGame: false }), // pointerup: target is still the divider
    ];
    for (const s of steps) { armed = nextArmed(armed, prev, s, R, W, H); expect(edgeScrollDir(s, armed, R, W, H)).toEqual([0, 0]); prev = s; }
    // after the drop the canvas ends at 700.4 (rounded panel width), the pointer at 700 is in its edge strip
    const R2 = { ...R, right: 700.4 };
    const s = at(699.8, 401);
    armed = nextArmed(armed, prev, s, R2, W, H);
    expect(armed).toBe(false);
    expect(edgeScrollDir(s, armed, R2, W, H)).toEqual([0, 0]);
    // back on the map and to the edge again: scrolls
    armed = nextArmed(armed, s, at(500, 400), R2, W, H);
    armed = nextArmed(armed, at(500, 400), at(698, 400), R2, W, H);
    expect(edgeScrollDir(at(698, 400), armed, R2, W, H)).toEqual([-1, 0]);
  });

  it('coming from the code panel into the edge strip does not scroll', () => {
    const armed = nextArmed(true, at(905, 400, { inGame: false }), at(897, 400), R, W, H);
    expect(armed).toBe(false);
    expect(edgeScrollDir(at(897, 400), armed, R, W, H)).toEqual([0, 0]);
  });

  it('a press outside the game area released over the canvas edge does not scroll', () => {
    let armed = nextArmed(true, at(400, 400), at(400, 400, { uiDrag: true, buttons: 1 }), R, W, H);
    armed = nextArmed(armed, at(400, 400, { uiDrag: true, buttons: 1 }), at(897, 400, { uiDrag: true, buttons: 1 }), R, W, H);
    armed = nextArmed(armed, at(897, 400, { uiDrag: true, buttons: 1 }), at(897, 400), R, W, H);
    expect(edgeScrollDir(at(897, 400), armed, R, W, H)).toEqual([0, 0]);
  });
});
