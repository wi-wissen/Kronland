<template>
  <transition name="dlg">
    <div v-if="current" :key="current.seq" class="dialogbox frame" role="status" aria-live="polite" data-testid="dialog">
      <span class="dlg-seal" :style="{ '--sp': speaker.color }" aria-hidden="true">{{ speaker.initial }}</span>
      <div class="dlg-body">
        <b class="dlg-name" data-testid="dialog-speaker">{{ $tr(speaker.name) }}</b>
        <p data-testid="dialog-text">{{ $tr(current.text) }}</p>
        <button v-if="waiting > 0" class="dlg-skip" data-testid="dialog-skip-all" @click="skipAll">{{ $t('mission.skipAll', { n: waiting }) }}</button>
      </div>
      <button class="icon-btn ghost dlg-close" :aria-label="$t('mission.dismiss')" data-testid="dialog-close" @click="dismiss"><Icon name="close" /></button>
    </div>
  </transition>
</template>

<script>
import { tr } from '../../i18n/index.js';
import { SPEAKERS } from '../../sim/missions/speakers.js';
import { speak, stopSpeech } from '../../audio/speech.js';
import { loadVoiceIndex } from '../../audio/voiceLines.js';

const SHOW_MS = 14000;
/** With recording: visible at least this long; pause after the recording ends; longest recording */
const VOICED_MIN_MS = 2500, GAP_MS = 450, MAX_VOICE_MS = 20000;

export default {
  name: 'DialogBox',
  props: {
    messages: { type: Array, required: true },
    lang: { type: String, default: 'de' },
    /** Game speed: script dialogues last dur ticks of game time */
    speed: { type: Number, default: 1 },
    /** Clicking away also ends the script's waiting (say blocks) */
    scripted: Boolean,
  },
  emits: ['skip', 'line'],
  data() { return { seen: 0 }; },
  computed: {
    /** Oldest message not yet read (order is preserved). */
    current() {
      // Unread ones in sequence; anything more than 10 s of game time older than the newest is obsolete
      const open = this.messages.filter((x) => x.seq > this.seen);
      if (!open.length) return null;
      const newest = open[open.length - 1].tick;
      return open.find((x) => x.tick >= newest - 100) ?? null;
    },
    /** Further waiting sentences after the current one (for "Skip all"). */
    waiting() { return this.current ? this.messages.filter((x) => x.seq > this.current.seq).length : 0; },
    speaker() {
      const id = this.current?.speaker;
      if (!id) return { name: { de: 'Erzähler', en: 'Narrator' }, color: '#8a7a5c', initial: '❧' };
      return SPEAKERS[id] ?? { name: id, color: '#e0a93b', initial: id[0]?.toUpperCase() ?? '?' };
    },
  },
  watch: {
    'current.seq': {
      immediate: true,
      handler(seq) {
        clearTimeout(this.timer);
        clearTimeout(this.gapTimer);
        this.$emit('line', this.current ?? null);
        if (!seq) return;
        // Only once the index of the recordings is there (otherwise the first sentence of the mission would stay mute)
        loadVoiceIndex().then(() => { if (this.current?.seq === seq) this.present(seq); });
      },
    },
  },
  beforeUnmount() { clearTimeout(this.timer); clearTimeout(this.gapTimer); clearTimeout(this.capTimer); stopSpeech(); },
  methods: {
    /** Show and read aloud the message; display time by reading time or duration in the script. */
    present(seq) {
      // It only continues when the time is up AND the recording has finished speaking (otherwise the
      // next speaker interrupts). Script dialogues: as long as the simulation waits; otherwise reading time by
      // text length – shorter with a recording, since you listen along.
      const len = tr(this.current.text, this.lang).length;
      const reading = Math.min(SHOW_MS, 6000 + len * 45);
      this.timeUp = false;
      this.voiceDone = true;
      const voiced = speak(this.current, this.lang, { onEnd: () => this.voiceEnded(seq) });
      this.voiceDone = !voiced;
      const ms = this.current.dur ? (this.current.dur * 100) / Math.max(0.25, this.speed) + 600 : voiced ? Math.min(reading, VOICED_MIN_MS) : reading;
      this.timer = setTimeout(() => { this.timeUp = true; this.advance(seq); }, ms);
      // Safety net in case the end of the recording is never reported
      if (voiced) this.capTimer = setTimeout(() => this.voiceEnded(seq), Math.max(ms, MAX_VOICE_MS));
    },
    /** Recording of message seq has ended: short breather, then continue (if the time is also up). */
    voiceEnded(seq) {
      if (this.current?.seq !== seq || this.voiceDone) return;
      clearTimeout(this.capTimer);
      this.gapTimer = setTimeout(() => { this.voiceDone = true; this.advance(seq); }, GAP_MS);
    },
    advance(seq) {
      if (this.current?.seq === seq && this.timeUp && this.voiceDone) this.dismiss(true);
    },
    /** Skip the whole conversation: all waiting sentences count as read. */
    skipAll() {
      const cur = this.current;
      if (!cur) return;
      this.seen = this.messages[this.messages.length - 1].seq;
      stopSpeech();
      if (this.scripted && cur.dur) this.$emit('skip', cur.seq);
    },
    /** @param {boolean} [auto] expired by itself (not clicked away) */
    dismiss(auto = false) {
      if (!this.current) return;
      const cur = this.current;
      this.seen = cur.seq;
      if (auto) return;
      stopSpeech();
      // If the script is still waiting for this dialog, it continues immediately
      if (this.scripted && cur.dur) this.$emit('skip', cur.seq);
    },
  },
};
</script>

<style>
.dialogbox { display: flex; gap: 0.75rem; align-items: flex-start; padding: 0.75rem 0.5rem 0.75rem 0.75rem; flex: none; }
.dlg-seal {
  flex: none; width: 3rem; height: 3rem; border-radius: 50%; display: grid; place-items: center;
  font-family: var(--display); font-size: 1.375rem; font-weight: 700; color: #fff8e6; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--sp) 60%, #fff), var(--sp) 70%);
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.3), 0 0 0 2px var(--gold-500), 0 0 0 4px var(--wood-950), 0 3px 6px rgba(0, 0, 0, 0.5);
}
.dlg-body { flex: 1; min-width: 0; }
.dlg-name { font-family: var(--display); font-size: var(--fs-md); display: block; margin-bottom: 0.125rem; color: var(--gold-200); }
.dlg-body p { margin: 0; font-size: var(--fs-md); line-height: 1.45; }
.dlg-skip {
  margin-top: 0.375rem; padding: 0.25rem 0.625rem; min-height: 2rem; font-size: var(--fs-sm);
  background: rgba(255, 225, 170, 0.08); border: 1px solid rgba(255, 225, 170, 0.25); border-radius: 1rem; color: var(--gold-200);
}
.dlg-close { flex: none; width: 2.25rem !important; min-width: 2.25rem !important; min-height: 2.25rem; }
.dlg-enter-active { transition: opacity 0.25s, transform 0.25s; }
.dlg-enter-from { opacity: 0; transform: translateX(-12px); }
@media (max-width: 640px), (max-height: 480px) and (orientation: landscape) {
  .dlg-seal { width: 2.25rem; height: 2.25rem; font-size: 1.0625rem; }
  .dlg-body p { font-size: var(--fs-sm); }
  .dialogbox { padding: 0.5rem 0.375rem 0.5rem 0.5rem; gap: 0.5rem; }
}
</style>
