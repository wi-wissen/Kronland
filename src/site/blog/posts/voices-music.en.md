---
title: Voices, music and introductory mission
date: 2026-10-05T15:03:47+02:00
teaser: 368 voice recordings with an automatic listening check, twelve tracks by Lyria 3, CC0 sounds – and many small improvements in one day.
milestone: true
---

## What was built {#what}

- **Voices:** every mission speaker and every character role gets a voice; all dialogues and barks are voiced
  in German and English, 368 recordings in total.
- **Music:** twelve tracks made with Google Lyria 3 Pro – building, winter, battle, menu, victory and defeat –
  with pauses between peaceful pieces; work sounds from CC0 recordings by Kenney, the anvil from Freesound.
- **Many small improvements:** the minimap sends units, heroes stacked, clear ice, dialogues without talking
  over each other, rarer barks – and mission 1 becomes a guided introduction.

## How {#how}

- Voices: describe the role (age, timbre, attitude) → draft with Seed Audio → clone for every sentence → a second model
  (Gemini) checks whether the words match and only the voice is audible → a person picks on a listening page.
- Music: prompts with instruments, tempo, key and form; Gemini checks for vocals and breaks, the owner decides by ear.
- Loudness by the standards: voices −18 LUFS, music −22 (peace) or −20 LUFS (battle).

## What didn’t work {#problems}

- Lyria doesn’t do short pieces (even “10 seconds” gives about 60 s) and masters like pop music (≈ −11 LUFS). About one
  draft in five had vocals despite the instruction, about one request in three came back randomly with
  `403 PROHIBITED_CONTENT` – the script skips what exists, so just run it again. “In the style of …” did not help.
- Seed Audio rendered vivid words as background (horses, gate), ellipses caused breaks, the checker heard an English
  “Aye” as “Hi”. Fix: neutral template sentences, commas instead of dots, the checker is told the language.
- The Kenney anvil sounded too dull – a CC0 anvil from Freesound replaced it. Barks came too often and overlapped.

## Try it yourself {#tips}

- AI checkers filter the obvious (vocals, wrong words); a person decides on taste.
- Make generation scripts resumable – models refuse at random, connections drop.
- Bring all recordings to one loudness before judging them in the game.
