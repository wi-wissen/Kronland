---
title: Character pipeline and coding adventures
date: 2026-10-04T20:41:03+02:00
teaser: How a painted sheet becomes an animated 3D character – polygons, skeleton, weights, animation on the graphics card. And in parallel a small Python language of its own with lexer, parser, compiler and virtual machine.
milestone: true
---

## What this is about {#what}

This milestone has two halves that have nothing to do with each other and still arrive at the same time:

- **Character pipeline:** from a concept sheet with four views, the Meshy service builds a 3D model with skeleton and
  animations; our own scripts prepare it for the game. The first own characters are the male and female serf. Until
  then the game used free characters from the KayKit pack (see [article 5](blog/first-package/)).
- **Coding in the game:** a subset of Python with its own bytecode machine, learning adventures with single
  stepping, breakpoints and a variable view, the scripted mission “The Raid” and a world editor.

On top of that: interface polish, balance modelled on the original and the website's English addresses with the
**compendium** – that is what the reference has been called since, because nobody but the game itself writes it.

Both halves answer a question players rarely ask: what is behind a character that walks, and behind a command you type?

## How a 3D character is made {#figure}

### From picture to mesh

It starts with a **concept sheet**: a painted image of the character from the front, the side, the back and the
other side, created with an image model. A style guide (`docs/STIL.md`) makes sure all characters match: warm
colours, slightly exaggerated proportions, and the area that will later carry the player colour in pure magenta.

