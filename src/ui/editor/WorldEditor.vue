<template>
  <div class="editor" :class="{ compact }" data-testid="world-editor">
    <canvas ref="canvas" class="ed-canvas" data-testid="editor-canvas"></canvas>
    <div v-if="loading" class="ed-loading backdrop"><span class="frame ed-loading-card">{{ $t('editor.loading') }}</span></div>

    <!-- Labels for start spots and places -->
    <template v-if="ui">
      <span v-for="s in ui.starts" v-show="s.screen && !s.screen.behind" :key="'s' + s.i" class="ed-label start" :style="labelStyle(s.screen)">{{ $t('editor.startOf', { n: s.i + 1 }) }}</span>
      <span v-for="p in ui.places" v-show="p.screen && !p.screen.behind" :key="'p' + p.name" class="ed-label place" :style="labelStyle(p.screen)">◎ {{ p.name }}</span>
    </template>

    <header class="ed-top frame">
      <button class="icon-btn ghost" :aria-label="$t('common.back')" data-testid="editor-back" @click="$emit('back')"><Icon name="back" /></button>
      <input v-model="scenario.title.de" class="ed-title" :aria-label="$t('editor.title')" data-testid="editor-title">
      <div class="ed-actions">
        <button v-tip="$t('editor.undo')" class="icon-btn" :disabled="!ui?.canUndo" data-testid="editor-undo" @click="view.undo()">↶</button>
        <button v-tip="$t('editor.redo')" class="icon-btn" :disabled="!ui?.canRedo" data-testid="editor-redo" @click="view.redo()">↷</button>
        <button v-tip="$t('script.gridTip')" class="icon-btn ed-grid" :class="{ on: grid }" :aria-pressed="grid" :aria-label="$t('script.grid')" data-testid="editor-grid" @click="toggleGrid">#</button>
        <button data-testid="editor-new" @click="newOpen = true"><Icon name="plus" /><span class="ed-lbl">{{ $t('editor.new') }}</span></button>
        <label class="ed-file-btn" data-testid="editor-open"><Icon name="load" /><span class="ed-lbl">{{ $t('editor.open') }}</span><input type="file" accept=".zip,.json,application/zip,application/json" data-testid="editor-open-file" @change="openFile"></label>
        <button data-testid="editor-save" @click="save"><Icon name="save" /><span class="ed-lbl">{{ $t('editor.save') }}</span></button>
        <button v-if="net.signedIn" v-tip="$t('editor.toServerTip')" :disabled="serverBusy" data-testid="editor-to-server" @click="toServer"><Icon name="cloud" /><span class="ed-lbl">{{ $t('editor.toServer') }}</span></button>
        <button class="primary" data-testid="editor-play" @click="play"><Icon name="play" />{{ $t('editor.play') }}</button>
      </div>
    </header>

    <nav class="ed-tools frame" role="toolbar" :aria-label="$t('editor.tools')">
      <button v-for="t in tools" :key="t.id" v-tip="$t('editor.tool.' + t.id)" class="act ed-tool" :class="{ on: ui?.tool.tool === t.id }" :aria-pressed="ui?.tool.tool === t.id" :data-testid="'tool-' + t.id" :disabled="ui?.preview && t.id !== 'camera'" @click="setTool({ tool: t.id })">
        <Icon v-if="t.icon" :name="t.icon" /><span v-else class="ed-glyph" aria-hidden="true">{{ t.glyph }}</span><span class="act-lbl">{{ $t('editor.toolShort.' + t.id) }}</span>
      </button>
      <div v-if="ui && showBrush" class="ed-brush">
        <label>{{ $t('editor.size') }} <input type="range" min="0" max="8" :value="ui.tool.r" data-testid="brush-size" @input="setTool({ r: +$event.target.value })"><b class="num">{{ ui.tool.r }}</b></label>
        <label v-if="ui.tool.tool === 'track'">{{ $t('editor.strength') }} <input type="range" min="1" :max="trackMax" :value="ui.tool.level" data-testid="track-level" @input="setTool({ level: +$event.target.value })"><b class="num">{{ ui.tool.level }}</b></label>
        <label v-if="['raise', 'lower'].includes(ui.tool.tool)">{{ $t('editor.strength') }} <input type="range" min="10" max="300" step="10" :value="ui.tool.strength" @input="setTool({ strength: +$event.target.value })"></label>
      </div>
      <div v-if="ui && ['pile', 'shaft'].includes(ui.tool.tool)" class="ed-brush">
        <select :value="ui.tool.res" :aria-label="$t('editor.res')" data-testid="tool-res" @change="setTool({ res: $event.target.value })">
          <option v-for="r in (ui.tool.tool === 'shaft' ? ['stone', 'iron', 'clay', 'sulfur'] : resources)" :key="r" :value="r">{{ $name.res ? $name.res(r) : r }}</option>
        </select>
        <label v-if="ui.tool.tool === 'pile'">{{ $t('editor.amount') }} <input type="number" min="1" max="5000" step="50" :value="ui.tool.amount" class="ed-num" @change="setTool({ amount: +$event.target.value })"></label>
      </div>
      <div v-if="ui && ui.tool.tool === 'item'" class="ed-brush">
        <select :value="ui.tool.item" :aria-label="$t('editor.item')" data-testid="tool-item-kind" @change="setTool({ item: $event.target.value })">
          <option v-for="k in items" :key="k" :value="k">{{ $t('editor.item.' + k) }}</option>
        </select>
      </div>
      <div v-if="ui && ui.tool.tool === 'start'" class="ed-brush">
        <select :value="ui.tool.player" :aria-label="$t('editor.player')" @change="setTool({ player: +$event.target.value })">
          <option v-for="(p, i) in realPlayers" :key="i" :value="i">{{ $t('editor.startOf', { n: i + 1 }) }}</option>
        </select>
      </div>
    </nav>

    <p v-if="ui" class="ed-status" data-testid="editor-status">
      <template v-if="ui.hover">x {{ ui.hover.x }} · y {{ ui.hover.y }} · {{ ui.hover.h }} cm · {{ $t('editor.kind.' + ui.hover.kind) }}<template v-if="ui.hover.res"> ({{ ui.hover.res }})</template></template>
      <template v-else>{{ ui.size.w }} × {{ ui.size.h }}</template>
      · 🌲 {{ ui.counts.trees }} · ◆ {{ ui.counts.piles }}<template v-if="ui.counts.items"> · ● {{ ui.counts.items }}</template>
      <b v-if="ui.preview" class="ed-preview-badge">{{ $t('editor.previewOn') }}</b>
    </p>

    <button v-if="compact && !sideOpen" class="ed-side-fab" data-testid="editor-panel-open" @click="sideOpen = true"><Icon name="menu" />{{ $t('editor.panel') }}</button>
    <aside v-show="!compact || sideOpen" class="ed-side frame" data-testid="editor-side">
      <header class="ed-side-head">
        <nav class="seg ed-tabs" role="tablist">
          <button v-for="t in tabs" :key="t" role="tab" :aria-selected="tab === t" :class="{ active: tab === t }" :data-testid="'editor-tab-' + t" @click="tab = t">{{ $t('editor.tab.' + t) }}</button>
        </nav>
        <button v-if="compact" class="icon-btn ghost" :aria-label="$t('common.close')" @click="sideOpen = false"><Icon name="close" /></button>
      </header>
      <div class="ed-side-body scroll-y">
        <!-- Scenario: title, kind, texts for the menu, players -->
        <section v-if="tab === 'scenario'" class="ed-form">
          <label>{{ $t('editor.id') }}<input v-model="scenario.id" pattern="[\w-]+" data-testid="editor-id"></label>
          <label>{{ $t('editor.kindLabel') }}
            <select v-model="scenario.kind" data-testid="editor-kind"><option value="adventure">{{ $t('editor.kindAdventure') }}</option><option value="mission">{{ $t('editor.kindMission') }}</option></select>
          </label>
          <div class="ed-two"><label>{{ $t('editor.titleDe') }}<input v-model="scenario.title.de"></label><label>{{ $t('editor.titleEn') }}<input v-model="scenario.title.en"></label></div>
          <div class="ed-two"><label>{{ $t('editor.summaryDe') }}<input v-model="scenario.summary.de"></label><label>{{ $t('editor.summaryEn') }}<input v-model="scenario.summary.en"></label></div>
          <label>{{ $t('editor.briefingDe') }}<textarea v-model="scenario.briefing.de" rows="3"></textarea></label>
          <label>{{ $t('editor.briefingEn') }}<textarea v-model="scenario.briefing.en" rows="3"></textarea></label>
          <label class="ed-check"><input v-model="scenario.world.fog" type="checkbox"> {{ $t('editor.fog') }}</label>
          <h4>{{ $t('editor.players') }}</h4>
          <div v-for="(p, i) in scenario.players" :key="i" class="ed-player">
            <b>{{ i === 0 ? $t('editor.human') : p.kind === 'bandits' ? $t('editor.bandits') : $t('editor.ai') }}</b>
            <select v-if="p.kind !== 'bandits'" v-model="p.hero" @change="rebuild"><option :value="null">–</option><option v-for="h in heroes" :key="h" :value="h">{{ $name.hero(h) }}</option></select>
            <label v-if="p.kind !== 'bandits'" class="ed-check"><input v-model="p.hq" type="checkbox" :true-value="true" :false-value="false" @change="rebuild"> {{ $t('editor.hq') }}</label>
            <button v-if="i > 0" class="icon-btn ghost" :aria-label="$t('editor.remove')" @click="removePlayer(i)"><Icon name="close" /></button>
          </div>
          <div class="ed-row">
            <button @click="addPlayer('ai')"><Icon name="plus" />{{ $t('editor.addAi') }}</button>
            <button :disabled="scenario.players.some((p) => p.kind === 'bandits')" @click="addPlayer('bandits')"><Icon name="plus" />{{ $t('editor.addBandits') }}</button>
          </div>
          <p class="ed-note">{{ $t('editor.scenarioNote') }}</p>
          <!-- Worlds: normal case and edge cases of one mission; the world code branches on world.id -->
          <h4>{{ $t('editor.worlds') }}</h4>
          <p class="ed-note">{{ $t('editor.worldsNote') }}</p>
          <div v-for="(w, i) in scenario.worlds ?? []" :key="i" class="ed-player ed-world" :data-testid="'editor-world-' + i">
            <input v-model="w.id" class="ed-world-id" pattern="[A-Za-z][\w-]*" :aria-label="$t('editor.worldId')" :placeholder="$t('editor.worldId')" data-testid="editor-world-id">
            <input v-model="w.title.de" :aria-label="$t('editor.titleDe')" :placeholder="$t('editor.titleDe')">
            <input v-model="w.title.en" :aria-label="$t('editor.titleEn')" :placeholder="$t('editor.titleEn')">
            <button class="icon-btn ghost" :aria-label="$t('editor.remove')" data-testid="editor-world-remove" @click="removeWorld(i)"><Icon name="close" /></button>
          </div>
          <div class="ed-row">
            <button :disabled="(scenario.worlds?.length ?? 0) >= maxWorlds" data-testid="editor-world-add" @click="addWorld"><Icon name="plus" />{{ $t('editor.addWorld') }}</button>
            <label v-if="scenario.worlds?.length" class="ed-inline">{{ $t('editor.playWorld') }}
              <select v-model="playWorld" data-testid="editor-play-world"><option v-for="w in scenario.worlds" :key="w.id" :value="w.id">{{ w.id }}</option></select>
            </label>
          </div>
        </section>

        <!-- Places: named circles, in code via place("name") -->
        <section v-else-if="tab === 'places'" class="ed-form">
          <p class="ed-note">{{ $t('editor.placesNote') }}</p>
          <div v-if="placeDraft" class="ed-place-new">
            <b>{{ $t('editor.newPlace', { x: placeDraft.x, y: placeDraft.y }) }}</b>
            <input v-model="placeDraft.name" :placeholder="$t('editor.placeName')" data-testid="place-name" @keydown.enter="addPlace">
            <button class="primary" :disabled="!/^[\w-]+$/.test(placeDraft.name)" data-testid="place-add" @click="addPlace">{{ $t('editor.add') }}</button>
          </div>
          <div v-for="(p, name) in scenario.world.places" :key="name" class="ed-place">
            <code>{{ name }}</code>
            <label>x<input v-model.number="p.x" type="number" class="ed-num"></label>
            <label>y<input v-model.number="p.y" type="number" class="ed-num"></label>
            <label>r<input v-model.number="p.r" type="number" min="0" max="20" class="ed-num"></label>
            <button class="icon-btn ghost" :aria-label="$t('editor.remove')" @click="delete scenario.world.places[name]"><Icon name="close" /></button>
          </div>
          <p v-if="!Object.keys(scenario.world.places).length" class="sp-none">{{ $t('editor.noPlaces') }}</p>
        </section>

        <!-- Code: edit sections, world setup as preview -->
        <section v-else-if="tab === 'code'" class="ed-form">
          <div class="ed-row">
            <button v-if="!ui?.preview" data-testid="editor-preview" @click="view.setPreview(true, plainScenario())"><Icon name="play" />{{ $t('editor.preview') }}</button>
            <template v-else>
              <button data-testid="editor-preview-off" @click="view.setPreview(false, plainScenario())">{{ $t('editor.previewOff') }}</button>
              <button v-tip="$t('editor.bakeTip')" data-testid="editor-bake" @click="bake">{{ $t('editor.bake') }}</button>
            </template>
          </div>
          <div v-if="ui?.preview && (ui.errors.length || ui.console.length)" class="sp-console">
            <div v-for="e in ui.errors" :key="'e' + e.seq" class="sp-out err" data-testid="editor-error">{{ errText(e) }}</div>
            <div v-for="c in ui.console.filter((c) => !c.err)" :key="c.seq" class="sp-out">{{ c.text }}</div>
          </div>
          <!-- Hints of the mission code (valid, but rarely meant so): amber, like in the code panel -->
          <div v-for="h in previewHints.list" :key="'h' + h.seq" class="sp-hint" role="status" data-testid="editor-hint">
            <b>{{ hintTitle(h) }}</b>
            <p>{{ $t(h.code, h.params ?? {}) }}</p>
          </div>
          <p v-if="previewHints.more" class="sp-hint-more">{{ $t('script.hint.more', { n: previewHints.more }) }}</p>
          <!-- Building blocks: typical pieces of a mission, inserted at the caret -->
          <details class="ed-blocks" :open="!compact" data-testid="editor-blocks">
            <summary>{{ $t('editor.blocks') }}</summary>
            <p class="ed-note">{{ $t(touch ? 'editor.blocksNoteTouch' : 'editor.blocksNote', { x: blockTile.x, y: blockTile.y }) }}</p>
            <div class="ed-block-list">
              <button v-for="b in blocks" :key="b.id" class="ed-block" :data-testid="'block-' + b.id" @click="insertBlock(b.id)">
                <b>{{ $t('editor.block.' + b.id) }}</b><small>{{ $t('editor.blockHint.' + b.id) }}</small>
              </button>
            </div>
          </details>
          <div v-for="(s, i) in scenario.sections" :key="s.id" class="ed-section" :data-testid="'editor-section-' + s.id">
            <div class="ed-sec-head">
              <input v-model="s.title.de" class="ed-sec-title" :aria-label="$t('editor.sectionTitle')">
              <select v-model="s.level" :aria-label="$t('editor.level')"><option value="mission">{{ $t('editor.levelMission') }}</option><option value="player">{{ $t('editor.levelPlayer') }}</option></select>
              <select v-model="s.visibility" :aria-label="$t('editor.visibility')"><option v-for="v in ['open', 'collapsed', 'hidden']" :key="v" :value="v">{{ $t('editor.vis.' + v) }}</option></select>
              <label class="ed-check"><input v-model="s.editable" type="checkbox"> {{ $t('editor.editable') }}</label>
              <button class="icon-btn ghost" :disabled="i === 0" :aria-label="$t('editor.up')" @click="moveSection(i, -1)"><Icon name="chevronUp" /></button>
              <button class="icon-btn ghost" :aria-label="$t('editor.remove')" @click="scenario.sections.splice(i, 1)"><Icon name="close" /></button>
            </div>
            <CodeEditor
              :ref="(el) => setEditor(s.id, el)"
              v-model="s.code"
              :label="s.title.de"
              :error-line="sectionError(s.id)"
              :hint-lines="previewHints.lines[s.id] ?? []"
              @update:model-value="edited(s.id)"
              @focus="focusSection(s.id)"
              @blur="rememberCaret(s.id)"
            />
          </div>
          <div class="ed-row">
            <button data-testid="editor-add-section" @click="addSection('mission')"><Icon name="plus" />{{ $t('editor.addMission') }}</button>
            <button @click="addSection('player')"><Icon name="plus" />{{ $t('editor.addPlayer') }}</button>
          </div>
          <details class="ed-help"><summary>{{ $t('editor.commands') }}</summary><ApiHelp level="mission" @insert="insertCode" /></details>
        </section>

        <!-- Files: pictures, recordings and 3D models of the level (assets/…), saved in the .zip -->
        <section v-else-if="tab === 'files'" class="ed-form">
          <p class="ed-note">{{ $t('editor.filesNote') }}</p>
          <div v-for="f in fileList" :key="f.path" class="ed-asset" :data-testid="'asset-' + f.path">
            <code>{{ f.path }}</code><small>{{ f.size }}</small>
            <button class="icon-btn ghost" :aria-label="$t('editor.remove')" @click="removeAsset(f.path)"><Icon name="close" /></button>
          </div>
          <p v-if="!fileList.length" class="sp-none">{{ $t('editor.noFiles') }}</p>
          <label class="ed-file-btn" data-testid="editor-add-file"><Icon name="plus" /><span>{{ $t('editor.addFile') }}</span><input type="file" multiple accept=".png,.jpg,.jpeg,.webp,.mp3,.ogg,.glb" data-testid="editor-asset-file" @change="addAssets"></label>
        </section>

        <!-- Examples: open bundled scenarios as a template -->
        <section v-else-if="tab === 'examples'" class="ed-form">
          <p class="ed-note">{{ $t('editor.examplesNote') }}</p>
          <button v-for="ex in examples" :key="ex.id" class="ed-example" :data-testid="'example-' + ex.id" @click="openExample(ex)">
            <b>{{ $tr(ex.title) }}</b><small>{{ $tr(ex.summary) }}</small>
          </button>
        </section>
        <p v-if="message" class="ed-msg" role="status">{{ message }}</p>
      </div>
    </aside>

    <!-- Double-click/long press on a free tile: what to insert -->
    <div v-if="codeMenu" class="ed-menu-scrim" data-testid="editor-code-scrim" @click="closeMenu" @contextmenu.prevent="closeMenu"></div>
    <div v-if="codeMenu" class="ed-code-menu frame" :style="codeMenu.style" role="menu" data-testid="editor-code-menu">
      <b class="ed-code-menu-title">{{ $t('editor.code.tile', { x: codeMenu.x, y: codeMenu.y }) }}</b>
      <button v-for="c in freeMenu" :key="c" role="menuitem" :data-testid="'code-menu-' + c" @click="menuChoice(c)">
        <span>{{ $t('editor.code.' + c) }}</span><code>{{ menuPreview(c) }}</code>
      </button>
    </div>
    <p v-if="codeToast" class="ed-code-toast" role="status" data-testid="editor-code-toast">{{ codeToast }}</p>

    <!-- New world -->
    <Teleport to="body">
      <div v-if="newOpen" class="scrim" @click.self="newOpen = false">
        <div class="dialog frame ed-new" role="dialog" aria-modal="true" :aria-label="$t('editor.new')" data-testid="editor-new-dialog">
          <h2 class="h-title">{{ $t('editor.new') }}</h2>
          <div class="seg"><button v-for="b in ['flat', 'generate']" :key="b" :class="{ active: newBase === b }" @click="newBase = b">{{ $t('editor.base.' + b) }}</button></div>
          <label>{{ $t('editor.mapSize') }}
            <select v-model.number="newSize"><option v-for="n in (newBase === 'flat' ? [24, 32, 48, 64, 96] : [64, 96, 128])" :key="n" :value="n">{{ n }} × {{ n }}</option></select>
          </label>
          <label v-if="newBase === 'generate'">{{ $t('menu.mapNumber') }}<input v-model.number="newSeed" type="number" min="1"></label>
          <div class="ed-row"><button @click="newOpen = false">{{ $t('common.cancel') }}</button><button class="primary" data-testid="editor-new-create" @click="createNew">{{ $t('editor.create') }}</button></div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import { markRaw } from 'vue';
