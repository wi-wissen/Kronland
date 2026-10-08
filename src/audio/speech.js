// Read dialogues aloud: the scenario's own recording (MP3/OGG under public/), the campaign's voiced sentences
// (public/audio/voice, see voiceLines.js) or the browser's speech output (Web Speech API).
// Pure rendering: the simulation sets the duration of a dialogue itself, reading aloud never influences
// the course of the game.

import { get } from '../ui/settings.js';
import { tr } from '../i18n/index.js';
import { loadVoiceIndex, voiceFile, speakerVoice } from './voiceLines.js';
import { assetUrl, assetPathOk } from '../paths.js';

/** Female speakers get a slightly higher voice if the browser has only one voice. */
const HIGH = new Set(['nelia', 'elder', 'villager', 'scholar']);

let audio = null;
let lastSeq = 0;
/** Reasons the voice is held ('pause': game paused, 'hidden': tab in the background) */
const holds = new Set();
/** recording paused by a hold (its pause event must not count as "finished") */
let heldAudio = null;
let fadeTimer = null;
/** volume of the current recording (target when fading back in) */
let audioVol = 1;
/** Fade length of a held recording (ms), like the game sounds (hold.js) */
const FADE_MS = 300;

/** Fade an <audio> element's volume to `to`, then call done (volume is ignored on iOS: done comes anyway). */
function fadeVolume(a, to, done) {
  clearInterval(fadeTimer);
  const from = a.volume, steps = 10;
  let i = 0;
  fadeTimer = setInterval(() => {
    i++;
    try { a.volume = Math.max(0, Math.min(1, from + ((to - from) * i) / steps)); } catch { /* */ }
    if (i >= steps) { clearInterval(fadeTimer); fadeTimer = null; done?.(); }
  }, FADE_MS / steps);
}

/**
 * Hold or release the spoken dialogue: a recording fades out and pauses (and later continues where it
 * stopped), the browser's speech output pauses. Several reasons can hold at once.
 * @param {'pause'|'hidden'} reason @param {boolean} on
 */
export function holdSpeech(reason, on) {
  const was = holds.size > 0;
  if (on) holds.add(reason); else holds.delete(reason);
  const now = holds.size > 0;
  if (was === now) return;
  try { if (now) globalThis.speechSynthesis?.pause(); else globalThis.speechSynthesis?.resume(); } catch { /* without speech output */ }
  const a = audio;
  if (!a) return;
  if (now) {
    if (a.paused && heldAudio !== a) return;
    heldAudio = a;
    fadeVolume(a, 0, () => { if (holds.size && audio === a) a.pause(); });
  } else if (heldAudio === a) {
    clearInterval(fadeTimer);
    const go = () => { heldAudio = null; fadeVolume(a, audioVol); };
    if (a.paused) a.play().then(go).catch(() => { heldAudio = null; }); else go();
  }
}

/** Is the voice held right now? */
export const speechHeld = () => holds.size > 0;

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => holdSpeech('hidden', document.hidden));
  if (document.hidden) holdSpeech('hidden', true);
}

// Load the recording index early so even the first dialogues of a mission find their recording
if (typeof window !== 'undefined') loadVoiceIndex();

/** Is something playing right now? */
export const speaking = () => (audio && !audio.paused) || (globalThis.speechSynthesis?.speaking ?? false);

/** Stop everything (dialogue dismissed, game ended). */
export function stopSpeech() {
  clearInterval(fadeTimer);
  heldAudio = null;
  try { if (audio) { audio.pause(); audio = null; } } catch { /* without audio */ }
  try { globalThis.speechSynthesis?.cancel(); } catch { /* without speech output */ }
}

/** Voice in the desired language (preferably local, natural voices). */
function pickVoice(lang) {
  const voices = globalThis.speechSynthesis?.getVoices?.() ?? [];
  const want = lang === 'en' ? 'en' : 'de';
  const list = voices.filter((v) => v.lang?.toLowerCase().startsWith(want));
  return list.find((v) => v.localService && /natural|neural|premium/i.test(v.name)) ?? list.find((v) => v.localService) ?? list[0] ?? null;
}

/**
 * Read a message aloud. Each message at most once (seq).
 * @param {{ seq: number, speaker?: string|null, text: any, voice?: string|null }} msg
 * @param {string} lang
 * @param {{ volume?: number, onEnd?: () => void }} [opts] onEnd: recording or reading finished (also on error)
 * @returns {boolean} whether something is playing
 */
export function speak(msg, lang, opts = {}) {
  if (!msg || msg.seq <= lastSeq) return false;
  lastSeq = msg.seq;
  if (!get('speech') || get('muted')) return false;
  stopSpeech();
  const volume = Math.max(0, Math.min(1, opts.volume ?? get('master') ?? 1));
  // Own recording: voice is a path or { de, en }; otherwise the speaker's voiced sentence
  const own = typeof msg.voice === 'string' ? msg.voice : msg.voice?.[lang] ?? msg.voice?.de ?? null;
  // A level may only name its own files (no other website); otherwise the speaker's recorded line or speech output
  const file = (assetPathOk(own) ? own : null)
    ?? (msg.speaker ? voiceFile(speakerVoice(msg.speaker), lang, tr(msg.text, lang)) : null);
  if (file && typeof Audio !== 'undefined') {
    try {
      const a = new Audio(assetUrl(file));
      audio = a;
      a.volume = volume;
      audioVol = volume;
      const end = once(opts.onEnd);
      a.addEventListener('ended', end);
      a.addEventListener('error', end);
      // also when paused (clicked away, next dialogue) – but not when held by a game pause
      a.addEventListener('pause', () => { if (heldAudio !== a) end(); });
      if (holds.size) { heldAudio = a; a.volume = 0; return true; } // starts once the game resumes
      a.play().catch(() => { if (audio === a) audio = null; end(); });
      return true;
    } catch { audio = null; }
  }
  const synth = globalThis.speechSynthesis;
  const Utter = globalThis.SpeechSynthesisUtterance;
  if (!synth || !Utter) return false;
  const text = tr(msg.text, lang).trim();
  if (!text) return false;
  try {
    const u = new Utter(text);
    u.lang = lang === 'en' ? 'en-GB' : 'de-DE';
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.volume = volume;
    u.rate = 1;
    u.pitch = HIGH.has(msg.speaker ?? '') ? 1.15 : 0.92;
    const end = once(opts.onEnd);
    u.onend = end;
    u.onerror = end;
    synth.speak(u);
    if (holds.size) synth.pause();
    return true;
  } catch { return false; }
}

/** Callback at most once. @param {(() => void)|undefined} f */
function once(f) {
  let done = !f;
  return () => { if (!done) { done = true; f(); } };
}

/** On a new game: reset counters. */
export function resetSpeech() { stopSpeech(); lastSeq = 0; loadVoiceIndex(); }
