---
title: Own art instead of KayKit
date: 2026-10-05T22:54:41+02:00
teaser: The largest branch: buildings in three levels, 24 professions, soldiers, heroes, trees – all own models from image AI and Meshy. What an asset pipeline looks like, why textures need their gaps filled, how a sword stays rigid in the hand and how 1,470 MB become 16 MB.
milestone: true
---

## What this is about {#what}

Since [article 5](blog/first-package/) the game used the free models of the KayKit pack: tidy, but recognisably “kit”,
and with buildings that did not fit all of the game's upgrade levels. This milestone replaces almost everything with
our own models. The work ran from the evening of 4 October to the evening of 5 October, more than a day, and it is the
largest branch of the project.

Afterwards Kronland has its own art for:

- all **buildings** in their upgrade levels (66 models),
- **24 professions**, each as a man and a woman,
- **soldiers**, riders, heroes, bandits,
- **trees** with a winter version, bridge, ruins, campfire, portraits and a cannon.

Of the KayKit pack only the scaffolding, construction stages, rubble and rocks remain.

![Before: mission 4 “Eisenhain” with the KayKit models (state of article 11).](blog/own-art/c4-before.webp)

![After: the same spot after this milestone – own castle, own buildings, own characters and trees.](blog/own-art/c4-after.webp)

## A pipeline instead of handiwork {#pipeline}

With more than a hundred models you cannot build each one by hand. Instead a **pipeline** is created: a chain of
scripts that sends every model through the same steps. Each step reads the files of the previous one and writes its
own. That has three advantages: you can repeat any step on its own, you can improve it and run all models through it
again, and you see exactly where an error came from.

![A character from idea to game. Blue are the paid steps at Meshy, orange our own scripts.](blog/own-art/pipeline-en.svg)

The steps:

1. **Concept** with an image model. For characters a sheet with four views (see
   [article 10](blog/characters-coding/)), for buildings a front view and, if needed, a back view.
2. **Image → 3D** at Meshy 7.1: about four minutes, 30 credits.
3. **Auto-rig:** Meshy inserts a skeleton (5 credits). Buildings do not need one.
4. **Animations:** 3 credits per clip – walking, working, fighting, dying.
5. **Remesh:** the same model reduced to about 2,000 triangles, as the game model for distance (5 credits).
6. **Post-processing** with our own scripts: team colour, filling gaps in the texture, binding weapons rigidly, levels
   of detail, shrinking animation files.

Meshy's web interface lets you look at each of these intermediate states: the raw model, the inserted skeleton, every
animation. The script does not need it, it works through Meshy's programming interface – but to understand what
happens there, a look inside helps.

1,500 Meshy credits cost about 20 dollars. A character with six animations therefore costs around 58 credits, just
under a dollar; a building concept with Seedream 5.0 Flash two cents.

### The job file

