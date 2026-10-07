---
title: Voices, music and introductory mission
date: 2026-10-05T15:03:47+02:00
teaser: 368 voice recordings checked automatically by a second AI model, twelve music tracks from Lyria 3 and sounds from free recordings. What loudness is, how to measure wording and why sound must never decide how the game plays.
milestone: true
---

## What this is about {#what}

Until now Kronland was almost silent, or more precisely: all sounds were synthesised at runtime with the Web Audio API
from noise, envelopes and simulated strings (see [article 7](blog/parallel-branches/)). In this milestone the game gets
real voices and music:

- **Voices:** every mission speaker and every character role gets a voice. All dialogues and the short barks when
  selecting or commanding are voiced in German and English, 368 recordings in total.
- **Music:** twelve tracks from Google Lyria 3 Pro – five for building, two for winter, two for battle, plus menu,
  victory and defeat.
- **Sounds:** chopping, pickaxe, hammer, blades and coins from free recordings (CC0) by Kenney, the anvil from
  Freesound.
- **Many small improvements:** the minimap sends characters, dialogues no longer talk over each other, barks come less
  often – and mission 1 becomes a guided introduction.

Generating is not the hard part here. The hard part is finding the usable results among hundreds without listening to
everything yourself. That is what this article is about.

![Mission 1 as a guided introduction: an exclamation mark marks the stranger on the village square, the objective at the top left says what to do, and Nelia speaks her first line – now with a voice. (German interface.)](blog/voices-music/c1-intro.webp)

## Voices: from profile to recording {#voices}

### Roles and profiles

First it is decided who speaks at all: every mission speaker (Nelia, Orrin, Malvor, the village elder …) and the
character roles male serf, female serf, swordsman, female soldier and cannoneer. Spearmen and riders share the
swordsman's voice. Which character has which voice is stored in the character manifest – the same file from which the
rendering reads which model a character wears. That way looks and voice always match.

Each role gets two or three short descriptions, for example “powerful lord, about fifty-five, rough bass, slow and
threatening”.

### Draft, selection, cloning

The speech model Seed Audio (ByteDance) can *design* a voice from a description: the description is placed in square
brackets before the text and is not spoken. The suffix “pure dry speech recording, only the voice, no music, no
background noise” is always added.

A person listens to the drafts on a small listening page and picks one per role. That draft becomes the **template**.
All further lines are *cloned* from it – the model gets the template recording plus its wording and speaks the new line
in the same voice. Only that way does Nelia sound the same in mission 1 as in mission 6.

![The path of a recording: description, draft, selection by a person, then for each line cloning, loudness matching and automatic listening. If the check fails, it is regenerated up to six times.](blog/voices-music/voice-pipeline-en.svg)

### A second model listens

With 368 recordings nobody listens to every single one. So a second model does it: Gemini gets the recording and
writes down what it hears. It should also append `[NOISE]` if, besides the voice, music or noises are audible. The
script then compares the heard text with the intended text.

