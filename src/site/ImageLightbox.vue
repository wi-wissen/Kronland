<template>
  <dialog ref="box" class="lightbox" data-testid="lightbox" :aria-label="item ? item.caption || item.alt : ''" @click="onClick" @close="onClose" @keydown="onKey" @touchstart.passive="onTouchStart" @touchend="onTouchEnd">
    <figure v-if="item" class="lb-fig">
      <img :key="item.src" :src="item.src" :alt="item.alt" :class="{ svg: svg }" :style="sizeStyle" data-testid="lightbox-img" @load="onLoad">
      <figcaption v-if="item.caption" data-testid="lightbox-caption">{{ item.caption }}</figcaption>
    </figure>
    <div class="lb-ctl">
      <template v-if="items.length > 1">
        <button type="button" class="icon-btn" :aria-label="$s('lightbox.prev')" data-testid="lightbox-prev" @click="step(-1)"><Icon name="back" /></button>
        <span class="lb-count" aria-live="polite">{{ index + 1 }} / {{ items.length }}</span>
        <button type="button" class="icon-btn" :aria-label="$s('lightbox.next')" data-testid="lightbox-next" @click="step(1)"><Icon name="next" /></button>
      </template>
      <button type="button" class="icon-btn" :aria-label="$s('lightbox.close')" data-testid="lightbox-close" @click="close"><Icon name="close" /></button>
    </div>
  </dialog>
</template>

<script>
import { ZOOM_SELECTOR, largestSrc, wrapIndex, swipeStep, isSvg } from './lightbox.js';

/**
 * Enlarged view of images – one per page, mounted in SiteLayout.
 * - Article images (`.prose figure img`, also re-rendered v-html) are found by event delegation on the document
 *   and made focusable by a MutationObserver; prev/next run through the images of the same article.
 * - Other pages (home gallery) call show(items, index) with [{ src, alt, caption }].
 */
export default {
  name: 'ImageLightbox',
  data() { return { items: [], index: null, ratio: 0 }; },
  computed: {
    item() { return this.index === null ? null : this.items[this.index] ?? null; },
    svg() { return isSvg(this.item?.src); },
    /** As large as fits: width from the aspect ratio and the free height; raster images not beyond their own size. */
    sizeStyle() {
      if (!this.ratio) return null;
      return { '--ar': String(this.ratio), '--nw': this.svg || !this.item?.w ? '100%' : `${this.item.w}px` };
    },
  },
  watch: {
    // Labels of the article images follow the language
    '$i18n.lang'() { this.decorate(true); },
  },
  mounted() {
    this.onDocClick = (e) => {
      const img = e.target instanceof Element ? e.target.closest(ZOOM_SELECTOR) : null;
      if (img) { e.preventDefault(); this.openFrom(img); }
    };
    this.onDocKey = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const img = e.target instanceof Element && e.target.matches(ZOOM_SELECTOR) ? e.target : null;
      if (img) { e.preventDefault(); this.openFrom(img); }
    };
    document.addEventListener('click', this.onDocClick);
    document.addEventListener('keydown', this.onDocKey);
    this.decorate();
    this.observer = new MutationObserver(() => this.decorate());
    this.observer.observe(document.body, { childList: true, subtree: true });
  },
  beforeUnmount() {
    document.removeEventListener('click', this.onDocClick);
    document.removeEventListener('keydown', this.onDocKey);
    this.observer?.disconnect();
  },
  methods: {
    /** Make article images focusable buttons (only attributes – nothing moves). */
    decorate(all = false) {
      for (const img of document.querySelectorAll(ZOOM_SELECTOR)) {
        if (!all && img.dataset.zoom) continue;
        img.dataset.zoom = '1';
        img.tabIndex = 0;
        img.setAttribute('role', 'button');
        const alt = img.getAttribute('alt');
        img.setAttribute('aria-label', alt ? this.$s('home.gallery.open', { name: alt }) : this.$s('lightbox.open'));
      }
    },
    /** Open an article image together with the other images of its article. */
    openFrom(img) {
      const root = img.closest('.prose') ?? document;
      const imgs = [...root.querySelectorAll(ZOOM_SELECTOR)];
      const items = imgs.map((el) => ({
        src: largestSrc(el.getAttribute('srcset'), el.currentSrc || el.src),
        alt: el.getAttribute('alt') ?? '',
        caption: el.closest('figure')?.querySelector('figcaption')?.textContent.trim() ?? '',
        ratio: el.naturalWidth && el.naturalHeight ? el.naturalWidth / el.naturalHeight : 0,
      }));
      this.show(items, Math.max(0, imgs.indexOf(img)));
    },
    /**
     * Show images in the lightbox.
     * @param {{ src: string, alt?: string, caption?: string, ratio?: number }[]} items
     * @param {number} [index]
     */
    show(items, index = 0) {
      this.items = items;
      this.go(index);
      const box = this.$refs.box;
      if (box && !box.open) box.showModal?.();
    },
    go(i) {
      this.index = i;
      this.ratio = this.items[i]?.ratio ?? 0;
    },
    close() { this.$refs.box?.close?.(); },
    /**
     * The close event arrives as a task after closing: if an image was opened again in the meantime (Escape and at
     * once Enter on the next image – input runs before queued tasks), it must not clear the new image.
     */
    onClose() { if (!this.$refs.box?.open) this.index = null; },
    step(d) { if (this.items.length > 1) this.go(wrapIndex(this.index, d, this.items.length)); },
    onLoad(e) {
      const { naturalWidth: w, naturalHeight: h } = e.target;
      if (!w || !h || !this.item) return;
      this.item.w = w;
      this.ratio = w / h;
    },
    /** Backdrop or empty space around the image closes; image, caption and buttons do not. */
    onClick(e) {
      if (e.target === this.$refs.box || e.target.classList?.contains('lb-fig')) this.close();
    },
    onKey(e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); this.step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); this.step(-1); }
    },
    onTouchStart(e) {
      const t = e.changedTouches[0];
      this.touch = t ? { x: t.clientX, y: t.clientY } : null;
    },
    onTouchEnd(e) {
      const t = e.changedTouches[0];
      if (!t || !this.touch) return;
      const d = swipeStep(t.clientX - this.touch.x, t.clientY - this.touch.y);
      this.touch = null;
      if (d) this.step(d);
    },
  },
};
</script>

