<template>
  <!-- Coding adventures: learning adventures, script missions, world editor and own scenario files. -->
  <div class="campaign backdrop" data-testid="adventure-menu">
    <div class="cm-wrap">
      <header class="cm-head">
        <button class="cm-back" data-testid="adventure-back" @click="$emit('back')"><Icon name="back" />{{ $t('mission.back') }}</button>
        <div class="cm-titles">
          <h1>{{ $t('adv.title') }}</h1>
          <p>{{ $t('adv.sub') }}</p>
        </div>
      </header>

      <div class="cm-body">
        <div class="adv-left">
          <ol class="cm-list frame">
            <!-- Course missions row by row (I.2, I.4 … I.M, II.1 …), own adventures without a row first -->
            <template v-for="r in rows" :key="'row' + r.row">
              <li v-if="r.row" class="adv-sep" :data-testid="'adventure-row-' + r.row">{{ $t('adv.row', { n: r.roman, title: $t('adv.row' + r.row) }) }}</li>
              <li v-for="m in r.missions" :key="m.id">
                <button class="cm-item" :class="{ active: m.id === selectedId, won: m.won }" :data-testid="'adventure-' + m.id" @click="selectedId = m.id">
                  <span class="seal" aria-hidden="true"><Icon v-if="m.won" name="check" /><template v-else>{{ m.seal }}</template></span>
                  <span class="cm-text"><b>{{ $tr(m.title) }}</b><small>{{ $tr(m.summary) }}</small></span>
                </button>
              </li>
            </template>
            <li class="adv-sep">{{ $t('adv.missions') }}</li>
            <li v-for="m in missions" :key="m.id">
              <button class="cm-item" :class="{ active: m.id === selectedId, won: m.won }" :data-testid="'adventure-' + m.id" @click="selectedId = m.id">
                <span class="seal" aria-hidden="true"><Icon :name="m.won ? 'check' : 'banner'" /></span>
                <span class="cm-text"><b>{{ $tr(m.title) }}</b><small>{{ $tr(m.summary) }}</small></span>
              </button>
            </li>
          </ol>
          <div class="adv-own frame">
            <h3 class="h-title">{{ $t('adv.own') }}</h3>
            <button class="adv-own-btn" data-testid="open-editor" @click="$emit('editor')"><Icon name="map" /><span><b>{{ $t('adv.editor') }}</b><small>{{ $t('adv.editorSub') }}</small></span></button>
            <label class="adv-own-btn" data-testid="open-file">
              <Icon name="load" /><span><b>{{ $t('adv.load') }}</b><small>{{ $t('adv.loadSub') }}</small></span>
              <input type="file" accept=".zip,.json,application/zip,application/json" class="adv-file" data-testid="scenario-file" @change="loadFile">
            </label>
            <form class="adv-link" data-testid="level-link-form" @submit.prevent="openLink">
              <input v-model.trim="link" type="url" inputmode="url" :placeholder="$t('adv.linkPlaceholder')" :aria-label="$t('adv.link')" data-testid="level-link">
              <button class="ghost" type="submit" :disabled="!link" data-testid="level-link-open">{{ $t('adv.linkOpen') }}</button>
            </form>
            <a class="adv-own-btn" :href="referenceUrl" target="_blank" rel="noopener" data-testid="open-reference"><Icon name="scroll" /><span><b>{{ $t('adv.reference') }}</b><small>{{ $t('adv.referenceSub') }}</small></span></a>
            <p v-if="fileError || notice" class="adv-err" role="alert" data-testid="level-error">{{ fileError || notice }}</p>
          </div>
        </div>

        <article v-if="selected" class="cm-brief parchment" data-testid="adventure-brief">
          <span class="cm-chapter">{{ selected.kind === 'mission' ? $t('adv.scriptMission') : $t('adv.lesson', { n: selected.n }) }}</span>
          <h2>{{ $tr(selected.title) }}</h2>
          <p class="cm-story">{{ $tr(selected.briefing) }}</p>
          <template v-if="selected.goals.length">
            <h3 class="cm-goalhead">{{ $t('mission.goals') }}</h3>
            <ul class="cm-goals" data-testid="adventure-goals">
              <li v-for="o in selected.goals" :key="o.id" :class="{ opt: !o.primary }">
                <Icon :name="o.primary ? 'objective' : 'scroll'" />
                <span>{{ $tr(o.text) }}<em v-if="!o.primary"> · {{ $t('mission.optional') }}</em></span>
              </li>
            </ul>
          </template>
          <template v-if="selected.learn">
            <h3 class="cm-goalhead">{{ $t('adv.learn') }}</h3>
            <p class="adv-tags"><span v-for="l in $tr(selected.learn)" :key="l" class="adv-tag">{{ l }}</span></p>
          </template>
          <div class="cm-foot">
            <span v-if="selected.won" class="cm-done"><Icon name="objectiveDone" />{{ $t('mission.done') }}</span>
            <button class="cm-start" data-testid="adventure-start" @click="$emit('start', selected.id)">{{ $t('mission.start') }}<Icon name="next" /></button>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<script>
