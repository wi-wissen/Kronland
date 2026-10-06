// Read dialogues aloud: the scenario's own recording (MP3/OGG under public/), the campaign's voiced sentences
// (public/audio/voice, see voiceLines.js) or the browser's speech output (Web Speech API).
// Pure rendering: the simulation sets the duration of a dialogue itself, reading aloud never influences
// the course of the game.

import { get } from '../ui/settings.js';
import { tr } from '../i18n/index.js';
import { loadVoiceIndex, voiceFile, speakerVoice } from './voiceLines.js';
import { assetUrl } from '../paths.js';

/** Female speakers get a slightly higher voice if the browser has only one voice. */
const HIGH = new Set(['nelia', 'elder', 'villager', 'scholar']);

let audio = null;
let lastSeq = 0;

// Load the recording index early so even the first dialogues of a mission find their recording
if (typeof window !== 'undefined') loadVoiceIndex();

/** Is something playing right now? */
export const speaking = () => (audio && !audio.paused) || (globalThis.speechSynthesis?.speaking ?? false);

/** Stop everything (dialogue dismissed, game ended). */
export function stopSpeech() {
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
  const file = (typeof msg.voice === 'string' ? msg.voice : msg.voice?.[lang] ?? msg.voice?.de ?? null)
    ?? (msg.speaker ? voiceFile(speakerVoice(msg.speaker), lang, tr(msg.text, lang)) : null);
  if (file && typeof Audio !== 'undefined') {
    try {
      const a = new Audio(assetUrl(file));
      audio = a;
      a.volume = volume;
      const end = once(opts.onEnd);
      a.addEventListener('ended', end);
      a.addEventListener('error', end);
      a.addEventListener('pause', end); // also when paused (clicked away, next dialogue)
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
