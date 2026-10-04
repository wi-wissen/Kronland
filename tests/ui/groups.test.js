import { describe, it, expect } from 'vitest';
import { ControlGroups, DOUBLE_MS, GROUP_COUNT } from '../../src/game/groups.js';

describe('Control groups', () => {
  it('remembers a selection and only returns living members', () => {
    const g = new ControlGroups();
    g.assign(1, [5, 7, 7, 9]);
    expect(g.members(1, () => true)).toEqual([5, 7, 9]);
    expect(g.members(1, (id) => id !== 7)).toEqual([5, 9]);
    // all fallen: group disappears
    expect(g.members(1, () => false)).toEqual([]);
    expect(g.numbers()).toEqual([]);
  });

  it('finds the group for a selection and the next free number', () => {
    const g = new ControlGroups();
    g.assign(1, [3, 4]);
    g.assign(3, [8]);
    expect(g.find([4, 3])).toBe(1);
    expect(g.find([3])).toBe(0);
    expect(g.nextFree()).toBe(2);
    for (let n = 1; n <= GROUP_COUNT; n++) g.assign(n, [n]);
    expect(g.nextFree()).toBe(0);
    // empty selection deletes, invalid numbers are ignored
    g.assign(2, []);
    g.assign(0, [1]);
    g.assign(10, [1]);
    expect(g.numbers()).toEqual([1, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('detects the double recall of the same group', () => {
    const g = new ControlGroups();
    expect(g.recall(1, 1000)).toBe(false);
    expect(g.recall(1, 1000 + DOUBLE_MS - 1)).toBe(true);
    expect(g.recall(2, 1100 + DOUBLE_MS)).toBe(false);
    expect(g.recall(2, 1100 + DOUBLE_MS * 3)).toBe(false);
  });
});
