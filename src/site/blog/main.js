import { mountPage } from '../site.js';
import Blog from './Blog.vue';

// Overview and articles are the same page; Blog.vue sets the title depending on the article.
mountPage(Blog);