How do you compare two sentences? Letter by letter would be too strict – “Orin” instead of “Orrin” is not a real
mistake. So the script compares **word sequences** using the [Levenshtein distance](https://en.wikipedia.org/wiki/Levenshtein_distance):
the smallest number of insertions, deletions and substitutions that turns one sequence into the other. The building
blocks here are whole words, and two words count as equal if they differ in at most one letter.

```js scripts/asset-gen/voice.mjs
export function similarity(a, b) {
  const x = words(a), y = words(b);
  if (x.join('') === y.join('')) return 1;          // "Alder Farm" = "Alderfarm"
  const d = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)]);
  for (let j = 1; j <= y.length; j++) d[0][j] = j;
  for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1,                      // word missing
                       d[i][j - 1] + 1,                      // extra word
                       d[i - 1][j - 1] + (sameWord(x[i - 1], y[j - 1]) ? 0 : 1)); // replaced
  }
  return 1 - d[x.length][y.length] / Math.max(x.length, y.length);
}
```

This is [dynamic programming](https://en.wikipedia.org/wiki/Dynamic_programming): the table `d[i][j]` holds the
distance between the first *i* words of one sentence and the first *j* words of the other, and each cell follows from
three neighbouring cells. A recording passes with a similarity of at least 0.85 and without `[NOISE]`. Otherwise it is
regenerated, up to six times. A good older recording is only replaced by an attempt that passed.

With very short lines the checker easily mishears – English “Aye” becomes “I” or “Hi”. For lines of at most three words
the script therefore asks specifically: “Is ‘Aye!’ spoken in it clearly and completely? Answer only with yes or no.”

![A finished recording as a waveform: two sentences with a pause between them. Its loudness matches all other voices.](blog/voices-music/wave-en.webp)

### How the game finds the right file

Every recording is named after its role and a hash of its text, for example `en/nelia-434717f9.mp3`. An index file maps
the key `voice|language|text` to the file:

```json
"nelia|de|Ich bin eine Leibeigene, Orrin. Mein Vater schlägt Holz.": "de/nelia-cd8611c9.mp3",
"nelia|en|I’m a serf, Orrin. My father chops wood.": "en/nelia-434717f9.mp3",
```

If someone changes a dialogue line, the key no longer matches, and the script knows by itself which lines need new
recordings. If a recording is missing, the dialogue stays silent or the browser reads it with its built-in speech
synthesis.

Important: **sound never decides how the game plays.** How long a dialogue lasts is computed by the simulation from the
text length, not from the length of the recording. Otherwise a computer with sound would play differently from one
without, and the simulation would no longer be deterministic (see [article 1](blog/simulation-core/)).

## Loudness: why −18 is not quiet {#loudness}

If you mix recordings from different sources, you quickly notice: one is twice as loud as the other. The measure for
this is called **loudness** and is given in LUFS (*Loudness Units relative to Full Scale*, following the standard
[EBU R 128](https://en.wikipedia.org/wiki/EBU_R_128)). 0 is the technical maximum, so values are negative: −11 LUFS is
louder than −22 LUFS. Unlike a simple peak level, LUFS takes into account how sensitive the ear is to different
pitches, and averages over the whole recording.

Kronland brings everything to fixed targets. The tool [FFmpeg](https://en.wikipedia.org/wiki/FFmpeg) has a filter for
this:

```js
export const LOUDNESS = 'loudnorm=I=-18:TP=-1.5:LRA=11';   // voices: −18 LUFS, peak −1.5 dB
ffmpeg(['-i', mp3, '-af', LOUDNESS, '-ar', '24000', '-ac', '1', tmp]);
```

![Where the targets lie. Lyria delivers music as loud as pop music; in the game it should stay in the background.](blog/voices-music/loudness-en.svg)

Lyria delivers its tracks at about −11 LUFS with peaks up to 0 dB – mixed loud like pop music on the radio. For
background music that is far too loud. Peaceful music therefore goes to −22 LUFS, battle music to −20, voices to −18,
so that speech sits on top of music and sounds.

## Music with Lyria 3 {#music}

### Prompts like an arranger

Lyria 3 Pro creates a piece of music of up to two and a half minutes from a text. A vague wish (“medieval building
music”) delivers something arbitrary. What works well is what an arranger would write down: instruments, tempo, key,
mood and form. A prompt from `scripts/asset-gen/music.mjs`:

```text scripts/asset-gen/music.mjs
Instrumental only, absolutely no vocals, no choir, no spoken words. Background music for a calm
medieval settlement-building strategy game … Mood: sunny morning in a green valley village,
peaceful and hopeful. Warm orchestral folk: soft string ensemble, solo wooden recorder carrying a
singable melody, harp arpeggios, plucked lute ostinato, light frame drum. 92 BPM, D major with
mixolydian colour. Form: [Intro] harp and lute, [A] recorder melody, [B] strings take the melody,
[A'] recorder returns with counter-melody, [Outro] back to intro texture.
```

The form `[Intro] [A] [B] [A'] [Outro]` is a classic song form: theme, contrast, return. It makes the piece have an
arc instead of meandering aimlessly.

### Let a model pre-listen, decide yourself

Here too a model listens first: Gemini rates each draft – vocals yes/no, hard breaks, instruments, a rough grade. About
one draft in five had vocals or a choir despite the instructions; Gemini detects that reliably. The grades, on the other
hand, were almost always 1 or 2 and useless for ranking. The actual choice was made by the project owner by ear.

### Music in the game

The music follows the game state, not the location: peace, winter or battle. Between two peaceful tracks there is an
adjustable pause in which only the ambience plays – wind, birds, water. Over hours, music wears out otherwise. Each
track is only loaded when its theme comes up.

The menu track should play endlessly. For that it is cut before its ending and built into a seamless loop: the last
five seconds are faded out over the faded-in first five. At the loop point the music continues without a jump.

## Sounds from free recordings {#sfx}

Not everything is generated. There are excellent free recordings for work sounds. The project rule: only
[CC0](https://en.wikipedia.org/wiki/Creative_Commons_license#Zero_/_public_domain) (public domain) or self-made. Taken
over were chopping, pickaxe, hammer, blades, arrow hits and coins from Kenney's “RPG Audio” and “Impact Sounds” packs,
and the anvil from two Freesound recordings. The script `sfx-cc0.mjs` downloads the packs, checks the licence of every
single Freesound file, trims silence, sets the peak to −3 dB and writes the files plus manifest.

Several variants per sound plus ±4 % random pitch on playback keep a hundred woodcutters from sounding like a machine.
Everything else – fanfares, interface sounds, cannons – stays synthetic, because there is no fitting recording or the
synthesis sounds just as good.

## What did not work {#problems}

- **Lyria cannot do short:** even “10 seconds” gives about 60 seconds. Victory and defeat were therefore cut at the end
  of a phrase – found from the loudness curve – and faded out.
- **Random refusals:** about every third request to Lyria came back with `403 PROHIBITED_CONTENT`; the same prompt
  worked on the second try. The script skips what exists, so just run it again.
- **“In the style of …”** is accepted but does not help – and names from the original do not belong in the project
  anyway.
- **Seed Audio** voiced vivid words as scenery: for words like “horses” or “gate” it added matching background sounds.
  The template lines are therefore neutral. Ellipses caused it to break off; they become a comma or full stop before
  speaking.
- **The Kenney anvil** sounded too dull and had no ring – a Freesound anvil replaced it.
- **Barks** came too often and overlapped; now there is a setting “rare/often/off” and cooldowns.

## Try it yourself {#tips}

- AI checkers filter out the obvious (vocals, wrong wording); taste is decided by a person.
- Compare texts at word level with Levenshtein, not character by character.
- Make generation scripts resumable – models refuse at random, connections drop.
- Bring all recordings to one loudness (LUFS) before judging them in the game.
- Never let sound control the game: the simulation works with text lengths, not recordings.
