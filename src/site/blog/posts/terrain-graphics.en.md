---
title: Terrain and graphics
date: 2026-10-03T19:45:30+02:00
teaser: Mountains, rivers with fords, cliffs, a water shader and sky – and a dedicated pass so all of it runs on weak devices too.
milestone: true
---

## What was built {#what}

On the afternoon of 3 October the prototype becomes a landscape. The map generator creates relief with mountains, a
river following the valleys, fords, cliffs, an ore mountain per player and three map sizes (96, 128, 160). The
graphics get quality levels, textured terrain, a water shader, sky, trees and decoration.

## How {#how}

- Map generator: fBm noise with domain warping, ridge noise for mountain ranges, the river through the valleys via
  Dijkstra. Connections between all starts, shafts and sites are enforced – and tested.
- Quality levels low/medium/high, chosen automatically or via `?quality=`; terrain with a splat shader and rock
  projected from three sides on cliffs.

## What didn’t work {#problems}

On weak devices and under software rendering the game started sluggishly. A dedicated step (“performance on weak
devices”) detects a software GPU and then picks the low level with half resolution, no shadows and little
decoration; trees and decoration are built with the first frame and shaders pre-warmed, all nature materials share
one shader program. And the rocky peaks were too frequent – a small follow-up made them rarer.

## Try it yourself {#tips}

- Enforce and test the properties of a random map that matter for play (reachability, wood at the start) instead of hoping for luck.
- Check graphics early on the weakest target. An automatic quality level is cheaper than complaints.
