// unpack near model for Blender: no meshopt/quantization, body mesh without skin at scene root (raw mesh space)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, prune } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const [src, dst] = process.argv.slice(2);
const doc = await io.read(src); await doc.transform(dequantize());
for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === 'EXT_meshopt_compression' || e.extensionName === 'KHR_mesh_quantization') e.dispose();
const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
const body = doc.getRoot().listNodes().find((n) => n.getMesh() && n.getSkin());
const keep = doc.createNode('body').setMesh(body.getMesh());
for (const p of body.getMesh().listPrimitives()) { p.setAttribute('JOINTS_0', null); p.setAttribute('WEIGHTS_0', null); }
for (const n of scene.listChildren()) scene.removeChild(n);
scene.addChild(keep);
await doc.transform(prune());
await io.write(dst, doc);
