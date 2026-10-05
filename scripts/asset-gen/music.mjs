// Generate music with Lyria 3 Pro (OpenRouter), audition it with Gemini and prepare it for the game.
//   NODE_USE_ENV_PROXY=1 node scripts/asset-gen/music.mjs gen <theme> [count]   drafts (~0.08 $ each)
//   node scripts/asset-gen/music.mjs rate <theme>                                Gemini verdict as JSON alongside
//   node scripts/asset-gen/music.mjs process [target-folder]                     cut PICK, level → public/audio/music
// Raw files live in assets-src/music/raw/<theme>/ (not in the repo, only verdicts and prompts). Workflow: docs/AUDIO.md#musik.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { requireAssetsSrc } from '../require-assets-src.mjs';

const OUT = process.env.MUSIC_RAW ?? 'assets-src/music/raw';
const LYRIA = 'google/lyria-3-pro-preview';
const EAR = 'google/gemini-3.8-flash';

const BASE = 'Instrumental only, absolutely no vocals, no choir, no spoken words. Background music for a calm medieval settlement-building strategy game: unobtrusive under gameplay, no sudden loud hits, consistent dynamics.';
const BUILD = `${BASE} About 2:30 long, gentle intro and a soft ending.`;

export const THEMES = {
  build: [
    { id: 'morning', prompt: `${BUILD} Mood: sunny morning in a green valley village, peaceful and hopeful. Warm orchestral folk: soft string ensemble, solo wooden recorder carrying a singable melody, harp arpeggios, plucked lute ostinato, light frame drum. 92 BPM, D major with mixolydian colour. Form: [Intro] harp and lute, [A] recorder melody, [B] strings take the melody, [A'] recorder returns with counter-melody, [Outro] back to intro texture.` },
    { id: 'market', prompt: `${BUILD} Mood: busy craftsmen and market day, cheerful and industrious. Celtic-medieval folk: fiddle melody, tin whistle, hurdy-gurdy drone, acoustic guitar strumming, bodhran groove, pizzicato strings. 108 BPM, G major, 6/8 feel. Form: [Intro] drone and bodhran, [A] fiddle tune, [B] tin whistle answers, [A] both together, [Outro] drone fades back to intro groove.` },
    { id: 'expanse', prompt: `${BUILD} Mood: wide landscape, a growing realm, gently majestic and a little wistful. Cinematic orchestral with folk instruments: french horn and cello melody, oboe answers, sustained strings, harp, soft timpani rolls only as swells. 80 BPM, A dorian. Form: [Intro] strings pad and harp, [A] cello melody, [B] horn takes over with oboe answers, [A'] full strings, [Outro] calm return to intro.` },
    { id: 'fields', prompt: `${BUILD} Mood: golden fields at harvest time, warm, content, gently flowing. Pastoral folk ensemble: wooden flute melody, nylon-string guitar and lute picking, viola and cello sustain, soft hand drum, occasional glockenspiel sparkle. 86 BPM, F major, 3/4 waltz feel. Form: [Intro] guitar and lute, [A] flute melody, [B] viola answers, [A'] flute and strings together, [Outro] guitar alone.` },
    { id: 'evening', prompt: `${BUILD} Mood: evening over the settlement, lanterns being lit, calm and reflective but not sad. Small orchestra with folk colour: solo cello and english horn melodies, harp, warm low strings, quiet dulcimer. 76 BPM, E minor moving to G major. Form: [Intro] harp and dulcimer, [A] cello melody, [B] english horn answers, [A'] cello and strings together, [Outro] harp alone.` },
  ],
  winter: [
    { id: 'winter', prompt: `${BUILD} Mood: snow-covered medieval village in deep winter, quiet, cold air, cosy hearths, a little magical. Celesta and harp ostinato, soft sleigh-bell shimmer used sparingly, wooden flute melody, warm string pads, low cello drone, no drums. 78 BPM, B minor with dorian brightness. Form: [Intro] celesta and harp, [A] flute melody, [B] strings carry the melody, [A'] flute returns over strings, [Outro] celesta alone.` },
  ],
  battle: [
    { id: 'storm', prompt: `${BASE.replace('calm ', '')} This is the battle theme: tense and driving but not chaotic, still sits under sound effects, about 2:00 long, keeps its energy until the end and ends on a sustained chord. Medieval war music: big frame drums and taiko-like low drums in an ostinato, low string ostinato, shawm and horn melody, brass stabs, no electric instruments. 124 BPM, A minor (aeolian). Form: [Intro] drums alone, [A] strings ostinato with horns, [B] shawm melody, [A'] full ensemble, [Outro] drums and final chord.` },
    { id: 'shieldwall', prompt: `${BASE.replace('calm ', '')} This is the battle theme: heavy, determined, marching, still sits under sound effects, about 2:00 long, keeps its energy until the end and ends on a sustained chord. Medieval orchestra: marching snare and deep war drums, cello and bass staccato ostinato, trombones and horns in unison melody, hurdy-gurdy drone, no electric instruments. 112 BPM, D minor (phrygian colour). Form: [Intro] war drums, [A] staccato strings, [B] brass melody, [A'] everything together, [Outro] drums and final chord.` },
  ],
  menu: [
    { id: 'menu', prompt: `${BASE} This is the main menu theme: noble, warm and inviting, a memorable but simple main melody, about 2:00 long. Small orchestra with medieval colour: harp and lute introduction, solo horn states the theme, recorder answers, strings swell gently, light timpani only at the climax. 84 BPM, D major. Form: [Intro] harp and lute, [A] horn theme, [B] recorder and strings, [A'] full orchestra theme, [Outro] harp and lute alone.` },
  ],
  victory: [
    { id: 'victory', prompt: 'Instrumental only, no vocals. A very short triumphant medieval victory fanfare, only about 10 seconds long: horns and trumpets in a bright D major fanfare, timpani roll, harp glissando, ending on a long held major chord that rings out.' },
  ],
  defeat: [
    { id: 'defeat', prompt: 'Instrumental only, no vocals. A very short sad medieval lament for losing a battle, only about 10 seconds long: solo cello and low strings, slow descending melody in D minor, a soft muffled drum, ending on a long held minor chord that fades out.' },
  ],
};

