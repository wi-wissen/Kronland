// "vor 12 Min" / "gestern" / date: time of a save game or of the last play in the player's words.
import { ago } from '../library/model.js';

/**
 * @param {string} iso ISO time @param {(key: string, params?: any) => string} t @param {string} lang
 * @param {number} [now]
 */
export function whenText(iso, t, lang, now = Date.now()) {
  const a = ago(iso, now);
  if (a.key === 'time.day' && a.n === 1) return t('time.day1');
  if (a.key === 'time.date') return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'de-DE', { dateStyle: 'medium' });
  return t(a.key, { n: a.n });
}
