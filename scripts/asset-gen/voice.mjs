// Character voices via Seed Audio (OpenRouter): design a voice from a description, take the chosen
// recording as a template and clone all further sentences from it. With automatic listening check.
//
//   node scripts/asset-gen/voice.mjs audition [role …]   audition samples: per draft one sentence designed, one sentence cloned
//   node scripts/asset-gen/voice.mjs pick <role> <nr> [source]   adopt draft nr (0, 1, …) as the template
//   node scripts/asset-gen/voice.mjs lines [role …]      voice all mission dialogues and barks (de/en, resumable)
//
// Roles and descriptions: assets-src/voices/cast.json. One folder per role assets-src/voices/<role>/ with the
// template (voice.wav, voice.json) and the unprocessed recordings (raw/). Game files: public/audio/voice/.
// Every recording is listened to again by a second model (Gemini 3.8 Flash); if the spoken text deviates, it is
// regenerated. All recordings are brought to the same loudness (EBU R128, ffmpeg loudnorm).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, reexecWithProxy } from './lib.mjs';
import { requireAssetsSrc } from '../require-assets-src.mjs';

const API = 'https://openrouter.ai/api/v1';
const TTS_MODEL = 'bytedance-seed/seed-audio-1-0';
const EAR_MODEL = 'google/gemini-3.8-flash';
const VOICE_DIR = path.join(ROOT, 'assets-src/voices');
const CAST_FILE = path.join(VOICE_DIR, 'cast.json');
const roleDir = (role) => path.join(VOICE_DIR, role);
const GAME_DIR = path.join(ROOT, 'public/audio/voice');
/** Mission speakers without a voice of their own (example script mission) */
const SPEAKER_ALIAS = { kunz: 'bandit', guard: 'collector' };
const AUDITION_DIR = path.join(VOICE_DIR, 'audition');
/** Target loudness (LUFS) and peak level of all recordings */
export const LOUDNESS = 'loudnorm=I=-18:TP=-1.5:LRA=11';
const TRIES = Number(process.env.VOICE_TRIES ?? 6);
const PARALLEL = Number(process.env.VOICE_PARALLEL ?? 5);

const headers = () => ({ 'Content-Type': 'application/json', ...(process.env.OPENROUTER_API_KEY ? { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } : {}) });
export const cast = () => JSON.parse(fs.readFileSync(CAST_FILE, 'utf8'));

