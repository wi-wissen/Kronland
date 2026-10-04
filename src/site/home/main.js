import { mountPage, st } from '../site.js';
import Home from './Home.vue';

mountPage(Home, { title: (l) => st('home.title', null, l) });
