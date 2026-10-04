<template>
  <Teleport to="body">
    <div class="scrim cf-scrim" @click.self="$emit('cancel')">
      <div ref="box" class="dialog parchment cf-box" role="alertdialog" aria-modal="true" :aria-labelledby="uid + '-t'" :aria-describedby="uid + '-d'" data-testid="confirm-dialog">
        <h3 :id="uid + '-t'" class="cf-title">{{ title }}</h3>
        <p :id="uid + '-d'" class="cf-text">{{ text }}</p>
        <div class="cf-actions">
          <button data-testid="confirm-cancel" @click="$emit('cancel')">{{ $t('common.cancel') }}</button>
          <button :class="danger ? 'danger' : 'primary'" data-testid="confirm-ok" @click="$emit('confirm')">{{ confirmLabel }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
let n = 0;

/** Own confirmation dialog (instead of window.confirm): Esc cancels, Enter confirms. */
export default {
  name: 'ConfirmDialog',
  props: {
    title: { type: String, required: true },
    text: { type: String, default: '' },
    confirmLabel: { type: String, required: true },
    danger: Boolean,
  },
  emits: ['confirm', 'cancel'],
  data() { return { uid: 'cf' + ++n }; },
  mounted() {
    this.onKey = (e) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); this.$emit('cancel'); }
    };
    // Strike before all other Esc handling (game menu)
    window.addEventListener('keydown', this.onKey, true);
    this.$nextTick(() => this.$refs.box?.querySelector('[data-testid="confirm-ok"]')?.focus({ preventScroll: true }));
  },
  beforeUnmount() { window.removeEventListener('keydown', this.onKey, true); },
};
</script>

<style>
.cf-scrim { z-index: 60; }
.cf-box { width: min(24rem, 100%); padding: 1.125rem 1.25rem 1rem; gap: 0.5rem; }
.cf-title { margin: 0; font-family: var(--display); font-size: var(--fs-xl); }
.cf-text { margin: 0; line-height: 1.45; overflow-wrap: anywhere; }
.cf-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap; }
.cf-actions button { min-height: var(--touch); padding-inline: 1.125rem; }
.cf-actions button:not(.primary):not(.danger) { color: var(--parch-ink); background: rgba(255, 255, 255, 0.3); border-color: rgba(58, 42, 23, 0.35); box-shadow: none; }
</style>
