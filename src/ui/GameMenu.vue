<template>
  <div class="scrim" @click.self="$emit('close')">
    <div class="dialog frame gmenu" :class="{ wide: view === 'save' || view === 'load' }" role="dialog" aria-modal="true" :aria-label="title" data-testid="game-menu">
      <header class="dialog-head">
        <button v-if="view !== 'main'" class="icon-btn ghost" :aria-label="$t('common.back')" data-testid="gmenu-back" @click="view = 'main'"><Icon name="back" /></button>
        <h2 class="h-title">{{ title }}</h2>
        <button class="icon-btn ghost" :aria-label="$t('common.close')" @click="$emit('close')"><Icon name="close" /></button>
      </header>

      <div v-if="view === 'main'" class="dialog-body scroll-y gm-main">
        <p class="gm-paused"><Icon name="pause" />{{ $t('gmenu.paused') }}</p>
        <button class="primary gm-btn" data-testid="resume" @click="$emit('close')"><Icon name="play" />{{ $t('gmenu.resume') }}</button>
        <button class="gm-btn" data-testid="save" @click="view = 'save'"><Icon name="save" />{{ $t('gmenu.save') }}</button>
        <button class="gm-btn" data-testid="load" @click="view = 'load'"><Icon name="load" />{{ $t('gmenu.load') }}</button>
        <button class="gm-btn" data-testid="open-settings" @click="view = 'settings'"><Icon name="settings" />{{ $t('gmenu.settings') }}</button>
        <button class="gm-btn" data-testid="open-controls" @click="view = 'controls'"><Icon name="keyboard" />{{ $t('gmenu.controls') }}</button>
        <div v-if="share" class="gm-map" data-testid="gmenu-map">
          <p class="gm-map-line"><Icon name="map" /><span>{{ $t('gmenu.map') }}:</span> <b class="num" data-testid="gmenu-map-name">{{ share.name }}</b></p>
          <button class="gm-btn gm-link" data-testid="copy-link" @click="shareLink"><Icon :name="copied ? 'check' : 'link'" />{{ copied ? $t('gmenu.linkCopied') : $t(canShare ? 'gmenu.shareLink' : 'gmenu.copyLink') }}</button>
          <input v-if="showField" ref="field" class="gm-link-field" readonly :value="share.url" :aria-label="$t('gmenu.linkLabel')" data-testid="link-field" @focus="$event.target.select()">
          <p class="gm-map-hint" role="status">{{ showField ? $t('gmenu.linkSelect') : $t('gmenu.linkHint') }}</p>
        </div>
        <div class="gm-sep"></div>
        <button class="gm-btn" :class="{ danger: confirmQuit }" data-testid="quit" @click="quit"><Icon name="quit" />{{ confirmQuit ? $t('gmenu.quitConfirm') : $t('gmenu.quit') }}</button>
      </div>

      <div v-else-if="view === 'save' || view === 'load'" class="dialog-body scroll-y">
        <SaveBrowser ref="saves" :key="view" :mode="view" :engine="engine" :touch="touch" in-game @load="$emit('load', $event)" @saved="$emit('saved', $event)" />
      </div>

      <div v-else-if="view === 'settings'" class="dialog-body scroll-y">
        <SettingsPanel in-game @close="view = 'main'" />
      </div>

      <div v-else class="dialog-body scroll-y gm-help">
        <table class="gm-keys">
          <tr v-for="row in controls" :key="row[0]">
            <th scope="row">{{ $t('help.' + row[0]) }}</th>
            <td>{{ row[1] }}</td>
          </tr>
        </table>
        <p class="gm-tip"><Icon name="worker" />{{ $t('help.workers') }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import SettingsPanel from './SettingsPanel.vue';
import SaveBrowser from './saves/SaveBrowser.vue';

export default {
  name: 'GameMenu',
  components: { SettingsPanel, SaveBrowser },
  props: {
    touch: Boolean,
    engine: { type: Object, default: null },
    /** Start link of the running map ({ url, name }) or null (save game, scenario file) */
    share: { type: Object, default: null },
  },
  emits: ['close', 'saved', 'load', 'quit'],
  data() { return { view: 'main', confirmQuit: false, copied: false, showField: false }; },
  computed: {
    /** On phones the system's share menu (navigator.share), otherwise the clipboard */
    canShare() { return !!(this.touch && typeof navigator !== 'undefined' && navigator.share); },
    title() {
      const v = this.view;
      if (v === 'save' || v === 'load') return this.$t('saves.title.' + v);
      return v === 'settings' ? this.$t('set.title') : v === 'controls' ? this.$t('gmenu.controls') : this.$t('gmenu.title');
    },
    controls() {
      if (this.touch) return ['select', 'command', 'pan', 'rotate', 'tilt', 'zoom', 'build', 'info'].map((k) => [k, this.$t('help.touch.' + k)]);
      return [
        ...['select', 'command', 'pan', 'rotate', 'tilt', 'zoom', 'build', 'info'].map((k) => [k, this.$t('help.desk.' + k)]),
        ['abilities', 'X · C'], ['groups', this.$t('key.shift') + '+1–9 · 1–9'], ['idle', '.'], ['hq', 'H'], ['pause', this.$t('key.space')], ['menu', 'Esc'],
      ];
    },
  },
  mounted() {
    this.onKey = (e) => {
      if (e.key !== 'Escape') return;
      // An open confirmation dialog handles Esc itself
      if (document.querySelector('[data-testid="confirm-dialog"]')) return;
      e.stopImmediatePropagation();
      if (this.$refs.saves?.escape()) return;
      if (this.view !== 'main') this.view = 'main'; else this.$emit('close');
    };
    window.addEventListener('keydown', this.onKey, true);
    this.$nextTick(() => this.$el.querySelector('[data-testid="resume"]')?.focus({ preventScroll: true }));
  },
  beforeUnmount() { window.removeEventListener('keydown', this.onKey, true); clearTimeout(this.copyTimer); },
  methods: {
    /** Share (phone) or copy the start link; without Clipboard API: show a text field for selecting. */
    async shareLink() {
      const { url, name } = this.share;
      if (this.canShare) {
        try { await navigator.share({ title: this.$t('gmenu.shareTitle', { name }), text: this.$t('gmenu.linkHint'), url }); return; } catch (e) {
          if (e?.name === 'AbortError') return;
        }
      }
      try {
        if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
        await navigator.clipboard.writeText(url);
        this.copied = true;
        clearTimeout(this.copyTimer);
        this.copyTimer = setTimeout(() => { this.copied = false; }, 2500);
      } catch {
        this.showField = true;
        await this.$nextTick();
        this.$refs.field?.focus();
        this.$refs.field?.select();
      }
    },
    quit() { if (this.confirmQuit) this.$emit('quit'); else this.confirmQuit = true; },
  },
};
</script>

<style>
.gmenu { width: min(27rem, 100%); }
.gmenu.wide { width: min(40rem, 100%); }
.gm-main { gap: 0.4375rem; }
.gm-paused { margin: 0 0 0.25rem; display: flex; align-items: center; gap: 0.4375rem; color: var(--ink-muted); font-size: var(--fs-sm); }
.gm-paused .ico { width: 0.875rem; height: 0.875rem; }
.gm-btn { display: flex; align-items: center; gap: 0.625rem; min-height: var(--touch); font-size: var(--fs-lg); text-align: left; }
.gm-btn .ico { width: 1.25rem; height: 1.25rem; }
.gm-sep { height: 1px; margin: 0.25rem 0; background: linear-gradient(90deg, transparent, rgba(225, 168, 58, 0.4), transparent); }
.gm-map { display: flex; flex-direction: column; gap: 0.375rem; margin-top: 0.25rem; padding: 0.5rem 0.625rem; border: 1px solid rgba(225, 168, 58, 0.25); border-radius: 0.375rem; background: rgba(0, 0, 0, 0.15); }
.gm-map-line { margin: 0; display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap; }
.gm-map-line .ico { width: 1rem; height: 1rem; }
.gm-map-line b { color: var(--gold-200); overflow-wrap: anywhere; }
.gm-link { font-size: var(--fs-md, 1rem); }
.gm-link-field { width: 100%; min-height: var(--touch); font-size: var(--fs-sm); }
.gm-map-hint { margin: 0; color: var(--ink-muted); font-size: var(--fs-sm); line-height: 1.4; }
.gm-help { font-size: var(--fs-sm); }
.gm-keys { border-collapse: collapse; width: 100%; }
.gm-keys th { text-align: left; font-weight: 700; color: var(--ink-muted); padding: 0.375rem 0.75rem 0.375rem 0; vertical-align: top; white-space: nowrap; }
.gm-keys td { padding: 0.375rem 0; color: var(--ink); }
.gm-keys tr + tr { border-top: 1px solid rgba(255, 225, 170, 0.08); }
.gm-tip { margin: 0; display: flex; gap: 0.5rem; color: var(--ink-muted); line-height: 1.45; }
.gm-tip .ico { width: 1.5rem; height: 1.5rem; flex: none; }
</style>
