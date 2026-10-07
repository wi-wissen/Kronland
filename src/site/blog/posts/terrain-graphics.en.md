---
title: Terrain and graphics
date: 2026-10-03T19:45:30+02:00
teaser: Mountains, rivers with fords, cliffs, a water shader and sky – how fractal noise, Dijkstra and flood fill build a fair random map, how shaders colour it, and why weak devices needed a round of their own.
milestone: true
---

## What was built {#what}

On the afternoon of 3 October the prototype becomes a landscape. The map generator creates relief with mountains, a
river that follows the valleys, fords, cliffs, an ore hill per player and three map sizes (96, 128 and 160 tiles per
side). The graphics get quality levels, textured terrain, a water shader, sky, trees and decoration. The generator
grows from 172 to about 700 lines along the way.

![The start on map 42 at this state: the castle stands on a levelled plateau, rock slopes rise all around.](blog/terrain-graphics/start.webp)

This article first looks inside the generator – there is a surprising amount of classic computer science in there –
and then at the graphics card.

## Hills from noise {#noise}

Real terrain is neither completely random (it would look like TV static) nor regular. It has large shapes (valleys,
ranges of hills) and ever smaller details on top. That is exactly what **fractal noise** imitates.

The building block is *value noise*: on a coarse grid every grid point gets a random value – not from a generator that
outputs numbers one after another, but from a hash function of (x, y, seed). That way each point only depends on its
coordinates, no matter in which order you compute. Between the grid points values are blended smoothly with the curve
3t² − 2t³ so that there are no kinks – in integers, of course:

```js src/sim/mapgen.js
export function valueNoise(x, y, cell, s) {
  const gx = Math.floor(x / cell), gy = Math.floor(y / cell);   // grid cell
  const fx = x - gx * cell, fy = y - gy * cell;                 // position inside the cell
  const c2 = cell * cell;
  const wx = Math.trunc((fx * fx * (3 * cell - 2 * fx)) / c2);  // 3t² − 2t³, scaled
  const wy = Math.trunc((fy * fy * (3 * cell - 2 * fy)) / c2);
  const v00 = hash32(gx, gy, s) & 1023, v10 = hash32(gx + 1, gy, s) & 1023;
  const v01 = hash32(gx, gy + 1, s) & 1023, v11 = hash32(gx + 1, gy + 1, s) & 1023;
  const a = v00 * (cell - wx) + v10 * wx;                       // blend along the top
  const b = v01 * (cell - wx) + v11 * wx;                       // blend along the bottom
  return Math.trunc((a * (cell - wy) + b * wy) / c2);           // then vertically: 0 … 1023
}
```

