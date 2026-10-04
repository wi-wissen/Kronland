import { mountPage, st } from '../site.js';
import Compendium from './Compendium.vue';

mountPage(Compendium, { title: (l) => `${st('compendium.title', null, l)} – Kronland` });
