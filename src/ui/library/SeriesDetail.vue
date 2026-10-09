<template>
  <!-- Detail of a series: header with the one big button, then one row per level with exactly one button each. -->
  <article class="sd" data-testid="series-detail">
    <header class="sd-head frame">
      <div class="sd-facts">
        <span class="sd-kind">{{ $t('lib.kind.' + series.kind) }}</span>
        <span v-if="series.difficulty" class="lib-fact"><span class="lib-dots" :data-level="rank(series.difficulty)" aria-hidden="true"><i></i><i></i><i></i></span>{{ $t('lib.diff.' + series.difficulty) }}</span>
        <span v-if="series.minutes" class="lib-fact"><Icon name="time" />{{ minutesText(series.minutes) }}</span>
        <span v-if="series.own" class="lib-fact">{{ $t('lib.own') }}</span>
      </div>
      <h2 class="sd-title" data-testid="series-title">{{ $tr(series.title) }}</h2>
      <p v-if="series.summary && $tr(series.summary)" class="sd-sum">{{ $tr(series.summary) }}</p>
      <p v-if="by" class="sd-by">{{ $t('lib.detail.by', { name: by }) }}</p>

      <template v-if="series.access === 'locked'">
        <p class="sd-note" data-testid="series-locked"><Icon name="lock" />{{ $t('lib.lockedText') }}</p>
        <button class="primary sd-big" data-testid="series-learn" @click="$emit('learn')">{{ $t('lib.learnMore') }}</button>
      </template>
      <template v-else>
        <div v-if="series.count" class="sd-progress">
          <div class="meter sd-meter" role="progressbar" :aria-valuenow="series.doneCount" aria-valuemin="0" :aria-valuemax="series.count" :aria-label="$t('lib.detail.progress')"><i :style="{ width: (100 * series.doneCount / series.count) + '%' }"></i></div>
          <span class="num sd-ptext">{{ series.doneCount }}/{{ series.count }}</span>
        </div>
        <button v-if="next" class="primary sd-big" :disabled="busy" data-testid="series-play" @click="$emit('play', next)">{{ bigLabel }}</button>
        <p v-if="nextWhen" class="sd-last">{{ nextWhen }}</p>
      </template>
      <p v-if="offline" class="sd-note" data-testid="discover-offline"><Icon name="info" />{{ $t('lib.detail.offline') }}</p>
      <p v-if="big" class="sd-note"><Icon name="warning" />{{ $t('lib.detail.big') }}</p>
      <p v-if="error" class="sd-err" role="alert" data-testid="series-error"><Icon name="warning" />{{ error }}</p>
      <button v-if="needsUpdate" class="sd-big" data-testid="discover-update" @click="$emit('reload')">{{ $t('lib.reload') }}</button>
    </header>

    <section v-if="series.access !== 'locked'" class="sd-levels frame" :aria-label="$t('lib.detail.levels')">
      <p v-if="loading" class="sd-loading" data-testid="series-loading">{{ $t('lib.detail.loading') }}</p>
      <ol v-else class="sd-list" data-testid="series-levels">
        <li v-for="(l, i) in series.levels" :key="l.id" class="sd-row" :class="l.state" :data-testid="'level-row-' + l.id">
          <span class="sd-no" aria-hidden="true">
            <Icon v-if="l.state === 'done'" name="check" /><Icon v-else-if="l.state === 'locked'" name="lock" /><template v-else>{{ l.label || i + 1 }}</template>
          </span>
          <span class="sd-text">
            <b>{{ $tr(l.title) }}</b>
            <small v-if="l.summary && $tr(l.summary)" class="sd-rsum">{{ $tr(l.summary) }}</small>
            <small class="sd-status">{{ statusText(l) }}</small>
          </span>
          <span class="sd-acts">
            <button v-if="action(l)" :class="{ primary: l.state !== 'done' }" class="sd-act" :disabled="busy" :data-testid="'level-play-' + l.id" @click="$emit('play', l)">{{ $t('lib.act.' + action(l)) }}</button>
            <button v-if="l.state === 'running'" class="ghost sd-restart" :disabled="busy" :data-testid="'level-restart-' + l.id" @click="$emit('restart', l)">{{ $t('lib.restart') }}</button>
            <button v-if="series.own" class="ghost sm" :data-testid="'edit-' + l.id" @click="$emit('edit', l.id)">{{ $t('lib.edit') }}</button>
          </span>
        </li>
      </ol>
      <footer v-if="series.own" class="sd-foot"><button class="ghost sm danger-text" data-testid="discover-delete" @click="$emit('delete')">{{ $t('lib.delete') }}</button></footer>
    </section>
  </article>
</template>

<script>
import { actionOf, nextLevel, DIFFICULTIES } from '../../library/model.js';
import { formatTime } from '../mission/progress.js';
import { whenText } from '../when.js';