Several such layers – **octaves** – with half the grid spacing and half the weight stacked on top of each other give a
height profile with large and small shapes. This is called *fBm*, after
[fractional Brownian motion](https://en.wikipedia.org/wiki/Fractional_Brownian_motion); a related, better-known
technique is [Perlin noise](https://en.wikipedia.org/wiki/Perlin_noise).

![Four octaves along a line across map 42 and their weighted sum. The values are computed with the noise function from the code of this milestone.](blog/terrain-graphics/noise-en.svg)

Two tricks make the terrain look more natural:

- **Warping** (*domain warping*): before looking up the noise, a *second* noise shifts the coordinates by up to six
  tiles. Round hills turn into winding valleys.
- **Ridged noise** for mountains: `1023 − |2 · n − 1023|` mirrors the values at the middle. Where the noise crosses the
  middle a sharp crest appears – just like real mountain ridges.

## Mountains, ore hills and a river {#features}

On top of the lowlands the generator places **mountain massifs**. Candidates are fixed spots – free corners, edge
midpoints, the map centre – as long as they are far enough from every castle. Their order is shuffled with the seed
([Fisher–Yates](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle)), and the first ones become mountains.
Every player also gets a small **ore hill** at a fixed distance from the castle, with the shafts on its flanks. Of 16
possible directions the winner is one that does *not* point to the map centre – that is where the paths to the enemy
run later.

The **river** is the nicest example of a graph algorithm turning into landscape. It should flow from one edge of the
map to another and follow the valleys. That is a path search! The generator uses
[Dijkstra’s algorithm](https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm) from the
[first article](blog/simulation-core/#pathfinding) – except that this time the cost of a tile depends on its height:

```js src/sim/mapgen.js
const cost = (k) => {
  let c = 20 + Math.max(0, H[k] - waterLevel) / 6;          // high = expensive, low = cheap
  const ds = minStartDist(x, y);
  if (ds < 22) c += (22 - ds) * 60;                         // keep away from the castles
  for (const m of mineHills) if (dist(x, y, m.x, m.y) < m.r + 4) c += 400;  // not through ore hills
  return Math.trunc(c + (valueNoise(x * 8, y * 8, 64, seed + 77) >> 1) + …); // noise: meanders
};
const path = dijkstra(S, start, end, cost);
```

The cheapest path winds through the valleys, and the extra noise in the costs makes it meander instead of drawing
straight lines. Along the path the terrain is lowered – narrow upstream, wider downstream. At two or three places a
flat, walkable **ford** remains.

Where the terrain is very steep or very high it turns into **rock** – impassable and unbuildable.

![Map 42 at this state: left the heights, right water (blue), rock (brownish grey), forest, castles (red), shafts and settlement spots (white frames).](blog/terrain-graphics/map.webp)

## Enforce, don’t hope: reachability {#reachable}

Mountains, cliffs and a river have a catch: they can cut a castle off from the rest of the world or make a shaft
unreachable. Randomness must never make a game unplayable. So at the end the generator checks whether everything is
connected – with a [flood fill](https://en.wikipedia.org/wiki/Flood_fill), a breadth-first search that simply marks
everything reachable on foot from the start:

```js src/sim/mapgen.js
const label = (from) => {
  const seen = new Uint8Array(N);
  const q = [from]; seen[from] = 1;
  for (let qi = 0; qi < q.length; qi++) {          // the array is the queue
    const k = q[qi], x = k % S, y = (k / S) | 0;
    if (x > 0     && !seen[k - 1] && passable(k - 1)) { seen[k - 1] = 1; q.push(k - 1); }
    if (x < S - 1 && !seen[k + 1] && passable(k + 1)) { seen[k + 1] = 1; q.push(k + 1); }
    if (y > 0     && !seen[k - S] && passable(k - S)) { seen[k - S] = 1; q.push(k - S); }
    if (y < S - 1 && !seen[k + S] && passable(k + S)) { seen[k + S] = 1; q.push(k + S); }
  }
  return seen;
};
```

If a castle, a shaft or a settlement spot is not marked, the generator **carves** a connection: Dijkstra finds the
cheapest way through rock and water (rock and water are expensive, open land cheap), and along that way the terrain is
shaped into a ramp with a limited gradient or a ford. Then it checks again – until everything is connected.

The tests insist on these promises, for many combinations of seed, map size and number of players:

```text
✓ has real relief: mountains, valleys and cliffs
✓ cliffs are neither walkable nor buildable, not even in winter
✓ start regions are flat and freely buildable
✓ Seed 5, size 128, 3 players: all castles connected, shafts reachable
```

## What a shader is {#shaders}

Now to the graphics. So far every tile had one colour. Now the ground should look like grass, meadow, earth, sand, rock
or snow – with soft transitions. That needs a custom [shader](https://en.wikipedia.org/wiki/Shader): a small program in
the GLSL language that runs *on the graphics card*, for every single pixel, millions of times in parallel.

The technique is called *splatting*. For every corner of the terrain mesh JavaScript computes weights once: how much
rock (from the slope), how much sand (from the closeness to the shore), how much snow (from the height)? The graphics
card blends these weights between the corners automatically, and the shader mixes the matching textures per pixel:

```text src/render/terrain.js (GLSL, trimmed)
// rock projected from three sides so cliffs are not distorted
vec3 bw = pow(abs(normalize(vWNrm)), vec3(4.0));    // how much does the surface face x, y, z?
bw /= (bw.x + bw.y + bw.z);
vec3 cRock = texture2D(tRock, vWPos.zy * uRockRep).rgb * bw.x
           + texture2D(tRock, vWPos.xz * uRockRep).rgb * bw.y
           + texture2D(tRock, vWPos.xy * uRockRep).rgb * bw.z;
…
albedo = mix(albedo, cSnow, sMask);                  // mix snow on top
```

The rock trick is called *triplanar projection*: laying a texture “from above” onto an almost vertical slope would
stretch it into long streaks. So it is applied from all three directions and weighted by the tilt of the surface.

The **water** is a shader of its own too: waves move over time, shallow water is turquoise, deep water blue, and there
is foam at the shore. How does the shader know the depth? From a small texture that stores, for every half tile, the
terrain height below the water level – data the graphics card can look up like an image.

## Quality levels for every device {#quality}

A browser game runs on a gaming PC just like on a five-year-old phone. So there are three quality levels, and each is a
table of settings:

| Setting | low | medium | high |
|---|---:|---:|---:|
| max. pixel ratio | 1.25 | 1.5 | 2 |
| shadow resolution | 1024 | 2048 | 4096 |
| texture size | 256 | 512 | 1024 |
| decoration (grass, flowers, pebbles) | 25 % | 60 % | 100 % |
| waves and foam on the water | no | yes | yes |

The level is chosen automatically: phone or small screen → low; recognisably weak graphics chips → medium; otherwise
high. You can override it with `?quality=low` in the address. The browser reveals the name of the graphics chip via a
WebGL extension – if it says “SwiftShader” or “llvmpipe”, no graphics card is computing at all, but the processor.

![The same map from further up, on the low level: forests, rock rings around the start plateaus and the ore hill with the shafts to the right of the castle.](blog/terrain-graphics/overview.webp)

## What did not work {#problems}

On weak devices and under software graphics the game started sluggishly – the first frame took many seconds, and then
it stuttered. A dedicated task “performance on weak devices” tackled it:

- A software GPU is detected and gets the low level with half resolution, no shadows and little decoration.
- Trees and decoration are built in one go for the first frame instead of bit by bit.
- The shaders are “pre-warmed” while loading: the graphics card compiles every shader program on first use, and that
  takes noticeable time – better behind the loading screen than in the middle of the game.
- All nature materials share one shader program instead of many.

And the rocky peaks were too frequent – a small follow-up made them rarer.

## Try it yourself {#tips}

- **Enforce and test the properties of a random map that matter for play** (reachability, flat start areas) instead of
  hoping for luck. Flood fill and Dijkstra are the right tools for it.
- **Play with noise yourself:** a few lines of value noise and a loop that paints grey values into a canvas – and you
  immediately see what octaves and warping do.
- **Check the graphics early on the weakest target.** An automatic quality level is cheaper than complaints.
