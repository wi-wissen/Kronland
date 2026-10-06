// Figure pipeline: marker colour, normal smoothing, tool geometry.
import { describe, it, expect } from 'vitest';
import { markerWeight, smoothNormals, isGreenish, toBrown, violetToMarker } from '../../scripts/asset-gen/postprocess.mjs';
import { rgbToLab } from '../../scripts/asset-gen/palette.mjs';
import { buildTool, TOOLS } from '../../scripts/asset-gen/props.mjs';

describe('markerWeight', () => {
  it('recognises magenta and the carmine shifted by Meshy', () => {
    expect(markerWeight(255, 0, 255)).toBe(1);
    expect(markerWeight(224, 0, 128)).toBe(1);
    expect(markerWeight(160, 0, 64)).toBeGreaterThan(0.9);
    expect(markerWeight(224, 128, 160)).toBeGreaterThan(0.5); // highlight
  });
  it('leaves skin, lips, leather, grey and green untouched', () => {
    expect(markerWeight(230, 160, 125)).toBe(0); // skin
    expect(markerWeight(170, 50, 50)).toBe(0);   // lips
    expect(markerWeight(120, 70, 40)).toBe(0);   // leather
    expect(markerWeight(128, 128, 128)).toBe(0);
    expect(markerWeight(80, 100, 50)).toBe(0);
    expect(markerWeight(30, 0, 30)).toBe(0);     // too dark
  });
});

describe('Green → brown', () => {
  const hue = (lab) => (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
  it('recognises green and olive, not brown, ochre, skin, grey', () => {
    expect(isGreenish(rgbToLab(90, 110, 50))).toBe(true);  // olive
    expect(isGreenish(rgbToLab(60, 140, 60))).toBe(true);  // green
    expect(isGreenish(rgbToLab(120, 80, 45))).toBe(false); // brown
    expect(isGreenish(rgbToLab(192, 138, 42))).toBe(false); // ochre
    expect(isGreenish(rgbToLab(230, 175, 140))).toBe(false); // skin
    expect(isGreenish(rgbToLab(128, 130, 126))).toBe(false); // almost grey
  });
  it('only turns the hue: lightness stays, chroma at most maxChroma', () => {
    const lab = rgbToLab(60, 140, 60);
    const b = toBrown(lab, { hue: 62, maxChroma: 38 });
    expect(b[0]).toBe(lab[0]);
    expect(hue(b)).toBeCloseTo(62, 5);
    expect(Math.hypot(b[1], b[2])).toBeLessThanOrEqual(38 + 1e-9);
    const dull = rgbToLab(100, 108, 90);
    expect(Math.hypot(...toBrown(dull).slice(1))).toBeCloseTo(Math.hypot(dull[1], dull[2]), 9);
    expect(isGreenish(b)).toBe(false);
  });
});

describe('smoothNormals', () => {
  it('averages normals over vertices at the same position (UV seam)', () => {
    // two triangles at a right angle, edge doubled (separate vertices as at a UV seam)
    const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1, /**/ 0, 0, 0, 0, 1, 0, 1, 0, 0]);
    const n = smoothNormals(pos, [0, 2, 1, 3, 4, 5]);
    // vertex (0,0,0) occurs twice → same normal
    expect([...n.slice(0, 3)]).toEqual([...n.slice(9, 12)]);
    expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1, 5);
  });
});

describe('Tools', () => {
  it('yield triangles with normals and UV into the colour field', () => {
    for (const name of Object.keys(TOOLS)) {
      const g = buildTool(name, () => [0.25, 0.97]);
      expect(g.pos.length % 9, name).toBe(0);
      expect(g.nrm.length).toBe(g.pos.length);
      expect(g.uv.length / 2).toBe(g.pos.length / 3);
      expect(g.pos.length / 9).toBeLessThan(200); // keep small
    }
  });
});

describe('violetToMarker (Meshy violet → team area)', () => {
  it('turns strong violet into the marker range, leaves skin, hair and leather', () => {
    const px = [[190, 20, 230], [150, 10, 190], [230, 160, 125], [220, 180, 90], [120, 70, 40], [60, 60, 200], [100, 90, 110]];
    const d = Buffer.from(px.flat());
    violetToMarker(d, 275);
    const out = [];
    for (let i = 0; i < d.length; i += 3) out.push([d[i], d[i + 1], d[i + 2]]);
    expect(markerWeight(...px[0])).toBeLessThan(0.5); // before: only partly team colour
    expect(markerWeight(...out[0])).toBe(1);
    expect(markerWeight(...out[1])).toBe(1);
    expect(Math.max(...out[0])).toBe(230); // lightness stays
    expect(out.slice(2)).toEqual(px.slice(2)); // skin, hair, leather, blue (240°), grey unchanged
  });
});

