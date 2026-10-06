// Move the characters' animations from the near model into the game model (postprocess.mjs calls this for every new
// character; manual use only needed for older files). Background: the game bakes the bone texture from the file with the animations.
// If they live in the game model (<model>.lod1.glb, ~0.6 MB), the large near model (<model>.glb, ~2.4 MB with
// 2048 textures) only has to be loaded when a character is close enough for the near level. See docs/MODELLE.md.
//
//   node scripts/asset-gen/anims-to-game.mjs            # all characters from public/models/characters/manifest.json
//   node scripts/asset-gen/anims-to-game.mjs Farmer FarmerF
//
// Channels are matched by node names (game and near model are set on the same skeleton). The
// geometry stays untouched: only repack buffers (meshopt), no new quantisation.

import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const DIR = process.env.CHAR_DIR ?? 'public/models/characters';

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

/** Copy animations from src to dst (target nodes by name). @returns {number} number of clips */
export function copyAnimations(src, dst) {
  const nodes = new Map(dst.getRoot().listNodes().map((n) => [n.getName(), n]));
  const buffer = dst.getRoot().listBuffers()[0];
  // many channels share time axes: copy each source accessor only once
  const accs = new Map();
  const copyAcc = (a) => {
    if (!accs.has(a)) accs.set(a, dst.createAccessor(a.getName()).setType(a.getType()).setArray(a.getArray().slice()).setNormalized(a.getNormalized()).setBuffer(buffer));
    return accs.get(a);
  };
  let n = 0;
  for (const anim of src.getRoot().listAnimations()) {
    const out = dst.createAnimation(anim.getName());
    const samplers = new Map();
    for (const ch of anim.listChannels()) {
      const target = nodes.get(ch.getTargetNode()?.getName());
      if (!target) continue;
      const s = ch.getSampler();
      let s2 = samplers.get(s);
      if (!s2) {
        s2 = dst.createAnimationSampler().setInput(copyAcc(s.getInput())).setOutput(copyAcc(s.getOutput())).setInterpolation(s.getInterpolation());
        out.addSampler(s2);
        samplers.set(s, s2);
      }
      out.addChannel(dst.createAnimationChannel().setTargetNode(target).setTargetPath(ch.getTargetPath()).setSampler(s2));
    }
    n++;
  }
  return n;
}

/**
 * Match animated nodes with a mesh (tools) in the target to the source. When packing without animations,
 * gltf-transform wrote the mesh's dequantisation into the node's pose; an animation overwrites
 * that pose, so the tool would sit wrong in the hand. Therefore: the node gets the pose from the source, the mesh
 * moves into a child node with the remainder (dequantisation). Geometry stays unchanged.
 * @returns {string[]} adjusted nodes
 */
export function separateAnimatedMeshes(src, dst) {
  const srcNodes = new Map(src.getRoot().listNodes().map((n) => [n.getName(), n]));
  const animated = new Set();
  for (const a of dst.getRoot().listAnimations()) for (const c of a.listChannels()) animated.add(c.getTargetNode());
  const fixed = [];
  for (const node of animated) {
    const mesh = node.getMesh(), ref = srcNodes.get(node.getName());
    if (!mesh || !ref) continue;
    const near = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-6);
    if (near(node.getTranslation(), ref.getTranslation()) && near(node.getRotation(), ref.getRotation()) && near(node.getScale(), ref.getScale())) continue;
    // rest = inv(source pose) · pose in the target, as a child node with the mesh
    const rest = mul(invert(ref.getMatrix()), node.getMatrix());
    const child = dst.createNode(`${node.getName()}_mesh`).setMatrix(rest).setMesh(mesh);
    const skin = node.getSkin();
    if (skin) { child.setSkin(skin); node.setSkin(null); }
    node.setMesh(null).setTranslation(ref.getTranslation()).setRotation(ref.getRotation()).setScale(ref.getScale()).addChild(child);
    fixed.push(node.getName());
  }
  return fixed;
}

/** 4×4 matrices (column-major, like glTF). */
function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function invert(m) {
  // general inverse (cofactors)
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * det, (a02 * b10 - a01 * b11 - a03 * b09) * det, (a31 * b05 - a32 * b04 + a33 * b03) * det, (a22 * b04 - a21 * b05 - a23 * b03) * det,
    (a12 * b08 - a10 * b11 - a13 * b07) * det, (a00 * b11 - a02 * b08 + a03 * b07) * det, (a32 * b02 - a30 * b05 - a33 * b01) * det, (a20 * b05 - a22 * b02 + a23 * b01) * det,
    (a10 * b10 - a11 * b08 + a13 * b06) * det, (a01 * b08 - a00 * b10 - a03 * b06) * det, (a30 * b04 - a31 * b02 + a33 * b00) * det, (a21 * b02 - a20 * b04 - a23 * b00) * det,
    (a11 * b07 - a10 * b09 - a12 * b06) * det, (a00 * b09 - a01 * b07 + a02 * b06) * det, (a31 * b01 - a30 * b03 - a32 * b00) * det, (a20 * b03 - a21 * b01 + a22 * b00) * det,
  ];
}

/** Remove all animations of a document. */
export function dropAnimations(doc) {
  for (const a of doc.getRoot().listAnimations()) {
    for (const smp of a.listSamplers()) { smp.getInput()?.dispose(); smp.getOutput()?.dispose(); smp.dispose(); }
    for (const c of a.listChannels()) c.dispose();
    a.dispose();
  }
}

/**
 * Convert one character: animations from the near model into the game model (also called from postprocess.mjs).
 * @param {string} model @param {string} [dir] folder with <model>.glb and <model>.lod1.glb
 * @returns {Promise<string>} report
 */
/** Read a GLB (for postprocess.mjs: earlier game model as clip source). */
export const readGlb = (file) => io.read(file);

export async function convert(model, dir = DIR, opts = {}) {
  const near = path.join(dir, `${model}.glb`), game = path.join(dir, `${model}.lod1.glb`);
  if (!fs.existsSync(near) || !fs.existsSync(game)) return `${model}: skipped (file missing)`;
  const [a, b] = [await io.read(near), await io.read(game)];
  if (b.getRoot().listAnimations().length) return `${model}: game model already has animations`;
  // source of the clips: the near model, or (opts.animsFrom, e.g. only the game model rebuilt) an earlier game model
  const from = opts.animsFrom ?? a;
  if (!from.getRoot().listAnimations().length) return `${model}: no animations found`;
  const before = [fs.statSync(near).size, fs.statSync(game).size];
  const n = copyAnimations(from, b);
  // pose of the tool nodes: the reference is the near model (they sit correctly there)
  const moved = separateAnimatedMeshes(a, b);
  dropAnimations(a);
  await io.write(game, b);
  if (!opts.animsFrom) await io.write(near, a);
  const kb = (x) => (x / 1024).toFixed(0);
  return `${model}: ${n} clips${moved.length ? ` (tools: ${moved.join(', ')})` : ''} · near model ${kb(before[0])} → ${kb(fs.statSync(near).size)} KB · game model ${kb(before[1])} → ${kb(fs.statSync(game).size)} KB`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(manifest.models).filter((k) => (manifest.models[k].lods ?? 0) >= 1);
  for (const m of names) console.log(await convert(m));
}
