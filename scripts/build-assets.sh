#!/usr/bin/env bash
# Builds the CC0 models in use (KayKit, Kay Lousberg) into compressed GLB files under public/models/.
# Usage: scripts/build-assets.sh <path to KayKit-Medieval-Hexagon-Pack-1.0> <path to KayKit-Character-Pack-Adventures-1.0>
set -euo pipefail
HEX="$1/addons/kaykit_medieval_hexagon_pack/Assets/gltf"
CHR="$2/addons/kaykit_character_pack_adventures/Characters/gltf"
OUT="$(dirname "$0")/../public/models"
mkdir -p "$OUT/buildings" "$OUT/nature" "$OUT/props" "$OUT/characters"
opt() { npx gltf-transform optimize "$1" "$2" --compress meshopt --texture-compress false --simplify false --flatten false --join false --instance false >/dev/null; }

for c in blue red green yellow; do
  for b in castle tavern home_A home_B windmill blacksmith lumbermill mine barracks archeryrange church market tower_A tower_B tower_catapult well; do
    opt "$HEX/buildings/$c/building_${b}_$c.gltf" "$OUT/buildings/${b}_$c.glb"
  done
done
for b in scaffolding stage_A stage_B stage_C destroyed grain; do
  opt "$HEX/buildings/neutral/building_$b.gltf" "$OUT/buildings/$b.glb"
done
# Nature: trees, stumps, rocks, mountain and hill decoration, water plants
for n in tree_single_A tree_single_B tree_single_A_cut tree_single_B_cut \
         trees_A_small trees_B_small trees_A_medium trees_B_medium trees_A_large trees_B_large \
         rock_single_A rock_single_B rock_single_C rock_single_D rock_single_E \
         mountain_A mountain_B mountain_C hill_single_A hill_single_B hill_single_C \
         waterplant_A waterplant_B waterlily_A waterlily_B; do
  opt "$HEX/decoration/nature/$n.gltf" "$OUT/nature/$n.glb"
done
for p in resource_lumber resource_stone sack crate_A_big barrel weaponrack target; do
  opt "$HEX/decoration/props/$p.gltf" "$OUT/props/$p.glb"
done
for ch in Knight Mage Barbarian; do
  opt "$CHR/$ch.glb" "$OUT/characters/$ch.glb"
done
cp "$1/LICENSE.txt" "$OUT/LICENSE-KayKit-Medieval-Hexagon.txt"
cp "$2/LICENSE.txt" "$OUT/LICENSE-KayKit-Adventurers.txt"
du -sh "$OUT"
