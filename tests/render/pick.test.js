// Picking of figures in image space (bug "click on empty grass selects a distant serf"):
// only drawn figures in the image with a limited catch radius are selectable.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { pickFigure, figurePickDistance, inDepth, PICK_MAX_PX, PICK_MIN_PX, PICK_MIN_TOUCH_PX } from '../../src/render/pick.js';

const VIEW = { width: 1440, height: 900 };
/** Figure from foot (x, y) vertically upwards, h px tall, in the middle of the view volume */
const fig = (x, y, h = 40, extra = {}) => ({ ax: x, ay: y, az: 0.9, bx: x, by: y - h, bz: 0.9, drawn: true, ...extra });

/** Project foot and head point of a figure as in the renderer */
function project(camera, x, z, view) {
  const a = new THREE.Vector3(x, 0, z).project(camera), b = new THREE.Vector3(x, 0.95, z).project(camera);
  return {
    ax: (a.x + 1) / 2 * view.width, ay: (1 - a.y) / 2 * view.height, az: a.z,
    bx: (b.x + 1) / 2 * view.width, by: (1 - b.y) / 2 * view.height, bz: b.z, drawn: true,
  };
}

describe('pickFigure', () => {
  it('hits the figure under the pointer, not next to it', () => {
    const f = fig(500, 400);
    expect(pickFigure([f], 500, 380, VIEW)).toBe(f);
    expect(pickFigure([f], 500 + 30, 380, VIEW)).toBeNull();
  });

  it('selects the figure nearest to the pointer', () => {
    const a = fig(500, 400), b = fig(510, 400);
    expect(pickFigure([a, b], 508, 380, VIEW)).toBe(b);
  });

  it('takes only figures drawn in this frame', () => {
    expect(pickFigure([fig(500, 400, 40, { drawn: false })], 500, 380, VIEW)).toBeNull();
  });

  it('nothing outside the image, not even just at the edge', () => {
    // figure entirely below the bottom edge: click at the edge (within the catch radius) does not hit it
    expect(pickFigure([fig(700, 1000, 80)], 700, 895, VIEW)).toBeNull();
    // if it extends into the image it stays selectable
    expect(pickFigure([fig(700, 960, 300)], 700, 800, VIEW)).not.toBeNull();
  });

  it('catch radius: at least mouse/touch, at most PICK_MAX_PX', () => {
    const small = fig(500, 400, 5);
    expect(figurePickDistance(small, 500 + PICK_MIN_PX - 1, 398, VIEW)).toBeLessThan(Infinity);
    expect(figurePickDistance(small, 500 + PICK_MIN_PX + 2, 398, VIEW)).toBe(Infinity);
    expect(figurePickDistance(small, 500 + PICK_MIN_TOUCH_PX - 1, 398, { ...VIEW, touch: true })).toBeLessThan(Infinity);
    const huge = fig(500, 800, 600);
    expect(figurePickDistance(huge, 500 + PICK_MAX_PX - 1, 500, VIEW)).toBeLessThan(Infinity);
    expect(figurePickDistance(huge, 500 + PICK_MAX_PX + 5, 500, VIEW)).toBe(Infinity);
  });

  it('points outside the view volume (behind the camera or in front of the near plane) do not count', () => {
    expect(inDepth(0.99)).toBe(true);
    expect(inDepth(1.2)).toBe(false);
    expect(inDepth(-3)).toBe(false);
    expect(inDepth(NaN)).toBe(false);
    expect(pickFigure([fig(500, 400, 40, { az: -40 })], 500, 380, VIEW)).toBeNull();
  });

  it('failure case: figure below/behind the camera (depth in front of the near plane) is not hit everywhere', () => {
    // oblique camera as in the game: 12 tiles above the ground, looking obliquely downwards
    const camera = new THREE.PerspectiveCamera(40, VIEW.width / VIEW.height, 0.3, 700);
    camera.position.set(0, 12, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    // point on the ground that lies in the camera plane (depth ≈ 0.1, i.e. in front of the near plane)
    const fwd = camera.getWorldDirection(new THREE.Vector3());
    // ground (y = 0) along z: depth d(z) = (p − cam)·fwd = 0.1
    const z = camera.position.z + (0.1 + camera.position.y * fwd.y) / fwd.z;
    const ghost = project(camera, 3, z, VIEW);
    // without a depth check this would give huge image coordinates and a huge catch radius
    expect(Math.hypot(ghost.bx - ghost.ax, ghost.by - ghost.ay)).toBeGreaterThan(5000);
    expect(ghost.az).toBeLessThan(-1);
    // click on empty grass in the middle of the image: nothing selected
    expect(pickFigure([ghost], 720, 450, VIEW)).toBeNull();
    // a real figure in the middle of the image stays selectable
    const real = project(camera, 0, 0, VIEW);
    expect(pickFigure([ghost, real], real.ax, real.ay - 5, VIEW)).toBe(real);
  });
});
