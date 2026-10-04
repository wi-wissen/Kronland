<template>
  <div class="scrim mresult" data-testid="mission-result">
    <div class="mr-card parchment" :class="result.won ? 'won' : 'lost'" role="dialog" aria-modal="true" :aria-label="heading">
      <div class="mr-banner">
        <Icon :name="result.won ? 'crown' : 'skull'" class="mr-crest" />
        <h2 data-testid="mission-result-title">{{ heading }}</h2>
        <span class="mr-mission">{{ $tr(result.title) }}</span>
      </div>
      <p class="mr-text">{{ $tr(result.text) }}</p>
      <p v-if="result.debrief" class="mr-debrief" data-testid="debrief">{{ $tr(result.debrief) }}</p>
      <ul v-if="objectives.length" class="mr-goals">
        <li v-for="o in objectives" :key="o.id" :class="'st-' + o.status">
          <Icon :name="o.status === 'done' ? 'objectiveDone' : o.status === 'failed' ? 'objectiveFailed' : 'objective'" />
          <span>{{ $tr(o.text) }}<em v-if="!o.primary"> · {{ $t('mission.optional') }}</em></span>
        </li>
      </ul>
      <p class="mr-stats num">
        <span><Icon name="time" />{{ $t('mission.time', { t: time }) }}</span>
        <span v-if="optional.total"><Icon name="scroll" />{{ $t('mission.optionalDone', { a: optional.done, b: optional.total }) }}</span>
        <span v-if="record" class="mr-record"><Icon name="crown" />{{ $t('mission.newRecord') }}</span>
      </p>
      <p v-if="result.won && isCampaign && !result.next" class="mr-end">{{ $t('mission.campaignEnd') }}</p>
      <div class="mr-actions">
        <button v-if="result.won && result.next" class="mr-primary" data-testid="next-mission" @click="$emit('next', result.next)">{{ $t('mission.nextMission') }}<Icon name="next" /></button>
        <button v-if="!result.won" class="mr-primary" data-testid="retry-mission" @click="$emit('retry')">{{ $t('mission.retry') }}</button>
        <button v-if="isCampaign || result.won" data-testid="to-campaign" @click="$emit('campaign')">{{ $t('mission.toCampaign') }}</button>
        <button data-testid="to-menu" @click="$emit('menu')">{{ $t('mission.toMenu') }}</button>
      </div>
    </div>
  </div>
</template>

<script>
import { formatTime } from './progress.js';

export default {
  name: 'MissionResult',
  props: {
    result: { type: Object, required: true },
    missionId: { type: String, required: true },
    objectives: { type: Array, default: () => [] },
    record: Boolean,
    lang: { type: String, default: 'de' },
  },
  emits: ['next', 'retry', 'campaign', 'menu'],
  computed: {
    isCampaign() { return this.missionId !== 'tutorial'; },
    heading() {
      if (!this.isCampaign) return this.$t('mission.tutorialEnd');
      return this.$t(this.result.won ? 'mission.victory' : 'mission.defeat');
    },
    time() { return formatTime(this.result.tick); },
    optional() {
      const opt = this.objectives.filter((o) => !o.primary);
      return { total: opt.length, done: opt.filter((o) => o.status === 'done').length };
    },
  },
};
</script>

<style>
.mresult { z-index: 28; }
.mr-card { width: min(34rem, 100%); overflow: hidden; display: flex; flex-direction: column; gap: 0.625rem; padding-bottom: 1.125rem; }
.mr-banner { padding: 1.125rem 1.375rem 0.875rem; display: flex; flex-direction: column; align-items: center; gap: 0.125rem; color: #f6ead0; text-align: center; }
.won .mr-banner { background: linear-gradient(180deg, #8a3523, #5e2416); box-shadow: inset 0 -3px 0 var(--gold-500); }
.lost .mr-banner { background: linear-gradient(180deg, #474e53, #2b3033); box-shadow: inset 0 -3px 0 #6b7378; }
.mr-crest { width: 2.75rem !important; height: 2.75rem !important; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5)); }
.mr-banner h2 { margin: 0; font-family: var(--display); font-size: 2.125rem; letter-spacing: 0.04em; }
.mr-mission { font-size: var(--fs-md); opacity: 0.85; }
.mr-text, .mr-debrief, .mr-stats, .mr-end, .mr-goals { margin: 0 1.375rem; }
.mr-text { font-size: var(--fs-lg); font-weight: 700; }
.mr-debrief { font-size: var(--fs-md); line-height: 1.5; max-width: 60ch; }
.mr-goals { padding: 0.5rem 0 0; list-style: none; display: flex; flex-direction: column; gap: 0.25rem; border-top: 1px solid rgba(90, 60, 20, 0.25); }
.mr-goals li { display: flex; gap: 0.4375rem; align-items: flex-start; font-size: var(--fs-sm); }
.mr-goals .ico { width: 1.125rem; height: 1.125rem; flex: none; }
.mr-goals .st-active { color: var(--parch-ink-muted); }
.mr-stats { display: flex; gap: 1rem; flex-wrap: wrap; color: var(--parch-ink-muted); font-size: var(--fs-sm); }
.mr-stats span { display: inline-flex; align-items: center; gap: 0.3125rem; }
.mr-stats .ico { width: 1rem; height: 1rem; }
.mr-record { color: #7a2f1f; font-weight: 700; }
.mr-end { font-family: var(--display); font-size: var(--fs-xl); color: #7a2f1f; }
.mr-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 0.375rem 1.375rem 0; }
.mr-actions button { color: var(--parch-ink); border-color: rgba(58, 42, 23, 0.35); background: rgba(255, 255, 255, 0.3); box-shadow: none; min-height: var(--touch); display: inline-flex; align-items: center; gap: 0.375rem; }
.mr-actions button .ico { width: 1rem; height: 1rem; }
.mr-actions .mr-primary { background: linear-gradient(180deg, #9c3b28, #6e2416); border-color: #3d120a; color: #fbeedd; font-weight: 700; }
@media (max-width: 640px) {
  .mr-actions button { flex: 1 1 100%; justify-content: center; }
  .mr-banner h2 { font-size: 1.75rem; }
}
</style>
