// Right click with the selection: what it would do (commands, walk marker, cursor) – one source for the
// command itself and for the cursor that announces it beforehand.
import { describe, it, expect } from 'vitest';
import { Engine } from '../../src/game/Engine.js';
import { cursorCss, CURSOR_KINDS } from '../../src/game/cursors.js';

const W = 12;
function fake({ sel = [1], pick = null, ground = { x: 8.4, z: 8.6 } } = {}) {
  const owner = new Array(W * W).fill(0);
  const ents = new Map([
    [1, { id: 1, kind: 'unit', owner: 0 }],
    [5, { id: 5, kind: 'tree', x: 3, y: 3 }],
    [6, { id: 6, kind: 'pile', x: 6, y: 3 }],
    [7, { id: 7, kind: 'building', owner: 0, done: false, x: 2, y: 8, w: 2, h: 2 }],
  ]);
  owner[3 * W + 3] = 5; owner[3 * W + 6] = 6;
  for (const [x, y] of [[2, 8], [3, 8], [2, 9], [3, 9]]) owner[y * W + x] = 7;
  const map = { owner, idx: (x, y) => y * W + x, inBounds: (x, y) => x >= 0 && y >= 0 && x < W && y < W, walkable: (x, y) => !owner[y * W + x] };
  const marks = [];
  const e = Object.create(Engine.prototype);
  Object.assign(e, {
    sim: { map, entities: ents }, player: 0, selected: new Set(sel), attackMode: false, queue: [], emitUi() {},
    renderer: { pickEntity: () => pick, pickGround: () => ground, orderMarker: (x, z) => marks.push([x, z]) },
  });
  return { e, marks };
}

describe('planCommandAt', () => {
  it('free ground: walk, with a marker and the normal cursor', () => {
    const { e, marks } = fake();
    const plan = e.planCommandAt(0, 0);
    expect(plan.cmds).toEqual([{ type: 'move', units: [1], x: 8, y: 8 }]);
    expect(plan.cursor).toBeNull();
    expect(e.queue).toEqual([]); // planning issues nothing
    expect(e.commandAt(0, 0)).toBe(true);
    expect(marks).toEqual([[8.4, 8.6]]);
  });

  it('tree: axe, pile: pickaxe, construction site: hammer, all without a marker', () => {
    for (const [ground, cursor, target] of [[{ x: 3.5, z: 3.6 }, 'chop', 5], [{ x: 6.4, z: 3.5 }, 'mine', 6], [{ x: 2.5, z: 8.5 }, 'build', 7]]) {
      const { e, marks } = fake({ ground });
      const plan = e.planCommandAt(0, 0);
      expect(plan.cursor).toBe(cursor);
      expect(plan.cmds).toEqual([{ type: 'assignWork', units: [1], target }]);
      e.commandAt(0, 0);
      expect(marks).toEqual([]);
    }
  });

  it('without a selection nothing happens and the cursor stays normal', () => {
    const { e } = fake({ sel: [] });
    expect(e.planCommandAt(0, 0)).toEqual({ cmds: [], walk: null, cursor: null });
  });
});

describe('cursorCss', () => {
  it('own SVG cursor with hot spot per kind, normal pointer otherwise', () => {
    expect(CURSOR_KINDS).toEqual(['attack', 'chop', 'mine', 'build']);
    for (const k of CURSOR_KINDS) expect(cursorCss(k)).toMatch(/^url\("data:image\/svg\+xml,.+"\) \d+ \d+, pointer$/);
    expect(cursorCss(null)).toBe('');
  });
});
