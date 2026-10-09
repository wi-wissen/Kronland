<template>
  <div class="campaign backdrop" data-testid="campaign-menu">
    <div class="cm-wrap">
      <header class="cm-head">
        <button class="cm-back" data-testid="campaign-back" @click="$emit('back')"><Icon name="back" />{{ $t('mission.back') }}</button>
        <div class="cm-titles">
          <h1>{{ $t('mission.campaign') }}</h1>
          <p>{{ $t('mission.campaignSub') }}</p>
        </div>
      </header>

      <div class="cm-body">
        <ol class="cm-list frame">
          <li v-for="(m, i) in missions" :key="m.id">
            <button
              v-tip="m.unlocked ? null : $t('mission.locked')"
              class="cm-item"
              :class="{ active: m.id === selectedId, locked: !m.unlocked, won: m.won }"
              :disabled="!m.unlocked"
              :aria-current="m.id === selectedId ? 'true' : null"
              :data-testid="'mission-' + m.id"
              @click="selectedId = m.id"
            >
              <span class="seal" aria-hidden="true">
                <Icon v-if="m.won" name="check" />
                <Icon v-else-if="!m.unlocked" name="lock" />
                <template v-else>{{ roman(i + 1) }}</template>
              </span>
              <span class="cm-text">
                <b>{{ $tr(m.title) }}</b>
                <small v-if="!m.unlocked">{{ $t('mission.locked') }}</small>
                <small v-else-if="m.best">{{ $t('mission.best', { t: m.best }) }}</small>
                <small v-else>{{ $tr(m.summary) }}</small>
              </span>
            </button>
          </li>
        </ol>

        <article v-if="selected" class="cm-brief parchment" data-testid="briefing">
          <span class="cm-chapter">{{ $t('mission.chapter', { n: selected.index + 1 }) }}</span>
          <h2>{{ $tr(selected.title) }}</h2>
          <p class="cm-story">{{ $tr(selected.briefing) }}</p>
          <h3 class="cm-goalhead">{{ $t('mission.goals') }}</h3>
          <ul class="cm-goals">
            <li v-for="o in selected.goals" :key="o.id" :class="{ opt: !o.primary }">
              <Icon :name="o.primary ? 'objective' : 'scroll'" />
              <span>{{ $tr(o.text) }}<em v-if="!o.primary"> · {{ $t('mission.optional') }}</em></span>
            </li>
          </ul>
          <div class="cm-foot">
            <span v-if="selected.won" class="cm-done"><Icon name="objectiveDone" />{{ $t('mission.done') }}<template v-if="selected.best"> · {{ $t('mission.best', { t: selected.best }) }}</template></span>
            <button class="cm-start" data-testid="mission-start" @click="$emit('start', selected.id)">{{ $t('mission.start') }}<Icon name="next" /></button>
          </div>
        </article>
      </div>

      <p class="cm-tut">
        <button class="ghost" data-testid="campaign-tutorial" @click="$emit('tutorial')">
          <Icon name="scroll" />{{ progress.tutorial ? $t('mission.tutorialDone') + ' – ' + $t('mission.playTutorial') : $t('mission.playTutorial') }}
        </button>
      </p>
    </div>
  </div>
</template>

<script>
import { CAMPAIGN } from '../../sim/missions/registry.js';
import { loadProgress, isUnlocked, formatTime } from './progress.js';

export default {
  name: 'CampaignMenu',
  props: { lang: { type: String, default: 'de' } },
  emits: ['back', 'start', 'tutorial'],
  data() {
    const progress = loadProgress();
    // Preselection: first mission that is not yet won and is unlocked
    const open = CAMPAIGN.find((m) => isUnlocked(progress, m.id) && !progress.done[m.id]) ?? CAMPAIGN[0];
    return { progress, selectedId: open.id };
  },
  computed: {
    missions() {
      return CAMPAIGN.map((m, index) => {
        const d = this.progress.done[m.id];
        return {
          id: m.id, index, title: m.title, summary: m.summary, briefing: m.briefing,
          unlocked: isUnlocked(this.progress, m.id), won: !!d, best: d ? formatTime(d.best) : null,
          // Mission files declare their objectives, level folders in Python (read from the code, scenarioGoals)
          goals: (m.objectives?.length ? m.objectives : m.goals ?? []).filter((o) => !o.hidden),
        };
      });
    },
    selected() { return this.missions.find((m) => m.id === this.selectedId) ?? null; },
  },
  methods: {
    roman(n) { return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][n - 1] ?? String(n); },
  },
};
</script>

