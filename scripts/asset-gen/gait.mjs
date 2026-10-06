// Gaits of a quadruped (horse) as pure computation: hoof paths per phase, preferred joint flexion and
// a small IK solver in the side plane. Used by horse.mjs to write animations from the rig.
//
// Side-plane coordinates: [z, y] (z = forward, y = up). Angle a > 0 rotates a limb "forward" (a downward
// hanging leg swings with the hoof forward) – that is a rotation about the x axis by −a.

/** Legs in the order left hind, left front, right hind, right front. */
export const LEGS = ['LH', 'LF', 'RH', 'RF'];

/**
 * Gaits. `period` in s (multiple of 1/24 – the game samples at 24 frames/s), `stride` = distance per cycle
 * in model units, `duty` = fraction of the stance phase, `touch` = touchdown time per leg (fraction of the cycle),
 * `lift` = lift height of the hoof, `flex` = flexion in the swing phase (factor on the base flexion).
 */
export const GAITS = {
  // Walk: four-beat, lateral (left hind, left front, right hind, right front), always 2–3 hooves on the ground
  walk: { period: 0.75, stride: 0.75, duty: 0.62, touch: { LH: 0, LF: 0.25, RH: 0.5, RF: 0.75 }, lift: 0.1, flex: 0.75 },
  // Gallop (right lead, three-beat): left hind – right hind + left front – right front, then suspension phase
  gallop: { period: 0.5, stride: 1.7, duty: 0.36, touch: { LH: 0, RH: 0.16, LF: 0.2, RF: 0.38 }, lift: 0.18, flex: 1.25 },
};

/** Natural ground speed of a gait (model units/s). */
export const gaitSpeed = (g) => g.stride / g.period;

const frac = (x) => x - Math.floor(x);
const smooth = (x) => x * x * (3 - 2 * x);

/**
 * Hoof path relative to the rest pose: the stance phase glides linearly backwards at ground speed (no slipping),
 * the swing phase lifts the hoof in an arc and brings it forward.
 * @param {{stride:number, duty:number, touch:Record<string,number>, lift:number}} g
 * @param {string} leg @param {number} phase 0…1
 * @returns {{ dz: number, dy: number, stance: boolean, s: number }} s = progress within the phase (0…1)
 */
export function hoofPath(g, leg, phase) {
  const u = frac(phase - g.touch[leg]);
  const half = (g.stride * g.duty) / 2;
  if (u < g.duty) {
    const s = u / g.duty;
    return { dz: half - s * 2 * half, dy: 0, stance: true, s };
  }
  const s = (u - g.duty) / (1 - g.duty);
  // lift off quickly, touch down softly: height as a sine arc, a little earlier at the top in front
  const dy = g.lift * Math.sin(Math.PI * Math.min(1, s * 1.08)) ** 1.2;
  return { dz: -half + smooth(s) * 2 * half, dy: Math.max(0, dy), stance: false, s };
}

/** Flexion in the swing phase (bell 0…1…0), a little earlier than the middle of the path. */
export const swingBell = (s) => Math.sin(Math.PI * Math.min(1, Math.max(0, s)) ** 0.85);

/**
 * Desired angles of the leg joints relative to rest (without shoulder/hip, which the solver chooses freely):
 *  Foreleg: elbow, carpus ("knee", flexes backwards), fetlock, hoof.
 *  Hind leg: stifle (lower leg backwards), hock (cannon bone forward), fetlock, hoof.
 * @param {'front'|'hind'} kind @param {{stance:boolean, s:number}} p @param {number} flex
 * @returns {number[]} angles for joint 1…4 (joint 0 = shoulder/hip has no preference)
 */
export function legPreference(kind, p, flex) {
  if (p.stance) {
    // rolling off at the end of the stance phase: fetlock gives way, hoof tips over the toe
    const roll = Math.max(0, (p.s - 0.8) / 0.2);
    return kind === 'front' ? [0, 0, -0.25 * roll, -0.35 * roll] : [0, 0, -0.25 * roll, -0.35 * roll];
  }
  const b = swingBell(p.s) * flex;
  if (kind === 'front') return [0.25 * b, -1.15 * b, -0.55 * b, -0.45 * b];
  return [-0.55 * b, 0.95 * b, -0.6 * b, -0.45 * b];
}

/** Rotation of a 2D vector [z, y] by a (counter-clockwise, "forward" for hanging limbs). */
export const rot2 = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];

/**
 * Forward kinematics of a limb chain in the side plane.
 * @param {number[]} base position of joint 0 @param {number} baseAngle rotation of the parent relative to rest
 * @param {number[][]} segs rest vectors joint i → i+1 @param {number[]} a angle per joint
 * @returns {number[][]} positions of joints 0…n (last = end point)
 */
export function chainFK(base, baseAngle, segs, a) {
  const pts = [base.slice()];
  let p = base.slice(), th = baseAngle;
  for (let i = 0; i < segs.length; i++) {
    th += a[i];
    const d = rot2(segs[i], th);
    p = [p[0] + d[0], p[1] + d[1]];
    pts.push(p);
  }
  return pts;
}

/**
 * IK with damped least squares: end point of the chain to the target, staying close to the preferred angles.
 * @param {number[]} base @param {number} baseAngle @param {number[][]} segs
 * @param {number[]} target @param {number[]} pref preferred angle per joint @param {number[]} stiff weight per joint
 * @param {number[]} [start] start angles (previous frame)
 * @returns {{ a: number[], err: number }}
 */