<style>
.lightbox { padding: 0; border: 0; background: transparent; width: min(96vw, 1440px); max-width: none; max-height: 96vh; overflow: visible; color: var(--ink); }
.lightbox::backdrop { background: rgba(10, 6, 3, 0.88); }
.lightbox .lb-fig { margin: 0; display: flex; flex-direction: column; align-items: center; }
.lightbox img { display: block; max-width: 100%; max-height: calc(96vh - 5.5rem); height: auto; margin: 0 auto; border-radius: var(--r-md); box-shadow: var(--panel-edge); background: var(--wood-950); }
/* Known aspect ratio: as wide as the free height allows, raster images at most at their own width */
.lightbox img[style*='--ar'] { width: min(var(--nw), 100%, calc((96vh - 5.5rem) * var(--ar))); }
.lightbox img.svg { background: #fffaf0; }
.lightbox figcaption { text-align: center; margin-top: 0.5rem; color: var(--ink-muted); max-width: 60rem; line-height: 1.4; }
.lb-ctl { display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 0.5rem; }
.lb-count { min-width: 3.5rem; text-align: center; color: var(--ink-muted); font-variant-numeric: tabular-nums; }

/* Article images: zoom cursor; hover/focus only brightens and shows a gold edge – nothing moves */
.prose figure:not(.code) > img[data-zoom] { cursor: zoom-in; transition: filter 0.2s, box-shadow 0.2s; }
.prose figure:not(.code) > img[data-zoom]:focus-visible { outline: none; filter: brightness(1.08); box-shadow: 0 0 0 2px var(--gold-500), 0 6px 18px rgba(40, 25, 5, 0.25); }
@media (hover: hover) {
  .prose figure:not(.code) > img[data-zoom]:hover { filter: brightness(1.08); box-shadow: 0 0 0 2px var(--gold-500), 0 6px 18px rgba(40, 25, 5, 0.25); }
}
</style>
