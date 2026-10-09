// Tracks and items in the rendering: texel packing (threshold, axis of the footprints, fog), instance lists, size.

import { describe, it, expect } from 'vitest';
import { packTracks, trackShade, TRACK_RAMP } from '../../src/render/ground.js';
import { itemInstances, itemScale } from '../../src/render/items.js';
import { TileMap } from '../../src/sim/map.js';

const W = 6, H = 5;
const strengths = (cells) => {
  const t = new Uint8Array(W * H);
  for (const [x, y, s] of cells) t[y * W + x] = s;
  return t;
};
const texel = (out, x, y) => [out[(y * W + x) * 4], out[(y * W + x) * 4 + 1]];

describe('Track texture', () => {
  it('shade: nothing below the threshold, 40 % at the threshold, full after the ramp', () => {
    expect(trackShade(0, 1)).toBe(0);
    expect(trackShade(7, 8)).toBe(0);
    expect(trackShade(8, 8)).toBe(Math.round(255 * 0.4));
    expect(trackShade(8 + TRACK_RAMP, 8)).toBe(255);
    expect(trackShade(48, 1)).toBe(255);
  });

  it('packs strength and the axis of the footprints from the neighbours', () => {
    // a row from west to east, a column from north to south, a diagonal
    const t = strengths([[0, 0, 9], [1, 0, 9], [2, 0, 9], [4, 1, 9], [4, 2, 9], [4, 3, 9], [0, 2, 9], [1, 3, 9], [2, 4, 9], [5, 4, 3]]);
    const out = new Uint8Array(W * H * 4);
    const rows = packTracks(t, out, { W, H, threshold: 8 });
    expect(rows).toEqual({ y0: 0, y1: 4 });
    expect(texel(out, 1, 0)).toEqual([trackShade(9, 8), 0]);   // east–west
    expect(texel(out, 4, 2)).toEqual([trackShade(9, 8), 85]);  // north–south
    expect(texel(out, 1, 3)).toEqual([trackShade(9, 8), 255]); // north-west–south-east
    // below the summer threshold: no track in the picture; in winter (threshold 1) it is one
    expect(texel(out, 5, 4)).toEqual([0, 0]);
    expect(packTracks(t, out, { W, H, threshold: 8 })).toBe(null); // nothing changed, nothing to upload
    expect(packTracks(t, out, { W, H, threshold: 1 })).toEqual({ y0: 0, y1: 4 }); // all shades change
    expect(texel(out, 5, 4)[0]).toBeGreaterThan(0);
  });

  it('fog: unexplored tiles show nothing, explored ones keep the last seen state', () => {
    const out = new Uint8Array(W * H * 4);
    const explored = new Uint8Array(W * H).fill(1), visible = new Uint8Array(W * H).fill(1);
    explored[0] = 0;
    packTracks(strengths([[0, 0, 20], [3, 3, 20]]), out, { W, H, threshold: 8, visible, explored });
    expect(texel(out, 0, 0)[0]).toBe(0);
    expect(texel(out, 3, 3)[0]).toBe(trackShade(20, 8));
    // the player looks away; the track fades in the simulation – the picture keeps what was seen
    visible[3 * W + 3] = 0;
    expect(packTracks(strengths([]), out, { W, H, threshold: 8, visible, explored })).toBe(null);
    expect(texel(out, 3, 3)[0]).toBe(trackShade(20, 8));
    // a new track out of sight is not revealed either
    expect(packTracks(strengths([[3, 3, 40]]), out, { W, H, threshold: 8, visible, explored })).toBe(null);
  });
});

describe('Items in the picture', () => {
  it('instances per kind on tile centres, sorted; only explored tiles', () => {
    const m = new TileMap(8, 8);
    m.items.set(m.idx(5, 2), 'flower');
    m.items.set(m.idx(1, 2), 'coin');
    m.items.set(m.idx(3, 0), 'coin');
    const all = itemInstances(m);
    expect(all.coin.map((c) => [c.x, c.z])).toEqual([[3.5, 0.5], [1.5, 2.5]]);
    expect(all.flower.map((c) => [c.x, c.z])).toEqual([[5.5, 2.5]]);
    const seen = itemInstances(m, (x, z) => z > 1);
    expect(seen.coin.length).toBe(1);
    expect(seen.flower.length).toBe(1);
    // same tile, same seed (turning angle stays the same after a rebuild)
    expect(itemInstances(m).coin[0].seed).toBe(all.coin[0].seed);
  });

  it('grow when the camera is far away (overview, phones), in steps', () => {
    expect(itemScale(10)).toBe(1);
    expect(itemScale(24)).toBe(1.5);
    expect(itemScale(80)).toBe(1.8);
  });
});