These four views go to [Meshy](https://www.meshy.ai), a service that computes a 3D model from images. What comes out
is a **polygon mesh**: thousands of small triangles whose corners (vertices) sit in space, plus a texture – an image
wrapped over the triangles like gift paper. Which part of the texture goes on which triangle is stored in the UV
coordinates of each vertex. Graphics cards can only draw triangles; every curved surface in the game is really made
of many flat triangles. More under [polygon mesh](https://en.wikipedia.org/wiki/Polygon_mesh) and
[UV mapping](https://en.wikipedia.org/wiki/UV_mapping).

![The serf from this milestone: on the left the close-up model with texture, next to it the same mesh as wireframe (11,429 triangles), the simplified game model (2,087 triangles) and on the right the skeleton in a walking pose.](blog/characters-coding/serf-lod-en.webp)

### The skeleton

A mesh alone cannot move. So the character gets a **skeleton** (a *rig*): a hierarchy of bones. The hips are the
root, the spine and thighs hang from them, the neck and shoulders from the spine, the upper arms from the shoulders,
and so on. The serf has 24 bones:

```
Hips → Spine02 → Spine01 → Spine → neck → Head
                                 → LeftShoulder → LeftArm → LeftForeArm → LeftHand
                                 → RightShoulder → …
     → LeftUpLeg → LeftLeg → LeftFoot → LeftToeBase
     → RightUpLeg → …
```

Each bone has a position relative to its parent. Rotate the upper arm and the forearm and hand follow automatically –
just like a real arm. Meshy inserts this skeleton automatically (“auto-rig”). In the Meshy interface you see the
character with its joints marked before the animations are added.

### Skinning: which vertex belongs to which bone

Now every vertex of the mesh has to know which bone it follows. A vertex on the hand follows the hand. But a vertex at
the elbow? It should follow the upper arm half and the forearm half, otherwise the sleeve kinks like a drinking straw.
So every vertex gets up to **four bones with weights** that add up to 1. This is called
[skinning](https://en.wikipedia.org/wiki/Skeletal_animation).

![Weights made visible: red means “follows this bone fully”, blue “not at all”. Left the upper arm, in the middle the right thigh – towards the hip it turns green and yellow, where several bones share the vertices. Right the same upper arm in the middle of a movement.](blog/characters-coding/weights-en.webp)

For each vertex the program then computes:

```
new_position = Σ  weight[i] · Matrix(bone[i]) · rest_position
              i=1..4
```

A bone's matrix describes how far it has moved and rotated compared to the rest pose. If you know matrices from maths
class: these are 4×4 matrices in [homogeneous coordinates](https://en.wikipedia.org/wiki/Homogeneous_coordinates), so
that rotation and translation fit into a single multiplication.

### Animations

An **animation** (a *clip*) is a list of keyframes: at certain points in time it is fixed how each bone is rotated; in
between the values are blended. Meshy delivers a set of clips per role. The serf has nine: `idle`, `walk`, `run`,
`chop`, `mine`, `hammer`, `carry`, `cheer` and `die`. If a character lacks a clip, the game uses a related one –
`mine` falls back to `chop`, `chop` to `attack`, `attack` to `idle`.

Tools such as axe, hammer and pickaxe hang on the hand as rigid parts and are only visible in matching clips. In the
image above they are hidden.

## Saving polygons: levels of detail {#lod}

11,429 triangles for a single serf are a lot when a hundred of them walk around. At the same time a character is only
about 25 pixels tall at normal zoom – you cannot see fine facial features there. The solution is called
[level of detail](https://en.wikipedia.org/wiki/Level_of_detail_(computer_graphics)) (LOD): several versions of the
same model, depending on how large it appears on screen right now.

Every character therefore has two meshes with the same skeleton:

| | Close-up model | Game model |
|---|---|---|
| when | character taller than ~80 px | medium zoom and further out |
| mesh | Meshy 7.1, ~11,000 triangles | the same model, reduced to ~2,000 via “remesh” |
| texture | 2048 × 2048 + normal map | 1024 × 1024 + normal map |

What counts is the **height on screen in pixels**, not the distance to the camera. That way the level switches at the
same visible size on phone and desktop. Below 80 px the game model plays at 24 frames per second without blending,
below 28 px at only 8, and below 12 px the character stays frozen in its pose. So that the boundary does not flicker
when a character sits exactly on it, there is a [hysteresis](https://en.wikipedia.org/wiki/Hysteresis) of about ±10 %:
switching up happens a little later than switching down. The switch itself is cross-faded over 0.35 seconds with a
dot pattern (dithering).

The normal map is a trick to show a lot of detail with few triangles: a second image stores, for every point, which
direction the surface “really” faces. Lighting uses it as if folds and seams were real
([normal mapping](https://en.wikipedia.org/wiki/Normal_mapping)).

## Hundreds of characters on the graphics card {#gpu}

This gets technical, but it is worth it. If the game computed the equation above on the CPU for every character, 100
characters with 2,000 vertices each would mean 200,000 matrix operations per frame – too much for a phone. And sending
every character to the graphics card separately costs one draw call each.

Kronland does it differently:

1. **Baking:** while loading, the game plays every clip once, at 24 frames per second, and writes the matrices of all
   bones for each frame into a **texture**. One row is one frame, four pixels per bone (each pixel holds four numbers
   RGBA, i.e. one column of the 4×4 matrix).
2. **Instancing:** all characters with the same model are drawn in *one* draw call
   ([instancing](https://en.wikipedia.org/wiki/Geometry_instancing)). Per character the CPU sends only a few numbers:
   placement, frame number, blend factor and colours.
3. **Skinning in the shader:** for each vertex, the graphics card reads its bones' matrices from the texture and
   computes the equation itself – for all vertices at once.

![How an animation is stored in the texture: one row per frame, four texels per bone. A vertex knows its bones and weights; the graphics card fetches the matching matrices.](blog/characters-coding/bone-texture-en.svg)

The shader code for this (in [GLSL](https://en.wikipedia.org/wiki/OpenGL_Shading_Language), the language for graphics
card programs) is surprisingly short:

```glsl
// src/render/characters.js (trimmed)
uniform highp sampler2D uBones;   // the baked bone texture
attribute vec4 aBoneIdx;           // up to four bones per vertex …
attribute vec4 aBoneW;             // … and their weights
attribute vec3 aAnim;              // frame A, frame B, blend factor (per character)

mat4 charBone(float frame, float b) {
  int x = int(b) * 4, y = int(frame);
  return mat4(texelFetch(uBones, ivec2(x, y), 0), texelFetch(uBones, ivec2(x + 1, y), 0),
              texelFetch(uBones, ivec2(x + 2, y), 0), texelFetch(uBones, ivec2(x + 3, y), 0));
}
mat4 charSkin() {
  mat4 m = charBoneMix(aBoneIdx.x) * aBoneW.x;
  if (aBoneW.y > 0.0) m += charBoneMix(aBoneIdx.y) * aBoneW.y;
  …
  return m;
}
```

`texelFetch` reads a single pixel from the texture; four of them make a matrix. That way hundreds of characters cost a
handful of draw calls.

### Player colour from magenta

Every player has a colour – blue, red, green, ochre. Instead of storing one texture per colour, the team area is
painted magenta in the concept (clearly visible on the headscarf and neckerchief above). While drawing, the shader
detects pixels close to magenta and recolours them to the player colour; brightness is kept so folds and shadows
survive. One texture serves all players.

## A programming language of our own {#language}

The second half of the milestone sounds megalomaniac: a programming language of our own. More precisely: a subset of
Python that runs inside the game. What for? For **learning adventures** where you steer the hero with code, and for
**mission scripts** that react to events.

You might ask why not simply run JavaScript in the browser. Three reasons:

- **Determinism:** scripts run *inside* the simulation. They must compute exactly the same on every computer, including
  decimals and randomness (see [article 1](blog/simulation-core/)).
- **Pausing and resuming:** `hero.step()` should wait in the code until the hero has taken a step – without freezing
  the game. And a save should be able to store a running script in the middle of a loop.
- **Safety and learning:** a program should only know the commands it is allowed to know, and error messages should be
  understandable in German and English.

This is how a program travels through the machine:

```
source → lexer → tokens → parser → syntax tree → compiler → bytecode → VM
```

![What happens to the line x = 2 + 3 * 4. Tokens, tree and bytecode are real output of Kronland's Python at this milestone.](blog/characters-coding/compiler-en.svg)

### 1. The lexer

The [lexer](https://en.wikipedia.org/wiki/Lexical_analysis) reads the text character by character and groups them into
**tokens**: names, keywords, numbers, strings, operators. From this small learning program

```python
while hero.can_step():
    hero.step()
hero.say("There!")
```

it produces this sequence (real output of `tokenize`):

```
kw:while  name:hero  op:.  name:can_step  op:(  op:)  op::  newline
indent  name:hero  op:.  name:step  op:(  op:)  newline
dedent  name:hero  op:.  name:say  op:(  str:"There!"  op:)  newline  eof
```

Note `indent` and `dedent`. In Python, indentation decides which lines belong to the loop. For this the lexer keeps a
[stack](https://en.wikipedia.org/wiki/Stack_(abstract_data_type)) of the current indentation depths: if a line is
indented deeper, it pushes the new depth and emits `indent`; when the code goes back, it pops depths and emits a
`dedent` for each one. After that, the parser sees indentation like curly braces in other languages.

### 2. The parser

The [parser](https://en.wikipedia.org/wiki/Parsing#Parser) turns the flat token sequence into a
[syntax tree](https://en.wikipedia.org/wiki/Abstract_syntax_tree). It is a *recursive descent* parser: for each rule of
the grammar there is a function that calls itself and others. The rule “multiplication before addition” lives in the
order of these functions – a sum consists of products, a product of factors. That is why `3 * 4` ends up deeper in the
tree than the `+` and is computed first.

### 3. The compiler

The [compiler](https://en.wikipedia.org/wiki/Compiler) walks the tree and produces **bytecode**: a list of simple
instructions for an imaginary machine. For the `while` loop above it looks like this (real output):

```
 0 LOAD_GLOBAL  hero
 1 LOAD_ATTR    can_step
 2 CALL         0          ← call a function without arguments
 3 JUMP_IF_FALSE 9         ← condition false? jump behind the loop
 4 LOAD_GLOBAL  hero
 5 LOAD_ATTR    step
 6 CALL         0
 7 POP                     ← discard the return value
 8 JUMP         0          ← back to the condition
 9 LOAD_GLOBAL  hero
10 LOAD_ATTR    say
11 LOAD_CONST   "There!"
12 CALL         1
…
```

So a loop is nothing but a conditional jump forwards and an unconditional jump back. The compiler also already knows
all names. Write `hero.stpe()` and it reports the error before anything runs and suggests the most similar known word
(“Did you mean `step`?”) – computed with the [Levenshtein distance](https://en.wikipedia.org/wiki/Levenshtein_distance).

### 4. The virtual machine

The VM is a [stack machine](https://en.wikipedia.org/wiki/Stack_machine): `LOAD_CONST` pushes a value onto the stack,
`BINARY` pops two and pushes the result. At its core it is one big loop:

```js
// src/script/vm.js (trimmed)
execute(task, budget) {
  for (;;) {
    if (used >= budget) break;                 // budget used up: continue later
    if (debug && code.stmt[pc] && this.debugStop(…)) { task.state = 'paused'; break; }
    const op = code.ops[pc], arg = code.args[pc];
    frame.pc = pc + 1; used++;
    switch (op) {
      case OP.LOAD_CONST: stack.push(code.consts[arg]); break;
      case OP.BINARY: { const b = stack.pop(); stack.push(binary(BIN_OPS[arg], stack.pop(), b)); break; }
      case OP.JUMP_IF_FALSE: if (!truthy(stack.pop())) frame.pc = arg; break;
      …
    }
  }
}
```

Three properties make it fit for a game:

- **Budget:** per game tick a mission script may execute at most 60,000 instructions, a player program 20,000. An
  endless loop therefore never freezes the game; it just keeps running slowly.
- **Waiting:** a command like `hero.step()` returns a `Suspend` object instead of a value. The task parks, the
  simulation lets the hero walk, and once he has arrived the host resumes the program exactly there. This only works
  because the VM has its own call stack instead of using JavaScript's recursion.
- **Debugger:** the compiler marks the start of every statement (`stmt[pc]`). There the VM checks breakpoints and
  single-step mode. That is how “step”, “over” and “out” come about, as you know them from IDEs.

![A learning adventure on the evening of 4 October: Bertram has to reach the treasure. The program is paused in single-step mode at line 3; below, the debugger shows the variable steps = 2. (The interface was German-only at that point.)](blog/characters-coding/debugger.webp)

Integers automatically become `BigInt` from 2⁵³ – `2 ** 100` works as in Python. Decimals compute `+ − * /` according
to [IEEE 754](https://en.wikipedia.org/wiki/IEEE_754) and are therefore the same everywhere; functions such as `sin` or
`log` are left out on purpose, because browsers compute them with different precision. Tests compare the output of
many small programs with real Python (CPython).

### Missions and world editor

The same language is used for scripted missions in the style of the original's triggers:

```python
@on_building_done("farm")
def first_farm():
    say("bertram", "The first farm is standing!")
    spawn(BANDITS, "sword1", place("gate"), count=3)
```

A [decorator](https://en.wikipedia.org/wiki/Python_syntax_and_semantics#Decorators) such as `@on_building_done`
registers the function as an event handler. Mission scripts may do more than player programs (spawn troops, move the
camera). Which names a program knows at all depends on its permission level. Finally, the world editor shapes terrain,
water and forest on a preview simulation and saves the result in the same scenario format.

## What did not work {#problems}

- The older Meshy model showed visible polygons in faces. Meshy 7.1 with PBR (physically based materials) delivers
  smooth faces and a normal map.
- A separate, simplified concept for the game model made no difference at game size. The game model is now the
  close-up model reduced to about 2,000 triangles via remesh (5 credits) – and it does not jump when switching.
- Flat vertex colours and extra saturation turned olive into “paintbox green”. In the end Meshy's colours were simply
  kept.
- A rim light meant to lift characters off the background looked like bright edges and was removed again.
- Dictionaries with tuples as keys did not survive saving and loading in the script VM – a fix of its own.

## Try it yourself {#tips}

- Judge characters at game size (about 25 pixels for us), not in a large preview.
- Cheap things first: check the concept and preview before spending Meshy credits; a budget ledger keeps count.
- When many identical things are animated, animation on the graphics card with a baked texture pays off.
- A small language of your own is doable if you split it into clear stages: lexer, parser, compiler, VM. Each stage
  can be tested on its own.
- A VM with its own call stack can pause, save and resume at any time – that is the key to debuggers and waiting
  commands.
