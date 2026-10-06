---
title: Character pipeline and coding adventures
date: 2026-10-04T20:41:03+02:00
teaser: The first own characters from concept sheets and Meshy – and in parallel a Python subset with its own VM, learning adventures and a world editor.
milestone: true
---

## What was built {#what}

- **Character pipeline:** Meshy turns a concept sheet with four views into a 3D model with rig and
  animations; own scripts post-process it. The first characters are the male and female serf, with a close-up model
  and a game model, switched by screen height.
- **Coding:** a Python subset with its own bytecode VM, scenarios with Python scripts, learning adventures with
  single-stepping, breakpoints and a variable view, the script mission “Der Überfall” and a world editor.
- Plus game interface and HUD polish, balance modelled on the original and the website with English
  addresses and the **compendium** – the wiki’s name since then, because nobody writes in it.

## How {#how}

- Team colour is pure magenta in the concept; the shader recolours it into the player colour when drawing.
- Comparison instead of guessing: test characters with Meshy 7.1 and PBR against the older model, the far model as a
  remesh of the close-up model (F1) against an own simplified concept (F2).
- The Python VM runs inside the deterministic simulation – scripts even survive saving and loading.

## What didn’t work {#problems}

- The older Meshy model showed visible polygons; Meshy 7.1 with PBR gives smooth faces and a normal map.
- An own far concept brought nothing at game size. The game model is now the close-up model remeshed to about 2,000
  triangles (5 credits).
- Flat vertex colours and saturation turned olive into “paintbox green” – in the end Meshy’s colours were simply kept.
- No rim light: it looked like bright edges.
- Dictionaries with tuple keys in the script VM did not survive loading – a fix of its own.

## Try it yourself {#tips}

- Judge characters at game size (for us about 25 pixels), not in close-up.
- Cheap things first: check concept and preview before Meshy credits are spent; a budget log keeps count.
- A small scripting language of your own is feasible if it is embedded deterministically in the simulation.