import CodeEditor from '../script/CodeEditor.vue';
import ApiHelp from '../script/ApiHelp.vue';
import { EditorView } from '../../game/EditorView.js';
import { emptyScenario, validateScenario, SCENARIO_LIMITS } from '../../sim/scripting/scenario.js';
import { assetAllowed, useLevelAssets } from '../../levels/assets.js';
import { SCENARIOS } from '../../sim/missions/levels/index.js';
import { RESOURCES } from '../../sim/data/resources.js';
import { HERO_IDS } from '../../sim/data/units.js';
import { BALANCE } from '../../sim/data/balance.js';
import { loadAssets } from '../../render/assets.js';
import { applyPlayerColor } from '../settings.js';
import { scriptErrorText, i18n } from '../../i18n/index.js';
import { planInsert, applyPlan, targetSnippet, menuSnippet, FREE_MENU } from './codeInsert.js';
import { BLOCKS, buildBlock, talkBlock } from './blocks.js';
import { shownHints } from '../script/panelState.js';
import { net } from '../../net/state.js';
import { errorMessage } from '../../net/errors.js';
import { has, t } from '../../i18n/index.js';
import { takePendingServerPack } from './serverDraft.js';

const DRAFT = 'kronland-editor-draft';
/**
 * Files of the level being edited (assets/… → Blob). Too big for the draft in localStorage: they stay while the page
 * is open (also across test play) and travel in the .zip.
 */
