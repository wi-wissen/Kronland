<template>
  <!-- Moving title backdrop of the menus (silent loop of the painted title image). It lies under the .backdrop of the
       menu, which then only darkens (.menu-anim ~ .backdrop in StartMenu.vue). The still stays underneath and the clip
       fades in over it once it really plays; if autoplay is refused (e.g. iOS power saving) or the file is missing,
       the still simply stays. -->
  <div v-if="allowed" class="menu-anim" :class="{ playing }" aria-hidden="true" data-testid="menu-anim">
    <video
      ref="video"
      muted
      autoplay
      loop
      playsinline
      disablepictureinpicture
      disableremoteplayback
      preload="auto"
      tabindex="-1"
      @playing="playing = true"
      @error="playing = false"
    >
      <source v-for="s in sources" :key="s.src" :src="s.src" :type="s.type">
    </video>
  </div>
</template>

<script>
import { settings } from './settings.js';
import { siteUrl } from '../paths.js';
import { ART_LOOP, menuMotionAllowed } from './art.js';

const REDUCE = '(prefers-reduced-motion: reduce)';

export default {
  name: 'MenuBackdrop',
  data() {
    return { reducedMotion: this.matchReduce()?.matches ?? false, playing: false };
  },
  computed: {
    allowed() {
      return menuMotionAllowed({ setting: settings.menuMotion, reducedMotion: this.reducedMotion, saveData: !!globalThis.navigator?.connection?.saveData });
    },
    sources() { return ART_LOOP.map((s) => ({ src: siteUrl(s.path), type: s.type })); },
  },
  watch: {
    allowed(on) { if (!on) this.playing = false; },
  },
  mounted() {
    this.mq = this.matchReduce();
    this.onReduce = (e) => { this.reducedMotion = e.matches; };
    this.mq?.addEventListener?.('change', this.onReduce);
    // A muted clip is allowed to start by itself; play() covers browsers that ignore the attribute after a re-render
    this.$refs.video?.play?.()?.catch?.(() => {});
  },
  beforeUnmount() { this.mq?.removeEventListener?.('change', this.onReduce); },
  methods: {
    matchReduce() { try { return globalThis.matchMedia?.(REDUCE) ?? null; } catch { return null; } },
  },
};
</script>

<style>
.menu-anim { position: fixed; inset: 0; pointer-events: none; background: var(--art-title, none) center 40% / cover no-repeat, #3a2a1c; }
/* Same framing as the still (center 40% / cover) */
.menu-anim video { width: 100%; height: 100%; object-fit: cover; object-position: center 40%; display: block; opacity: 0; transition: opacity 0.8s ease; }
.menu-anim.playing video { opacity: 1; }
</style>
