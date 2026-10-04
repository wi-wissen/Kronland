// Public interface of the audio system (see docs/AUDIO.md).

export { getAudio, AudioEngine, sliderToGain } from './AudioEngine.js';
export { GameAudio } from './GameAudio.js';
export {
  AUDIO_SETTINGS_KEY, SETTINGS_EVENT, AUDIO_DEFAULTS, AUDIO_LABELS, VOLUME_KEYS,
  getAudioSettings, setAudioSetting, setAudioSettings,
} from './settings.js';
export { SFX_NAMES } from './sfx.js';

import { getAudio } from './AudioEngine.js';

/** Music for menus (start screen, campaign selection) or silence; safe without Web Audio. */
export function setMenuMusic(on) {
  try { getAudio().music.setTheme(on ? 'menu' : null); } catch { /* without audio */ }
}

/** Trigger a UI sound directly (e.g. from a settings UI as a preview). */
export function playUiSound(name = 'click') {
  try { return getAudio().play(name); } catch { return false; }
}