Every paid step is first booked in a budget ledger (`assets-src/credits.json`) and aborts above the limit. And every
Meshy task ID immediately goes into a file `job.json` next to the model. If a run breaks off – network gone, credits
empty – the script reads the job file on the next start and continues with the next open step instead of ordering
already paid work again. This property is called [idempotence](https://en.wikipedia.org/wiki/Idempotence): running a
script twice has the same effect as running it once.

## Buildings: all levels in one picture {#buildings}

A building has up to three upgrade levels. Generate each one separately and each looks a bit different: different
scale, different construction, different roof colour. The project owner's idea: order **all levels in one image**, side
by side. Then the image model paints them in the same style and scale. Plus fixed rules for all buildings:

- uniform terracotta roofs (blue is a player colour and must not be on the roof),
- one storey more and finer material per level: timber and plaster, then a stone base, then dressed stone with golden
  tips,
- cut out, without ground and without smoke (Meshy would turn smoke into geometry), only one door, no lettering,
- a magenta pennant that the game later recolours to the player colour.

Style comes from reference images, not from words: the prompt includes the building's icon from the game and a “style
house” that the project owner had created with an image model himself. After comparing several models, Seedream 5.0
Flash (two cents per image) became the standard for buildings.

![The showcase: a special map on which every model stands once – here a section with castle, residences and workshops in different upgrade levels.](blog/own-art/showcase.webp)

## Post-processing: three problems, three scripts {#postprocess}

### Bright lines in the distance: filling gaps

Meshy's textures consist of hundreds of small islands: every piece of the surface is laid out somewhere on the texture
image, with empty background in between. Up close that does not matter, because no triangle points at the background.
From afar it does.

The reason is called [mipmapping](https://en.wikipedia.org/wiki/Mipmap). When an object is small on screen, the
graphics card does not use the full texture but a pre-shrunk version (half the size, a quarter …). When shrinking,
neighbouring pixels are averaged – and at the edge of an island the colour of the empty background mixes in. In the
game, bright lines then appear along the seams.

The fix: the gaps between the islands are filled completely with the colour of the nearest island. Then only “real”
colour mixes in when shrinking.

### The sword that bends

Tools in the hand were the hardest topic of the whole branch. Meshy does not know that a sword is rigid. It spreads the
blade's vertices over several bones – hand, forearm, sometimes even the knee. When the character moves, the blade
bends like rubber.

The script `rigid.mjs` fixes this geometrically: all vertices inside a cylinder from the hand to the blade tip are bound
100 % to the hand bone.

```js scripts/asset-gen/rigid.mjs
export function bindCylinder(pos, joints, weights, a, b, radius, joint, start = 0.08) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  for (let i = 0; i < pos.length / 3; i++) {
    const v = [pos[i * 3] - a[0], pos[i * 3 + 1] - a[1], pos[i * 3 + 2] - a[2]];
    const t = (v[0] * ab[0] + v[1] * ab[1] + v[2] * ab[2]) / L2;       // position along the axis
    if (t < start || t > 1.03) continue;
    const d2 = (v[0] - ab[0] * t) ** 2 + (v[1] - ab[1] * t) ** 2 + (v[2] - ab[2] * t) ** 2;
    if (d2 > radius * radius) continue;                                  // too far from the axis
    // only one bone left, with weight 1
    for (let k = 0; k < 4; k++) { joints[i * 4 + k] = k === 0 ? joint : 0; weights[i * 4 + k] = k === 0 ? 1 : 0; }
  }
}
```

This is vector maths from school: `t` is the [projection](https://en.wikipedia.org/wiki/Vector_projection) of the
vertex onto the line from the hand (`a`) to the tip (`b`), as a fraction of the distance. `d2` is the squared distance
from the line. If `t` lies between just above 0 and 1 and the distance is smaller than the radius, the vertex is inside
the cylinder. Squares are compared so that no square root is needed. The fist itself (`t` below 0.08) keeps Meshy's
weights so the fingers still move.

### 1,470 MB of animation files

For every clip Meshy delivers a separate file – and each contains the **complete model** including its texture, 4 to
8 MB. But only the animation tracks are needed: for each bone a list of times and rotations. With dozens of characters
with six to ten clips each, that added up to 1,470 MB.

![What an animation file contains and what of it is needed.](blog/own-art/animation-file-en.svg)

The script `strip-anims.mjs` opens every file with the glTF-Transform library, throws away mesh, skin, material and
texture and keeps only tracks and bone names – 20 to 50 KB per clip. Afterwards it is 16 MB. “Lossless” is meant
literally: the finished game model that post-processing builds from the shrunk files is bit for bit identical.

The file format behind this is [glTF](https://en.wikipedia.org/wiki/GlTF) (in its binary form `.glb`): an open format
for 3D scenes that stores meshes, materials, skeletons and animations in one file – the JPEG of 3D, so to speak.

## What did not work {#problems}

- **Tools in hand looked “miserable”** (the project owner's verdict). Generated animations know nothing of tools: the
  hands are open, the tool floats. With the weapon in the concept and the arm close to the body, Meshy fused the sword
  with the leg. In A-pose it dropped held items entirely. Solution for soldiers: weapon fixed in the model, away from
  the body, keep the concept's pose, blade bound rigidly to the hand bone by script.
- **The Meshy credits ran out:** the first run managed 36 building levels, 12 characters and the horse, then it broke
  off. Since then every step is in the job file and is resumed instead of paid again.
- **Image models** painted German building names into the picture as lettering, ignored numbers like “1.5 × width” (a
  vivid description like “three rows of windows above each other” works) and turned pits into cut-out cubes of earth –
  “flat like a rug” helped.
- **The merchant with scales** lost his head in the rig twice. He no longer carries scales.

## Try it yourself {#tips}

- Build a pipeline from small steps with files in between – then each step can be repeated on its own.
- Write task IDs down immediately and make scripts idempotent. Paid steps are ordered only once.
- Style comes from reference images, not words – and never pass your own intermediate results on as style references,
  errors get inherited.
- Generate things that belong together in one image (all levels of a building).
- Check models at game size and from a distance: errors like bright seams only show there.
