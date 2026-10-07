import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { MOVING_PARTS, partAt, splitGeometry, splitMovingParts, findSpinners, turnParts } from '../../src/render/movingParts.js';
import { OWN_BUILDING_MODELS } from '../../src/render/assets.js';

/** One triangle per centre (small, in the XY plane). */
function triangles(centres, size = 0.02) {
  const pos = [];
  for (const [x, y, z] of centres) pos.push(x - size, y - size, z, x + size, y - size, z, x, y + size, z);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0.5), 2));
  return g;
}

const WHEEL = { pivot: [0, 1, 0], axis: [0, 0, 1], radius: 0.5, span: [-0.1, 0.1], speed: 2 };

describe('moving parts', () => {
  it('a point belongs to the part inside the cylinder around the axis, not outside or in an excluded box', () => {
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    expect(partAt([WHEEL], v(0.3, 1.2, 0))).toBe(0);
    expect(partAt([WHEEL], v(0.6, 1, 0))).toBe(-1); // beyond the radius
    expect(partAt([WHEEL], v(0, 1, 0.2))).toBe(-1); // beyond the span along the axis
    expect(partAt([{ ...WHEEL, exclude: [[-1, 0, -1, 1, 0.8, 1]] }], v(0, 0.7, 0))).toBe(-1);
    // tilted axis: the span counts along the axis
    expect(partAt([{ ...WHEEL, axis: [1, 0, 1] }], v(0.05, 1, 0.05))).toBe(0);
    expect(partAt([{ ...WHEEL, axis: [1, 0, 1] }], v(0.2, 1, 0.2))).toBe(-1);
  });

  it('splits a geometry by triangle centre and keeps all attributes', () => {
    const g = triangles([[0.2, 1, 0], [0, 0, 0], [0, 1.3, 0.05], [2, 2, 2]]);
    const { rest, parts } = splitGeometry(g, [WHEEL]);
    expect(parts[0].attributes.position.count).toBe(6);
    expect(rest.attributes.position.count).toBe(6);
    expect(parts[0].attributes.uv.count).toBe(6);
  });

  it('drops long slivers across the cut, keeps short ones on the side of their centre', () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 1, 0, 0.1, 1, 0, 0, 0.3, 0, // corner at y 0.3 outside the wheel, edge 0.7 long
      0.47, 1, 0, 0.52, 1, 0, 0.47, 1.02, 0, // short triangle on the rim
    ], 3));
    const { rest, parts } = splitGeometry(g, [WHEEL]);
    expect(rest.attributes.position).toBeUndefined();
    expect(parts[0].attributes.position.count).toBe(3);
  });

  it('cuts the parts of a loaded model into turning groups at the pivot', () => {
    MOVING_PARTS.test_mill = [WHEEL];
    const scene = new THREE.Group();
    const mesh = new THREE.Mesh(triangles([[0.2, 1, 0], [0, 0, 0], [0, 1.3, 0.05]]), new THREE.MeshStandardMaterial());
    mesh.name = 'Mesh_0';
    scene.add(mesh);
    expect(splitMovingParts('buildings/test_mill.lod1', scene)).toBe(1);
    const [g] = findSpinners(scene);
    expect(g.position.toArray()).toEqual([0, 1, 0]);
    expect(g.children[0].name).toBe('Mesh_0');
    expect(g.children[0].material).toBe(mesh.material);
    expect(mesh.geometry.attributes.position.count).toBe(3);
    // the part keeps its place in the model: geometry relative to the pivot
    const box = new THREE.Box3().setFromObject(g);
    expect(box.max.y).toBeGreaterThan(1.2);
    turnParts([g], Math.PI / 4); // speed 2 → half a turn
    expect(g.quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(Math.PI / 2, 5);
    delete MOVING_PARTS.test_mill;
  });

  it('leaves models without parts untouched', () => {
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(triangles([[0, 0, 0]]), new THREE.MeshBasicMaterial()));
    expect(splitMovingParts('buildings/house', scene)).toBe(0);
    expect(scene.children.length).toBe(1);
  });

  it('all parts belong to own building models and are well formed', () => {
    for (const [name, parts] of Object.entries(MOVING_PARTS)) {
      expect(OWN_BUILDING_MODELS.has(name), name).toBe(true);
      for (const p of parts) {
        expect(p.pivot).toHaveLength(3);
        expect(Math.hypot(...p.axis)).toBeGreaterThan(0);
        expect(p.radius).toBeGreaterThan(0);
        expect(p.span[0]).toBeLessThan(p.span[1]);
        expect(p.speed).not.toBe(0);
        for (const b of p.exclude ?? []) expect(b).toHaveLength(6);
      }
    }
  });
});
