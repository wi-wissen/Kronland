#!/usr/bin/env bash
# Builds the CC0 models still in use (KayKit Medieval Hexagon, Kay Lousberg) into compressed GLB files under
# public/models/: scaffolding, construction stages, rubble, rocks, mountain peaks. Everything else (buildings,
# characters, trees, bushes) are our own models (docs/MODELLE.md).
# Usage: scripts/build-assets.sh <path to KayKit-Medieval-Hexagon-Pack-1.0>
set -euo pipefail
HEX="$1/addons/kaykit_medieval_hexagon_pack/Assets/gltf"
OUT="$(dirname "$0")/../public/models"
mkdir -p "$OUT/buildings" "$OUT/nature"
opt() { npx gltf-transform optimize "$1" "$2" --compress meshopt --texture-compress false --simplify false --flatten false --join false --instance false >/dev/null; }

for b in scaffolding stage_A stage_B stage_C destroyed; do
  opt "$HEX/buildings/neutral/building_$b.gltf" "$OUT/buildings/$b.glb"
  # LOD levels: <name>.lod1.glb, .lod2.glb
  node "$(dirname "$0")/build-lods.mjs" "$OUT/buildings/$b.glb"
done
# Nature: rocks, mountain peaks
for n in rock_single_A rock_single_B rock_single_C rock_single_D rock_single_E \
         mountain_A mountain_B mountain_C; do
  opt "$HEX/decoration/nature/$n.gltf" "$OUT/nature/$n.glb"
done
cp "$1/LICENSE.txt" "$OUT/LICENSE-KayKit-Medieval-Hexagon.txt"
du -sh "$OUT"