<style>
.cm-wrap { max-width: 64rem; margin: 0 auto; display: flex; flex-direction: column; gap: 1rem; }
.cm-head { display: flex; gap: 1rem; align-items: center; }
.cm-back { display: inline-flex; align-items: center; gap: 0.375rem; min-height: var(--touch); }
.cm-titles h1 { font-family: var(--display); color: var(--gold-200); font-size: clamp(2rem, 5vw, 2.75rem); margin: 0; letter-spacing: 0.04em; line-height: 1; text-shadow: 0 2px 0 var(--gold-800), 0 4px 12px rgba(0, 0, 0, 0.6); }
.cm-titles p { color: #fff3da; margin: 0.25rem 0 0; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8); }
.cm-body { display: grid; grid-template-columns: minmax(16rem, 21rem) 1fr; gap: 1rem; align-items: start; }
.cm-list { list-style: none; margin: 0; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem; position: relative; }
/* Path stroke between the chapters */
.cm-list::before { content: ''; position: absolute; left: 2.0625rem; top: 2rem; bottom: 2rem; border-left: 2px dashed rgba(225, 168, 58, 0.4); }
.cm-item { width: 100%; display: flex; gap: 0.75rem; align-items: center; text-align: left; background: transparent; border-color: transparent; box-shadow: none; padding: 0.5rem 0.625rem 0.5rem 0.5rem; position: relative; min-height: 3.5rem; }
.cm-item:hover:not(:disabled) { background: rgba(255, 225, 170, 0.06); filter: none; }
.cm-item.active { background: linear-gradient(90deg, rgba(243, 200, 94, 0.22), rgba(243, 200, 94, 0.04)); box-shadow: inset 0 0 0 1px rgba(243, 200, 94, 0.55); }
.cm-item:disabled { filter: none; }
.cm-item.locked .cm-text { opacity: 0.55; }
.seal {
  flex: none; width: 2.5rem; height: 2.5rem; border-radius: 50%; display: grid; place-items: center; position: relative; z-index: 1;
  font-family: var(--display); font-size: 1.125rem; font-weight: 700; color: #3a1f06;
  background: radial-gradient(circle at 35% 30%, var(--gold-200), var(--gold-500) 70%);
  box-shadow: inset 0 0 0 2px rgba(255, 240, 200, 0.4), 0 0 0 2px var(--wood-950), 0 2px 4px rgba(0, 0, 0, 0.5);
}
.seal .ico { width: 1.25rem; height: 1.25rem; }
.cm-item.locked .seal { background: radial-gradient(circle at 35% 30%, #6d6459, #463f36 70%); color: var(--ink-muted); }
.cm-item.won .seal { background: radial-gradient(circle at 35% 30%, #b5ec92, #4f8a45 70%); color: #fff; }
.cm-text { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; }
.cm-text b { font-weight: 700; font-size: var(--fs-md); }
.cm-text small { color: var(--ink-muted); font-size: var(--fs-sm); line-height: 1.3; }

/* The briefing as a parchment page */
.cm-brief { padding: 1.375rem 1.625rem 1.375rem; display: flex; flex-direction: column; gap: 0.625rem; position: relative; }
.cm-brief::before { content: ''; position: absolute; top: 0.75rem; right: 0.875rem; width: 3.5rem; height: 3.5rem; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #c2493a, #7a2216 70%); box-shadow: 0 2px 4px rgba(0, 0, 0, 0.35), inset 0 0 0 3px rgba(255, 200, 180, 0.2); opacity: 0.9; }
.cm-chapter { font-family: var(--display); color: #8a5a1a; font-size: var(--fs-md); }
.cm-brief h2 { font-family: var(--display); font-size: 1.875rem; margin: -0.25rem 4rem 0 0; line-height: 1.1; color: #2c1d0e; text-wrap: balance; }
.cm-story { margin: 0; font-size: var(--fs-lg); line-height: 1.55; max-width: 62ch; }
.cm-goalhead { margin: 0.375rem 0 0; font-family: var(--display); font-size: var(--fs-md); color: #8a5a1a; }
.cm-goals { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.3125rem; }
.cm-goals li { display: flex; gap: 0.5rem; align-items: flex-start; }
.cm-goals li .ico { width: 1.125rem; height: 1.125rem; margin-top: 0.125rem; }
.cm-goals li.opt { color: var(--parch-ink-muted); }
.cm-goals em { font-size: var(--fs-sm); }
.cm-foot { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.5rem; }
.cm-done { display: inline-flex; align-items: center; gap: 0.375rem; color: #3f6b2a; font-weight: 700; }
.cm-done .ico { width: 1.25rem; height: 1.25rem; }
.cm-start { margin-left: auto; display: inline-flex; align-items: center; gap: 0.5rem; min-height: 3rem; padding: 0.5rem 1.375rem; font-size: var(--fs-lg); font-weight: 700; background: linear-gradient(180deg, #9c3b28, #6e2416); border-color: #3d120a; color: #fbeedd; box-shadow: inset 0 1px 0 rgba(255, 200, 180, 0.3), 0 2px 4px rgba(0, 0, 0, 0.35); }
.cm-start .ico { width: 1.125rem; height: 1.125rem; }
.cm-tut { margin: 0; text-align: center; }
.cm-tut button { display: inline-flex; align-items: center; gap: 0.5rem; color: #fff3da; text-shadow: 0 1px 2px #000; }
@media (max-width: 760px) {
  .cm-body { grid-template-columns: 1fr; }
  .cm-brief { padding: 1rem 1rem 1.125rem; }
  .cm-brief h2 { font-size: 1.5rem; }
  .cm-story { font-size: var(--fs-md); }
  .cm-start { margin-left: 0; flex: 1; justify-content: center; }
}
@media (max-height: 480px) and (orientation: landscape) {
  .cm-body { grid-template-columns: minmax(13rem, 17rem) 1fr; }
  .cm-titles p { display: none; }
  .cm-story { font-size: var(--fs-md); }
}
</style>
