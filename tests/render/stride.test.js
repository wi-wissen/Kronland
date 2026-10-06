import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { strideSpeed, strideRate, posedBounds, STRIDE_RATE_MAX } from '../../src/render/characters.js';

/** Two bones: 0 = foot (slides backwards by `slide` per frame), 1 = body (fixed). */
function fake(frames, slide, crouch = 0) {
  const pts = [], bone = [];
  for (let i = 0; i < 20; i++) { pts.push((i % 4) * 0.02, 0, (i % 5) * 0.02); bone.push(0); }
  for (let i = 0; i < 20; i++) { pts.push(0, 0.2 + i * 0.07, 0); bone.push(1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const n = bone.length;
  geo.setAttribute('aBoneIdx', new THREE.Float32BufferAttribute(bone.flatMap((b) => [b, 0, 0, 0]), 4));
  geo.setAttribute('aBoneW', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [1, 0, 0, 0]).flat(), 4));
  const W = 8, data = new Float32Array(W * frames * 4);
  for (let f = 0; f < frames; f++) {
    new THREE.Matrix4().makeTranslation(0, 0, -slide * f).toArray(data, (f * W + 0) * 4);
    // frame 0 crouched (base pose), else upright
    new THREE.Matrix4().makeScale(1, f === 0 ? 1 - crouch : 1, 1).toArray(data, (f * W + 4) * 4);
  }
  return { geo, bake: { texture: { image: { width: W, data } }, boneIndex: new Map() } };
}

describe('Walking tempo', () => {
  it('measures the sliding speed of the stance foot', () => {
    const { geo, bake } = fake(20, 0.05);
    // 20 frames in 2 s → 0.1 s per frame → 0.5 units/s; the jump at the loop end is an outlier
    expect(strideSpeed(geo, bake, { start: 0, frames: 20, duration: 2 })).toBeCloseTo(0.5, 2);
  });
  it('clip in place: not measurable', () => {
    const { geo, bake } = fake(20, 0);
    expect(strideSpeed(geo, bake, { start: 0, frames: 20, duration: 2 })).toBeNull();
  });
  it('tempo = ground / natural, limited', () => {
    expect(strideRate(1, 1.5)).toBeCloseTo(1.5);
    expect(strideRate(0.3, 2)).toBe(STRIDE_RATE_MAX);
    expect(strideRate(2, 0.2)).toBe(0.6);
    expect(strideRate(null, 2, 0.6)).toBe(0.6);
    expect(strideRate(1, 0, 1)).toBe(1);
  });
  it('body size: crouched base pose has smaller measure than the rest pose', () => {
    const { geo, bake } = fake(4, 0, 0.2);
    expect(posedBounds(geo, bake, 0).max.y).toBeLessThan(posedBounds(geo, bake, 1).max.y * 0.85);
  });
});
