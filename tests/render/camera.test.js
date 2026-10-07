// Camera: keep the target visible above a panel at the bottom edge (tutorial in portrait mode, QA finding D),
// graphics level in a running game (QA finding E) – pure logic without WebGL.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CameraRig, MIN_DIST, MAX_DIST, NEAR_PITCH, viewPitch, grabRange, buildingTop, buildingEdge, BUILDING_EDGE_MAX } from '../../src/render/CameraRig.js';
import { Environment } from '../../src/render/environment.js';
import { QUALITY_PRESETS } from '../../src/render/quality.js';
import { CharacterSystem } from '../../src/render/characters.js';
import { lodSettings, effectiveDistance, selectLod, NEAR_FULL_DETAIL, screenHeightPx, pixelMetric } from '../../src/render/lod.js';

function rigFor(w, h) {
  const cam = new THREE.PerspectiveCamera(w < h ? 55 : 40, w / h, 0.3, 700);
  cam.updateProjectionMatrix();
  const rig = new CameraRig(cam, { w: 128, h: 128 });
  rig.groundAt = (x, z) => Math.sin(x * 0.2) + Math.cos(z * 0.15);
  return { cam, rig };
}

const screenY = (rig, cam, x, z, h) => {
  rig.update(0);
  cam.updateMatrixWorld();
  const p = new THREE.Vector3(x, rig.groundAt(x, z), z).project(cam);
  return ((1 - p.y) / 2) * h;
};

describe('CameraRig.lookAtScreen', () => {
  it('puts the point in portrait mode at the desired screen height (above the panel)', () => {
    const W = 412, H = 915;
    for (const yaw of [0, 0.7, 2.5, -1.9]) for (const dist of [14, 28, 60]) {
      const { cam, rig } = rigFor(W, H);
      rig.yaw = yaw; rig.dist = dist;
      const want = 260;
      rig.lookAtScreen(64, 70, want, H);
      expect(Math.abs(screenY(rig, cam, 64, 70, H) - want)).toBeLessThan(6);
    }
  });

  it('without offset the point stays at the screen centre (like lookAt)', () => {
    const { cam, rig } = rigFor(1280, 800);
    rig.lookAtScreen(40, 50, 400, 800);
    expect(Math.abs(screenY(rig, cam, 40, 50, 800) - 400)).toBeLessThan(6);
    expect(Math.hypot(rig.target.x - 40, rig.target.z - 50)).toBeLessThan(0.5);
  });

  it('at the map edge: limited, no endless loop', () => {
    const { rig } = rigFor(412, 915);
    rig.yaw = Math.PI; // view such that "up in the image" leads off the map
    rig.lookAtScreen(0, 0, 100, 915);
    expect(rig.target.x).toBeGreaterThanOrEqual(0);
    expect(rig.target.z).toBeGreaterThanOrEqual(0);
  });
});

describe('Graphics level in a running game: shadows', () => {
  const fakeRenderer = () => ({ shadowMap: { enabled: false, type: 0, needsUpdate: false } });

  it('Environment.setQuality switches shadows and map size', () => {
    const r = fakeRenderer();
    const env = new Environment(r, new THREE.Scene(), QUALITY_PRESETS.high);
    expect(r.shadowMap.enabled).toBe(true);
    expect(env.sun.shadow.mapSize.x).toBe(4096);
    // software level "low" without shadows
    let toggled = env.setQuality({ ...QUALITY_PRESETS.low, shadows: false, shadowMapSize: 512 });
    expect(toggled).toBe(true);
    expect(r.shadowMap.enabled).toBe(false);
    expect(env.sun.castShadow).toBe(false);
    expect(env.sun.shadow.mapSize.x).toBe(512);
    expect(env.sun.shadow.map).toBeNull();
    toggled = env.setQuality(QUALITY_PRESETS.medium);
    expect(toggled).toBe(true);
    expect(r.shadowMap.enabled).toBe(true);
    expect(env.sun.shadow.mapSize.x).toBe(2048);
    expect(env.sun.shadow.radius).toBe(QUALITY_PRESETS.medium.shadowRadius);
    expect(env.setQuality(QUALITY_PRESETS.high)).toBe(false); // size only, no shader recompilation
  });

  it('Figures: LOD boundaries and blob shadows follow the level', () => {
    const scene = new THREE.Scene();
    const chars = new CharacterSystem(scene, QUALITY_PRESETS.high, { procedural: {} });
    expect(chars.blob).toBe(false);
    chars.setQuality(QUALITY_PRESETS.low);
    expect(chars.blob).toBe(true);
    expect(chars.blobs).toBeTruthy();
    expect(chars.lodSettings).toEqual(lodSettings('character', 'low'));
    chars.setQuality(QUALITY_PRESETS.medium);
    expect(chars.blob).toBe(false);
    expect(chars.blobs.visible).toBe(false);
    expect(chars.lodSettings).toEqual(lodSettings('character', 'medium'));
  });
});

