// Clear view for scripted camera moves: when a script (camera.jump_to / camera.fly_to) or the dialogue camera
// points at figures, trees and houses may stand between the lens and them. Here the camera tries other rotations
// (and if needed a steeper tilt) and takes the one with the fewest blocked lines of sight, preferring the smallest
// turn. Pure geometry on simple stand-ins (trees: crown cylinders, houses: boxes, terrain: height field) – no
// raycasting against the meshes, so it stays cheap and testable without WebGL. Rendering only, the simulation
// never sees it.

/**
 * @typedef {{type:'cyl', x:number, z:number, r:number, y0:number, y1:number}} CylBlocker vertical cylinder (tree crown)
 * @typedef {{type:'box', x0:number, z0:number, x1:number, z1:number, y0:number, y1:number}} BoxBlocker axis-aligned box (house)
 * @typedef {CylBlocker|BoxBlocker} Blocker
 * @typedef {{x:number, y:number, z:number}} P3
 */

/** Heights above the ground at which a figure is checked (tiles: legs/body and head). */
export const FIGURE_SAMPLES = [0.35, 0.8];
/** Rotation candidates (degrees from the current rotation): small turns first, at most to the opposite side. */
export const YAW_STEPS = [0, 25, -25, 50, -50, 75, -75, 100, -100, 130, -130, 160, -160, 180];
/** Additional tilt tried when no rotation alone gives a clear view (rad): looking over the crowns. */
export const PITCH_LIFT = 0.3;
/** Cost per degree of turning compared with one blocked line of sight (a clear view always wins over turning). */
const TURN_COST = 0.002;
/** Last part of the line of sight in front of the target that the terrain test leaves out (the figure stands there). */
const GROUND_TAIL = 0.1;

/**
 * Does the segment a→b pass through the blocker?
 * @param {P3} a @param {P3} b @param {Blocker} o
 */
export function segmentHits(a, b, o) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  let t0 = 0, t1 = 1;
  if (o.type === 'cyl') {
    // horizontal part: |a + d·t − c|² ≤ r²
    const fx = a.x - o.x, fz = a.z - o.z;
    const qa = dx * dx + dz * dz, qb = 2 * (fx * dx + fz * dz), qc = fx * fx + fz * fz - o.r * o.r;
    if (qa < 1e-12) { if (qc > 0) return false; }
    else {
      const disc = qb * qb - 4 * qa * qc;
      if (disc < 0) return false;
      const s = Math.sqrt(disc);
      t0 = Math.max(t0, (-qb - s) / (2 * qa));
      t1 = Math.min(t1, (-qb + s) / (2 * qa));
    }
  } else {
    // slabs in x and z
    for (const [p, d, lo, hi] of [[a.x, dx, o.x0, o.x1], [a.z, dz, o.z0, o.z1]]) {
      if (Math.abs(d) < 1e-12) { if (p < lo || p > hi) return false; continue; }
      let u = (lo - p) / d, v = (hi - p) / d;
      if (u > v) [u, v] = [v, u];
      t0 = Math.max(t0, u); t1 = Math.min(t1, v);
    }
  }
  if (t0 > t1) return false;
  // height along the (linear) segment within [t0, t1] must overlap the blocker's height range
  const ya = a.y + dy * t0, yb = a.y + dy * t1;
  return Math.max(ya, yb) >= o.y0 && Math.min(ya, yb) <= o.y1;
}

/** Does the blocker stand on the target itself (figure under a crown, point inside a house)? Then no turn helps. */
function contains(o, p) {
  if (o.type === 'cyl') return (p.x - o.x) ** 2 + (p.z - o.z) ** 2 <= o.r * o.r;
  return p.x >= o.x0 && p.x <= o.x1 && p.z >= o.z0 && p.z <= o.z1;
}

/**
 * Number of blocked lines of sight from the camera to the target points.
 * @param {P3} cam @param {P3[]} targets @param {Blocker[]} blockers
 * @param {(x:number, z:number)=>number} [groundAt] terrain (optional)
 */
export function blockedCount(cam, targets, blockers, groundAt) {
  let n = 0;
  for (const p of targets) {
    let hit = false;
    for (const o of blockers) if (!contains(o, p) && segmentHits(cam, p, o)) { hit = true; break; }
    if (!hit && groundAt) {
      for (let k = 1; k < 16 && !hit; k++) {
        const f = (k / 16) * (1 - GROUND_TAIL);
        if (groundAt(cam.x + (p.x - cam.x) * f, cam.z + (p.z - cam.z) * f) > cam.y + (p.y - cam.y) * f) hit = true;
      }
    }
    if (hit) n++;
  }
  return n;
}

/** Target points for figures standing at the given ground positions. @param {{x:number, z:number}[]} spots @param {(x:number,z:number)=>number} groundAt */
export function figureTargets(spots, groundAt) {
  const out = [];
  for (const s of spots) {
    const g = groundAt(s.x, s.z);
    for (const h of FIGURE_SAMPLES) out.push({ x: s.x, y: g + h, z: s.z });
  }
  return out;
}

/**
 * Choose rotation and tilt for a clear view of the targets.
 * @param {(yaw:number, pitch:number)=>P3} camAt camera position for rotation and tilt (target and distance fixed)
 * @param {number} yaw current rotation @param {number} pitch current set tilt
 * @param {P3[]} targets @param {Blocker[]} blockers @param {(x:number, z:number)=>number} [groundAt]
 * @param {{pitchMax?: number}} [opts]
 * @returns {{yaw:number, pitch:number, blocked:number, before:number}} `before`: blocked lines of sight with the old view
 */
export function clearView(camAt, yaw, pitch, targets, blockers, groundAt, opts = {}) {
  const pitchMax = opts.pitchMax ?? 1.5;
  const before = blockedCount(camAt(yaw, pitch), targets, blockers, groundAt);
  let best = { yaw, pitch, blocked: before, before, cost: before };
  if (!before || !targets.length) return best;
  const pitches = [pitch];
  if (pitch < pitchMax - 0.05) pitches.push(Math.min(pitchMax, pitch + PITCH_LIFT));
  for (const p of pitches) {
    for (const deg of YAW_STEPS) {
      const y = yaw + (deg * Math.PI) / 180;
      const n = blockedCount(camAt(y, p), targets, blockers, groundAt);
      // steeper view costs like a medium turn: rotation is preferred when it suffices
      const cost = n + Math.abs(deg) * TURN_COST + (p !== pitch ? 60 * TURN_COST : 0);
      if (cost < best.cost - 1e-9) best = { yaw: y, pitch: p, blocked: n, before, cost };
    }
    if (best.blocked === 0) break;
  }
  return best;
}

/** Shortest signed angle from a to b (rad), for gliding rotation. */
export function angleDelta(a, b) {
  const d = (b - a) % (2 * Math.PI);
  return d > Math.PI ? d - 2 * Math.PI : d < -Math.PI ? d + 2 * Math.PI : d;
}
