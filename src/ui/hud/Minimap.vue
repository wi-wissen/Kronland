<template>
  <!-- Minimap square like the map, rounded corners in the brass frame; north up -->
  <div v-tip="{ title: $t('minimap.title'), text: $t('minimap.hint') + ' – ' + (touch ? $t('minimap.tipTouch') : $t('minimap.tip')) }" class="minimap" data-testid="minimap">
    <div class="mm-frame">
      <canvas
        ref="cv"
        class="mm-canvas"
        data-testid="minimap-canvas"
        role="img"
        :aria-label="$t('minimap.title')"
        :data-order="orderAt"
        @pointerdown="down"
        @pointermove="move"
        @pointerup="up"
        @pointercancel="up"
        @contextmenu.prevent
      ></canvas>
      <i class="mm-north" aria-hidden="true">N</i>
    </div>
  </div>
</template>

<script>
import { playerColor } from '../plugin.js';
import { fitMap, toTile, MAP_CORNER } from './hudLayout.js';

/** Draw cadence: terrain rarely (cached in the engine), units and field of view about 4× per second. */
const DYN_MS = 250;
/** Duration of the target feedback after a move command. */
const PING_MS = 900;
const RES_DOT = { clay: '#e08a55', stone: '#d8d2c8', iron: '#9fb4c6', sulfur: '#f2dc3c' };