import { kmeans, rgbToLab, labToRgb, paletteize } from '../../scripts/asset-gen/palette.mjs';
import { markerWeight as mw } from '../../scripts/asset-gen/postprocess.mjs';

describe('Palette style', () => {
  it('Lab there and back', () => {
    for (const c of [[200, 40, 60], [10, 120, 230], [128, 128, 128]]) {
      const back = labToRgb(...rgbToLab(...c));
      back.forEach((v, i) => expect(Math.abs(v - c[i])).toBeLessThanOrEqual(1));
    }
  });
  it('k-means is deterministic and separates clear groups', () => {
    const pts = new Float32Array([10, 0, 0, 11, 0, 0, 80, 0, 0, 81, 1, 0]);
    const w = new Float32Array([1, 1, 1, 1]);
    const a = kmeans(pts, w, 2), b = kmeans(pts, w, 2);
    expect([...a.label]).toEqual([...b.label]);
    expect(a.label[0]).toBe(a.label[1]);
    expect(a.label[0]).not.toBe(a.label[2]);
  });
  it('colours triangles flat, magenta becomes the team area', () => {
    // texture: green on the left, magenta on the right (2×1)
    const tex = { data: Buffer.from([40, 160, 40, 255, 0, 255]), w: 2, h: 1 };
    // strip of triangles: 0–5 left (u 0.25), 6–7 right (u 0.75)
    const pos = [], uv = [], idx = [];
    for (let t = 0; t < 8; t++) {
      const x = t * 0.1, u = t < 6 ? 0.25 : 0.75;
      for (const [dx, dy] of [[0, 0], [0.1, 0], [0, 0.1]]) { pos.push(x + dx, dy, 0); uv.push(u, 0.5); idx.push(idx.length); }
    }
    const pal = paletteize(tex, [{ pos, uv, idx }], mw, { colors: 2, smooth: 0 });
    const L = pal.labels[0];
    expect(L[6]).toBe(pal.marker);
    expect(L[0]).not.toBe(pal.marker);
    expect(pal.palette[pal.marker]).toEqual([140, 140, 140]); // team area neutral grey
    expect(pal.neighbors.length).toBe(8);
  });
});

import { rasterTriangles, fillGutters } from '../../scripts/asset-gen/texraster.mjs';
import { growMarker, shiftBeard, headRegions, triangleAdjacency } from '../../scripts/asset-gen/regions.mjs';
import { fitTo, transferWeights } from '../../scripts/asset-gen/farmesh.mjs';
import { markerWeightRelaxed } from '../../scripts/asset-gen/postprocess.mjs';

describe('Triangles in the texture', () => {
  it('rasterises triangles and fills island edges from their own island', () => {
    // two triangles, each one half of an 8×8 texture (diagonal), nothing in between
    const uv = [0.0, 0.0, 0.45, 0.0, 0.0, 0.45, 1.0, 1.0, 0.55, 1.0, 1.0, 0.55];
    const id = rasterTriangles(uv, [0, 1, 2, 3, 4, 5], 8, 8);
    expect(id[0]).toBe(0);
    expect(id[63]).toBe(1);
    expect(id[3 * 8 + 4]).toBe(-1); // centre free
    const col = new Uint8Array(64);
    for (let i = 0; i < 64; i++) col[i] = id[i] === 0 ? 10 : id[i] === 1 ? 200 : 0;
    fillGutters(id, 8, 8, [{ data: col, ch: 1 }], 8);
    expect([...id].every((t) => t >= 0)).toBe(true);
    // every filled point carries the colour of its triangle
    for (let i = 0; i < 64; i++) expect(col[i]).toBe(id[i] === 0 ? 10 : 200);
  });
  it('tiny triangles get at least one pixel', () => {
    const id = rasterTriangles([0.51, 0.51, 0.52, 0.51, 0.51, 0.52], [0, 1, 2], 4, 4);
    expect([...id].filter((t) => t === 0).length).toBe(1);
  });
});

