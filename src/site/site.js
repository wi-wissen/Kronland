// Shared foundation of the website pages (home, manual, compendium): language, texts, mounting the Vue app.
// Language as in the game: localStorage 'kronland-lang'; without a saved choice the browser language
// (German, otherwise English). Only an explicit choice on the website is saved – then
// the game also starts in that language.

import { createApp, watch } from 'vue';
import { i18n, setLang, LANGS } from '../i18n/index.js';
import { I18nPlugin, buildingName, techName, unitName, lineName, resName, profName, weatherName, blessingName, heroTitle, heroName, abilityName, techDesc, rankName } from '../i18n/index.js';
import SiteIcon from './SiteIcon.vue';
import { siteRoot } from '../paths.js';
import STRINGS from './strings.js';
import '../ui/style.css';
import './site.css';

const KEY = 'kronland-lang';

/** Language for the website: saved, otherwise browser. */
export function detectLang(nav = globalThis.navigator, storage = globalThis.localStorage) {
  try {
    const v = storage?.getItem(KEY);
    if (LANGS.includes(v)) return v;
  } catch { /* private mode */ }
  const list = [...(nav?.languages ?? []), nav?.language].filter(Boolean).map((l) => String(l).slice(0, 2).toLowerCase());
  const hit = list.find((l) => LANGS.includes(l));
  return hit ?? 'de';
}

const fill = (s, p) => (p ? s.replace(/\{(\w+)\}/g, (m, k) => (p[k] ?? m)) : s);

/** Website text in the current language. */
export function st(key, params, lang = i18n.lang) {
  const s = STRINGS[lang]?.[key] ?? STRINGS.de[key] ?? key;
  return fill(s, params);
}

/** Switch language (saved, also applies to the game). */
export const chooseLang = (l) => setLang(l);

/** Links to the pages, relative to the current page. */
export function pageLinks(root = siteRoot()) {
  return { home: root, play: `${root}play/`, manual: `${root}manual/`, compendium: `${root}compendium/` };
}

/**
 * Mount the page.
 * @param {any} component root component
 * @param {{ title?: (lang: string) => string }} [opts]
 */
export function mountPage(component, opts = {}) {
  i18n.lang = detectLang();
  const apply = () => {
    document.documentElement.lang = i18n.lang;
    if (opts.title) document.title = opts.title(i18n.lang);
  };
  apply();
  watch(() => i18n.lang, apply);
  const app = createApp(component);
  // Like ui/plugin.js (UiPlugin), but with SVG icons without PNG conversion and without game tooltips
  app.use(I18nPlugin);
  app.component('Icon', SiteIcon);
  app.config.globalProperties.$name = {
    building: buildingName, tech: techName, unit: unitName, line: lineName, res: resName, prof: profName,
    weather: weatherName, blessing: blessingName, heroTitle, hero: heroName, ability: abilityName, techDesc, rank: rankName,
  };
  app.config.globalProperties.$s = st;
  app.config.globalProperties.$links = pageLinks();
  app.config.globalProperties.$siteRoot = siteRoot();
  app.mount('#app');
  return app;
}
