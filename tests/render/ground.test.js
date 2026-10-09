// Tracks and items in the rendering: texel packing (stages of grass and snow, axis of the footprints, fog), instance
// lists, size.

import { describe, it, expect } from 'vitest';
import { packTracks, trackShade, trackStages, TRACK_SHADE } from '../../src/render/ground.js';
import { BALANCE } from '../../src/sim/data/balance.js';
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
  const grass = trackStages(BALANCE.ground.tracks.grass);
  const snow = trackStages(BALANCE.ground.tracks.snow);

  it('shade: the stages of the ground map onto fixed values for the shader', () => {
    const G = BALANCE.ground.tracks.grass, S = BALANCE.ground.tracks.snow;
    expect(trackShade(0, grass)).toBe(0);
    expect(trackShade(G.faint - 1, grass)).toBe(0);
    expect(trackShade(G.faint, grass)).toBe(TRACK_SHADE.faint);   // barely visible
    expect(trackShade(G.trodden, grass)).toBe(TRACK_SHADE.trodden);
    expect(trackShade(G.path, grass)).toBe(TRACK_SHADE.path);
    expect(trackShade(G.full, grass)).toBe(255);
    expect(trackShade(255, grass)).toBe(255);
    // rising in between
    expect(trackShade(G.trodden + 10, grass)).toBeGreaterThan(TRACK_SHADE.trodden);
    expect(trackShade(G.trodden + 10, grass)).toBeLessThan(TRACK_SHADE.path);
    // snow: the first footprint is at once "trodden" (no faint stage), the lane from the path stage on
    expect(trackShade(S.trodden - 1, snow)).toBe(0);
    expect(trackShade(S.gain, snow)).toBeGreaterThanOrEqual(TRACK_SHADE.trodden);
    expect(trackShade(S.path, snow)).toBe(TRACK_SHADE.path);
    // a level threshold moves "trodden" (and "faint" with it when it lies above)
    expect(trackStages(BALANCE.ground.tracks.grass, 1)).toMatchObject({ faint: 1, trodden: 1 });
  });

  it('packs strength and the axis of the footprints from the neighbours', () => {
    // a row from west to east, a column from north to south, a diagonal
    const v = 60, low = 4;
    const t = strengths([[0, 0, v], [1, 0, v], [2, 0, v], [4, 1, v], [4, 2, v], [4, 3, v], [0, 2, v], [1, 3, v], [2, 4, v], [5, 4, low]]);
    const out = new Uint8Array(W * H * 4);
    const rows = packTracks(t, out, { W, H, stages: grass });
    expect(rows).toEqual({ y0: 0, y1: 4 });
    expect(texel(out, 1, 0)).toEqual([trackShade(v, grass), 0]);   // east–west
    expect(texel(out, 4, 2)).toEqual([trackShade(v, grass), 85]);  // north–south
    expect(texel(out, 1, 3)).toEqual([trackShade(v, grass), 255]); // north-west–south-east
    // below the faint stage of grass: nothing in the picture; with a level threshold of 1 it is one
    expect(texel(out, 5, 4)).toEqual([0, 0]);
    expect(packTracks(t, out, { W, H, stages: grass })).toBe(null); // nothing changed, nothing to upload
    expect(packTracks(t, out, { W, H, stages: snow })).toEqual({ y0: 0, y1: 4 }); // other ground: shades change
    expect(packTracks(t, out, { W, H, stages: trackStages(BALANCE.ground.tracks.snow, 1) })).not.toBe(null);
    expect(texel(out, 5, 4)[0]).toBeGreaterThan(0);
  });

  it('fog: unexplored tiles show nothing, explored ones keep the last seen state', () => {
    const out = new Uint8Array(W * H * 4);
    const explored = new Uint8Array(W * H).fill(1), visible = new Uint8Array(W * H).fill(1);
    explored[0] = 0;
    packTracks(strengths([[0, 0, 80], [3, 3, 80]]), out, { W, H, stages: grass, visible, explored });
    expect(texel(out, 0, 0)[0]).toBe(0);
    expect(texel(out, 3, 3)[0]).toBe(trackShade(80, grass));
    // the player looks away; the track fades in the simulation – the picture keeps what was seen
    visible[3 * W + 3] = 0;
    expect(packTracks(strengths([]), out, { W, H, stages: grass, visible, explored })).toBe(null);
    expect(texel(out, 3, 3)[0]).toBe(trackShade(80, grass));
    // a new track out of sight is not revealed either
    expect(packTracks(strengths([[3, 3, 200]]), out, { W, H, stages: grass, visible, explored })).toBe(null);
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