export function solveChain(base, baseAngle, segs, target, pref, stiff, start = pref) {
  const n = segs.length;
  const a = start.slice(0, n);
  for (let it = 0; it < 80; it++) {
    const pts = chainFK(base, baseAngle, segs, a);
    const e = pts[n];
    const r = [target[0] - e[0], target[1] - e[1]];
    // Jacobian: d e / d a_i = 90° rotation of (e − joint i)
    const J = [];
    for (let i = 0; i < n; i++) J.push([-(e[1] - pts[i][1]), e[0] - pts[i][0]]);
    // (JᵀJ + Λ) Δ = Jᵀ r − Λ (a − pref)
    // target weighted strongly (W), preferred angles only as damping: reachable targets are hit exactly
    const W = 400;
    const M = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => W * (J[i][0] * J[j][0] + J[i][1] * J[j][1]) + (i === j ? stiff[i] : 0)));
    const rhs = Array.from({ length: n }, (_, i) => W * (J[i][0] * r[0] + J[i][1] * r[1]) - stiff[i] * (a[i] - pref[i]));
    const d = solveLinear(M, rhs);
    let mx = 0;
    for (let i = 0; i < n; i++) { const s = Math.max(-0.3, Math.min(0.3, d[i])); a[i] += s; mx = Math.max(mx, Math.abs(s)); }
    if (mx < 1e-6) break;
  }
  const e = chainFK(base, baseAngle, segs, a)[n];
  return { a, err: Math.hypot(target[0] - e[0], target[1] - e[1]) };
}

/** Small linear system of equations (Gauss with pivot search). */
export function solveLinear(M, b) {
  const n = b.length;
  const A = M.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    const piv = A[c][c] || 1e-12;
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / piv;
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = A[r][n];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = s / (A[r][r] || 1e-12);
  }
  return x;
}

/**
 * Body motion per gait and phase: lifting/lowering, pitching of the trunk, back, neck, head, tail, ears.
 * All curves are closed over the cycle (integer frequencies) – the loop does not jump.
 * Angles in the convention above (a > 0 = rotated forward/up for limbs pointing forward).
 * @param {'idle'|'walk'|'gallop'} clip @param {number} p Phase 0…1
 */
export function bodyPose(clip, p) {
  const TAU = Math.PI * 2;
  const s = (f, ph = 0) => Math.sin(TAU * (f * p - ph));
  const c = (f, ph = 0) => Math.cos(TAU * (f * p - ph));
  if (clip === 'walk') {
    return {
      dy: -0.045 + 0.008 * c(2, 0.15), pitch: 0.012 * s(2, 0.1), spine: 0.01 * s(2),
      // head nods twice per cycle: low when a front hoof lands (0.25 / 0.75)
      neck: [-0.05 * c(2, 0.55), -0.03 * c(2, 0.6), 0], head: 0.02 * c(2, 0.6), yaw: 0.04 * s(1, 0.2),
      tailX: [0.03 * s(2), 0, 0, 0, 0, 0], tailSide: [0.1 * s(1, 0.05), 0.12 * s(1, 0.12), 0.14 * s(1, 0.2), 0.14 * s(1, 0.28), 0.12 * s(1, 0.36), 0.1 * s(1, 0.44)],
      ears: [0.05 * s(1), 0.05 * s(1, 0.5)],
    };
  }
  if (clip === 'gallop') {
    return {
      // low in the support phase of the diagonal, high in the suspension phase; trunk rocks (forehand up, then down)
      dy: -0.075 + 0.02 * c(1, 0.86), pitch: 0.07 * c(1, 0.06), spine: -0.04 * c(1, 0.3),
      neck: [0.12 * c(1, 0.12) - 0.08, 0.06 * c(1, 0.2), 0.03 * c(1, 0.25)], head: 0.06 * c(1, 0.3) + 0.04, yaw: 0,
      tailX: [-0.45 - 0.08 * s(1, 0), -0.12 - 0.1 * s(1, 0.1), -0.08 - 0.12 * s(1, 0.2), -0.06 - 0.14 * s(1, 0.3), -0.04 - 0.14 * s(1, 0.4), -0.14 * s(1, 0.5)],
      tailSide: [0.03 * s(1), 0.04 * s(1, 0.1), 0.05 * s(1, 0.2), 0.05 * s(1, 0.3), 0.05 * s(1, 0.4), 0.05 * s(1, 0.5)],
      ears: [-0.25, -0.25],
    };
  }
  // Standing: breathing (trunk rises and falls), head looks around slowly, tail swishes, ears twitch
  const twitch = (at) => { const d = frac(p - at); return d < 0.06 ? Math.sin((d / 0.06) * Math.PI) : 0; };
  return {
    dy: -0.014 + 0.004 * s(2), pitch: 0.003 * s(2, 0.2), spine: 0.006 * s(2),
    neck: [-0.06 + 0.05 * s(1, 0.1), 0.03 * s(1, 0.3), 0.02 * s(2)], head: 0.04 * s(1, 0.4), yaw: 0.18 * s(1),
    tailX: [0.02 * s(2), 0, 0, 0, 0, 0],
    tailSide: [0.12 * s(2), 0.16 * s(2, 0.06), 0.2 * s(2, 0.12), 0.22 * s(2, 0.18), 0.2 * s(2, 0.24), 0.18 * s(2, 0.3)],
    ears: [0.35 * twitch(0.3) - 0.05 * s(1), -0.35 * twitch(0.72) + 0.05 * s(1)],
  };
}
