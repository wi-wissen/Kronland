---
title: Polish II: notices, circle spots, sound, blog
date: 2026-10-06T21:56:46+02:00
teaser: Nine tasks in one evening. How notices get priorities, how characters sit in a circle around a fire using a table of 19 numbers, why clicks on grass hit invisible characters – and how this blog grew out of the Git history.
milestone: true
---

## What this is about {#what}

On the evening of 6 October nine branches run in parallel and are merged into `main` one after another:

- **Notices** get categories with priorities, identical notices are bundled (“×3”), and attacks, fires and an
  unconscious hero stay up as persistent warnings.
- **Circle spots:** resting, waiting and woodcutting characters stand on fixed points of a circle around their target
  instead of in tile centres.
- **Female characters** get female job titles (in German “Bäuerin”, “Schwertkämpferin”), show their own portrait and
  call out with the female voice.
- **Alarm calls and battle music:** soldiers who are hit call for help too, and the battle music ends shortly after the
  last own hit.
- **Showcase:** the constant ringing when many workers move in is gone.
- **Selection:** a click on empty ground no longer selects a character standing outside the view.
- **Links:** maps can be shared by link.
- **Top bar:** faith is always shown, greyed out at 0 instead of leaving a gap.
- **Blog:** one article per milestone, with key figures and a link to the source code of that state.

## Notices with priorities {#notices}

In a big match something is always happening: a building is finished, a squad is promoted, a trade completes, the
weather changes. Until now each event produced a notice at the bottom of the screen, and the important ones got lost
among the unimportant. “Your village is under attack” must not disappear behind “squad promoted”.

### Categories

Every notice now belongs to a **category**. Each category has a priority (smaller = more important) and a limit on how
many of its notices may be visible at once:

```js
// src/game/notices.js (trimmed)
export const CATEGORIES = {
  alarm:    { prio: 0, limit: 2 },  // attack, building destroyed, hero unconscious
  fire:     { prio: 1, limit: 1 },  // burning buildings
  feedback: { prio: 2, limit: 1 },  // answer to own inputs (err.*)
  system:   { prio: 3, limit: 1 },  // saving, loading
  build:    { prio: 4, limit: 2 },  // building finished, repaired
  research: { prio: 5, limit: 1 },
  economy:  { prio: 6, limit: 2 },  // trade, resources exhausted, campfire
  military: { prio: 7, limit: 2 },  // recruited, promoted
  world:    { prio: 8, limit: 1 },  // weather, bridge collapsed
  info:     { prio: 9, limit: 1 },
};
```

When a new notice arrives, `addNotice` first checks whether the same one already exists (same key, same parameters).
Then only the counter goes up, and five notices become one with “×5”. Some notices are also merged with different
parameters: “12 promotions – latest …”. After that the category's limit is enforced – the oldest one drops out. At most
five notices are shown (four on phones), the most important category on top.

All of this is a **pure function** on a list: it gets the list, the notice and the time and returns the result, without
screen and without engine. That is why it can be tested thoroughly with Vitest – and since the time is a parameter, a
test simply passes “ten seconds later” as a number.

### Persistent warnings from the state

For attacks and fires a short notice is not enough: as long as the village burns, the warning should stay. The obvious
way would be to create a notice on the event “fire” and remove it on the event “extinguished”. That is error-prone: if
an event gets lost – for example when loading a save – the warning stays forever or never appears.

Kronland does it the other way round: the persistent warnings are **rebuilt from the game state every time the
interface updates**. Are there attack sites right now? Burning buildings? Unconscious heroes? Then there is a warning,
otherwise not. In computer science this is called *derived state*: you do not store it, you compute it from what is
there anyway. That is why it can never go stale.

### Throttling the chimes

In the showcase (the special map with all models) a worker moved in more than once per second, and every arrival
played a harp chime – a constant ringing. A cooldown of 0.4 seconds per sound did not help, because the arrivals came
less often than that. The fix is a quiet period **per event kind**: after an arrival chime, all further arrivals stay
silent for eight seconds, after a promotion for five.

