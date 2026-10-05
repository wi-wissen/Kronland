// Global UI helpers for all components (Options API):
// $t / $tr / $reason (i18n), $name.* (names from game data), <Icon>, v-tip.

import { I18nPlugin, buildingName, techName, unitName, lineName, resName, profName, weatherName, blessingName, heroTitle, heroName, abilityName, techDesc, rankName } from '../i18n/index.js';
import Icon from './icons/Icon.vue';
import { tipDirective } from './tooltip.js';
import { playerCss } from '../render/playerColors.js';

export const UiPlugin = {
  install(app) {
    app.use(I18nPlugin);
    app.component('Icon', Icon);
    app.directive('tip', tipDirective);
    app.config.globalProperties.$name = {
      building: buildingName, tech: techName, unit: unitName, line: lineName, res: resName, prof: profName,
      weather: weatherName, blessing: blessingName, heroTitle, hero: heroName, ability: abilityName,
      techDesc, rank: rankName,
    };
  },
};

/** Game time (ticks) as m:ss or h:mm:ss. */
export function clock(ticks) {
  const s = Math.max(0, Math.floor(ticks / 10));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Seconds as m:ss. */
export const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

/** Player colour (like the 3D models, with the human's colour choice) as CSS colour; mapping in render/playerColors.js. */
export const playerColor = (i) => playerCss(i);
