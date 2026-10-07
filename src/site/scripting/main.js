import { mountPage, st } from '../site.js';
import Scripting from './Scripting.vue';

mountPage(Scripting, { title: (l) => `${st('scripting.title', null, l)} – Kronland` });
