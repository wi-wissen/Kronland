import { createApp } from 'vue';
import App from './ui/App.vue';
import { UiPlugin } from './ui/plugin.js';
import { applyUiScale } from './ui/settings.js';
import { currentLang } from './i18n/index.js';
import { preloadIcons } from './ui/icons/Icon.vue';
import './ui/style.css';
import { registerServiceWorker } from './pwa.js';

applyUiScale();
document.documentElement.lang = currentLang();
createApp(App).use(UiPlugin).mount('#app');
// Convert icons to bitmaps once (cheaper to redraw over the 3D scene)
setTimeout(preloadIcons, 50);
registerServiceWorker();