const files = new Map();
/** Id of the server pack this level was opened from / saved to (stays while the page is open, like `files`) */
let serverId = null;
const TOOLS = [
  { id: 'camera', glyph: '✥' }, { id: 'raise', glyph: '▲' }, { id: 'lower', glyph: '▼' }, { id: 'flatten', glyph: '▬' },
  { id: 'smooth', glyph: '≈' }, { id: 'water', glyph: '≋' }, { id: 'land', glyph: '◭' }, { id: 'forest', icon: 'wood' },
  { id: 'erase', icon: 'trash' }, { id: 'pile', icon: 'stone' }, { id: 'shaft', icon: 'b-stoneMine' }, { id: 'spot', icon: 'b-villageCenter' },
  { id: 'item', icon: 'gold' }, { id: 'track', glyph: '∴' }, { id: 'start', icon: 'banner' }, { id: 'place', icon: 'target' },
];
/** Items of the tool "Gegenstand" (src/sim/systems/ground.js ITEM_KINDS) */
const ITEMS = ['coin', 'flower'];

/** Add missing fields so the forms always have something to bind to. */
function normalize(s) {
  // JSON copy: s may be a reactive Vue proxy (structuredClone fails on it)
  const c = JSON.parse(JSON.stringify(s));
  c.title = { de: '', en: '', ...(c.title ?? {}) };
  c.summary = { de: '', en: '', ...(c.summary ?? {}) };
  c.briefing = { de: '', en: '', ...(c.briefing ?? {}) };
  c.world = { places: {}, ...(c.world ?? {}) };
  c.world.places ??= {};
  if (Array.isArray(c.worlds)) c.worlds = c.worlds.map((w) => ({ ...w, title: typeof w.title === 'string' ? { de: w.title, en: w.title } : { de: '', en: '', ...(w.title ?? {}) } }));
  c.sections = (c.sections ?? []).map((x) => ({ level: 'mission', visibility: 'open', editable: false, ...x, title: typeof x.title === 'string' ? { de: x.title, en: x.title } : { de: x.id, en: x.id, ...(x.title ?? {}) } }));
  return c;
}

