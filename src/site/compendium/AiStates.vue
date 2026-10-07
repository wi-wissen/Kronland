<template>
  <figure class="ais" data-testid="ai-states">
    <svg viewBox="0 0 400 300" role="img" :aria-label="L('ai.diagram')">
      <defs>
        <marker id="ais-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" class="ais-head" />
        </marker>
      </defs>
      <!-- transitions -->
      <path d="M118,57 Q200,8 288,55" class="ais-edge" marker-end="url(#ais-arrow)" />
      <path d="M257,92 L145,92" class="ais-edge" marker-end="url(#ais-arrow)" />
      <path d="M80,104 L160,222" class="ais-edge prio" marker-end="url(#ais-arrow)" />
      <path d="M320,104 L240,222" class="ais-edge prio" marker-end="url(#ais-arrow)" />
      <path d="M137,258 Q28,262 44,106" class="ais-edge" marker-end="url(#ais-arrow)" />
      <!-- labels -->
      <text x="200" y="20" class="ais-label">{{ L('ai.toAttack') }}</text>
      <text x="200" y="116" class="ais-label">{{ L('ai.toGather') }}</text>
      <text x="200" y="166" class="ais-label prio">{{ L('ai.toDefend') }}</text>
      <text x="14" y="292" class="ais-label start">{{ L('ai.fromDefend') }}</text>
      <!-- states -->
      <g v-for="s in states" :key="s.id" :transform="`translate(${s.x},${s.y})`">
        <rect x="-62" y="-22" width="124" height="44" rx="10" :class="'ais-node ' + s.id" />
        <text y="6" class="ais-name">{{ L('ai.' + s.id) }}</text>
      </g>
    </svg>
  </figure>
</template>

<script>
// State diagram of the AI army (AiPlayer.commandArmy: armyState gather / attack / defend).
import { AI_LABELS } from './aiGuide.js';

export default {
  name: 'AiStates',
  data() {
    return { states: [{ id: 'gather', x: 80, y: 80 }, { id: 'attack', x: 320, y: 80 }, { id: 'defend', x: 200, y: 245 }] };
  },
  methods: {
    L(k) { return AI_LABELS[this.$i18n.lang]?.[k] ?? AI_LABELS.de[k] ?? k; },
  },
};
</script>

<style>
.ais { margin: 1rem 0 1.5rem; }
.ais svg { display: block; width: 100%; max-width: 32rem; height: auto; }
.ais-node { fill: #fffaf0; stroke: #8a5a1e; stroke-width: 2; }
.ais-node.attack { fill: #f6d9c8; stroke: #9a2a1a; }
.ais-node.defend { fill: #dbe6f3; stroke: #2f5a8a; }
.ais-name { font: 700 16px var(--font-display, serif); text-anchor: middle; fill: var(--parch-ink, #2b1d0e); }
.ais-edge { fill: none; stroke: #6b4a22; stroke-width: 2; }
.ais-edge.prio { stroke: #2f5a8a; stroke-dasharray: 6 4; }
.ais-head { fill: #6b4a22; }
.ais-label { font: 12.5px sans-serif; text-anchor: middle; fill: var(--parch-ink, #2b1d0e); paint-order: stroke; stroke: #f3e7cc; stroke-width: 4px; }
.ais-label.prio { fill: #2f5a8a; }
.ais-label.start { text-anchor: start; }
</style>
