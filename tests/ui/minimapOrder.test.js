import { describe, it, expect } from 'vitest';
import { Engine, nearestWalkable } from '../../src/game/Engine.js';

/** Map 10×10, columns x < 5 impassable (water). */
const map = { inBounds: (x, y) => x >= 0 && y >= 0 && x < 10 && y < 10, walkable: (x) => x >= 5 };

function fake(sel) {
  const ents = new Map([[1, { id: 1, kind: 'unit', owner: 0 }], [2, { id: 2, kind: 'leader', owner: 0 }], [3, { id: 3, kind: 'unit', owner: 1 }]]);
  const e = Object.create(Engine.prototype);
  Object.assign(e, { sim: { map, entities: ents }, player: 0, selected: new Set(sel), attackMode: false, queue: [], emitUi() {} });
  return e;
}

describe('Minimap: move command to a tile', () => {
  it('takes the nearest walkable tile', () => {
    expect(nearestWalkable(map, 7, 3, 4)).toEqual({ x: 7, y: 3 });
    expect(nearestWalkable(map, 3, 3, 4)).toEqual({ x: 5, y: 3 });
    expect(nearestWalkable(map, 0, 0, 3)).toBeNull();
  });

  it('sends serfs and troops separately', () => {
    const e = fake([1, 2, 3]);
    expect(e.commandTile(2, 4)).toEqual({ x: 5, y: 4 });
    expect(e.queue).toEqual([
      { type: 'order', units: [2], order: 'move', x: 5, y: 4, player: 0 },
      { type: 'move', units: [1], x: 5, y: 4, player: 0 },
    ]);
  });

  it('attack mode becomes attack-move and is then ended', () => {
    const e = fake([2]);
    e.attackMode = true;
    e.commandTile(8, 8);
    expect(e.queue[0].order).toBe('attackMove');
    expect(e.attackMode).toBe(false);
  });

  it('without own selection no command', () => {
    const e = fake([3]);
    expect(e.commandTile(8, 8)).toBeNull();
    expect(e.queue).toEqual([]);
    expect(e.hasOrderable()).toBe(false);
  });
});
