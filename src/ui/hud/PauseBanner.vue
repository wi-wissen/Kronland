<template>
  <transition name="pause-banner">
    <div v-if="show" class="pause-banner" :class="{ top }" role="status" data-testid="pause-banner">
      <Icon name="pause" class="pb-icon" />
      <span class="pb-title">{{ $t('pause.title') }}</span>
      <span class="pb-hint">{{ touch ? $t('pause.hintTouch') : $t('pause.hint', { key: $t('key.space') }) }}</span>
    </div>
  </transition>
</template>

<script>
/**
 * Banner while the game is paused (Space or pause button). Lets clicks through: orders can still be given
 * on the map while paused; resuming goes via Space or the play button in the top bar.
 */
export default {
  name: 'PauseBanner',
  props: {
    show: { type: Boolean, default: false },
    touch: { type: Boolean, default: false },
    /** something is selected: the context panel takes the bottom (up to most of the height), the banner moves under the top bar */
    top: { type: Boolean, default: false },
  },
};
</script>

<style>
/* Bottom centre, where the context panel of a selection would be: the map stays free to look at */
.pause-banner {
  position: fixed; z-index: 5; left: 50%; bottom: calc(var(--hud-gap) * 2 + var(--safe-b)); transform: translateX(-50%);
  display: grid; grid-template-columns: auto auto; align-items: center; column-gap: 0.75rem; row-gap: 0.125rem;
  max-width: calc(100vw - 9.5rem); padding: 0.625rem 1.25rem 0.625rem 1rem; border: 0; border-radius: 0.75rem;
  background: linear-gradient(180deg, rgba(58, 40, 26, 0.92), rgba(36, 24, 16, 0.92));
  box-shadow: inset 0 0 0 1px rgba(225, 168, 58, 0.45), 0 8px 24px rgba(0, 0, 0, 0.45);
  color: var(--ink); text-align: left; pointer-events: none;
}
.pause-banner.top { bottom: auto; top: calc(var(--top-total, 4rem) + var(--hud-gap)); padding: 0.3125rem 1rem 0.3125rem 0.75rem; }
/* compact under the top bar: only the word, so it hardly covers a tall context panel (serfs' build menu) */
.pause-banner.top .pb-hint { display: none; }
.pause-banner.top .pb-icon { grid-row: auto; width: 1.25rem; height: 1.25rem; }
.pause-banner.top .pb-title { font-size: 1.125rem; }
.pause-banner .pb-icon { grid-row: span 2; width: 1.75rem; height: 1.75rem; color: var(--brass, #e1a83a); }
.pause-banner .pb-title { font-family: var(--display); font-size: clamp(1.25rem, 4.5vw, 1.75rem); line-height: 1.1; letter-spacing: 0.04em; }
.pause-banner .pb-hint { font-size: var(--fs-sm); color: var(--ink-muted); white-space: nowrap; }
.pause-banner-enter-active, .pause-banner-leave-active { transition: opacity 0.15s ease; }
.pause-banner-enter-from, .pause-banner-leave-to { opacity: 0; }
</style>
