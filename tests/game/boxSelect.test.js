import { describe, it, expect } from 'vitest';
import { dragRect, boxSelectable, unitsInBox } from '../../src/game/boxSelect.js';

const ents = [
  { id: 1, kind: 'unit', owner: 0, sx: 10, sy: 10 },
  { id: 2, kind: 'leader', owner: 0, sx: 50, sy: 50 },
  { id: 3, kind: 'hero', owner: 0, sx: 100, sy: 100 }, // on the edge
  { id: 4, kind: 'unit', owner: 1, sx: 20, sy: 20 }, // foreign
  { id: 5, kind: 'soldier', owner: 0, sx: 30, sy: 30 }, // soldiers come with their captain
  { id: 6, kind: 'building', owner: 0, sx: 40, sy: 40 },
  { id: 7, kind: 'unit', owner: 0, sx: 60, sy: 60, behind: true }, // behind the camera
  { id: 8, kind: 'unit', owner: 0, sx: 101, sy: 50 }, // just outside
];
const project = (e) => ({ x: e.sx, y: e.sy, behind: !!e.behind });

describe('selection box', () => {
  it('normalises the rectangle in every drag direction', () => {
    const r = { left: 10, top: 20, right: 110, bottom: 70, width: 100, height: 50 };
    expect(dragRect(10, 20, 110, 70)).toEqual(r);
    expect(dragRect(110, 70, 10, 20)).toEqual(r);
    expect(dragRect(110, 20, 10, 70)).toEqual(r);
    expect(dragRect(5, 5, 5, 5)).toEqual({ left: 5, top: 5, right: 5, bottom: 5, width: 0, height: 0 });
  });

  it('catches own serfs, captains and heroes inside (edges included)', () => {
    expect(unitsInBox(ents, 0, project, dragRect(0, 0, 100, 100))).toEqual([1, 2, 3]);
    expect(unitsInBox(ents, 0, project, dragRect(45, 45, 55, 55))).toEqual([2]);
    expect(unitsInBox(ents, 1, project, dragRect(0, 0, 100, 100))).toEqual([4]);
    expect(unitsInBox(ents, 0, project, dragRect(200, 200, 300, 300))).toEqual([]);
  });

  it('projects only figures the box can catch', () => {
    const seen = [];
    unitsInBox(ents, 0, (e) => { seen.push(e.id); return project(e); }, dragRect(0, 0, 100, 100));
    expect(seen).toEqual([1, 2, 3, 7, 8]);
    expect(boxSelectable({ kind: 'soldier', owner: 0 }, 0)).toBe(false);
    expect(boxSelectable({ kind: 'unit', owner: 0, militia: true }, 0)).toBe(true);
  });

  it('stays cheap with many figures (budget for a whole crowd)', () => {
    // 20 000 entities, half of them own figures: one pass must stay far below a frame
    const many = [];
    for (let i = 0; i < 20000; i++) many.push({ id: i, kind: i % 4 === 0 ? 'soldier' : 'unit', owner: i % 2, sx: i % 1440, sy: (i * 7) % 900 });
    const rect = dragRect(200, 100, 900, 700);
    unitsInBox(many, 0, project, rect); // warm-up (JIT)
    const runs = 20, t0 = performance.now();
    let n = 0;
    for (let k = 0; k < runs; k++) n = unitsInBox(many, 0, project, rect).length;
    const ms = (performance.now() - t0) / runs;
    expect(n).toBeGreaterThan(1000);
    expect(ms).toBeLessThan(8);
  });
});