export default {
  name: 'Minimap',
  props: {
    /** Engine (markRaw) – only minimapTerrain()/minimapDynamic() are read, controlled via jumpTo() */
    engine: { type: Object, required: true },
    touch: Boolean,
  },
  data: () => ({ orderAt: null }),
  mounted() {
    this.terrainCanvas = document.createElement('canvas');
    this.fogCanvas = document.createElement('canvas');
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.$refs.cv);
    this.resize();
    const loop = (now) => {
      this.raf = requestAnimationFrame(loop);
      // draw smoothly during the target feedback
      const pinging = this.ping && now - this.ping.at < PING_MS;
      if (!pinging && now - (this.last ?? 0) < DYN_MS) return;
      this.last = now;
      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  },
  beforeUnmount() { cancelAnimationFrame(this.raf); this.ro?.disconnect(); },
  methods: {
    resize() {
      const cv = this.$refs.cv;
      if (!cv) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(cv.clientWidth * dpr)), h = Math.max(1, Math.round(cv.clientHeight * dpr));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; this.last = 0; }
    },
    terrain() {
      const t = this.engine.minimapTerrain();
      if (this.terrainKey !== t.key) {
        const c = this.terrainCanvas;
        c.width = t.w; c.height = t.h;
        c.getContext('2d').putImageData(new ImageData(t.data, t.w, t.h), 0, 0);
        this.terrainKey = t.key;
      }
      return t;
    },
    /** Fog layer (unexplored black, explored darkened) or null. */
    fog() {
      const f = this.engine.minimapFog?.();
      if (!f) return null;
      if (this.fogKey !== f.key) {
        const c = this.fogCanvas;
        if (c.width !== f.w || c.height !== f.h) { c.width = f.w; c.height = f.h; }
        c.getContext('2d').putImageData(new ImageData(f.data, f.w, f.h), 0, 0);
        this.fogKey = f.key;
      }
      return f;
    },
    draw() {
      const cv = this.$refs.cv;
      if (!cv || !this.engine?.sim) return;
      const ctx = cv.getContext('2d');
      const t = this.terrain();
      const d = this.engine.minimapDynamic();
      const W = cv.width, H = cv.height;
      this.map = fitMap(Math.min(W, H), d.w, d.h);
      const { s, ox, oy } = this.map;
      ctx.imageSmoothingEnabled = true;
      ctx.clearRect(0, 0, W, H);
      // Clip with rounded corners; area outside the map in sea or fog colour
      ctx.save();
      ctx.beginPath(); ctx.roundRect(0, 0, W, H, Math.min(W, H) * MAP_CORNER); ctx.clip();
      ctx.fillStyle = this.engine.minimapFog?.() ? '#0b0907' : '#1e3a52'; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(this.terrainCanvas, ox, oy, d.w * s, d.h * s);
      // Fog of war: smoothly enlarged (image smoothing) so the edges are not jagged
      if (this.fog()) ctx.drawImage(this.fogCanvas, ox, oy, d.w * s, d.h * s);
      // Shafts
      for (const sh of d.shafts) {
        ctx.fillStyle = RES_DOT[sh.res] ?? '#fff';
        ctx.strokeStyle = 'rgba(30,20,10,.8)';
        ctx.lineWidth = Math.max(1, s * 0.3);
        ctx.beginPath(); ctx.arc(ox + sh.x * s, oy + sh.y * s, Math.max(1.6, s * 1.1), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      // Buildings
      ctx.lineWidth = Math.max(1, s * 0.35);
      for (const b of d.buildings) {
        ctx.fillStyle = playerColor(b.owner);
        ctx.strokeStyle = 'rgba(20,12,6,.9)';
        // last seen enemy buildings in the fog: paler
        ctx.globalAlpha = b.ghost ? 0.55 : 1;
        const x = ox + b.x * s, y = oy + b.y * s, w = Math.max(2.5, b.w * s), h = Math.max(2.5, b.h * s);
        ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
      }
      ctx.globalAlpha = 1;
      // Units
      for (const u of d.units) {
        ctx.fillStyle = playerColor(u.owner);
        const r = Math.max(u.big ? 2.2 : 1.2, s * (u.big ? 0.9 : 0.5));
        ctx.beginPath(); ctx.arc(ox + u.x * s, oy + u.y * s, r, 0, Math.PI * 2); ctx.fill();
        if (u.big) { ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, s * 0.25); ctx.stroke(); }
      }
      // Campfire: orange embers with dark edge
      for (const c of d.camps ?? []) {
        ctx.fillStyle = '#ff9a2e'; ctx.strokeStyle = 'rgba(30,12,4,.9)'; ctx.lineWidth = Math.max(1, s * 0.3);
        ctx.beginPath(); ctx.arc(ox + c.x * s, oy + c.y * s, Math.max(2, s * 0.9), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      // Tutorial hint
      if (d.hint) {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
        ctx.strokeStyle = `rgba(255,207,74,${0.6 + 0.4 * pulse})`;
        ctx.lineWidth = Math.max(2, s * 0.6);
        ctx.beginPath(); ctx.arc(ox + d.hint.x * s, oy + d.hint.y * s, Math.max(5, s * (3 + 2 * pulse)), 0, Math.PI * 2); ctx.stroke();
      }
      // Target of the last move command
      const pingAge = this.ping ? performance.now() - this.ping.at : Infinity;
      if (pingAge < PING_MS) {
        const k = pingAge / PING_MS;
        ctx.strokeStyle = `rgba(255,244,207,${1 - k})`;
        ctx.lineWidth = Math.max(2, s * 0.6);
        ctx.beginPath(); ctx.arc(ox + this.ping.x * s, oy + this.ping.y * s, Math.max(3, s * (1.5 + 5 * k)), 0, Math.PI * 2); ctx.stroke();
      }
      // Camera field of view
      if (d.view) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(ox, oy, d.w * s, d.h * s);
        ctx.clip();
        ctx.beginPath();
        d.view.forEach((p, i) => { const x = ox + p.x * s, y = oy + p.y * s; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,240,200,.12)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(20,12,6,.7)'; ctx.lineWidth = Math.max(3, s * 1.1); ctx.stroke();
        ctx.strokeStyle = '#fff4cf'; ctx.lineWidth = Math.max(1.5, s * 0.55); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    },
    toTile(e) {
      const m = this.map;
      if (!m) return null;
      const r = this.$refs.cv.getBoundingClientRect();
      const dpr = this.$refs.cv.width / Math.max(1, r.width);
      return toTile(m, (e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr);
    },
    down(e) {
      // Right click, attack mode or tapping with selected figures: send them there
      const touch = e.pointerType === 'touch';
      if (e.button === 2 || (e.button === 0 && (this.engine.attackMode || (touch && this.engine.hasOrderable())))) {
        this.order(e);
        return;
      }
      if (e.button > 0) return;
      this.dragging = !touch;
      this.$refs.cv.setPointerCapture?.(e.pointerId);
      this.jump(e);
    },
    order(e) {
      const p = this.toTile(e);
      if (!p) return;
      const tx = Math.min(this.map.w - 1, Math.floor(p.x)), ty = Math.min(this.map.h - 1, Math.floor(p.y));
      const t = this.engine.commandTile(tx, ty, e.ctrlKey);
      if (!t) return;
      // short ring at the target spot as feedback
      this.ping = { x: t.x + 0.5, y: t.y + 0.5, at: performance.now() };
      this.orderAt = `${t.x},${t.y}`;
      this.last = 0;
    },
    move(e) { if (this.dragging) this.jump(e); },
    up() { this.dragging = false; },
    jump(e) {
      const p = this.toTile(e);
      if (!p) return;
      this.engine.jumpTo(p.x, p.y);
      this.last = 0;
    },
  },
};
</script>

<style>
.minimap { position: relative; border-radius: var(--r-lg); padding: 0.375rem; background: var(--brass); box-shadow: 0 0 0 2px var(--wood-950), 0 8px 18px rgba(0, 0, 0, 0.55); }
.mm-frame { position: relative; width: 100%; height: 100%; border-radius: calc(var(--r-lg) - 0.25rem); background: #0b0907; box-shadow: inset 0 0 0 2px var(--wood-950); }
.mm-canvas { display: block; width: 100%; height: 100%; border-radius: calc(var(--r-lg) - 0.25rem); cursor: crosshair; touch-action: none; }
.mm-north {
  position: absolute; top: -0.875rem; left: 50%; transform: translateX(-50%); width: 1.125rem; height: 1.125rem; border-radius: 50%;
  display: grid; place-items: center; font: 700 0.6875rem/1 var(--display); font-style: normal; color: var(--wood-950);
  background: var(--gold-300); box-shadow: 0 0 0 2px var(--wood-950); pointer-events: none;
}
</style>
