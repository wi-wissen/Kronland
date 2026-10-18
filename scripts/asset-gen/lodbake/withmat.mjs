import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [orig, lod, out] = process.argv.slice(2);
const o = await io.read(orig), l = await io.read(lod);
const lp = l.getRoot().listMeshes()[0].listPrimitives()[0], op = o.getRoot().listMeshes()[0].listPrimitives()[0];
for (const sem of op.listSemantics()) op.setAttribute(sem, null);
const buf = o.getRoot().listBuffers()[0];
for (const sem of lp.listSemantics()) {
  const a = lp.getAttribute(sem);
  op.setAttribute(sem, o.createAccessor().setType(a.getType()).setArray(a.getArray()).setBuffer(buf).setNormalized(a.getNormalized()));
}
op.setIndices(o.createAccessor().setType('SCALAR').setArray(lp.getIndices().getArray()).setBuffer(buf));
await io.write(out, o);