const env = { ...process.env };

async function post(body) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Title': 'Kronland asset-gen', ...(env.OPENROUTER_API_KEY ? { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` } : {}) },
    body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r;
}

async function generate(prompt, file) {
  const r = await post({ model: LYRIA, modalities: ['text', 'audio'], stream: true, messages: [{ role: 'user', content: prompt }] });
  const dec = new TextDecoder(); let buf = '', parts = [], cost = 0;
  for await (const c of r.body) {
    buf += dec.decode(c, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data:') || line.includes('[DONE]')) continue;
      const j = JSON.parse(line.slice(5));
      if (j.error) throw new Error(JSON.stringify(j.error));
      const a = j.choices?.[0]?.delta?.audio?.data;
      if (a) parts.push(Buffer.from(a, 'base64'));
      if (j.usage) cost = j.usage.cost;
    }
  }
  if (!parts.length) throw new Error('no audio data');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat(parts));
  return cost;
}

const RATE_PROMPT = (kind) => `You are listening to ${kind === 'victory' || kind === 'defeat' ? 'a short signal melody' : 'background music'} for a medieval building strategy game (theme: ${kind}). Answer ONLY with JSON: {"vocals": bool, "instruments": "…", "bpm": number, "mood": "…", "problems": "disturbing passages with time, or empty", "outroStart": second from which the piece fades out/slows down, or null, "fit": grade 1-6 for the intended use (1 = very good), "comment": "one sentence"}`;

async function rate(file, kind) {
  const r = await post({ model: EAR, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: [
    { type: 'text', text: RATE_PROMPT(kind) },
    { type: 'input_audio', input_audio: { data: fs.readFileSync(file).toString('base64'), format: 'mp3' } } ] }] });
  const j = await r.json();
  const t = j.choices[0].message.content.replace(/^```json\s*|```$/g, '');
  return JSON.parse(t);
}

const [cmd, theme, n = '2'] = process.argv.slice(2);
if (!process.env.MUSIC_RAW) requireAssetsSrc();
if (cmd === 'gen') {
  const list = THEMES[theme];
  await Promise.all(list.flatMap((t) => Array.from({ length: +n }, async (_, k) => {
    const file = `${OUT}/${theme}/${t.id}-${k + 1}.mp3`;
    if (fs.existsSync(file)) return;
    try { const c = await generate(t.prompt, file); console.log(file, `${c} $`); }
    catch (e) { console.error(file, e.message); }
  })));
} else if (cmd === 'rate') {
  const dir = `${OUT}/${theme}`;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mp3'));
  await Promise.all(files.map(async (f) => {
    const out = `${dir}/${f.replace('.mp3', '.json')}`;
    if (fs.existsSync(out)) return;
    try { fs.writeFileSync(out, JSON.stringify(await rate(`${dir}/${f}`, theme), null, 1)); } catch (e) { console.error(f, e.message); }
  }));
  for (const f of files) { const p = `${dir}/${f.replace('.mp3', '.json')}`; if (fs.existsSync(p)) { const j = JSON.parse(fs.readFileSync(p)); console.log(f, 'grade', j.fit, j.vocals ? 'VOCALS' : '', j.bpm, 'BPM', '|', j.problems, '|', j.comment); } }
}