const loadDraft = () => { try { const d = JSON.parse(localStorage.getItem(DRAFT) ?? 'null'); return d && !validateScenario(d).length ? d : null; } catch { return null; } };

export default {
  name: 'WorldEditor',
  components: { CodeEditor, ApiHelp },
  props: {
    initial: { type: Object, default: null },
    touch: Boolean,
  },
  emits: ['back', 'play', 'change'],
  created() {
    // Own pack opened from "Discover levels": its media become the level's files
    const p = takePendingServerPack();
    if (p) { files.clear(); for (const [k, v] of p.files) files.set(k, v); serverId = p.id; }
  },
  data() {
    return {
      net, serverBusy: false,
      scenario: normalize(this.initial ?? loadDraft() ?? emptyScenario({ size: 32 })),
      ui: null, view: null, loading: true, tab: 'scenario', sideOpen: false, grid: false,
      newOpen: false, newBase: 'flat', newSize: 32, newSeed: 42,
      placeDraft: null, message: '', fileVersion: 0,
      compact: false, tools: TOOLS, items: ITEMS, trackMax: BALANCE.ground.tracks.max, resources: RESOURCES, heroes: HERO_IDS, examples: SCENARIOS,
      blocks: BLOCKS, freeMenu: FREE_MENU,
      /** Code from the map: menu for a free tile, confirmation, tile for the building blocks */
      codeMenu: null, codeToast: '', codeTile: null,
      /** Section that gets code from the map (last focused), its caret while the editor is closed */
      focusedSection: null, carets: {},
      /** Sections edited since the preview started: their error and hint marks are out of date */
      previewDirty: {},
      /** World for preview and test play (scenario.worlds), null = the first */
      playWorld: null, maxWorlds: SCENARIO_LIMITS.worlds,
    };
  },
  computed: {
    tabs() { return ['scenario', 'places', 'code', 'files', 'examples']; },
    fileList() {
      void this.fileVersion;
      return [...files].map(([path, b]) => ({ path, size: b.size >= 1e6 ? `${(b.size / 1e6).toFixed(1)} MB` : `${Math.ceil(b.size / 1e3)} KB` }));
    },
    realPlayers() { return this.scenario.players.filter((p) => p.kind !== 'bandits'); },
    /** Tile for the building blocks: the last one picked on the map, otherwise the middle */
    blockTile() { return this.codeTile ?? { x: Math.floor((this.ui?.size.w ?? 32) / 2), y: Math.floor((this.ui?.size.h ?? 32) / 2) }; },
    previewHints() {
      if (!this.ui?.preview) return { list: [], more: 0, lines: {} };
      return shownHints({ missionHints: this.ui.hints }, { mode: 'editor', dirty: this.previewDirty });
    },
    showBrush() { return ['raise', 'lower', 'flatten', 'smooth', 'water', 'land', 'forest', 'erase', 'track'].includes(this.ui?.tool.tool); },
  },
  watch: {
    // Preview in the chosen world: build it anew
    playWorld(v) {
      if (!this.view) return;
      this.view.world = v;
      if (this.view.preview) { this.view.setPreview(false, this.plainScenario()); this.view.setPreview(true, this.plainScenario()); }
    },
    scenario: {
      deep: true,
      handler() {
        if (this.view) this.view.scenario = this.plainScenario();
        clearTimeout(this.draftTimer);
        this.draftTimer = setTimeout(() => this.saveDraft(), 800);
      },
    },
    'ui.preview'(on) { if (on) this.previewDirty = {}; },
    'ui.canUndo'() { clearTimeout(this.draftTimer); this.draftTimer = setTimeout(() => this.saveDraft(), 800); },
  },
  async mounted() {
    this.layout = () => { this.compact = window.innerWidth < 900 || window.innerHeight < 560; };
    this.layout();
    window.addEventListener('resize', this.layout);
    this.onEsc = (e) => { if (e.key === 'Escape' && this.codeMenu) { e.stopPropagation(); this.codeMenu = null; } };
    window.addEventListener('keydown', this.onEsc, true);
    // Caret of the section being edited, also when its editor closes (tab change) before it reports a blur
    this.onSel = () => {
      const a = document.activeElement;
      for (const [id, ed] of Object.entries(this.editors ?? {})) if (ed?.$refs?.ta === a && a.offsetParent) { this.carets[id] = ed.selection(); this.focusedSection = id; }
    };
    document.addEventListener('selectionchange', this.onSel);
    applyPlayerColor();
    try { await loadAssets(Math.max(1, this.realPlayers.length), () => {}); } catch { /* placeholder models */ }
    this.view = markRaw(new EditorView(this.$refs.canvas, this.plainScenario(), {
      onUi: (ui) => { this.ui = ui; },
      onPick: (tool, x, y) => this.pick(tool, x, y),
      onCode: (target, client) => this.codeAt(target, client),
    }));
    this.loading = false;
    window.__kronlandEditor = this.view;
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.layout);
    window.removeEventListener('keydown', this.onEsc, true);
    document.removeEventListener('selectionchange', this.onSel);
    clearTimeout(this.draftTimer);
    clearTimeout(this.toastTimer);
    clearTimeout(this.sheetTimer);
    this.saveDraft();
    this.view?.dispose();
    if (window.__kronlandEditor === this.view) window.__kronlandEditor = null;
  },
  methods: {
    toggleGrid() { this.grid = !this.grid; this.view?.setGrid(this.grid); },
    /** Scenario as a plain object (without Vue proxies). */
    plainScenario() { return JSON.parse(JSON.stringify(this.scenario)); },
    /** Complete scenario with map. */
    fullScenario() { return this.view ? this.view.scenarioWithTerrain(this.plainScenario()) : this.plainScenario(); },
    saveDraft() {
      if (!this.view || this.view.preview) return;
      const full = this.fullScenario();
      this.$emit('change', full);
      try { localStorage.setItem(DRAFT, JSON.stringify(full)); } catch { /* full or blocked */ }
    },
    setTool(patch) { this.view?.setTool(patch); if (patch.tool === 'place') { this.tab = 'places'; if (this.compact) this.sideOpen = false; } },
    labelStyle(p) { return { left: `${p.x}px`, top: `${p.y}px` }; },
    errText(e) { const r = scriptErrorText(e, { line: e.sline || e.line }); return `${r.title}: ${r.text}`; },
    flash(msg) { this.message = msg; clearTimeout(this.msgTimer); this.msgTimer = setTimeout(() => { this.message = ''; }, 4000); },

    /** Click with the "start spot" or "place" tool. */
    pick(tool, x, y) {
      if (tool === 'place') {
        this.placeDraft = { x, y, name: this.placeDraft?.name ?? '' };
        this.tab = 'places';
        if (this.compact) this.sideOpen = true;
        return;
      }
      const p = this.ui?.tool.player ?? 0;
      const full = this.fullScenario();
      const starts = (full.world.starts ?? full.world.terrain?.starts ?? []).slice();
      while (starts.length <= p) starts.push({ ...(this.view.sim.starts[starts.length] ?? { x: 8, y: 8 }) });
      starts[p] = { x, y };
      this.scenario.world.starts = starts;
      full.world.starts = starts;
      if (full.world.terrain) full.world.terrain.starts = starts;
      this.view.undoStack = [];
      this.view.load(full, true);
    },
    addPlace() {
      const d = this.placeDraft;
      if (!d || !/^[\w-]+$/.test(d.name)) return;
      this.scenario.world.places[d.name] = { x: d.x, y: d.y, r: 2 };
      this.placeDraft = null;
    },
    /** Add pictures, recordings, 3D models: they land in assets/ under their (cleaned) file name. */
    addAssets(ev) {
      for (const f of ev.target.files ?? []) {
        const path = `assets/${f.name.toLowerCase().replace(/[^\w.-]+/g, '-')}`;
        if (!assetAllowed(path)) { this.flash(this.$t('editor.fileType', { name: f.name })); continue; }
        if (f.size > 15_000_000) { this.flash(this.$t('editor.fileTooBig', { name: f.name })); continue; }
        files.set(path, f);
        this.flash(this.$t('editor.fileAdded', { path }));
      }
      ev.target.value = '';
      this.fileVersion++;
      this.useFiles();
    },
    removeAsset(path) { files.delete(path); this.fileVersion++; this.useFiles(); },
    /** Preview and test play show the files of the level. */
    useFiles() { const s = this.plainScenario(); useLevelAssets({ scenario: s, assets: files }, s); },
    addSection(level) {
      let n = 1;
      while (this.scenario.sections.some((s) => s.id === `${level}${n}`)) n++;
      this.scenario.sections.push({ id: `${level}${n}`, title: { de: level === 'player' ? 'Dein Programm' : 'Skript', en: level === 'player' ? 'Your program' : 'Script' }, level, visibility: 'open', editable: level === 'player', code: level === 'player' ? 'nelia.step()\n' : '# …\n' });
    },
    moveSection(i, d) {
      const s = this.scenario.sections;
      const [x] = s.splice(i, 1);
      s.splice(i + d, 0, x);
    },
    /** Example from the command help: at the caret like a building block (definitions at the top level). */
    insertCode(text) { this.insertSnippet({ kind: /^(@|def )/m.test(text) ? 'top' : 'stmt', code: text }); },

    // ---------- Code from the map and building blocks ----------

    setEditor(id, el) { if (el) (this.editors ??= {})[id] = el; else if (this.editors) delete this.editors[id]; },
    focusSection(id) { this.focusedSection = id; },
    /** Caret on leaving a section – only from a visible editor (a hidden sheet's textarea has lost its selection). */
    rememberCaret(id) { const ed = this.editors?.[id]; if (ed?.$refs?.ta?.offsetParent) this.carets[id] = ed.selection(); },
    edited(id) { if (this.ui?.preview) this.previewDirty = { ...this.previewDirty, [id]: true }; },
    sectionError(id) {
      if (!this.ui?.preview || this.previewDirty[id]) return -1;
      const e = [...this.ui.errors].reverse().find((x) => x.section === id);
      return e?.sline > 0 ? e.sline : -1;
    },
    hintTitle(h) {
      const sec = this.scenario.sections.find((x) => x.id === h.section);
      if (!h.sline) return this.$t('script.hint.title');
      return sec ? this.$t('script.hint.whereSection', { section: this.$tr(sec.title), line: h.sline }) : this.$t('script.hint.where', { line: h.sline });
    },
    /** Section for inserted code: the last focused one, otherwise the mission. */
    targetSection() {
      const all = this.scenario.sections;
      return all.find((x) => x.id === this.focusedSection) ?? all.find((x) => x.id === 'mission') ?? all.find((x) => x.level === 'mission') ?? all[0] ?? null;
    },
    /** Context for building blocks and the talk figure of the menu. */
    blockCtx(at) {
      const p = this.scenario.players[0] ?? {};
      return { x: at.x, y: at.y, lang: i18n.lang === 'en' ? 'en' : 'de', codes: this.scenario.sections.map((x) => x.code), hero: p.hero ?? null, hq: !!p.hq, width: this.ui?.size.w ?? 32, height: this.ui?.size.h ?? 32 };
    },
    /** Double-click/long press on the map: code for places and things right away, a menu for free tiles. */
    codeAt(target, client) {
      this.codeTile = { x: target.x, y: target.y };
      const sn = targetSnippet(target);
      if (sn) { this.insertSnippet(sn); return; }
      const W = window.innerWidth, H = window.innerHeight;
      const left = Math.max(8, Math.min(W - 248, client.x + 8)), top = Math.max(8, Math.min(H - 220, client.y + 8));
      this.codeMenu = { x: target.x, y: target.y, at: Date.now(), style: { left: `${left}px`, top: `${top}px` } };
    },
    /** Tap beside the menu closes it – not the click the browser sends when the long-press finger lifts. */
    closeMenu() {
      if (this.codeMenu && Date.now() - this.codeMenu.at > 600) this.codeMenu = null;
    },
    menuSnippetOf(choice) {
      const at = { x: this.codeMenu.x, y: this.codeMenu.y };
      return menuSnippet(choice, at, { codes: this.scenario.sections.map((x) => x.code), talk: (p) => talkBlock(this.blockCtx(p)) });
    },
    /** First line of the code a menu entry inserts (without comments and placeholder marks). */
    menuPreview(choice) {
      const lines = this.menuSnippetOf(choice).code.replace(/[«»]/g, '').split('\n').filter((l) => l.trim() && !l.startsWith('#'));
      return lines[0] ?? '';
    },
    menuChoice(choice) {
      const sn = this.menuSnippetOf(choice);
      this.codeMenu = null;
      this.insertSnippet(sn);
    },
    insertBlock(id) {
      const sn = buildBlock(id, this.blockCtx(this.blockTile));
      if (!sn) return;
      if (sn.needs === 'bandits' && !this.scenario.players.some((p) => p.kind === 'bandits')) {
        this.addPlayer('bandits');
        this.flash(this.$t('editor.banditsAdded'));
      }
      this.insertSnippet(sn);
    },
    /**
     * Insert a snippet at the caret of the target section (codeInsert.planInsert): through the code editor so undo
     * keeps it; the code tab opens (on phones the panel too) so you see where it went.
     */
    async insertSnippet(sn) {
      const s = this.targetSection();
      if (!s) return;
      this.tab = 'code';
      // Phones: the sheet opens a moment later – the finger of the long press must not land in it
      await this.$nextTick();
      const ed = this.editors?.[s.id];
      const live = ed && document.activeElement === ed.$refs?.ta && ed.$refs.ta.offsetParent ? ed.selection() : null;
      const sel = live ?? this.carets[s.id] ?? { start: s.code.length, end: s.code.length };
      const plan = planInsert(s.code, sel.start, sel.end, sn);
      if (!ed?.replace(plan.from, plan.to, plan.text, plan.select, !this.touch)) s.code = applyPlan(s.code, plan);
      this.carets[s.id] = { start: plan.select[0], end: plan.select[1] };
      this.focusedSection = s.id;
      const shown = plan.text.trim().split('\n').find((l) => !l.trim().startsWith('#')) ?? '';
      this.codeToast = this.$t('editor.code.inserted', { section: this.$tr(s.title), code: shown.trim() });
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => { this.codeToast = ''; }, 3500);
      if (this.compact) { clearTimeout(this.sheetTimer); this.sheetTimer = setTimeout(() => { this.sideOpen = true; }, 450); }
    },
    addPlayer(kind) {
      this.scenario.players.push(kind === 'bandits' ? { kind: 'bandits' } : { kind: 'ai', hero: 'malvor', hq: true, difficulty: 'normal' });
      this.rebuild();
    },
    removePlayer(i) { this.scenario.players.splice(i, 1); this.rebuild(); },
    /** Add a world: the first one added also gets the normal case, so that the existing world code keeps an id. */
    addWorld() {
      const list = this.scenario.worlds ?? (this.scenario.worlds = []);
      if (!list.length) list.push({ id: 'normal', title: { de: 'Normalfall', en: 'Normal case' } });
      let n = list.length + 1;
      while (list.some((w) => w.id === `world${n}`)) n++;
      list.push({ id: `world${n}`, title: { de: '', en: '' } });
    },
    removeWorld(i) {
      this.scenario.worlds.splice(i, 1);
      if (!this.scenario.worlds.length) delete this.scenario.worlds;
      if (!this.scenario.worlds?.some((w) => w.id === this.playWorld)) this.playWorld = null;
    },
    /** Rebuild the world (players changed): the map is kept. */
    rebuild() {
      if (!this.view) return;
      const full = this.fullScenario();
      this.view.undoStack = [];
      this.view.load(full, true);
    },
    createNew() {
      const s = normalize(emptyScenario({ size: this.newSize }));
      if (this.newBase === 'generate') {
        s.world = { base: 'generate', seed: this.newSeed || 1, size: this.newSize, fog: true, places: {} };
        s.kind = 'mission';
        s.players = [{ kind: 'human', hero: 'nelia', hq: true }];
        s.sections = s.sections.filter((x) => x.level === 'mission');
      }
      this.scenario = s;
      serverId = null;
      files.clear();
      this.fileVersion++;
      this.newOpen = false;
      this.view.undoStack = [];
      this.view.preview = false;
      this.view.load(this.plainScenario());
    },
    openExample(ex) {
      serverId = null;
      files.clear();
      this.fileVersion++;
      this.scenario = normalize(ex);
      this.scenario.id = `${ex.id}-copy`;
      this.view.preview = false;
      this.view.undoStack = [];
      this.view.load(this.plainScenario());
      this.flash(this.$t('editor.opened', { name: this.$tr(ex.title) }));
    },
    /** Open a level: .zip (with its files) or a scenario file .json. */
    async openFile(ev) {
      const f = ev.target.files?.[0];
      ev.target.value = '';
      if (!f) return;
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
        if (!pkg.scenario) { this.flash(this.$t('adv.loadFailed', { why: pkg.problems[0] })); return; }
        serverId = null;
        files.clear();
        for (const [k, v] of pkg.assets) files.set(k, v);
        this.fileVersion++;
        this.scenario = normalize(pkg.scenario);
        this.view.preview = false;
        this.view.undoStack = [];
        this.view.load(this.plainScenario());
        this.useFiles();
        this.flash(this.$t('editor.opened', { name: this.$tr(pkg.scenario.title) || pkg.scenario.id }));
      } catch (e) { this.flash(this.$t('adv.loadFailed', { why: e.message })); }
    },
    /** "Save to server": the level becomes a pack with one level in the player's account (docs/SERVER.md). */
    async toServer() {
      const full = this.fullScenario();
      const problems = validateScenario(full);
      if (problems.length) { this.flash(problems[0]); return; }
      this.serverBusy = true;
      try {
        const sp = await (await import('../../net/index.js')).serverPacks();
        serverId ||= sp.newId();
        await sp.save(full, files, serverId);
        this.flash(this.$t('editor.toServerDone', { id: serverId }));
      } catch (e) {
        this.flash(this.$t('editor.toServerFailed', { why: errorMessage(e, t, has) }));
      } finally { this.serverBusy = false; }
    },
    /** Save as .zip: scenario.json, one .py file per section, assets/ – the same folder as the bundled levels. */
    async save() {
      const full = this.fullScenario();
      const { writeLevelZip } = await import('../../levels/package.js');
      const blob = new Blob([await writeLevelZip(full, files)], { type: 'application/zip' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${full.id || 'world'}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      this.flash(this.$t('editor.saved'));
    },
    bake() {
      const baked = this.view.bakePreview(this.plainScenario());
      if (!baked) return;
      this.scenario = normalize(baked);
      // World-setup sections have done their job: comment them out so nothing is created twice
      const world = this.scenario.sections.find((s) => s.id === 'world');
      if (world) world.code = world.code.split('\n').map((l) => (l.trim() ? '# ' + l : l)).join('\n');
      this.flash(this.$t('editor.baked'));
    },
    play() {
      const full = this.fullScenario();
      const problems = validateScenario(full);
      if (problems.length) { this.flash(problems[0]); return; }
      this.saveDraft();
      this.$emit('play', { scenario: { ...full, debug: true }, assets: files, world: this.playWorld });
    },
  },
};
</script>

