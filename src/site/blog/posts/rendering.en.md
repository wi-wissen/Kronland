---
title: 3D rendering and controls
date: 2026-10-03T12:08:15+02:00
teaser: Three.js renders the world, mouse and touch control it, and Playwright checks it on desktop and phone from day one – plus scene graphs, triangles, the camera and why ten ticks per second still look smooth.
milestone: true
---

## What was built {#what}

Sixteen minutes after the simulation core the rendering arrives: [Three.js](https://en.wikipedia.org/wiki/Three.js)
draws terrain, buildings and figures, the controls work with mouse and touch, and a first interface shows the stock
and a build menu. The first three Playwright tests come with it. One minute later a one-line change follows: the build
gets a relative base path.

![The very first 3D version (map 42): castle, village centre, trees, shafts and four serfs – all built from simple primitives in code, without a single loaded model.](blog/rendering/first-3d.webp)

Everything you see here is assembled in code from boxes, cylinders and cones. The interesting part is *how* the image
comes out of the simulation without the graphics ever touching the game rules.

## Computing in ticks, drawing in flow {#loop}

The simulation takes ten steps per second, the screen shows sixty frames or more. The beat comes from
`requestAnimationFrame`: the browser calls a function just before it paints the next frame. The engine collects the
elapsed time in a “pot” and computes as many ticks as fit in – the pattern is called a *fixed time step with an
accumulator*:

```js src/game/Engine.js
frame(now) {
  const dt = Math.min(0.1, (now - this.last) / 1000);  // seconds since the last frame
  this.last = now;
  if (!this.paused) this.acc += dt * 1000 * this.speed; // speed 1×, 2×, 4×
  let steps = 0;
  while (this.acc >= TICK_MS && steps < 8) {            // TICK_MS = 100
    this.stepOnce();                                     // AI + sim.step()
    this.acc -= TICK_MS; steps++;
  }
  // what is left in the pot = how far we are between two ticks (0 … 1)
  this.renderer.frame(this.acc / TICK_MS, dt, this.prev, { … });
}
```

If figures were only drawn at their tick positions, they would jump ten times per second. So before each tick the
engine remembers the old positions, and the renderer **interpolates** between old and new:

```js src/render/Renderer.js
const px = prev ? prev.px + (e.px - prev.px) * alpha : e.px;
const py = prev ? prev.py + (e.py - prev.py) * alpha : e.py;
```

![Ticks and frames: between two ticks every frame shows an intermediate position. The fraction α is what is left in the pot.](blog/rendering/ticks-en.svg)

That is [linear interpolation](https://en.wikipedia.org/wiki/Linear_interpolation) – the same formula as a straight
line through two points. The simulation stays integer and deterministic; only the rendering uses floating point, and
it may, because it writes nothing back. The limit of eight ticks per frame prevents the “spiral of death”, by the way:
if the computer is too slow, the game rather slows down than trying to catch up on more and more ticks.

## What a 3D scene is {#scene}

Three.js organises everything that is drawn in a **scene graph** – a [tree](https://en.wikipedia.org/wiki/Tree_%28data_structure%29)
of nodes. Every node has a position, rotation and scale *relative to its parent*. Move a “serf” group and its legs,
head and tool move along automatically.

![The scene graph of the first version: camera and lights, terrain and water, trees as one instanced object, buildings and figures as groups of simple parts.](blog/rendering/scene-graph-en.svg)

The leaves of the tree are **meshes**: a shape (*geometry*) plus a material (colour, shininess). And every shape
ultimately consists of [triangles](https://en.wikipedia.org/wiki/Polygon_mesh). Graphics cards are really fast at one
thing: projecting millions of triangles onto the screen and colouring them. A cylinder is a ring of narrow
rectangles – pairs of triangles –, a sphere is a net of many small triangles. A serf of the first version is built
like this:

```js src/render/models.js
export function serfModel(owner) {
  const g = new THREE.Group();
  const b = new THREE.Group(); g.add(b);
  for (const s of [-1, 1]) {                         // two legs with a hip joint
    const hip = new THREE.Group(); hip.position.set(s * 0.05, 0.25, 0);
    hip.add(box(0.07, 0.25, 0.07, 0x4a3a2a, 0, -0.25, 0)); b.add(hip);
  }
  b.add(cyl(0.1, 0.15, 0.32, 0xc39a5e, 0, 0.24, 0));  // body
  const head = mesh(new THREE.SphereGeometry(0.09, 8, 6), 0xe6c2a0);
  head.position.y = 0.64; b.add(head);
  b.add(cyl(0.06, 0.11, 0.08, PLAYER_COLORS[owner % 4], 0, 0.7, 0)); // cap in player colour
  …
}
```

Switch on `wireframe` in the material and you see what the world is really made of. The scene above has about 300
meshes with roughly 125,000 triangles in total:

![The same scene as a wireframe: the terrain is a regular net of triangles, trees are stacked cones.](blog/rendering/wireframe.webp)

## Terrain from the height grid {#terrain}

The simulation knows one height per *tile*. A triangle mesh, however, needs heights at the *corners*. The renderer
takes the mean of the up to four adjacent tiles for every corner and then lays two triangles over each tile:

![From height grid to triangle mesh: height per tile, corners as the mean, two triangles per tile.](blog/rendering/terrain-mesh-en.svg)

```js src/render/terrain.js
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const h00 = this.cornerY(x, y),     h10 = this.cornerY(x + 1, y);
  const h01 = this.cornerY(x, y + 1), h11 = this.cornerY(x + 1, y + 1);
  // two triangles: (top left, bottom left, top right) and (top right, bottom left, bottom right)
  const quad = [[x, y, h00], [x, y + 1, h01], [x + 1, y, h10],
                [x + 1, y, h10], [x, y + 1, h01], [x + 1, y + 1, h11]];
  …
}
```

The colour of each tile depends on water, closeness to the shore and slope: steep becomes rock, flat becomes meadow.
With `heightAt(x, z)` the renderer can also ask for the height at *any* point (bilinear between the four corners) – so
figures and buildings stand on the ground rather than in it or above it.

## Camera, clicks and touch {#camera}

The camera of a city builder looks at a point on the ground at an angle from above. Instead of storing position and
viewing direction directly, `CameraRig` keeps three numbers: rotation around the vertical axis (`yaw`), tilt (`pitch`)
and distance (`dist`). From these it computes the camera position every frame – these are
[spherical coordinates](https://en.wikipedia.org/wiki/Spherical_coordinate_system):

```js src/render/CameraRig.js
const cp = Math.cos(this.pitch);
this.camera.position.set(
  this.target.x + Math.sin(this.yaw) * cp * this.dist,
  this.target.y + Math.sin(this.pitch) * this.dist,
  this.target.z + Math.cos(this.yaw) * cp * this.dist,
);
this.camera.lookAt(this.target);
```

Zooming only changes `dist`, rotating only `yaw` – much simpler than moving the camera directly.

And how does the game know what you clicked on? It shoots a ray from the camera through the mouse point into the scene
(*raycasting*) and checks which triangle it hits first: the terrain, a building or a figure. The hit becomes – of
course – a command to the simulation.

Input uses [pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events): mouse, pen and finger
all arrive through the same events. On the desktop a left click selects, a right click commands and dragging with the
right button rotates. On the phone one finger moves the map, a tap selects, two fingers zoom and rotate (the distance
between the fingers gives the zoom, their angle the rotation). There is deliberately no hover effect anywhere: a
touchscreen does not have one.

## Trees by the thousand {#instancing}

A map has more than a thousand trees. One mesh per tree would mean more than a thousand *draw calls* per frame, and
each costs the processor time. That is why even the first version uses `InstancedMesh`: the shape of a tree is sent to
the graphics card once, together with a table holding one matrix (position, rotation, scale) per tree. One call then
draws them all. Three such objects – trunks, conifers, broadleaf trees – are enough for the whole forest. Later all
figures are drawn the same way, animation included (see [Parallel branches](blog/parallel-branches/#graphics)).

## Tests in the browser {#tests}

Vitest tests the simulation in milliseconds. But only a test that remote-controls a browser can check whether you can
really build a house. That is what [Playwright](https://playwright.dev/) is for: it starts Chromium, loads the game,
clicks and taps like a human and checks what ends up on the screen. Every test runs in two profiles – desktop and the
Pixel 7 phone with touch:

```js e2e/game.spec.js
test('Place a house via the build menu', async ({ page }, info) => {
  await boot(page);
  await page.getByRole('button', { name: 'Alle' }).click();
  if (info.project.name === 'mobile') await page.getByTestId('build-toggle').click();
  await page.getByTestId('build-residence').click();
  const pos = await screenPosFor(page, 'residence');   // building spot → screen point
  if (info.project.name === 'mobile') {
    await page.touchscreen.tap(pos.x, pos.y);
    await page.getByRole('button', { name: 'Hier bauen' }).click();
  } else {
    await page.mouse.click(pos.x, pos.y);
  }
  await expect(page.getByTestId('res-wood')).toHaveText('1600'); // wood was paid
});
```

The test reads the building spot straight from the simulation and turns it into a screen point with `project()` – the
reverse of raycasting. (The interface was still German-only at that point, hence the button names.)

## What did not work {#problems}

Absolute paths would have tied the game to the root of a server (`/assets/…`). Anyone putting it into a subfolder such
as `myserver.org/games/kronland/` would have seen an empty page – hence the quick follow-up `base: './'` in the Vite
configuration.

Later the downside of browser tests became clear: without a graphics card they run on software WebGL (SwiftShader), and
the processor computes every frame. Time limits had to be raised again and again; the rule since then: generous
timeouts, run only the affected specs, a separate port per session.

## Try it yourself {#tips}

- **Separate simulation and rendering strictly.** Then the graphics can be replaced completely later without touching
  the rules – which is exactly what happened two days later.
- **Interpolate between ticks** instead of raising the tick rate. Ten ticks per second are enough for a city builder.
- **Set up Playwright with a phone profile before the interface grows** – retrofitting touch is more expensive.
- **Experiment:** in the browser console the engine is available as `window.__kronland`. Try
  `__kronland.renderer.scene.traverse(o => o.material && (o.material.wireframe = true))`.
