// Align two-handed tools: generated motions know no tool, so the wrists are in arbitrary
// positions. Instead of a fixed pose in the hand, the tool is rotated per frame so that
//  - the shaft points outward from the chest through the hands (`radial`), blended with the direction
//    lead hand `aim` → main hand `bone` (`hands`); head behind the main hand,
//  - the blade (−Y of the tool) points down in the swing direction (forward when winding up).
// The result is written as rotation/translation of the tool node (child of the main hand) into every clip.

import * as THREE from 'three';

/** Linear sampling of a glTF channel at time t. */
function sampleChannel(ch, t, out) {
  const { times, vals, size } = ch;
  const n = times.length;
  if (t <= times[0]) return out.fromArray(vals, 0);
  if (t >= times[n - 1]) return out.fromArray(vals, (n - 1) * size);
  let k = 0;
  while (k < n - 2 && times[k + 1] < t) k++;
  const w = (t - times[k]) / (times[k + 1] - times[k] || 1);
  if (size === 4) {
    const a = new THREE.Quaternion().fromArray(vals, k * 4), b = new THREE.Quaternion().fromArray(vals, (k + 1) * 4);
    return out.copy(a.slerp(b, w));
  }
  const a = new THREE.Vector3().fromArray(vals, k * 3), b = new THREE.Vector3().fromArray(vals, (k + 1) * 3);
  return out.copy(a.lerp(b, w));
}

/**
 * @param {import('@gltf-transform/core').Document} doc
 * @param {import('@gltf-transform/core').Node} prop tool node (child of the main hand)
 * @param {{ bone: string, aim: string, chest?: string, grip?: number }} p grip: distance main hand → tool origin along the shaft (m, negative = towards the lead hand)
 */
export function aimProp(doc, prop, p) {
  const root = doc.getRoot();
  const buffer = root.listBuffers()[0];
  const nodes = root.listNodes();
  const byName = new Map(nodes.map((n) => [n.getName(), n]));
  const hand = byName.get(p.bone), lead = byName.get(p.aim), chest = byName.get(p.chest ?? 'Spine02');
  if (!hand || !lead || !chest) throw new Error(`aim: bones missing (${p.bone}, ${p.aim})`);
  // chain root → node for forward computation
  const chain = (n) => { const c = []; for (let x = n; x; x = x.getParentNode()) c.unshift(x); return c; };
  const handChain = chain(hand), leadChain = chain(lead), chestChain = chain(chest);
  // Palm: wrist plus a bit in the forearm direction (the rig has no finger bones)
  const handArm = chain(hand.getParentNode()), leadArm = chain(lead.getParentNode());
  const palmK = p.palm ?? 0.35;
  const scale = new THREE.Vector3(...prop.getScale());

  for (const anim of root.listAnimations()) {
    // channels of this clip per node
    const chs = new Map();
    let T = 0;
    for (const c of anim.listChannels()) {
      const s = c.getSampler();
      const times = s.getInput().getArray(), vals = s.getOutput().getArray();
      T = Math.max(T, times[times.length - 1]);
      const size = c.getTargetPath() === 'rotation' ? 4 : 3;
      chs.set(`${c.getTargetNode().getName()}.${c.getTargetPath()}`, { times, vals, size });
    }
    const world = (ch, t) => {
      const m = new THREE.Matrix4();
      for (const n of ch) {
        const tr = chs.get(`${n.getName()}.translation`), ro = chs.get(`${n.getName()}.rotation`);
        const pos = tr ? sampleChannel(tr, t, new THREE.Vector3()) : new THREE.Vector3(...n.getTranslation());
        const q = ro ? sampleChannel(ro, t, new THREE.Quaternion()) : new THREE.Quaternion(...n.getRotation());
        m.multiply(new THREE.Matrix4().compose(pos, q, new THREE.Vector3(...n.getScale())));
      }
      return m;
    };
    const fps = 30, frames = Math.max(2, Math.round(T * fps) + 1);
    const times = new Float32Array(frames), rot = new Float32Array(frames * 4), pos = new Float32Array(frames * 3);
    let prevQ = null;
    for (let f = 0; f < frames; f++) {
      const t = Math.min(T, f / fps);
      const H = world(handChain, t), L = world(leadChain, t), C = world(chestChain, t);
      const palm = (M, armChain) => {
        const w = new THREE.Vector3().setFromMatrixPosition(M), e = new THREE.Vector3().setFromMatrixPosition(world(armChain, t));
        return w.clone().addScaledVector(w.clone().sub(e), palmK);
      };
      const ph = palm(H, handArm), pl = lead === hand ? ph.clone() : palm(L, leadArm), pc = new THREE.Vector3().setFromMatrixPosition(C);
      // Shaft: two-handed through both palms (lead hand → main hand); if the hands are too close, from the chest
      // through the hands outward. One-handed (aim = bone) always from the chest through the hand.
      const mid = ph.clone().add(pl).multiplyScalar(0.5);
      const radial = mid.sub(pc).normalize();
      const across = ph.clone().sub(pl);
      const span = across.length();
      if (span > 1e-8) across.normalize();
      const w = lead === hand ? 0 : Math.min(1, span / (p.span ?? 0.12));
      const z = radial.multiplyScalar(1 - w).addScaledVector(across, w);
      if (z.lengthSq() < 1e-8) z.set(0, 0, 1);
      z.normalize();
      // Blade points in the swing direction (down, perpendicular to the shaft); if the shaft is vertical, forward
      const blade = new THREE.Vector3(0, -1, 0).addScaledVector(z, z.y);
      if (blade.lengthSq() < 0.04) blade.set(0, 0, 1).addScaledVector(z, -z.z);
      blade.normalize();
      const y = blade.negate(); // tool blade points towards −Y
      const x = new THREE.Vector3().crossVectors(y, z).normalize();
      const origin = ph.clone().addScaledVector(z, p.grip ?? 0);
      const desired = new THREE.Matrix4().makeBasis(x, y, z).setPosition(origin);
      // local to the main hand (its scale is contained in the tool node)
      const local = H.clone().invert().multiply(desired);
      const lp = new THREE.Vector3(), lq = new THREE.Quaternion(), ls = new THREE.Vector3();
      local.decompose(lp, lq, ls);
      if (prevQ && prevQ.dot(lq) < 0) lq.set(-lq.x, -lq.y, -lq.z, -lq.w); // continuous signs
      prevQ = lq.clone();
      times[f] = t;
      lq.toArray(rot, f * 4);
      lp.toArray(pos, f * 3);
      if (f === 0) scale.copy(ls);
    }
    const inp = doc.createAccessor().setType('SCALAR').setArray(times).setBuffer(buffer);
    for (const [path, arr, type] of [['rotation', rot, 'VEC4'], ['translation', pos, 'VEC3']]) {
      const smp = doc.createAnimationSampler().setInput(inp).setOutput(doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer)).setInterpolation('LINEAR');
      anim.addSampler(smp).addChannel(doc.createAnimationChannel().setTargetNode(prop).setTargetPath(path).setSampler(smp));
    }
  }
  prop.setScale(scale.toArray());
}