// ---------- Processing ----------
// Selection: raw file → target file, loudness (LUFS), cut. Target: slightly above the synthetic music
// (build ≈ −23, battle ≈ −22 LUFS at unit level, measured with scripts/audio-check.html).
// at 0 dB (mastered like pop music) – far too loud for background music.
export const PICK = [
  ...['morning', 'market', 'expanse', 'fields', 'evening'].map((id) => ({ src: `build/${id}-1`, out: `build-${id}`, lufs: -22 })),
  { src: 'winter/winter-1', out: 'winter-snow', lufs: -22 },
  { src: 'winter/winter-3', out: 'winter-frost', lufs: -22 },
  { src: 'battle/storm-1', out: 'battle-storm', lufs: -20 },
  { src: 'battle/shieldwall-1', out: 'battle-shieldwall', lufs: -20 },
  { src: 'menu/menu-2', out: 'menu', lufs: -22, end: 100, loop: 5 },
  { src: 'victory/victory-2', out: 'victory', lufs: -20, end: 25.5, fadeOut: 2 },
  { src: 'defeat/defeat-1', out: 'defeat', lufs: -20, end: 15.8, fadeOut: 1 },
];

function sh(args) { return execFileSync('ffmpeg', ['-hide_banner', '-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 }).toString(); }
function loudness(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  return +/I:\s+(-?[\d.]+) LUFS\s*\n\s*Threshold/.exec(r.stderr.split('Summary:').pop())[1];
}
function duration(file) {
  return +execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString();
}

function processOne(p, rawDir, outDir, tmp) {
  const src = `${rawDir}/${p.src}.mp3`, mid = `${tmp}/${p.out}.wav`, out = `${outDir}/${p.out}.mp3`;
  // 1. Remove silence at start/end, shorten if needed, fade in/out
  const trim = 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse';
  const pre = p.end ? `atrim=0:${p.end},` : '';
  sh(['-i', src, '-af', `${pre}${trim}`, '-ar', '44100', mid]);
  let len = duration(mid);
  const fo = p.fadeOut ?? 3;
  let filter = `afade=t=in:d=0.3,afade=t=out:st=${(len - fo).toFixed(2)}:d=${fo}`;
  const mid2 = `${tmp}/${p.out}-2.wav`;
  if (p.loop) {
    // Seamless loop: fade out the end (X s) and lay it over the faded-in start.
    // Result = mix(end, start) + middle; at the loop point the middle continues into the end.
    const X = p.loop, a = `${tmp}/a.wav`, b = `${tmp}/b.wav`, c = `${tmp}/c.wav`;
    sh(['-i', mid, '-af', `atrim=0:${X},afade=t=in:d=${X}`, a]);
    sh(['-i', mid, '-af', `atrim=${(len - X).toFixed(3)},asetpts=PTS-STARTPTS,afade=t=out:d=${X}`, c]);
    sh(['-i', mid, '-af', `atrim=${X}:${(len - X).toFixed(3)},asetpts=PTS-STARTPTS`, b]);
    sh(['-i', a, '-i', c, '-i', b, '-filter_complex', '[0][1]amix=inputs=2:normalize=0[x];[x][2]concat=n=2:v=0:a=1', mid2]);
  } else sh(['-i', mid, '-af', filter, mid2]);
  // 2. Level the loudness (peaks then stay far below 0 dB)
  const gain = p.lufs - loudness(mid2);
  sh(['-i', mid2, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.84:level=false`, '-c:a', 'libmp3lame', '-b:a', '112k', '-ac', '2', out]);
  return { out, len: duration(out), lufs: loudness(out) };
}

if (cmd === 'process') {
  const outDir = theme ?? 'public/audio/music';
  for (const f of fs.existsSync(outDir) ? fs.readdirSync(outDir) : []) if (f.endsWith('.mp3')) fs.rmSync(`${outDir}/${f}`);
  const tmp = fs.mkdtempSync('/tmp/kronland-music-');
  fs.mkdirSync(outDir, { recursive: true });
  for (const p of PICK) {
    const r = processOne(p, OUT, outDir, tmp);
    console.log(r.out, `${r.len.toFixed(1)} s`, `${r.lufs} LUFS`, `${(fs.statSync(r.out).size / 1e6).toFixed(2)} MB`);
  }
  fs.rmSync(tmp, { recursive: true });
  // Manifest: music section from the selection (theme = part before the first hyphen)
  const mf = 'public/audio/manifest.json';
  const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
  m.music = {};
  for (const p of PICK) (m.music[p.out.split('-')[0]] ??= { files: [], gain: 1 }).files.push(`music/${p.out}.mp3`);
  fs.writeFileSync(mf, JSON.stringify(m, null, 2) + '\n');
}