<style>
.editor { position: fixed; inset: 0; background: #1a221e; overflow: hidden; }
.ed-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
.ed-loading { display: grid; place-items: center; z-index: 50; }
.ed-loading-card { padding: 1rem 1.5rem; }
.ed-top { position: absolute; z-index: 5; top: calc(0.5rem + var(--safe-t)); left: calc(0.5rem + var(--safe-l)); right: calc(0.5rem + var(--safe-r)); display: flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0.5rem; }
.ed-grid { font: 800 1rem/1 ui-monospace, Menlo, monospace; }
.ed-grid.on { color: var(--gold-100); box-shadow: inset 0 0 0 2px var(--gold-300); }
.ed-title { flex: 1; min-width: 6rem; font-family: var(--display); font-size: var(--fs-lg); background: transparent; border-color: transparent; color: var(--gold-200); box-shadow: none; }
.ed-title:hover, .ed-title:focus-visible { background: var(--inset-bg); border-color: var(--wood-950); }
.ed-actions { display: flex; gap: 0.375rem; align-items: center; }
.ed-actions > button, .ed-file-btn { display: inline-flex; align-items: center; gap: 0.375rem; min-height: 2.5rem; }
.ed-asset { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
.ed-asset code { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ed-asset small { color: var(--ink-muted); }
.ed-file-btn { position: relative; padding: 0 0.75rem; border-radius: var(--r-md); cursor: pointer; background: var(--inset-bg); box-shadow: var(--inset-edge); }
.ed-file-btn input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
/* two columns: all 16 tools and the options of the chosen one fit without scrolling */
.ed-tools { position: absolute; z-index: 5; left: calc(0.5rem + var(--safe-l)); top: 4.25rem; display: grid; grid-template-columns: 1fr 1fr; align-content: start; gap: 0.25rem; padding: 0.375rem; max-height: calc(100dvh - 6rem); overflow-y: auto; width: 10rem; }
.ed-tools button.act.ed-tool { flex: none; width: 100%; min-height: 3.25rem; padding: 0.375rem 0.25rem 0.3125rem; }
.ed-tool > .ico { width: 1.5rem; height: 1.5rem; }
.ed-glyph { position: relative; z-index: 1; height: 1.5rem; display: grid; place-items: center; font-size: 1.25rem; line-height: 1; }
.ed-brush { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 0.25rem; font-size: var(--fs-xs); padding: 0.25rem 0; border-top: 1px solid rgba(225, 168, 58, 0.2); }
.ed-brush input[type=range] { width: 100%; }
.ed-num { width: 4.5rem; }
.ed-status { position: absolute; z-index: 5; left: 6.25rem; bottom: calc(0.5rem + var(--safe-b)); margin: 0; padding: 0.25rem 0.625rem; border-radius: var(--r-md); background: rgba(20, 13, 8, 0.75); color: var(--ink); font-size: var(--fs-sm); }
.ed-preview-badge { margin-left: 0.5rem; color: var(--warn); }
.ed-side { position: absolute; z-index: 5; top: 4.25rem; right: calc(0.5rem + var(--safe-r)); bottom: calc(0.5rem + var(--safe-b)); width: min(34rem, 44vw); display: flex; flex-direction: column; padding: 0.5rem; gap: 0.5rem; }
.ed-side-head { display: flex; align-items: center; gap: 0.5rem; }
.ed-tabs { flex: 1; overflow-x: auto; }
.ed-tabs > button { min-height: 2.125rem; padding: 0 0.625rem; white-space: nowrap; }
.ed-side-body { flex: 1; min-height: 0; }
.ed-form { display: flex; flex-direction: column; gap: 0.5rem; }
.ed-form label { display: flex; flex-direction: column; gap: 0.2rem; font-size: var(--fs-sm); color: var(--ink-muted); }
.ed-form label.ed-check { flex-direction: row; align-items: center; gap: 0.4rem; }
.ed-form h4 { margin: 0.5rem 0 0; color: var(--gold-300); font-size: var(--fs-sm); }
.ed-world input { flex: 1; min-width: 6rem; }
.ed-world .ed-world-id { flex: none; width: 7rem; font-family: ui-monospace, monospace; }
.ed-row .ed-inline { flex-direction: row; align-items: center; gap: 0.375rem; }
.ed-two { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
.ed-row { display: flex; gap: 0.375rem; flex-wrap: wrap; align-items: center; }
.ed-row button { display: inline-flex; align-items: center; gap: 0.3rem; }
.ed-note { margin: 0; font-size: var(--fs-sm); color: var(--ink-dim); line-height: 1.4; }
.ed-player, .ed-place { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; padding: 0.375rem 0.5rem; border-radius: var(--r-md); background: var(--inset-bg); }
.ed-place label { flex-direction: row; align-items: center; gap: 0.25rem; }
.ed-place code { color: var(--gold-100); min-width: 5rem; }
.ed-place-new { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; padding: 0.5rem; border: 1px dashed var(--gold-500); border-radius: var(--r-md); }
.ed-section { display: flex; flex-direction: column; gap: 0.25rem; padding: 0.375rem; border-radius: var(--r-md); background: rgba(0, 0, 0, 0.18); }
.ed-sec-head { display: flex; gap: 0.25rem; flex-wrap: wrap; align-items: center; }
.ed-sec-head select { min-height: 2rem; padding-top: 0; padding-bottom: 0; }
.ed-sec-title { flex: 1; min-width: 8rem; }
.ed-example { display: flex; flex-direction: column; align-items: flex-start; text-align: left; gap: 0.125rem; padding: 0.5rem 0.75rem; }
.ed-example b { color: var(--gold-200); }
.ed-example small { color: var(--ink-muted); }
.ed-help summary, .ed-blocks summary { cursor: pointer; color: var(--gold-300); }
.ed-block-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr)); gap: 0.375rem; margin-top: 0.375rem; }
.ed-block { display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-start; text-align: left; gap: 0.125rem; padding: 0.4375rem 0.625rem; min-height: var(--touch, 2.75rem); }
.ed-block b { color: var(--gold-200); font-size: var(--fs-sm); }
.ed-block small { color: var(--ink-muted); font-size: var(--fs-xs); line-height: 1.3; font-weight: 400; }
.ed-menu-scrim { position: fixed; inset: 0; z-index: 20; }
.ed-code-menu { position: fixed; z-index: 21; width: 15rem; display: flex; flex-direction: column; gap: 0.25rem; padding: 0.5rem; }
.ed-code-menu-title { font-size: var(--fs-xs); color: var(--gold-300); padding: 0 0.25rem; }
.ed-code-menu button { display: flex; flex-direction: column; align-items: flex-start; gap: 0.125rem; text-align: left; min-height: var(--touch, 2.75rem); padding: 0.375rem 0.625rem; }
.ed-code-menu code { font-size: 0.75rem; color: var(--gold-100); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.ed-code-toast { position: absolute; z-index: 9; left: 50%; top: 4.5rem; transform: translateX(-50%); max-width: min(32rem, calc(100vw - 2rem)); margin: 0; padding: 0.375rem 0.75rem; border-radius: var(--r-md); background: rgba(20, 13, 8, 0.9); box-shadow: inset 0 0 0 1px var(--gold-500); color: var(--ink); font-size: var(--fs-sm); pointer-events: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ed-msg { position: sticky; bottom: 0; margin: 0.5rem 0 0; padding: 0.375rem 0.625rem; border-radius: var(--r-md); background: rgba(63, 125, 43, 0.4); font-size: var(--fs-sm); }
/* Preview output: the code panel's look (its styles load only with the game) */
.editor .sp-console { padding: 0.375rem 0.625rem; border-radius: var(--r-md); background: #0f0b08; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.8125rem; line-height: 1.5; }
.editor .sp-out { white-space: pre-wrap; word-break: break-word; color: #e6dbc3; }
.editor .sp-out.err { color: #ff9f8c; }
.editor .sp-hint { padding: 0.5rem 0.75rem; border-radius: var(--r-md); background: rgba(196, 140, 30, 0.2); box-shadow: inset 3px 0 0 #f0b43c; }
.editor .sp-hint b { color: #f5c46a; font-size: var(--fs-sm); }
.editor .sp-hint p { margin: 0.125rem 0 0; font-size: var(--fs-sm); line-height: 1.4; }
.editor .sp-hint-more { margin: 0; font-size: var(--fs-xs); color: #d9b46a; }
.ed-label { position: absolute; z-index: 4; transform: translate(-50%, -110%); pointer-events: none; padding: 0.125rem 0.4rem; border-radius: var(--r-sm); font-size: var(--fs-xs); font-weight: 700; white-space: nowrap; text-shadow: 0 1px 2px #000; }
.ed-label.start { background: rgba(77, 123, 192, 0.85); color: #fff; }
.ed-label.place { background: rgba(196, 141, 42, 0.85); color: #fff8e6; }
.ed-new { width: min(24rem, 100%); padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
.ed-new label { display: flex; flex-direction: column; gap: 0.25rem; }
.ed-side-fab { position: absolute; z-index: 6; right: calc(0.5rem + var(--safe-r)); bottom: calc(4.5rem + var(--safe-b)); display: inline-flex; gap: 0.375rem; align-items: center; min-height: var(--touch); background: var(--panel-bg); box-shadow: var(--panel-edge); }
/* Phone and small windows: tools as a bar at the bottom, panel as a sheet */
.editor.compact .ed-lbl { display: none; }
.editor.compact .ed-top { gap: 0.25rem; padding: 0.25rem; }
.editor.compact .ed-title { min-width: 0; width: 0; flex: 1; font-size: var(--fs-md); }
.editor.compact .ed-actions { gap: 0.2rem; }
.editor.compact .ed-actions > button, .editor.compact .ed-file-btn { min-height: 2.25rem; padding: 0 0.45rem; }
.editor.compact .ed-actions .icon-btn { min-width: 2.25rem; }
.editor.compact .ed-side-fab { bottom: calc(5.75rem + var(--safe-b)); }
.editor.compact .ed-tools { display: flex; top: auto; left: var(--safe-l); right: var(--safe-r); bottom: var(--safe-b); width: auto; flex-direction: row; max-height: none; overflow-x: auto; border-radius: var(--r-lg) var(--r-lg) 0 0; }
.editor.compact .ed-tools button.act.ed-tool { width: 3.75rem; }
.editor.compact .ed-brush { flex-direction: row; align-items: center; border-top: 0; border-left: 1px solid rgba(225, 168, 58, 0.2); padding: 0 0.375rem; min-width: 10rem; }
.editor.compact .ed-status { left: 0.5rem; bottom: calc(5.75rem + var(--safe-b)); font-size: var(--fs-xs); }
.editor.compact .ed-side { left: var(--safe-l); right: var(--safe-r); top: auto; bottom: 0; width: auto; height: min(70dvh, 36rem); border-radius: var(--r-lg) var(--r-lg) 0 0; z-index: 8; }
.editor.compact .ed-two { grid-template-columns: 1fr; }
</style>