async function speech(body) {
  const res = await fetch(`${API}/audio/speech`, { method: 'POST', headers: headers(), body: JSON.stringify({ model: TTS_MODEL, response_format: 'mp3', ...body }) });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Voice from a description: the description is in square brackets before the text (it is not spoken). */
const design = (desc, text) => speech({ input: `[Voice: ${desc}; ${CLEAN}] ${text}` });

/** Seed is a general audio model and otherwise paints backdrops (music, wind, horses): explicitly voice only. */
const CLEAN = 'pure dry speech recording, only the voice, no music, no background noise, no effects';

/** Sentence in the voice of a template (WAV + its wording). */
export const clone = (refWav, refText, text) => speech({
  input: text,
  input_references: [
    { type: 'input_audio', input_audio: { data: `data:audio/wav;base64,${fs.readFileSync(refWav).toString('base64')}`, format: 'wav' } },
    { type: 'text', text: refText },
  ],
});

/** Have the spoken wording of a WAV file listened to. */
async function hear(wav, lang) {
  const language = { de: 'The recording is German. ', en: 'The recording is English. ' }[lang] ?? '';
  const body = { model: EAR_MODEL, messages: [{ role: 'user', content: [
    { type: 'text', text: language + 'Reproduce exactly the spoken wording of this audio file, word for word, numbers written out. Append [NOISE] on its own line at the end if, besides the voice, music, noises or background sounds are audible, otherwise nothing.' },
    { type: 'input_audio', input_audio: { data: fs.readFileSync(wav).toString('base64'), format: 'wav' } },
  ] }] };
  const res = await fetch(`${API}/chat/completions`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Listening check ${res.status}`);
  return (await res.json()).choices[0].message.content ?? '';
}

/** Follow-up question for short sentences: is exactly this wording audible? */
async function confirms(wav, text, lang) {
  const body = { model: EAR_MODEL, messages: [{ role: 'user', content: [
    { type: 'text', text: `The recording is ${lang === 'en' ? 'English' : 'German'}. Is "${text}" spoken in it clearly and completely? Answer only with yes or no.` },
    { type: 'input_audio', input_audio: { data: fs.readFileSync(wav).toString('base64'), format: 'wav' } },
  ] }] };
  const res = await fetch(`${API}/chat/completions`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) return false;
  return /^\s*(yes|ja)/i.test((await res.json()).choices[0].message.content ?? '');
}

const words = (s) => s.toLowerCase().replace(/[–—-]/g, ' ').replace(/[^a-zäöüß0-9 ]/g, '').split(/\s+/).filter(Boolean);
/** Words equal, longer ones also with one letter deviation (names: "Orin" instead of "Orrin"). */
function sameWord(a, b) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 4 || Math.abs(a.length - b.length) > 1) return false;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length] <= 1;
}

/** Text for the speech model: ellipses become comma or full stop (long pauses make Seed abort
 * or insert noises). The key of the recording stays the original text. */
export const spokenText = (text) => text.replace(/\s*…\s*$/, '.').replace(/\s*…\s*/g, ', ').replace(/,\s*([.!?])/g, '$1');

/** Similarity of two word sequences (0…1, Levenshtein on words). */
export function similarity(a, b) {
  const x = words(a), y = words(b);
  if (x.join('') === y.join('')) return 1; // "Alder Farm" = "Alderfarm"
  const d = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)]);
  for (let j = 1; j <= y.length; j++) d[0][j] = j;
  for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (sameWord(x[i - 1], y[j - 1]) ? 0 : 1));
  }
  return 1 - d[x.length][y.length] / Math.max(x.length, y.length);
}

export const ffmpeg = (args) => { const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', ...args]); if (r.status) throw new Error(`ffmpeg: ${r.stderr}`); };

/**
 * Generate until the listening check passes; writes `wav` (24 kHz mono, loudness-matched).
 * @param {() => Promise<Buffer>} make
 * @returns {Promise<{ok:boolean, tries:number, heard:string, score:number}>}
 */
export async function speakChecked(make, text, wav, lang) {
  // attempts go into an intermediate file; the target file is only replaced on success (a good recording is kept)
  const mp3 = `${wav}.src.mp3`, tmp = `${wav}.try.wav`;
  let last = { ok: false, tries: 0, heard: '', score: 0 };
  for (let i = 1; i <= TRIES; i++) {
    try {
      fs.writeFileSync(mp3, await make());
      ffmpeg(['-i', mp3, '-af', LOUDNESS, '-ar', '24000', '-ac', '1', tmp]);
      const answer = await hear(tmp, lang);
      const noisy = answer.includes('[NOISE]');
      const heard = answer.replace('[NOISE]', '').trim();
      let score = similarity(heard, text);
      // The checker easily mishears short sentences ("Aye" → "I"): then ask specifically
      if (!noisy && score < 0.85 && words(text).length <= 3 && await confirms(tmp, text, lang)) score = 1;
      last = { ok: score >= 0.85 && !noisy, tries: i, heard: noisy ? `[noise] ${heard}` : heard, score };
      if (last.ok) { fs.renameSync(tmp, wav); break; }
    } catch (e) {
      last = { ...last, tries: i, heard: String(e.message) };
    }
  }
  fs.rmSync(mp3, { force: true }); fs.rmSync(tmp, { force: true });
  return last;
}

/** Work through jobs with limited parallelism. */
export async function pool(jobs, n = PARALLEL) {
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (next < jobs.length) await jobs[next++](); }));
}

/** Two sample sentences per role: real mission sentences (speakers) or barks (serfs, troops). */
export async function sampleLines(role) {
  const { BARKS } = await import(path.join(ROOT, 'src/audio/barks.js'));
  // Voice roles without barks of their own (e.g. soldierF) speak the barks assigned to them
  const speakers = cast().speakers ?? {};
  const b = BARKS[role] ?? BARKS[Object.keys(speakers).find((k) => k !== '_info' && speakers[k].includes(role))];
  // Own template sentence (neutral and not too short: pictorial words like "horses" make Seed paint noises,
  // short templates clone badly), plus a bark or a mission sentence
  const refLine = cast().roles[role]?.refLine;
  if (b && refLine) return [refLine, (b.grumble ?? b.attack ?? b.select)[0].de];
  const { missionLines } = await import(path.join(ROOT, 'src/sim/missions/dialogLines.js'));
  const lines = missionLines().filter((l) => l.speaker === role && typeof l.text?.de === 'string').map((l) => l.text.de);
  // Prefer short and medium-length sentences; with only one sentence add a bark
  const out = lines.sort((x, y) => Math.abs(x.length - 60) - Math.abs(y.length - 60)).slice(0, 2);
  if (refLine) return [refLine, out[0]];
  const extra = { prisoner: 'Ich sag euch alles, nur lasst mich laufen!', scholar: 'Lest die Zeichnung von links nach rechts, nicht umgekehrt.' };
  if (out.length < 2) out.push(b ? b.select[0].de : extra[role] ?? 'So sei es.');
  return out;
}

async function audition(roles) {
  const c = cast();
  fs.mkdirSync(AUDITION_DIR, { recursive: true });
  const indexFile = path.join(AUDITION_DIR, 'index.json');
  const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : {};
  // without argument: roles without a pick whose audition samples are still missing
  const todo = roles.length ? roles : Object.keys(c.roles).filter((r) => c.roles[r].pick === undefined
    && c.roles[r].designs.some((_, i) => !fs.existsSync(path.join(AUDITION_DIR, `${r}-${i}.mp3`))));
  const jobs = [];
  for (const role of todo) {
    const lines = await sampleLines(role);
    index[role] = { lines, designs: c.roles[role].designs };
    c.roles[role].designs.forEach((desc, i) => jobs.push(async () => {
      const ref = path.join(AUDITION_DIR, `${role}-${i}-ref.wav`), second = path.join(AUDITION_DIR, `${role}-${i}-2.wav`);
      const a = await speakChecked(() => design(desc, lines[0]), lines[0], ref);
      const b = a.ok ? await speakChecked(() => clone(ref, lines[0], lines[1]), lines[1], second) : a;
      console.log(`${role} ${i}: draft ${a.ok ? 'ok' : 'ERROR'} (${a.tries}), clone ${b.ok ? 'ok' : 'ERROR'} (${b.tries})${a.ok && b.ok ? '' : ` – heard: ${(a.ok ? b : a).heard.slice(0, 80)}`}`);
      fs.writeFileSync(`${ref}.txt`, lines[0]);
      if (!a.ok || !b.ok) return;
      ffmpeg(['-i', ref, '-f', 'lavfi', '-t', '0.7', '-i', 'anullsrc=r=24000:cl=mono', '-i', second,
        '-filter_complex', '[0][1][2]concat=n=3:v=0:a=1', '-b:a', '64k', path.join(AUDITION_DIR, `${role}-${i}.mp3`)]);
      fs.rmSync(second, { force: true });
    }));
  }
  await pool(jobs);
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2) + '\n');
}

/**
 * Adopt a draft as the template: recording to assets-src/voices/<role>/voice.wav, description and wording
 * to voice.json, choice in cast.json. With `from` the draft comes from another role.
 */
function pick(role, nr, from = role) {
  const c = cast();
  const src = path.join(AUDITION_DIR, `${from}-${nr}-ref.wav`);
  if (!c.roles[role] || !fs.existsSync(src)) throw new Error(`No draft ${from} ${nr}`);
  fs.mkdirSync(roleDir(role), { recursive: true });
  fs.copyFileSync(src, path.join(roleDir(role), 'voice.wav'));
  const auditions = JSON.parse(fs.readFileSync(path.join(AUDITION_DIR, 'index.json'), 'utf8'));
  const description = (c.roles[from] ?? auditions[from]).designs[Number(nr)];
  fs.writeFileSync(path.join(roleDir(role), 'voice.json'), JSON.stringify({
    model: TTS_MODEL, description, prompt: `[Voice: ${description}; ${CLEAN}] …`, text: fs.readFileSync(`${src}.txt`, 'utf8'),
    source: from === role ? `draft ${nr}` : `draft ${nr} of role ${from}`, loudness: LOUDNESS,
  }, null, 2) + '\n');
  c.roles[role].pick = from === role ? Number(nr) : `${from} ${nr}`;
  fs.writeFileSync(CAST_FILE, JSON.stringify(c, null, 2) + '\n');
  console.log(`${role}: draft ${nr} is the template`);
}

/** Key of a recording in the index (src/audio/voiceLines.js reads the same one). */
export const lineKey = (voice, lang, text) => `${voice}|${lang}|${text}`;
const fnv = (str) => { let h = 0x811c9dc5; for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };

/**
 * Everything that is spoken: mission dialogues (speaker → voice) – dialogue actions of mission files and say() lines
 * of level folders (Python syntax tree, src/sim/missions/dialogLines.js) – and barks (bark role → voices).
 */
export async function collectLines() {
  const c = cast();
  const { missionLines } = await import(path.join(ROOT, 'src/sim/missions/dialogLines.js'));
  const { BARKS } = await import(path.join(ROOT, 'src/audio/barks.js'));
  const out = new Map(), skipped = new Set();
  const add = (voice, text) => {
    for (const lang of ['de', 'en']) {
      const t = text?.[lang];
      if (!t) continue;
      const key = lineKey(voice, lang, t);
      if (!out.has(key)) out.set(key, { voice, lang, text: t, file: `${lang}/${voice}-${fnv(key)}.mp3` });
    }
  };
  for (const l of missionLines()) {
    const voice = SPEAKER_ALIAS[l.speaker] ?? l.speaker;
    if (c.roles[voice]) add(voice, l.text); else skipped.add(l.speaker);
  }
  for (const [textRole, events] of Object.entries(BARKS)) {
    for (const voice of c.speakers?.[textRole] ?? [textRole]) for (const lines of Object.values(events)) lines.forEach((l) => add(voice, l));
  }
  return { lines: [...out.values()], skipped: [...skipped] };
}

async function lines(only) {
  const { lines: all, skipped } = await collectLines();
  if (skipped.length) console.log('Without voice:', skipped.join(', '));
  const todo = all.filter((l) => (!only.length || only.includes(l.voice)) && !fs.existsSync(path.join(GAME_DIR, l.file)));
  console.log(`${all.length} recordings, of which ${todo.length} to generate`);
  const failed = [];
  let done = 0;
  await pool(todo.map((l) => async () => {
    const dir = roleDir(l.voice), ref = path.join(dir, 'voice.wav');
    if (!fs.existsSync(ref)) { failed.push({ ...l, why: 'no template' }); return; }
    const refText = JSON.parse(fs.readFileSync(path.join(dir, 'voice.json'), 'utf8')).text;
    const base = path.basename(l.file, '.mp3');
    const rawFile = path.join(dir, 'raw', `${l.lang}-${base.slice(l.voice.length + 1)}.mp3`);
    const wav = path.join(GAME_DIR, `${l.file}.wav`);
    fs.mkdirSync(path.dirname(rawFile), { recursive: true });
    fs.mkdirSync(path.dirname(wav), { recursive: true });
    let raw = null;
    const r = await speakChecked(async () => (raw = await clone(ref, refText, spokenText(l.text))), l.text, wav, l.lang);
    if (!r.ok) { failed.push({ ...l, why: r.heard.slice(0, 80) }); fs.rmSync(wav, { force: true }); return; }
    fs.writeFileSync(rawFile, raw);
    ffmpeg(['-i', wav, '-ac', '1', '-b:a', '48k', path.join(GAME_DIR, l.file)]);
    fs.rmSync(wav, { force: true });
    if (++done % 25 === 0) console.log(`${done}/${todo.length}`);
  }));
  writeIndex(all);
  for (const f of failed) console.log(`ERROR ${f.voice} ${f.lang} "${f.text}": ${f.why}`);
  console.log(`done: ${done} new, ${failed.length} failed`);
}

/** Index of the existing game files: key (voice|language|text) → file. */
function writeIndex(all) {
  const files = {};
  for (const l of all) if (fs.existsSync(path.join(GAME_DIR, l.file))) files[lineKey(l.voice, l.lang, l.text)] = l.file;
  fs.writeFileSync(path.join(GAME_DIR, 'index.json'), JSON.stringify({ version: 1, files }, null, 1) + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  requireAssetsSrc('voices');
  if (reexecWithProxy()) process.exit(0);
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'audition') await audition(rest);
  else if (cmd === 'pick') pick(rest[0], rest[1], rest[2]);
  else if (cmd === 'lines') await lines(rest);
  else console.log('Usage: node scripts/asset-gen/voice.mjs audition [role …] | pick <role> <nr> [source] | lines [role …]');
}
