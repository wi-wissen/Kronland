// Removes unneeded animations from character GLBs (saves download on mobile).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const KEEP = /^(Idle|Walking_A|Running_A|1H_Melee_Attack_Chop|2H_Melee_Attack_Spin|Death_A|Death_A_Pose|Spellcast_Shoot|Spellcast_Raise|Use_Item|Interact)$/;
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
for (const file of process.argv.slice(2)) {
  const doc = await io.read(file);
  const before = doc.getRoot().listAnimations().map((a) => a.getName());
  for (const a of doc.getRoot().listAnimations()) if (!KEEP.test(a.getName())) a.dispose();
  await doc.transform(prune());
  await io.write(file, doc);
  console.log(file, before.length, '→', doc.getRoot().listAnimations().map((a) => a.getName()).join(', '));
}
