import { describe, it, expect } from 'vitest';
import { isDoubleClick, sameTypeKey, visibleSameType, DOUBLE_CLICK_MS, DOUBLE_CLICK_PX } from '../../src/game/sameType.js';

// Screen 0…100 × 0…100; figures simply stand at (px, py) on the screen
const rect = { left: 0, top: 0, right: 100, bottom: 100 };
const project = (e) => ({ x: e.px, y: e.py, behind: !!e.behind });

const ents = [
  { id: 1, kind: 'unit', owner: 0, px: 10, py: 10 },
  { id: 2, kind: 'unit', owner: 0, px: 90, py: 50 },
  { id: 3, kind: 'unit', owner: 0, px: 150, py: 50 }, // outside
  { id: 4, kind: 'unit', owner: 0, px: 20, py: 20, militia: true },
  { id: 5, kind: 'unit', owner: 1, px: 30, py: 30 }, // enemy
  { id: 6, kind: 'leader', def: 'sword1', owner: 0, px: 40, py: 40 },
  { id: 7, kind: 'leader', def: 'sword1', owner: 0, px: 60, py: 60 },
  { id: 8, kind: 'leader', def: 'bow1', owner: 0, px: 50, py: 50 },
  { id: 9, kind: 'leader', def: 'sword1', owner: 1, px: 45, py: 45 },
  { id: 10, kind: 'soldier', leader: 6, owner: 0, px: 41, py: 41 },
  { id: 11, kind: 'hero', hero: 'a', owner: 0, px: 70, py: 70 },
  { id: 12, kind: 'hero', hero: 'b', owner: 0, px: 80, py: 80 },
  { id: 13, kind: 'unit', owner: 0, px: 50, py: 50, behind: true }, // behind the camera
  { id: 14, kind: 'building', type: 'headquarters', owner: 0, px: 50, py: 50 },
];

describe('Double click: select the same kind', () => {
  it('serfs: only own, visible, without militia', () => {
    expect(visibleSameType(ents, 0, ents[0], project, rect)).toEqual([1, 2]);
  });

  it('captains: only the same unit type, no soldiers, no enemies', () => {
    expect(visibleSameType(ents, 0, ents[5], project, rect)).toEqual([6, 7]);
    expect(visibleSameType(ents, 0, ents[7], project, rect)).toEqual([8]);
  });

  it('militia and heroes are one kind each', () => {
    expect(visibleSameType(ents, 0, ents[3], project, rect)).toEqual([4]);
    expect(visibleSameType(ents, 0, ents[10], project, rect)).toEqual([11, 12]);
  });

  it('edge counts as visible, the clicked figure is always included', () => {
    const edge = { left: 10, top: 10, right: 90, bottom: 50 };
    expect(visibleSameType(ents, 0, ents[0], project, edge)).toEqual([1, 2]);
    expect(visibleSameType(ents, 0, ents[2], project, rect)).toEqual([1, 2, 3]);
  });

  it('foreign figures, buildings and nothing yield no selection', () => {
    expect(visibleSameType(ents, 0, ents[4], project, rect)).toEqual([]);
    expect(visibleSameType(ents, 0, ents[13], project, rect)).toEqual([]);
    expect(visibleSameType(ents, 0, null, project, rect)).toEqual([]);
    expect(sameTypeKey(ents[9])).toBeNull();
  });

  it('detects the double click by time and distance', () => {
    const a = { x: 100, y: 100, at: 1000 };
    expect(isDoubleClick(null, a)).toBe(false);
    expect(isDoubleClick(a, { x: 105, y: 98, at: 1000 + DOUBLE_CLICK_MS - 1 })).toBe(true);
    expect(isDoubleClick(a, { x: 100, y: 100, at: 1000 + DOUBLE_CLICK_MS })).toBe(false);
    expect(isDoubleClick(a, { x: 100 + DOUBLE_CLICK_PX + 1, y: 100, at: 1100 })).toBe(false);
  });
});
