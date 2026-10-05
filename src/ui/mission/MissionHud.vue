<template>
  <!-- Left column in the game: tutorial card, goals, messages (they stack, do not scroll over each other).
       Height ends above the command bar (--bottom-h), width leaves room on the right for quick access/minimap. -->
  <div class="mhud" data-testid="mission-hud">
    <TutorialCoach v-if="mission.tutorial" :step="mission.tutorial" :touch="touch" :lang="lang" @next="$emit('next')" @skip="$emit('skip')" />
    <ObjectivePanel v-if="mission.objectives.length" :objectives="mission.objectives" :lang="lang" @focus="$emit('focus', $event)" />
    <TributePanel v-if="mission.tributes?.length" :tributes="mission.tributes" :lang="lang" @pay="$emit('tribute', $event)" />
    <DialogBox :messages="mission.messages" :lang="lang" :speed="speed" :scripted="!!mission.script" @skip="$emit('skipDialog')" @line="$emit('line', $event)" />
  </div>
</template>

<script>
import TutorialCoach from './TutorialCoach.vue';
import ObjectivePanel from './ObjectivePanel.vue';
import DialogBox from './DialogBox.vue';
import TributePanel from './TributePanel.vue';

export default {
  name: 'MissionHud',
  components: { TutorialCoach, ObjectivePanel, DialogBox, TributePanel },
  props: {
    mission: { type: Object, required: true },
    touch: Boolean,
    lang: { type: String, default: 'de' },
    speed: { type: Number, default: 1 },
  },
  emits: ['next', 'skip', 'skipDialog', 'tribute', 'line', 'focus'],
};
</script>

<style>
.mhud {
  position: fixed; z-index: 5; pointer-events: none;
  left: calc(var(--hud-gap) * 2 + var(--safe-l)); top: calc(var(--top-total, 4rem) + var(--hud-gap));
  width: min(22rem, calc(100% - 6rem));
  max-height: calc(100dvh - var(--top-total, 4rem) - var(--bottom-h, 14rem) - var(--hud-gap) * 3);
  display: flex; flex-direction: column; gap: 0.5rem;
}
.mhud > * { pointer-events: auto; }
.mhud > .co-ring { pointer-events: none; }
.compact .mhud { left: calc(var(--hud-gap) + var(--safe-l)); width: calc(100% - 5.25rem - var(--safe-l) - var(--safe-r)); gap: 0.375rem; }
@media (max-height: 480px) and (orientation: landscape) {
  .compact .mhud { left: calc(var(--hud-gap) + var(--safe-l)); width: min(20rem, 42vw); }
}
</style>