import { ADVENTURES, SCRIPT_MISSIONS, courseNumber } from '../../sim/missions/levels/index.js';
import { validateScenario } from '../../sim/scripting/scenario.js';
import { scenarioGoals } from '../../sim/scripting/outline.js';
import { loadProgress } from '../mission/progress.js';
import { refUrl } from './reference.js';

export default {
  name: 'AdventureMenu',
  props: {
    lang: { type: String, default: 'de' },
    /** Why a level by link could not be opened */
    notice: { type: String, default: '' },
  },
  emits: ['back', 'start', 'editor', 'open', 'link'],
  data() {
    const progress = loadProgress();
    const open = ADVENTURES.find((a) => !progress.done[a.id]) ?? ADVENTURES[0];
    return { progress, selectedId: open.id, fileError: '', link: '' };
  },
  computed: {
    referenceUrl() { return refUrl(); },
    adventures() {
      return ADVENTURES.map((a, i) => {
        const no = courseNumber(a.id);
        return { ...a, row: no?.row ?? 0, roman: no?.roman ?? '', n: no?.label ?? i + 1, seal: no?.n ?? i + 1, won: !!this.progress.done[a.id] };
      });
    },
    /** Adventures grouped by course row (row 0: adventures without a course number). */
    rows() {
      const out = [];
      for (const m of this.adventures) {
        let r = out.find((x) => x.row === m.row);
        if (!r) out.push(r = { row: m.row, roman: m.roman, missions: [] });
        r.missions.push(m);
      }
      return out.sort((a, b) => a.row - b.row);
    },
    missions() { return SCRIPT_MISSIONS.map((a) => ({ ...a, won: !!this.progress.done[a.id] })); },
    selected() {
      const s = [...this.adventures, ...this.missions].find((a) => a.id === this.selectedId);
      // Objectives straight from the level's code (without running it), hidden ones stay a surprise
      return s ? { ...s, goals: scenarioGoals(s).filter((o) => !o.hidden) } : null;
    },
  },
  methods: {
    /** Level from the device: a .zip (folder with scenario.json, .py files, assets/) or a scenario file .json. */
    async loadFile(ev) {
      const f = ev.target.files?.[0];
      ev.target.value = '';
      if (!f) return;
      this.fileError = '';
      try {
        let pkg;
        if (/\.zip$/i.test(f.name) || f.type === 'application/zip') {
          const { readLevelZip } = await import('../../levels/package.js');
          pkg = readLevelZip(await f.arrayBuffer());
        } else {
          const json = JSON.parse((await f.text()).replace(/^\uFEFF/, ''));
          const problems = validateScenario(json);
          pkg = { scenario: problems.length ? null : json, assets: new Map(), problems };
        }
        if (!pkg.scenario) { this.fileError = this.$t('adv.loadFailed', { why: pkg.problems[0] }); return; }
        this.$emit('open', pkg);
      } catch (e) {
        this.fileError = this.$t('adv.loadFailed', { why: e.message });
      }
    },
    openLink() {
      if (this.link) this.$emit('link', this.link);
    },
  },
};
</script>

<style>
.adv-left { display: flex; flex-direction: column; gap: 0.75rem; min-width: 0; }
.adv-sep { padding: 0.625rem 0.75rem 0.25rem; font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--gold-300); list-style: none; }
.adv-own { padding: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
.adv-own .h-title { margin: 0; font-size: var(--fs-lg); }
.adv-own-btn { position: relative; display: flex; align-items: center; gap: 0.75rem; text-align: left; padding: 0.625rem 0.75rem; cursor: pointer; border-radius: var(--r-md); background: var(--inset-bg); box-shadow: var(--inset-edge); }
a.adv-own-btn { text-decoration: none; color: inherit; }
.adv-own-btn b { display: block; color: var(--gold-200); }
.adv-own-btn small { color: var(--ink-muted); font-size: var(--fs-sm); }
.adv-file { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.adv-err { margin: 0; color: var(--bad); font-size: var(--fs-sm); }
.adv-link { display: flex; gap: 0.5rem; min-width: 0; }
.adv-link input { flex: 1; min-width: 0; }
.adv-tags { display: flex; gap: 0.375rem; flex-wrap: wrap; margin: 0; }
.adv-tag { padding: 0.125rem 0.5rem; border-radius: 999px; background: rgba(90, 60, 20, 0.15); font-size: var(--fs-sm); }
</style>
