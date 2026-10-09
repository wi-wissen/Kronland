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

  it('packs the stage, a smoothed field (round bends, diagonals) and the walking direction (doubled angle)', () => {
    const v = 120, low = 4;
    const big = 12;
    const t = new Uint8Array(big * big);
    const set = (x, y, s) => { t[y * big + x] = s; };
    for (let x = 0; x < 6; x++) set(x, 1, v);              // west–east
    for (let y = 3; y < 9; y++) set(10, y, v);             // north–south
    for (let i = 0; i < 6; i++) set(i, 4 + i, v);          // diagonal north-west → south-east
    set(8, 0, low);
    const out = new Uint8Array(big * big * 4);
    expect(packTracks(t, out, { W: big, H: big, stages: grass })).not.toBe(null);
    const px = (x, y) => [...out.subarray((y * big + x) * 4, (y * big + x) * 4 + 4)];
    const angle = (x, y) => { const [, g, , a] = px(x, y); return Math.round(Math.atan2((a - 128) / 127, (g - 128) / 127) / 2 * 180 / Math.PI); };
    // R: the stage of the path (strongest stage of the neighbourhood)
    expect(px(2, 1)[0]).toBe(trackShade(v, grass));
    // direction: along the row 0°, along the column ±90°, along the diagonal 45° (x east, y south)
    expect(angle(2, 1)).toBe(0);
    expect(Math.abs(angle(10, 5))).toBe(90);
    expect(angle(2, 6)).toBe(45);
    // B: the middle of a straight path keeps about its strength, the corners between diagonal tiles fill in
    // (no staircase), a tile far away stays empty
    expect(px(2, 1)[2]).toBeGreaterThanOrEqual(Math.floor(px(2, 1)[0] * 0.9));
    expect(px(3, 5)[2]).toBeGreaterThan(0);  // beside the diagonal, between two of its tiles
    expect(px(3, 5)[0]).toBe(trackShade(v, grass)); // R: strongest stage nearby (the path's stage across its width)
    expect(px(8, 10)[2]).toBe(0);
    // below the faint stage of grass: nothing in the picture
    expect(px(8, 0)[0]).toBe(0);
    expect(packTracks(t, out, { W: big, H: big, stages: grass })).toBe(null); // nothing changed, nothing to upload
    expect(packTracks(t, out, { W: big, H: big, stages: snow })).not.toBe(null); // other ground: shades change
    expect(packTracks(t, out, { W: big, H: big, stages: trackStages(BALANCE.ground.tracks.snow, 1) })).not.toBe(null);
    expect(px(8, 0)[0]).toBeGreaterThan(0);
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

describe('Track texture cost', () => {
  it('a refill of a 256×256 map with paths stays cheap; rows far from any track are skipped', () => {
    const W2 = 256, t = new Uint8Array(W2 * W2);
    // a network of winding paths over the whole map (worst realistic case: much more than a real settlement)
    for (let y = 0; y < W2; y += 8) for (let x = 0; x < W2; x++) t[((y + ((x >> 3) & 3)) % W2) * W2 + x] = 200;
    const out = new Uint8Array(W2 * W2 * 4);
    packTracks(t, out, { W: W2, H: W2, stages: trackStages(BALANCE.ground.tracks.grass) });
    const t0 = performance.now();
    for (let i = 0; i < 10; i++) { t[i * 1031] ^= 64; packTracks(t, out, { W: W2, H: W2, stages: trackStages(BALANCE.ground.tracks.grass) }); }
    expect((performance.now() - t0) / 10).toBeLessThan(60);
    // an empty map after the tracks are gone: nothing left in the texture
    expect(packTracks(new Uint8Array(W2 * W2), out, { W: W2, H: W2, stages: trackStages(BALANCE.ground.tracks.grass) })).not.toBe(null);
    expect(out.some((v, i) => (i % 4 === 0 || i % 4 === 2) && v > 0)).toBe(false);
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
