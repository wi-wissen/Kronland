---
title: Polish: crowds, melee, mount
date: 2026-10-06T19:12:10+02:00
teaser: A stress test with about 2,500 entities reveals hangs. How to find a bottleneck, why a search grid saves 42 % of computing time, how a game loop escapes the death spiral – and how a horse gallops with computed gaits and inverse kinematics.
milestone: true
---

## What this is about {#what}

On the afternoon of 6 October seven tasks run in parallel and land on `main` within 22 minutes:

- painted icons for the menu,
- **double-click** selects all visible own characters of the same kind,
- **melee in a circle:** attackers surround their target instead of standing on one point,
- buildings without **colour streaks** at the furthest zoom level,
- **hangs in the “Crowd” map** fixed,
- a new **Nelia**,
- the Meshy **horse** as a mount with hand-written gaits.

Three of them are little computer science lessons: hunting down the bottleneck, the geometry of surrounding, and the
motion of a four-legged animal.

## Crowd: the stress test {#stress}

How does the game behave when a lot is going on? To find out, there has been a special map since the previous
milestone that you can start like any other: `?mission=bustle`, “Crowd”. It holds about 2,500 objects, four AI
opponents build towns, and two battles never end.

![The Crowd map at this milestone: full towns, an army marching past at the top right. The top bar shows 377 settlers with room for 75 – the map deliberately pushes past every limit. (German interface.)](blog/polish/bustle.webp)

On this map the game kept hanging for seconds at a time. But why?

### Measuring without graphics