describe('CameraRig: tilt, free view', () => {
  it('keys R/F tilt, the tilt stays within limits and is kept while zooming', () => {
    const { rig } = rigFor(1280, 800);
    const p0 = rig.pitch;
    rig.keys.add('r'); rig.update(0.2); rig.keys.clear();
    expect(rig.pitch).toBeGreaterThan(p0);
    rig.keys.add('f'); rig.update(0.5); rig.keys.clear();
    expect(rig.pitch).toBeLessThan(p0);
    const tilted = rig.pitch;
    rig.zoom(0.2); rig.zoom(5);
    expect(rig.pitch).toBeCloseTo(tilted, 6);
    rig.rotate(0, 5);
    expect(rig.pitch).toBeLessThanOrEqual(1.5);
    rig.rotate(0, -10);
    expect(rig.pitch).toBeGreaterThanOrEqual(0.45);
  });

  it('a mountain between camera and target raises the camera immediately, without lag', () => {
    const cam = new THREE.PerspectiveCamera(40, 1.6, 0.3, 700);
    const rig = new CameraRig(cam, { w: 128, h: 128 });
    rig.pitch = 0.5; rig.dist = 60;
    rig.lookAt(64, 64);
    rig.update(0);
    const y0 = cam.position.y;
    // a mountain appears between camera and target
    const mx = 64 + (cam.position.x - 64) / 2, mz = 64 + (cam.position.z - 64) / 2;
    rig.groundAt = (x, z) => Math.max(0, 25 - 4 * Math.hypot(x - mx, z - mz));
    rig.update(1 / 60);
    const y1 = cam.position.y;
    expect(y1).toBeGreaterThan(y0 + 5);
    for (let i = 0; i < 30; i++) rig.update(1 / 60);
    expect(cam.position.y).toBe(y1);
  });

  it('on flat terrain no raising, at any distance', () => {
    const { cam, rig } = rigFor(1440, 900);
    rig.groundAt = () => 2;
    for (const dist of [3, 6, 10, 14, 18, 28, 50, 75]) {
      rig.dist = dist; rig.update(0);
      const pitch = viewPitch(rig.pitch, dist);
      expect(cam.position.y - rig.aim.y).toBeCloseTo(Math.sin(pitch) * dist, 6);
    }
  });
});

