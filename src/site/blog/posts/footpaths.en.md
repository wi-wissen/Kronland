---
title: Footpaths – one tile, one byte, one path
date: 2026-10-09T17:30:00+02:00
teaser: Where serfs walk often, the grass gets flattened and then turns to earth; in snow, footprints stay behind. How the simulation computes this with one byte per tile, why the path still does not look like a chessboard – and why a small test bench helped more than twenty town screenshots.
---

## What this is about {#what}

A building game lives from seeing what happens in the settlement. Since this version, figures wear paths: whoever
walks between castle and storehouse often first flattens the grass, then exposes an earth track. In winter every step
leaves footprints, many steps a trodden lane. The settings offer three levels: **off**, **fading** (default) and
**permanent**.

This article tells two things: how the paths come about in the simulation – and how long it took until they also
looked good.

## One byte per tile {#field}

Kronland's simulation computes with integers only and must give the same result on every computer (otherwise lockstep
multiplayer will never work later). The paths are therefore simply a field with **one byte per tile**, strength
0 to 255:

- **Growing:** when a figure leaves a tile, the track there gets stronger – fast at first, then slower and slower
  (`gain · (255 − strength) / 255`). Only tiles walked often become paths.
- **Relative to the settlement:** the gain depends on the player's number of walkers, `√(20 / walkers)`, clamped to
  35 … 200 %. A village of eight serfs sees small paths after a few walks, a town of 150 figures only wears its main
  routes.
- **Fading:** a "broom" visits every tile every ten seconds and takes some away – more in snow than in grass, less on
  bare earth. Its position follows from the tick; there is no list and nothing to save except the bytes themselves.
- **Seasons:** fresh snow covers the summer paths, the thaw takes the snow tracks along. In "permanent" everything
  stays.

The setting is a game option of the simulation: it is in the save game and the state hash, and changing it during a
game is an ordinary command. A level that needs a track – like the trail in the snow of the course mission "In the
Blizzard" – fixes the mode itself. Scripts can look for a track with `nelia.front() == "track"`; the threshold for it
is the same at which it becomes clearly visible.

## Computed per tile, but no chessboard {#organic}

One byte per tile means: the simulation only knows squares. The first version showed that – paths made of tiles,
right-angled corners, diagonals as staircases. The terrain itself has no visible grid, though, so the paths looked
painted onto a chessboard.

The solution lies entirely in the rendering. When the data texture is filled, each tile gets three values:

- the **stage** of the path (how worn it is),
- the same **smoothed over the neighbours** – along the line, so that a diagonal of tiles that only touch at their
  corners is as strong as a straight path,
- the **walking direction**, from the slope of the field (as a doubled angle, so there and back is the same direction).

The terrain shader reads the smoothed field **bicubically**, shifts the lookup with calm noise by up to half a tile
(the path meanders) and cuts the path out at a threshold. This gives curves instead of corners and diagonals instead
of staircases, although tiles are still underneath.

## Grass and snow {#materials}

In winter the shader draws footprints as oval pairs in walking direction, close to the middle of the path. As the
strength grows, more layers are added, each turned and shifted a little, until they merge into a trodden, slightly
dirty lane.

In summer **the same geometry** applies – only the material changes: lightly trodden, lighter blades lie flat; medium
shows earth in scattered patches along the middle; fully worn it is mostly earth with a soft grass edge. The earth is
never struck cleanly: noise on three scales frays the edges and leaves gaps and patches. On **rock** the track never
turns earth-brown – the stone only gets darker and dirtier; the shader fades the earth colour out with the rock weight
of the ground. In winter it is the other way round: on bare rock packed snow shows up exactly where people walk – the
stronger the track, the clearer the light, slightly bluish lane with footprints.

![The test bench: five shapes (straight, diagonal, bend, S-curve, junction) and two rock cases at three strengths, summer on the left, winter on the right – always one path, similarly wide in summer and in snow, broken up and frayed in summer.](blog/footpaths/bench.webp)

## How it got there {#story}

The way to this picture led through several failed attempts:

1. **Chessboard:** paths made of tiles, see above.
2. **Too wide:** with smoothing and noise the paths became round – but in summer much wider than in snow. Wide brown
   areas made the settlement look untidy.
3. **Parallel strips:** drawing every path tile as a short capsule in walking direction made single paths narrow. In
   the town, however, several strips then lay side by side where there really was one path.
4. **Too clean:** an intermediate version drew the earth as a continuous, smoothly bounded line. It was tidy – and
   looked as if someone had smeared brown paint on the grass. A real desire path is not struck cleanly: it frays,
   breaks up, has gaps and patches. The version before, with frayed edges and gaps, looked far more natural; so we went
   back to it, only narrower. **Ragged and gappy looks trodden, continuous looks painted.**
5. **Rock:** on stone ground the track first turned earth-brown too – brown streaks across rocks. Now the shader fades
   the earth colour out with the rock weight and only darkens the stone. The bench has two cases of its own for this:
   a path from grass onto rock and a path entirely on rock.

The actual problem was the check. Town screenshots after twenty minutes of play are pretty, but useless for this
question: buildings, trees and many figures cover everything, every run looks different, and you cannot tell whether a
path is too wide or whether simply three paths lie side by side.

So a **test bench**: a flat, empty map on which the track field is set directly – straight, diagonal, a bend, an
S-curve, a junction, each light, medium and full. Every cell gets the same camera, summer next to winter. A test also
checks that every shape is exactly **one** connected path in the smoothed field. With this sheet, width and shape could
be compared in minutes instead of hours – and the answer was clear: the snow was right, summer needed the same shape.

![The same AI town three times: on the left earth areas that were too wide and patchy, in the middle the too-clean continuous earth, on the right today – narrower, broken up and frayed, wide only where groups walk side by side. For the question "how wide is a path?" such pictures are hardly useful; that is what the test bench is for.](blog/footpaths/iterations.webp)

## Wide bands at busy spots {#bands}

One case belongs to it on purpose: send a group of serfs somewhere and each gets its own target tile, so they walk
side by side. The field becomes two to three tiles wide there. In the picture it is still one path, only a wider one –
like a square in front of the castle that everyone crosses. That is intended: busy spots wear down more.

![Four serfs walk a path with a bend back and forth: an earth band in summer, the same shape in the snow in winter.](blog/footpaths/walked.webp)

## What it costs {#cost}

- **Simulation:** one loop over the figures per tick (which already existed) plus the broom with tiles/100 per tick –
  about 650 bytes on a map of 256 × 256 tiles.
- **Texture:** refilled at most every half second, only rows near tracks; in the worst case about 8 ms on a 256 map
  full of paths.
- **Shader:** four texture reads for the bicubic value, footprints only in winter. The low graphics level uses a single
  linear read.

![An AI town after twenty minutes in summer: the main routes are worn, into wide bands where many figures walk side by side.](blog/footpaths/town.webp)

## To try yourself {#tips}

- Compute as simply as possible in the simulation (one byte per tile) and make the picture nice in the rendering.
- For a question of looks, build a test bench with clean cases before tinkering with game screenshots.
- Check summer and winter with the same shape; only the material may differ.
- Lines that are too clean look painted: natural things may have gaps and frayed edges.
- Give special cases like rock a bench case of their own, otherwise they only show up in the town.
- A small test ("exactly one path per shape") keeps a regression from going unnoticed.
