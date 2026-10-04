import { mountPage, st } from '../site.js';
import Manual from './Manual.vue';

mountPage(Manual, { title: (l) => `${st('manual.title', null, l)} – Kronland` });