const W = 1440, H = 900;
/** Screen point (pixels) of a world point */
const px = (cam, p) => { const v = p.clone().project(cam); return [((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H]; };
/** Pixel distance between world point p and screen point (nx, ny) */
const off = (cam, p, nx, ny) => { const [x, y] = px(cam, p); return Math.hypot(x - ((nx + 1) / 2) * W, y - ((1 - ny) / 2) * H); };
const hilly = (x, z) => 2.5 * Math.sin(x * 0.21) + 1.8 * Math.cos(z * 0.17) + 0.4 * Math.sin((x + z) * 0.9);

describe('CameraRig: direct like a map app (no lag, grabbing, zoom to pointer)', () => {
  /** Camera after an input: is it still at the next frame? */
  const still = (cam, rig) => {
    const p = cam.position.clone(), q = cam.quaternion.clone();
    for (let i = 0; i < 20; i++) rig.update(1 / 60);
    return cam.position.equals(p) && cam.quaternion.equals(q);
  };

  it('no lag: after zoom, drag, rotate the image is still immediately', () => {
    const { cam, rig } = rigFor(W, H);
    rig.groundAt = hilly;
    rig.update(0);
    rig.zoomAt(0.8, 0.3, -0.2); expect(still(cam, rig)).toBe(true);
    const h = rig.grabHeight(0.1, -0.3);
    rig.dragStep(0.1, -0.3, 0.2, 0.1, h); expect(still(cam, rig)).toBe(true);
    rig.rotateAt(0.3, 0, 0); expect(still(cam, rig)).toBe(true);
    rig.rotate(0.2, -0.1); rig.update(1 / 60); expect(still(cam, rig)).toBe(true);
  });

  it('no bounce: camera position depends only on the position, not on the way there', () => {
    const { cam, rig } = rigFor(W, H);
    rig.groundAt = hilly;
    for (const dist of [3, 10, 28]) {
      rig.dist = dist; rig.lookAt(60, 60); rig.update(0);
      const p0 = cam.position.clone();
      // drag back and forth over hills, then back to the starting point
      for (let i = 0; i < 40; i++) { rig.target.x += 0.37; rig.target.z += Math.sin(i) * 0.5; rig.update(1 / 60); }
      rig.lookAt(60, 60); rig.update(1 / 60);
      expect(cam.position.distanceTo(p0)).toBeLessThan(1e-9);
    }
  });

  it('camera height follows the terrain continuously: small steps, small height change', () => {
    const { cam, rig } = rigFor(W, H);
    rig.groundAt = hilly;
    for (const dist of [3, 12, 40]) {
      rig.dist = dist; rig.lookAt(30, 64); rig.update(0);
      let y = cam.position.y, worst = 0;
      for (let i = 0; i < 400; i++) {
        rig.target.x += 0.05; rig.update(1 / 60);
        worst = Math.max(worst, Math.abs(cam.position.y - y));
        y = cam.position.y;
      }
      // terrain rises here by at most ≈ 0.9 per tile; smoothed, every 0.05 step stays small
      expect(worst).toBeLessThan(0.08);
    }
  });

  it('dragging: the grabbed ground point stays under mouse or finger (flat terrain, also close up)', () => {
    for (const [w, h] of [[W, H], [412, 915]]) {
      for (const dist of [3, 8, 28, 60]) {
        const { cam, rig } = rigFor(w, h);
        rig.groundAt = () => 1;
        rig.dist = dist; rig.yaw = 0.4; rig.update(0);
        const from = [0.1, -0.4], to = [-0.3, 0.2];
        const p = rig.pick(...from);
        const gh = rig.grabHeight(...from);
        let last = from;
        for (let i = 1; i <= 12; i++) {
          const cur = [from[0] + ((to[0] - from[0]) * i) / 12, from[1] + ((to[1] - from[1]) * i) / 12];
          rig.dragStep(...last, ...cur, gh);
          last = cur;
        }
        const v = p.clone().project(cam);
        expect(Math.hypot(v.x - to[0], v.y - to[1])).toBeLessThan(0.003);
      }
    }
  });

  it('dragging over hills: movement follows the hand without jumps or oscillation', () => {
    const { cam, rig } = rigFor(W, H);
    rig.groundAt = hilly;
    for (const dist of [3, 12, 40]) {
      rig.dist = dist; rig.lookAt(64, 64); rig.update(0);
      const gh = rig.grabHeight(0, -0.2);
      let last = [0, -0.2], worst = 0;
      for (let i = 1; i <= 60; i++) {
        const cur = [0.4 * Math.sin(i / 9), -0.2 + 0.3 * Math.sin(i / 7)];
        const t0 = rig.target.clone();
        rig.dragStep(...last, ...cur, gh);
        worst = Math.max(worst, Math.hypot(rig.target.x - t0.x, rig.target.z - t0.z));
        last = cur;
      }
      // a step of at most ≈ 0.07 of the image width moves the target only a bit, never across the map
      expect(worst).toBeLessThan(dist * 0.5);
    }
  });

  it('dragging to the horizon: path limited, nothing shoots off to infinity', () => {
    const { rig } = rigFor(W, H);
    rig.dist = MIN_DIST; rig.lookAt(64, 64); rig.update(0);
    const gh = rig.grabHeight(0, -0.9);
    rig.dragStep(0, -0.9, 0, 0.99, gh);
    expect(Math.hypot(rig.target.x - 64, rig.target.z - 64)).toBeLessThan(grabRange(MIN_DIST) + 1);
  });

  it('zoom to the mouse pointer: ground point below stays put (exact outside close view)', () => {
    for (const dist of [20, 40, 70]) {
      for (const [nx, ny] of [[0, 0], [0.6, -0.5], [-0.7, 0.4], [0.2, 0.8]]) {
        const { cam, rig } = rigFor(W, H);
        rig.groundAt = () => 0;
        rig.dist = dist; rig.update(0);
        const p = rig.pick(nx, ny);
        rig.zoomAt(1 / 1.1, nx, ny);
        expect(off(cam, p, nx, ny)).toBeLessThan(0.5);
        rig.zoomAt(1.1, nx, ny);
        expect(off(cam, p, nx, ny)).toBeLessThan(0.5);
      }
    }
  });

  it('zoom to the mouse pointer in close view: point stays near the pointer, target does not jump', () => {
    for (const ground of [() => 0, hilly]) {
      for (const dist of [17, 12, 8, 5, 3.4]) {
        for (const [nx, ny] of [[0, 0], [0.6, -0.5], [-0.7, 0.4], [0.2, 0.8]]) {
          const { cam, rig } = rigFor(W, H);
          rig.groundAt = ground;
          rig.dist = dist; rig.lookAt(64, 64); rig.update(0);
          const p = rig.pick(nx, ny);
          const t0 = rig.target.clone();
          rig.zoomAt(1 / 1.1, nx, ny);
          // close view tilts the view by a few degrees per notch around the screen centre
          if (p) expect(off(cam, p, nx, ny)).toBeLessThan(H * 0.05);
          expect(Math.hypot(rig.target.x - t0.x, rig.target.z - t0.z)).toBeLessThan(dist * 0.15);
        }
      }
    }
  });

  it('zoom: into the sky to the screen centre, no movement at the limit', () => {
    const { rig } = rigFor(W, H);
    rig.dist = MIN_DIST; rig.update(0);
    const t0 = rig.target.clone();
    rig.zoomAt(0.5, 0.4, 0.99); // all the way up: sky
    expect(rig.dist).toBe(MIN_DIST);
    expect(rig.target.distanceTo(t0)).toBeLessThan(1e-9);
    rig.zoomAt(0.5, 0.3, -0.6); // at the smallest distance: nothing more
    expect(rig.target.x).toBeCloseTo(t0.x, 9);
    expect(rig.target.z).toBeCloseTo(t0.z, 9);
    rig.dist = MAX_DIST; rig.update(0);
    const t1 = rig.target.clone();
    rig.zoomAt(2, 0.3, -0.6);
    expect(rig.dist).toBe(MAX_DIST);
    expect(rig.target.x).toBeCloseTo(t1.x, 9);
  });

  it('rotating around the finger centre: the point below stays put, the map turns with the fingers', () => {
    for (const dist of [5, 20, 50]) {
      const { cam, rig } = rigFor(W, H);
      rig.groundAt = () => 0;
      rig.dist = dist; rig.update(0);
      const p = rig.pick(0.3, -0.2), q = rig.pick(0.6, -0.2);
      const ang = () => { const [ax, ay] = px(cam, p), [bx, by] = px(cam, q); return Math.atan2(by - ay, bx - ax); };
      const a0 = ang();
      for (let i = 0; i < 5; i++) rig.rotateAt(0.04, 0.3, -0.2);
      expect(off(cam, p, 0.3, -0.2)).toBeLessThan(0.5);
      // fingers clockwise (image angle grows) → map turns clockwise with them
      expect(ang() - a0).toBeGreaterThan(0.05); // oblique view shortens the visible rotation
    }
  });
});

describe('CameraRig: never into buildings', () => {
  // house 5×5 tiles, 6 high, with soft edge like Renderer.buildingTopAt
  const house = { x: 60, z: 60, w: 5, h: 5, top: 6 };
  const obstacleAt = (x, z) => buildingTop({ x: house.x, y: house.z, w: house.w, h: house.h }, 0, house.top, x, z);
  const inside = (c) => c.x > house.x && c.x < house.x + house.w && c.z > house.z && c.z < house.z + house.h && c.y < house.top + 0.2;

  it('zooming in on the house centre: camera rises steadily over the roof instead of into it', () => {
    for (const yaw of [0, 0.785, 2, 3.9]) {
      const { cam, rig } = rigFor(W, H);
      rig.groundAt = () => 0; rig.obstacleAt = obstacleAt;
      rig.yaw = yaw; rig.dist = 20; rig.lookAt(62.5, 62.5); rig.update(0);
      let y = cam.position.y, worst = 0;
      while (rig.dist > MIN_DIST) {
        rig.zoomAt(0.97, 0, 0);
        expect(inside(cam.position)).toBe(false);
        worst = Math.max(worst, Math.abs(cam.position.y - y));
        y = cam.position.y;
      }
      expect(worst).toBeLessThan(0.8); // no jump
    }
  });

  it('passing the house: camera stays outside, height changes steadily', () => {
    const { cam, rig } = rigFor(W, H);
    rig.groundAt = () => 0; rig.obstacleAt = obstacleAt;
    rig.yaw = 0; rig.dist = MIN_DIST; rig.lookAt(62.5, 52); rig.update(0);
    let y = cam.position.y, worst = 0;
    for (let i = 0; i < 300; i++) {
      rig.target.z += 0.08; rig.update(1 / 60);
      expect(inside(cam.position)).toBe(false);
      worst = Math.max(worst, Math.abs(cam.position.y - y));
      y = cam.position.y;
    }
    expect(worst).toBeLessThan(0.8);
  });
});

describe('CameraRig: tall buildings', () => {
  // castle 5×5 tiles with an 11-tile tower (like the headquarters model)
  const castle = { x: 14, y: 14, w: 5, h: 5 };
  const obstacleAt = (x, z) => buildingTop(castle, 0, 11, x, z);

  it('the soft edge is limited: 3 tiles in front of the wall nothing lifts the camera', () => {
    expect(buildingEdge(2)).toBeCloseTo(1.5);
    expect(buildingEdge(11)).toBe(BUILDING_EDGE_MAX);
    expect(obstacleAt(16.5, 19 + BUILDING_EDGE_MAX)).toBe(-Infinity);
    expect(obstacleAt(16.5, 19)).toBe(11);
  });

  it('close zoom in front of the castle keeps the flat view', () => {
    const { cam, rig } = rigFor(W, H);
    rig.groundAt = () => 0; rig.obstacleAt = obstacleAt;
    // look-at point 1.6 tiles in front of the wall, camera behind it (away from the castle)
    rig.yaw = 0.7; rig.dist = MIN_DIST; rig.lookAt(17.6, 20.6); rig.update(0);
    const dir = cam.getWorldDirection(new THREE.Vector3());
    expect(Math.asin(-dir.y)).toBeLessThan(NEAR_PITCH + 0.05);
  });
});

describe('CameraRig close zoom (issue #6)', () => {
  it('allows getting clearly closer than before (distance 8)', () => {
    const { rig } = rigFor(1440, 900);
    rig.zoom(0.01);
    expect(rig.dist).toBe(MIN_DIST);
    expect(MIN_DIST).toBeLessThanOrEqual(3.5);
  });

  it('view becomes flatter when zooming in and back as set when zooming out', () => {
    const { cam, rig } = rigFor(1440, 900);
    rig.groundAt = () => 0;
    const angle = () => {
      rig.update(0); cam.updateMatrixWorld();
      const dir = cam.getWorldDirection(new THREE.Vector3());
      return Math.asin(-dir.y);
    };
    rig.dist = 40;
    const far = angle();
    expect(far).toBeCloseTo(rig.pitch, 1);
    rig.dist = MIN_DIST;
    const near = angle();
    expect(near).toBeLessThan(far - 0.4);
    expect(viewPitch(rig.pitch, MIN_DIST)).toBeCloseTo(NEAR_PITCH, 5);
    // monotonic: the closer, the flatter
    for (let d = MIN_DIST + 1; d <= 30; d += 1) expect(viewPitch(0.95, d)).toBeGreaterThanOrEqual(viewPitch(0.95, d - 1));
    rig.dist = 40;
    expect(angle()).toBeCloseTo(far, 5);
    expect(rig.pitch).toBeCloseTo(0.95, 5);
  });

  it('does not dive into the terrain: camera and surroundings stay above the ground, also on slopes', () => {
    const { cam, rig } = rigFor(412, 915);
    // steep slope and hill
    rig.groundAt = (x, z) => Math.max(0, 6 - Math.hypot(x - 64, z - 64)) * 1.4 + 0.3 * Math.sin(x * 1.3);
    for (const yaw of [0, 0.7, 1.6, 3.1, 4.5]) {
      for (const [x, z] of [[60, 64], [64, 64], [70, 61], [58, 69]]) {
        rig.yaw = yaw; rig.pitch = 0.6; rig.dist = MIN_DIST;
        rig.lookAt(x, z); rig.update(0);
        const c = cam.position;
        for (const [ox, oz] of [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) {
          expect(c.y - rig.groundAt(c.x + ox, c.z + oz)).toBeGreaterThan(cam.near + 0.2);
        }
      }
    }
  });

  it('near clipping plane moves closer when zooming in', () => {
    const { cam, rig } = rigFor(1440, 900);
    rig.dist = 40; rig.update(0);
    const far = cam.near;
    rig.dist = MIN_DIST; rig.update(0);
    expect(cam.near).toBeLessThan(far);
    expect(cam.near).toBeGreaterThan(0.05);
  });

  it('up close LOD0 applies to buildings on every graphics level and in portrait mode', () => {
    for (const tier of ['low', 'medium', 'high']) {
      for (const fov of [40, 55]) {
        const s = lodSettings('building', tier);
        for (let d = 0; d < NEAR_FULL_DETAIL; d += 0.5) {
          expect(selectLod(effectiveDistance(d, fov, s.bias), -1, s.thresholds, s.h)).toBe(0);
          expect(selectLod(effectiveDistance(d, fov, s.bias), 2, s.thresholds, s.h)).toBe(0);
        }
      }
    }
    // the camera is far inside this range at the smallest distance
    expect(MIN_DIST * 2).toBeLessThan(NEAR_FULL_DETAIL);
  });

  it('very close trees show the full level (by screen height), desktop, phone upright and landscape', () => {
    // smallest tree (birch, ~1.6 tiles) up to twice the smallest camera distance
    for (const tier of ['low', 'medium', 'high']) {
      const s = lodSettings('tree', tier);
      for (const [h, fov] of [[900, 40], [844, 55], [390, 40]]) {
        for (let d = 0.5; d <= MIN_DIST * 2; d += 0.5) {
          const px = screenHeightPx(1.6, d, fov, h) * s.bias;
          expect(selectLod(pixelMetric(px), -1, s.thresholds, s.h)).toBe(0);
          expect(selectLod(pixelMetric(px), 2, s.thresholds, s.h)).toBe(0);
        }
      }
    }
  });

  it('very close figures show the near model (by screen height), desktop and phone upright', () => {
    // figure level depends on the screen height: at the smallest distance a figure is large enough
    for (const tier of ['low', 'medium', 'high']) {
      const s = lodSettings('character', tier);
      for (const [h, fov] of [[900, 40], [844, 55]]) {
        const px = screenHeightPx(0.95, MIN_DIST, fov, h) * s.bias;
        expect(selectLod(pixelMetric(px), -1, s.thresholds, s.h)).toBe(0);
        expect(selectLod(pixelMetric(px), 3, s.thresholds, s.h)).toBe(0);
      }
    }
  });
});