describe('Team area and beard', () => {
  it('darkened marker colour only counts in connection with pure marker colour', () => {
    // chain 0–1–2, 3 alone: 0 pure magenta, 1 and 3 carmine red, 2 green
    const nb = [[1], [0, 2], [1], []];
    const m = growMarker(new Float32Array([0.9, 0.1, 0, 0.1]), new Float32Array([1, 0.8, 0, 0.9]), nb);
    expect(m).toEqual([true, true, false, false]);
  });
  it('extended marker colour: carmine yes, skin and leather no', () => {
    expect(markerWeightRelaxed(150, 20, 40)).toBeGreaterThan(0.9);   // carmine
    expect(markerWeightRelaxed(230, 160, 125)).toBe(0);               // skin
    expect(markerWeightRelaxed(120, 70, 40)).toBe(0);                 // leather
  });
  it('beard becomes hair colour, skin stays', () => {
    const beard = [22, 16, 27], hair = [35, 25, 38];
    const b = shiftBeard([22, 16, 27], beard, hair);
    b.forEach((v, i) => expect(v).toBeCloseTo(hair[i], 5));
    const skin = shiftBeard([72, 18, 30], beard, hair);
    expect(Math.abs(skin[0] - 72)).toBeLessThan(1.5); // barely noticeable (ΔL < 1.5)
  });
  it('neighbourhood via shared edges', () => {
    // square made of two triangles + one loose triangle
    const pos = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 5, 5, 5, 6, 5, 5, 5, 6, 5];
    const nb = triangleAdjacency(pos, [0, 1, 2, 0, 2, 3, 4, 5, 6]);
    expect(nb[0]).toEqual([1]);
    expect(nb[2]).toEqual([]);
  });
  it('head regions: face in front, hair at the back', () => {
    const tri = (c, n, lab, headW = 1) => ({ c, n, lab, area: 1, headW });
    const info = [
      tri([0, 1.3, 0.1], [0, 0, 1], [70, 15, 25]),   // face (skin, front)
      tri([0, 1.5, -0.1], [0, 0, -1], [35, 25, 38]), // hair at the back
      tri([0, 1.15, 0.12], [0, -0.3, 0.9], [22, 16, 27]), // beard front bottom
      tri([0, 0.5, 0], [0, 0, 1], [40, 0, 0], 0),    // body
    ];
    const r = headRegions(info);
    expect(r.head).toEqual([true, true, true, false]);
    expect(r.face[0]).toBe(true);
    expect(r.hair[1]).toBe(true);
    expect(r.beard[2]).toBe(true);
    expect(r.face[3]).toBe(false);
  });
});

describe('Far model onto the near skeleton', () => {
  it('adjusts height and centre and takes over weights of the nearest vertices', () => {
    const near = new Float32Array([0, 0, 0, 0, 1, 0, 0, 2, 0]); // feet, hips, head
    const far = fitTo(new Float32Array([5, -1, 5, 5, 0, 5, 5, 1, 5]), near);
    expect([...far]).toEqual([0, 0, 0, 0, 1, 0, 0, 2, 0]);
    const w = transferWeights({ pos: near, joints: [0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0], weights: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] },
      new Float32Array([0, 1.95, 0]), 1);
    expect(w.joints[0]).toBe(2);
    expect(w.weights[0]).toBeCloseTo(1, 5);
  });
});

import { blueToTerracotta } from '../../scripts/asset-gen/building.mjs';
describe('Buildings: blue to terracotta', () => {
  it('turns blue into brick red, leaves magenta, red and grey', () => {
    const px = Buffer.from([60, 80, 160, 255, 0, 255, 180, 70, 50, 120, 120, 120]);
    blueToTerracotta(px);
    const [r, g, b] = px.subarray(0, 3);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    expect([...px.subarray(3)]).toEqual([255, 0, 255, 180, 70, 50, 120, 120, 120]);
  });
});

import { bindCylinder } from '../../scripts/asset-gen/rigid.mjs';
describe('Weapon rigid to the hand', () => {
  it('only binds vertices in the cylinder hand → tip', () => {
    // blade along x (0.1 … 1), plus a point next to the blade and one in the fist
    const pos = [0.5, 0, 0, 0.98, 0.02, 0, 0.5, 0.3, 0, 0.02, 0, 0];
    const joints = [3, 4, 0, 0, 3, 5, 0, 0, 3, 4, 0, 0, 3, 4, 0, 0];
    const weights = [0.5, 0.5, 0, 0, 0.6, 0.4, 0, 0, 0.5, 0.5, 0, 0, 0.5, 0.5, 0, 0];
    expect(bindCylinder(pos, joints, weights, [0, 0, 0], [1, 0, 0], 0.05, 7, 0.08)).toBe(2);
    expect(joints.slice(0, 8)).toEqual([7, 0, 0, 0, 7, 0, 0, 0]);
    expect(weights.slice(0, 4)).toEqual([1, 0, 0, 0]);
    expect(joints.slice(8)).toEqual([3, 4, 0, 0, 3, 4, 0, 0]);
  });
});