```js
// src/audio/notify.js (trimmed)
export const NOTIFY_REST = { workerArrived: 8, promoted: 5 };

admit(kind, now) {
  const r = this.rest[kind];
  if (!r) return true;                                 // no rule: always
  const t = this.last.get(kind);
  if (t !== undefined && now >= t && now - t < r) return false;
  return true;
}
```

## Circle spots {#spots}

Since [article 14](blog/loading-performance/) every working character has a spot of its own. Until now that was a
**tile** next to the target. It looked stiff: four woodcutters around a tree stood in a square, workers at the campfire
in a grid. Now they stand on a **circle**.

![Workers at the campfire after this milestone: in a circle around the fire, all facing it (on the right a bush hides two of them).](blog/polish-2/campfire.webp)

### Directions without decimals

A circle needs sine and cosine. But the simulation must not use `Math.sin`, because it is not bit-identical on every
computer (see [article 1](blog/simulation-core/)). For surrounding in melee (see [article 15](blog/polish/)) there was
already a table with 24 directions in a 15° grid. For the circle spots it gets finer and moves into a file of its own:

```js
// src/sim/dirs.js
/** sin(0°, 5°, …, 90°) × 1000, rounded. */
const SIN5 = [0, 87, 174, 259, 342, 423, 500, 574, 643, 707, 766, 819, 866, 906, 940, 966, 985, 996, 1000];

const sin72 = (i) => {
  const j = ((i % 72) + 72) % 72;
  return j <= 18 ? SIN5[j] : j <= 36 ? SIN5[36 - j] : -sin72(j - 36);
};

/** 72 directions in a 5° grid (length 1000), index 0 = +x, counter-clockwise. */
export const DIR72 = Array.from({ length: 72 }, (_, k) => ({ x: sin72(k + 18), y: sin72(k) }));

/** Divisors of 72 – this many spots fit evenly on a circle made from DIR72. */
export const RING_SIZES = [72, 36, 24, 18, 12, 9, 8, 6, 4, 3, 2, 1];
```

19 numbers give 72 directions. A spot on the circle is then simply centre + direction × radius / 1000 – integers only.

### How many spots fit?

At the campfire and the tree it is simple: eight spots, radius 1.1 and 0.9 tiles. For buildings it depends on the
size. The inner circle lies half a diagonal plus 0.4 tiles from the centre, a second one 0.9 tiles further out. How many
spots a circle gets is computed by the simulation: the largest divisor of 72 at which neighbouring spots are still at
least one tile apart.

```js
// src/sim/systems/spots.js
function ringSize(radius, spacing) {
  const circ = idiv(radius * 6283, 1000);            // circumference = 2π · r, as an integer
  for (const n of RING_SIZES) if (idiv(circ, n) >= spacing) return n;
  return 1;
}
```

`6283` is 2π × 1000 – once again a way of computing with integers. For a building of 3 × 3 tiles that gives 12 spots
inside and 18 outside; the outer circle is rotated by half a spot so that nobody stands exactly behind someone else.

![Left the campfire with 8 spots, right a 3 × 3 building with two rings. The calculation on the side.](blog/polish-2/circle-spots-en.svg)

### A new field in the save game

A character's spot lives in `e.slot` and is therefore part of the game state: it goes into the state hash and the save.
What happens to old saves in which characters still have a tile spot `e.spot`? That is exactly what the migrations from
[article 9](blog/first-wave/) are for: on loading, the old tile spot is dropped, and the character picks a circle spot
in the next tick.

## One source for “female” {#sex}

Since [article 13](blog/own-art/) every profession exists as a man and a woman. Which variant a character gets is
decided by the rendering via a hash of its ID – the simulation knows nothing about it. Now the name on the selection
card, the portrait and the voice should match too. The danger: three places each decide on their own and contradict
each other.

