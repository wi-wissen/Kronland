// Renderer.setSize only does work on a real size change (split screen with the code panel: ResizeObserver and
// layout passes must not reallocate buffers or touch the camera every frame).
import { describe, it, expect } from 'vitest';
import { Renderer } from '../../src/render/Renderer.js';

function fake() {
  const calls = [];
  return {
    calls,
    renderer: { setSize: (w, h) => calls.push([w, h]) },
    camera: { aspect: 1, fov: 40, updateProjectionMatrix() { calls.push('proj'); } },
    chars: { viewH: 0 },
    viewport: null,
  };
}

describe('Renderer.setSize', () => {
  it('updates buffers and camera once per size', () => {
    const r = fake();
    Renderer.prototype.setSize.call(r, 800, 600);
    Renderer.prototype.setSize.call(r, 800, 600);
    Renderer.prototype.setSize.call(r, 800, 600);
    expect(r.calls).toEqual([[800, 600], 'proj']);
    expect(r.camera.aspect).toBeCloseTo(800 / 600);
    Renderer.prototype.setSize.call(r, 700, 600);
    expect(r.calls).toEqual([[800, 600], 'proj', [700, 600], 'proj']);
    expect(r.viewport).toEqual({ w: 700, h: 600 });
    expect(r.chars.viewH).toBe(600);
  });
});