export default {
  name: 'SeriesDetail',
  props: {
    series: { type: Object, required: true },
    /** Newest save game per mission id (Map) */
    saves: { type: Map, default: () => new Map() },
    busy: Boolean,
    error: { type: String, default: '' },
    loading: Boolean,
    needsUpdate: Boolean,
    offline: Boolean,
    big: Boolean,
    by: { type: String, default: '' },
  },
  emits: ['play', 'restart', 'learn', 'edit', 'delete', 'reload'],
  computed: {
    next() { return nextLevel(this.series.levels.filter((l) => l.state !== 'locked')); },
    bigLabel() {
      const l = this.next;
      if (l.state === 'done') return this.$t('lib.detail.again');
      const name = this.series.kind === 'stories' && l.label ? this.$t('lib.chapter', { n: l.label }) : this.$tr(l.title);
      return this.$t(l.state === 'running' ? 'lib.detail.continue' : 'lib.detail.play', { level: name });
    },
    nextWhen() {
      const e = this.next && this.saves.get(this.next.id);
      return e && this.next.state === 'running' ? this.$t('lib.detail.lastPlayed', { when: this.when(e.savedAt) }) : '';
    },
  },
  methods: {
    rank: (v) => DIFFICULTIES.indexOf(v) + 1,
    action: (l) => actionOf(l.state),
    when(iso) { return whenText(iso, (k, p) => this.$t(k, p), this.$i18n.lang); },
    minutesText(m) { return m >= 90 ? this.$t('lib.hours', { n: Math.round(m / 6) / 10 }) : this.$t('lib.minutes', { n: m }); },
    statusText(l) {
      if (l.state === 'locked') return this.$t(l.lockReason ?? 'lib.locked');
      if (l.state === 'running') { const e = this.saves.get(l.id); return e ? this.$t('lib.lastPlayed', { when: this.when(e.savedAt) }) : ''; }
      if (l.state === 'done') return l.best ? this.$t('lib.best', { t: formatTime(l.best) }) : this.$t('lib.state.done');
      return '';
    },
  },
};
</script>

<style>
.sd { display: flex; flex-direction: column; gap: 0.875rem; }
.sd-head { padding: 1rem 1.125rem 1.125rem; display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start; }
.sd-facts { display: flex; gap: 0.25rem 1rem; flex-wrap: wrap; align-items: center; color: var(--ink-muted); font-size: var(--fs-sm); }
.sd-kind { color: var(--gold-300); font-size: var(--fs-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
.sd-title { margin: 0; font-family: var(--display); color: var(--gold-200); font-size: clamp(1.75rem, 5vw, 2.5rem); line-height: 1.05; text-wrap: balance; }
.sd-sum { margin: 0; max-width: 60ch; font-size: var(--fs-lg); line-height: 1.5; }
.sd-by { margin: 0; color: var(--ink-muted); font-size: var(--fs-sm); }
.sd-progress { display: flex; align-items: center; gap: 0.625rem; width: min(24rem, 100%); }
.sd-meter { flex: 1; height: 0.625rem; }
.sd-ptext { color: var(--ink-muted); font-size: var(--fs-sm); }
.sd-big { min-height: 3.25rem; padding-inline: 1.75rem; font-size: var(--fs-lg); max-width: 100%; text-align: center; }
.sd-last { margin: 0; color: var(--ink-muted); font-size: var(--fs-sm); }
.sd-note { margin: 0; display: flex; gap: 0.5rem; align-items: flex-start; color: var(--ink-muted); font-size: var(--fs-sm); line-height: 1.4; }
.sd-note .ico { width: 1.125rem; height: 1.125rem; flex: none; }
.sd-err { margin: 0; display: flex; gap: 0.5rem; color: var(--bad); font-weight: 600; }
.sd-levels { padding: 0.5rem; }
.sd-loading { margin: 0.75rem; color: var(--ink-muted); }
.sd-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.sd-row { display: grid; grid-template-columns: 2.5rem minmax(0, 1fr) auto; gap: 0.75rem; align-items: center; padding: 0.5rem 0.5rem; border-radius: var(--r-md); }
.sd-row.running { background: linear-gradient(90deg, rgba(243, 200, 94, 0.18), rgba(243, 200, 94, 0.03)); box-shadow: inset 0 0 0 1px rgba(243, 200, 94, 0.45); }
.sd-row.locked .sd-text { opacity: 0.6; }
.sd-no { width: 2.5rem; height: 2.5rem; border-radius: 50%; display: grid; place-items: center; font-family: var(--display); font-weight: 700; font-size: var(--fs-md); color: #3a1f06; background: radial-gradient(circle at 35% 30%, var(--gold-200), var(--gold-500) 70%); box-shadow: inset 0 0 0 2px rgba(255, 240, 200, 0.4), 0 0 0 2px var(--wood-950); }
.sd-row.done .sd-no { background: radial-gradient(circle at 35% 30%, #b5ec92, #4f8a45 70%); color: #fff; }
.sd-row.locked .sd-no { background: radial-gradient(circle at 35% 30%, #6d6459, #463f36 70%); color: var(--ink-muted); }
.sd-no .ico { width: 1.25rem; height: 1.25rem; }
.sd-text { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; }
.sd-text b { font-size: var(--fs-lg); color: var(--ink); }
.sd-rsum { color: var(--ink-muted); font-size: var(--fs-sm); line-height: 1.35; }
.sd-status { color: var(--ink-dim); font-size: var(--fs-sm); }
.sd-row.running .sd-status, .sd-row.done .sd-status { color: var(--gold-300); }
.sd-acts { display: flex; flex-direction: column; align-items: stretch; gap: 0.125rem; min-width: 9.5rem; }
.sd-restart { font-size: var(--fs-sm); min-height: var(--ctl-sm); }
.sd-foot { display: flex; justify-content: flex-end; padding: 0.5rem; }
.danger-text { color: var(--bad); }
@media (max-width: 760px) {
  .sd-row { grid-template-columns: 2.25rem minmax(0, 1fr); }
  .sd-no { width: 2.25rem; height: 2.25rem; }
  .sd-acts { grid-column: 1 / -1; flex-direction: row; flex-wrap: wrap; min-width: 0; }
  .sd-acts .sd-act { flex: 1 1 10rem; }
  .sd-big { width: 100%; }
}
</style>
