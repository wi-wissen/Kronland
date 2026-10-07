<template>
  <transition name="pause-banner">
    <div v-if="show" class="pause-banner" role="status" data-testid="pause-banner">
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
  },
};
</script>

<style>
/* Centred in the upper third: clear of top bar, notices and command bar, also on phones */
.pause-banner {
  position: fixed; z-index: 5; left: 50%; top: max(calc(var(--top-total, 4rem) + 1.5rem), 26vh); transform: translateX(-50%);
  display: grid; grid-template-columns: auto auto; align-items: center; column-gap: 0.75rem; row-gap: 0.125rem;
  max-width: calc(100vw - 2rem); padding: 0.75rem 1.5rem 0.75rem 1.25rem; border: 0; border-radius: 0.75rem;
  background: linear-gradient(180deg, rgba(58, 40, 26, 0.92), rgba(36, 24, 16, 0.92));
  box-shadow: inset 0 0 0 1px rgba(225, 168, 58, 0.45), 0 8px 24px rgba(0, 0, 0, 0.45);
  color: var(--ink); text-align: left; pointer-events: none;
}
.pause-banner .pb-icon { grid-row: span 2; width: 1.75rem; height: 1.75rem; color: var(--brass, #e1a83a); }
.pause-banner .pb-title { font-family: var(--display); font-size: clamp(1.25rem, 4.5vw, 1.75rem); line-height: 1.1; letter-spacing: 0.04em; }
.pause-banner .pb-hint { font-size: var(--fs-sm); color: var(--ink-muted); white-space: nowrap; }
.pause-banner-enter-active, .pause-banner-leave-active { transition: opacity 0.15s ease; }
.pause-banner-enter-from, .pause-banner-leave-to { opacity: 0; }
</style>