Because simulation and rendering are separate (see [article 1](blog/simulation-core/)), you can run the simulation on
its own, in Node, without a browser. The script `scripts/stress-run.js` plays the Crowd map as fast as possible and
measures, per game minute, the computing time per tick, the number of characters and the cost of a save. A
[profiler](https://en.wikipedia.org/wiki/Profiling_(computer_programming)) shows in addition which function the time
is spent in.

The result was clear: **42 % of all computing time** went into a single function, `nearestEnemy` – the search for the
nearest enemy. Every soldier calls it every tick.

### Why a grid helps

The naive enemy search compares every character with every other. With *n* characters that is *n · n* comparisons:
with 2,500 characters over six million per tick. Computer scientists write this as
[O(n²)](https://en.wikipedia.org/wiki/Big_O_notation) – double the number of characters and the work quadruples.

The simulation already had a **search grid**: the map is divided into cells of 8 × 8 tiles, and each cell knows the
characters currently standing in it. To find enemies within radius *r*, you only need to look at the cells touching the
square around that circle. This data structure is called [spatial hashing](https://en.wikipedia.org/wiki/Spatial_hashing)
or simply a *grid*.

![Enemy search with a grid: instead of checking every character on the map, only the cells in the square around the search circle count.](blog/polish/spatial-grid-en.svg)

So the grid was not the problem. The problem was what happened *inside* the cells: for every character in every cell
it first checked whether it was an enemy (a query through diplomacy), then computed the exact distance, then whether it
could be attacked. The fix: **cheap checks first**.

```js
// src/sim/systems/military.js (trimmed)
export function nearestEnemy(sim, e, radius, opts) {
  const foe = [];                                   // hostility per owner – only once per call
  const far = (radius + 1) * (radius + 1);
  for (/* every cell in the square around the search circle */) {
    for (const t of sim.grid.get(cy * 4096 + cx)) {
      let f = foe[t.owner];
      if (f === undefined) f = foe[t.owner] = isEnemy(sim, e.owner, t.owner);
      if (!f) continue;                               // cheap: not an enemy
      const dx = q.x - p.x, dy = q.y - p.y;
      if (dx * dx + dy * dy >= far) continue;         // cheap: surely too far (no square root)
      const d = distTo(e, t);                         // pricier: exact distance
      if (d > radius || d >= best) continue;
      if (!targetable(sim, t)) continue;              // most expensive, only for possible best values
      best = d; bestUnit = t;
    }
  }
  return bestUnit;
}
```

Again the trick with squares: instead of checking `√(dx² + dy²) < r`, compare `dx² + dy² < r²`. That is mathematically
equivalent but saves the square root. And it remembers whether an owner is hostile instead of asking again for each of
its characters.

Together with a faster region computation (which tiles are connected and reachable, see [article 8](blog/qa-fog/)) –
which now only refloods the affected regions instead of the whole map – this gives:

| | before | after |
|---|--:|--:|
| Computing time per tick, average after 10 game minutes | 19.9 ms | ~7 ms |
| 10 game minutes of Crowd, whole run | 80 s | 29 s |
| Share of `nearestEnemy` in computing time | 42 % | 16 % |
| Region computations in a 20-minute run (843 of them) | 468 ms | 129 ms |

### Proving instead of hoping

How do you know the faster version does *exactly* the same as the slow one? This is where the state hash from
[article 1](blog/simulation-core/) pays off: after every game minute the hash of the whole game state is recorded –
before and after the optimisation. If all hashes are equal, the behaviour has not changed by a single bit. The game just
computes less.

## The game loop and the death spiral {#loop}

The simulation computes in fixed ticks of 100 ms. The browser, however, draws 60 frames per second, every 16.7 ms. The
game loop connects the two with an *accumulator*: it counts how much time has passed and computes as many ticks as are
due. This is the well-known [fixed timestep](https://gafferongames.com/post/fix_your_timestep/) pattern.

But what happens if a tick takes longer than 100 ms? Then two ticks are due at the next frame. Together they take even
longer, so three are due after that … The game spends more and more time catching up and never gets back on track. This
is called the **death spiral**.

![One frame of the game loop: after 45 ms it stops, leftover ticks are dropped.](blog/polish/game-loop-en.svg)

The new loop has a **time budget**:

```js
// src/game/loop.js
export const TICK_MS = 100, MAX_STEPS = 8, STEP_BUDGET_MS = 45;

export function runSteps(acc, step, { now = () => performance.now(), budget = STEP_BUDGET_MS, maxSteps = MAX_STEPS } = {}) {
  const t0 = now();
  let steps = 0;
  while (acc >= TICK_MS && steps < maxSteps) {
    step();
    acc -= TICK_MS;
    steps++;
    if (now() - t0 >= budget) break;          // budget used up – at least one tick ran
  }
  let dropped = 0;
  if (acc >= TICK_MS) { dropped = Math.floor(acc / TICK_MS); acc -= dropped * TICK_MS; }
  return { acc, steps, dropped };
}
```

At most eight ticks and at most 45 ms per frame; whatever would still be due after that is dropped. If the simulation
is slower than the clock, the game runs slower – but it stays responsive. Because the function receives `now` as a
parameter, it can be tested in Vitest with a fake clock, without actually waiting.

In addition, the loop now requests the next frame **before** computing and drawing. If anything throws an error, the
next frame still happens. A guard (`FaultGuard`) counts errors per area; only when the simulation fails three times in
a row does the game stop and offer to load the last save.

## Two invisible brakes {#hitches}

The browser profiler found two more hangs that had nothing to do with computing time.

**The autosave thumbnail.** When saving automatically, the game takes a small picture of the current scene for the list
of saves. For that it called `toDataURL` on the WebGL canvas. Sounds harmless – but the graphics card works
asynchronously, several frames behind the program. To hand out the pixels, the browser has to wait until the graphics
card has finished *all* pending frames. Under software rendering a single frame took 35 seconds this way, 64 % of it in
exactly this call. Now the thumbnail is copied to an ordinary 2D canvas in main memory and converted there. The save
itself is turned into text directly, without a deep copy (about 0.7 MB, roughly 20 ms); compressing and storing then
run asynchronously.

**Shaders in the middle of the game.** A [shader](https://en.wikipedia.org/wiki/Shader) is a program for the graphics
card, and it must be compiled before first use. When a model appears for the first time – a campfire, a ruin – the game
stops until its shader is ready. On real graphics cards a fraction of a second, under software rendering up to 70
seconds. Now such models are drawn once, invisibly, during the warm-up at game start.

## Melee in a circle {#surround}

Until now all attackers ran to the same point: the target. Ten swordsmen then stood inside each other. Now there are two
rings of fixed spots around every target: 8 inside, 12 outside, both within reach of the blades.

![Spots around a target. An attacker takes the spot in its direction of approach; if it is taken, the next one beside it.](blog/polish/surround-en.svg)

How does an attacker find its spot? It takes the spot whose direction best matches its direction of approach. “Best
matches” means: the largest [dot product](https://en.wikipedia.org/wiki/Dot_product) between the direction to the spot
and the vector from the target to the attacker. If the spot is taken, it tries the neighbours left and right
alternately, then the outer ring. That way nobody runs across around the target.

But the simulation must not use `Math.sin` – it is not bit-identical on every computer. So the directions are stored as
integers in a table:

```js
// src/sim/systems/military.js (trimmed)
/** 24 directions in a 15° grid as integer vectors (length 1000) – no floating-point angles in the sim. */
const SIN15 = [0, 259, 500, 707, 866, 966, 1000];     // sin(0°), sin(15°), … sin(90°) · 1000
const DIR24 = Array.from({ length: 24 }, (_, k) => {
  const s = (i) => { const j = ((i % 24) + 24) % 24; return j <= 6 ? SIN15[j] : j <= 12 ? SIN15[12 - j] : -s(j - 12); };
  return { x: s(k + 6), y: s(k) };                     // cos(k·15°) = sin(k·15° + 90°)
});
```

Seven numbers are enough for all 24 directions because the sine is symmetric: from 90° to 180° it runs through the same
values backwards, from 180° to 360° the same with a minus sign. And the cosine is just a sine shifted by 90°.

## Colour streaks in the distance {#streaks}

At the furthest zoom level buildings had colourful streaks. The cause is related to the seams in
[article 13](blog/own-art/): the most distant level of detail is heavily simplified with the meshoptimizer library.
While doing so it pulled edges across the borders of texture islands, and a triangle that used to lie on one island now
reached into the colours of a completely different spot. Forbid that, and the mesh stays almost as large as the
original (castle: 12,082 → 7,009 triangles) – too much for the distance.

The fix: the most distant level uses no texture at all, but **vertex colours**. While generating, each vertex gets the
colour the texture had at that point (sampled slightly towards the triangle's centre, never on the island border), and
only then is it simplified. The graphics card blends the colours across the triangle. At that size you see no
difference – only the streaks are gone. In the distance the castle now has 2,533 triangles without streaks instead of
2,171 with them.

## Nelia, redesigned {#nelia}

The campaign's heroine had been a placeholder so far. This time her new figure was not generated from scratch but by
**editing** the female serf's concept sheet: same build, only hair, cloak and trousers changed. The cloak carries the
magenta team colour so that Nelia clearly stands out from the serfs when seen from above.

![The four views of the new Nelia from which Meshy builds the 3D model.](blog/polish/nelia-views.webp)

![The result from Meshy, front and back, plus close-up and game model as wireframes.](blog/polish/nelia-en.webp)

## A horse learns to walk {#horse}

The horse was the last model finished before the credits ran out (see [article 13](blog/own-art/)). Meshy's automatic
skeleton, however, is made for humans; for the quadruped the project owner placed the bones by hand in the Meshy
interface – 65 of them, from the hooves to the ears and six segments in the tail.

![The horse's skeleton with its 65 bones, here in a walking pose.](blog/polish/horse-bones-en.webp)

The animations were not generated but **computed** – with a script of our own (`scripts/asset-gen/gait.mjs`) that
produces the motion from a few numbers.

### Gaits as numbers

How does a horse walk? Each leg alternates between the **stance phase** (hoof on the ground, gliding backwards relative
to the body) and the **swing phase** (hoof in the air, swinging forward). A gait defines how long the stance phase lasts
(the *duty factor*) and when each leg touches down:

```js
// scripts/asset-gen/gait.mjs
export const GAITS = {
  // walk: four-beat (left hind, left front, right hind, right front), always 2–3 hooves on the ground
  walk:   { period: 0.75, stride: 0.75, duty: 0.62, touch: { LH: 0, LF: 0.25, RH: 0.5, RF: 0.75 }, lift: 0.1, flex: 0.75 },
  // gallop (right lead, three-beat): left hind – right hind + left front – right front, then suspension
  gallop: { period: 0.5, stride: 1.7, duty: 0.36, touch: { LH: 0, RH: 0.16, LF: 0.2, RF: 0.38 }, lift: 0.18, flex: 1.25 },
};
```

![Gait diagram from exactly these numbers: in the walk two or three hooves are always on the ground; the gallop has a phase with no ground contact at all.](blog/polish/gaits-en.svg)

From the phase each hoof gets a path: in the stance phase it glides backwards evenly at ground speed – so nothing
slides – and in the swing phase it rises on a sine arc and comes forward.

### Inverse kinematics: from the hoof back to the joints

Now we know where each hoof should be. But what we need are the *angles* of the joints – shoulder, elbow, carpus,
fetlock – so that the hoof lands exactly there. That is the reverse of ordinary kinematics (angles known → where is the
hoof?) and is therefore called [inverse kinematics](https://en.wikipedia.org/wiki/Inverse_kinematics).

A leg with four joints has infinitely many solutions. The script picks the one closest to a *preferred posture* (a
horse's knee simply bends backwards) and solves it step by step:

```pseudo
repeat up to 80 times:
    compute from the current angles where the hoof is       (forward kinematics)
    r = target − hoof                                        (how far off?)
    J = how much does each joint move the hoof?              (Jacobian matrix)
    solve (W·JᵀJ + Λ) · Δ = W·Jᵀr − Λ·(angles − preferred)   (Gaussian elimination)
    angles += Δ (at most 0.3 rad each)
    stop when nothing changes any more
```

The method is called *damped least squares*. The [Jacobian matrix](https://en.wikipedia.org/wiki/Jacobian_matrix_and_determinant)
tells you which way the hoof moves when you turn a joint a little – in the plane that is simply the vector from the joint
to the hoof, rotated by 90°. The script solves the small system of equations with
[Gaussian elimination](https://en.wikipedia.org/wiki/Gaussian_elimination), as you know it from maths class.

On top come body motions as sine curves: in the gallop the trunk rises and falls and rocks forwards and backwards, the
head nods with the front hooves, and the tail swings with a delay from segment to segment. All curves have integer
frequencies over one cycle, so the loop does not jump at the end.

![The finished gallop at six moments of one cycle (0.5 seconds).](blog/polish/gallop.webp)

## What did not work {#problems}

- **Hangs:** the enemy search took 42 % of computing time, the autosave thumbnail stopped the game, and shader
  compilation mid-game froze it for up to 70 seconds under software rendering – all three described above.
- **Nelia generated anew** came out bulky, although the template was slender. Only editing the female serf's sheet hit
  the right build.
- **Colours:** Gemini painted the cloak raspberry red instead of magenta, and Meshy pushed it towards violet. A
  recolouring step turns both back to the team colour.

## Try it yourself {#tips}

- Build a stress test as a normal map – then it can be played and measured at any time.
- Measure with a profiler before optimising. The bottleneck is rarely where you suspect it.
- Optimise with hash comparison: identical behaviour can be proven, not just felt.
- Give the game loop a time budget and drop backlog instead of catching up.
- Cheap checks first, expensive ones last – and compare distances squared.
- If a generator misses the character, edit a successful template instead of rolling the dice again.
