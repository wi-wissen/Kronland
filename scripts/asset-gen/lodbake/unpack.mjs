import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const [src, dst] = process.argv.slice(2);
const d = await io.read(src);
await d.transform(dequantize());
for (const e of d.getRoot().listExtensionsUsed()) if (e.extensionName === 'EXT_meshopt_compression') e.dispose();
await io.write(dst, d);