The fix is a single source: the character manifest carries `"sex": "m"` or `"f"` on each variant, and rendering,
selection card and sound all ask the same pure function `figureSex(manifest, role, id)`. In software engineering this
principle is called [single source of truth](https://en.wikipedia.org/wiki/Single_source_of_truth).

## Clicks on nothing {#picking}

When you click, you want to select the character under the pointer. For that the rendering projects the foot and head
point of every drawn character onto the screen and checks whether the click is close enough to the line between them.
The pick radius grows with the character's size on screen – a nearby character is easier to hit.

On the Crowd map, though, over 80 % of clicks on empty grass still selected a character – one that could not be seen
at all. The reason lies in the maths of [perspective projection](https://en.wikipedia.org/wiki/3D_projection#Perspective_projection):
to put a point onto the screen, you divide by its depth. If the point lies **behind** the camera, the depth is
negative – and the calculation still produces a number, just mirrored and often huge. Points between the camera and the
near plane fare similarly. Characters just behind or below the camera thus got enormous screen coordinates and with them
an enormous pick radius.

![Side view: a character in front of the camera lands correctly on the image plane, a character just behind it is mirrored through the focal point.](blog/polish-2/pick-behind-camera-en.svg)

The fix is short. After projection every point is in *normalised device coordinates*; z values between −1 and 1 are
exactly what lies between the camera's near and far plane. Everything else does not count:

```js
// src/render/pick.js (trimmed)
export function inDepth(z) { return Number.isFinite(z) && z >= -1 && z <= 1; }

export function figurePickDistance(f, px, py, view) {
  if (!f.drawn || !inDepth(f.az) || !inDepth(f.bz)) return Infinity;   // not drawn or behind the camera
  …
  if (qx < 0 || qy < 0 || qx > view.width || qy > view.height) return Infinity;  // hit point not on screen
  const radius = Math.min(PICK_MAX_PX, Math.max(view.touch ? PICK_MIN_TOUCH_PX : PICK_MIN_PX, len * PICK_WIDTH));
  return d <= radius ? d : Infinity;
}
```

This too is a pure function without three.js and without a browser – with tests that recreate exactly the “character
behind the camera” case. By the way, on phones the smallest pick radius is larger (16 instead of 9 pixels), because
fingers are less precise than a mouse pointer.

## Maps by link {#links}

A link like `play/?seed=4711&ai=hard` describes the **start** of a match: seed, opponent, hero, fog – or a mission.
Because the simulation is deterministic, the same seed creates the same map on every computer. A few numbers in the
address are therefore enough to share a map; the map itself does not need to travel. Parameters that only affect your
own display (quality level, developer mode) are deliberately left out.

## How this blog came about {#blog}

The last of the nine tasks was this blog. Its basis is the project's Git history: every milestone is a commit, and a
file `docs/milestones.json` records for each one when it started and ended, how many files and lines it changed and how
many tests there were afterwards. A script (`scripts/milestones.mjs`) counts these values from the history itself
instead of copying them by hand. The articles are Markdown files per language, the blog pages are generated at build
time, and every article links to the source code of exactly its state.

The nine branches were merged **one after another**: each first got the current state of `main`, conflicts were
resolved so that the behaviour of both sides was kept, then `npm test`, the build and the affected E2E tests ran. That
way it stayed clear after every step which merge would have broken something.

## What did not work {#problems}

- **Ringing:** the cooldown of 0.4 s did not help because the arrivals came less often; only quiet periods per event
  kind ended it.
- **Phantom selection:** characters just behind the camera got huge screen coordinates – over 80 % of clicks on grass
  selected an invisible character on the Crowd map.
- **Silent troops:** usually a soldier is hit, not the captain. But soldiers had no speaking role, and the militia got
  lines without recordings. When merging with the female characters, the militia also had to call out with the serf
  voice of its sex again.
- **Battle music too long:** it depended on a slowly decaying “heat” and kept playing for half a minute after big
  fights. Fights between others on screen triggered it too.
- **Slow tests:** under software rendering, E2E tests managed too few ticks; the campfire test now fast-forwards with
  `stepOnce`.

## Try it yourself {#tips}

- Throttle sounds from mass events per event kind, not per single case.
- Define properties like sex in exactly one place and read them everywhere through the same function.
- Rebuild persistent states like “under attack” from the state every time instead of dragging them along as notices.
- After a projection, check whether the point lies in front of the camera at all.
- Merge parallel branches one by one and test after each step.
