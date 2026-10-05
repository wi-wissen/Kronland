// Voiced sentences (public/audio/voice/, generated with scripts/asset-gen/voice.mjs, see docs/AUDIO.md#stimmen):
// load the index and find the file for voice + language + text. If a recording is missing, it stays silent or the
// browser reads it aloud – rendering never influences the course of the game.

import { siteUrl } from '../paths.js';

/** Speakers of the missions without their own voice */
export const SPEAKER_VOICE = { kunz: 'bandit' };

/** Voice of a mission speaker. */
export const speakerVoice = (speaker) => SPEAKER_VOICE[speaker] ?? speaker;

/** Key in the index (same as in the generation script). */
export const voiceKey = (voice, lang, text) => `${voice}|${lang}|${text}`;

/** @type {Record<string, string>|null} */
let index = null;
/** @type {Promise<void>|null} */
let loading = null;

/** Load the index once (in the background; until then there are no recordings). */
export function loadVoiceIndex() {
  if (index || loading || typeof fetch === 'undefined') return loading ?? Promise.resolve();
  loading = fetch(siteUrl('audio/voice/index.json'))
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { index = d?.files ?? {}; })
    .catch(() => { index = {}; });
  return loading;
}

/** Set the index directly (tests). @param {Record<string, string>|null} files */
export function setVoiceIndex(files) { index = files; loading = null; }

/** URL of the recording or null. */
export function voiceFile(voice, lang, text) {
  const f = voice && text ? index?.[voiceKey(voice, lang, text)] : null;
  return f ? siteUrl(`audio/voice/${f}`) : null;
}
