<template>
  <div class="minimap frame" data-testid="minimap">
    <div class="mm-frame">
      <canvas
        ref="cv"
        class="mm-canvas"
        data-testid="minimap-canvas"
        role="img"
        :aria-label="$t('minimap.title')"
        :title="touch ? $t('minimap.tipTouch') : $t('minimap.tip')"
        @pointerdown="down"
        @pointermove="move"
        @pointerup="up"
        @pointercancel="up"
        @contextmenu.prevent
      ></canvas>
    </div>
  </div>
</template>

<script>
import { playerColor } from '../plugin.js';

/** Draw cadence: terrain rarely (cached in the engine), units and field of view about 4× per second. */
const DYN_MS = 250;
const RES_DOT = { clay: '#e08a55', stone: '#d8d2c8', iron: '#9fb4c6', sulfur: '#f2dc3c' };

export default {
  name: 'Minimap',
  props: {
    /** Engine (markRaw) – only minimapTerrain()/minimapDynamic() are read, controlled via jumpTo() */
    engine: { type: Object, required: true },
    touch: Boolean,
  },
  mounted() {
    this.terrainCanvas = document.createElement('canvas');
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.$refs.cv);
    this.resize();
    const loop = (now) => {
      this.raf = requestAnimationFrame(loop);
      if (now - (this.last ?? 0) < DYN_MS) return;
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
    draw() {
      const cv = this.$refs.cv;
      if (!cv || !this.engine?.sim) return;
      const ctx = cv.getContext('2d');
      const t = this.terrain();
      const d = this.engine.minimapDynamic();
      const W = cv.width, H = cv.height;
      const s = Math.min(W / d.w, H / d.h);
      const ox = (W - d.w * s) / 2, oy = (H - d.h * s) / 2;
      this.map = { s, ox, oy, w: d.w, h: d.h };
      ctx.imageSmoothingEnabled = true;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(this.terrainCanvas, ox, oy, d.w * s, d.h * s);
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
        const x = ox + b.x * s, y = oy + b.y * s, w = Math.max(2.5, b.w * s), h = Math.max(2.5, b.h * s);
        ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
      }
      // Units
      for (const u of d.units) {
        ctx.fillStyle = playerColor(u.owner);
        const r = Math.max(u.big ? 2.2 : 1.2, s * (u.big ? 0.9 : 0.5));
        ctx.beginPath(); ctx.arc(ox + u.x * s, oy + u.y * s, r, 0, Math.PI * 2); ctx.fill();
        if (u.big) { ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, s * 0.25); ctx.stroke(); }
      }
      // Tutorial hint
      if (d.hint) {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
        ctx.strokeStyle = `rgba(255,207,74,${0.6 + 0.4 * pulse})`;
        ctx.lineWidth = Math.max(2, s * 0.6);
        ctx.beginPath(); ctx.arc(ox + d.hint.x * s, oy + d.hint.y * s, Math.max(5, s * (3 + 2 * pulse)), 0, Math.PI * 2); ctx.stroke();
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
    },
    toTile(e) {
      const m = this.map;
      if (!m) return null;
      const r = this.$refs.cv.getBoundingClientRect();
      const dpr = this.$refs.cv.width / Math.max(1, r.width);
      const x = ((e.clientX - r.left) * dpr - m.ox) / m.s, y = ((e.clientY - r.top) * dpr - m.oy) / m.s;
      return { x: Math.max(0, Math.min(m.w, x)), y: Math.max(0, Math.min(m.h, y)) };
    },
    down(e) {
      if (e.button > 0) return;
      this.dragging = e.pointerType !== 'touch';
      this.$refs.cv.setPointerCapture?.(e.pointerId);
      this.jump(e);
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
.minimap { padding: 0.4375rem; display: flex; }
.mm-frame { position: relative; flex: 1; border-radius: 0.5rem; overflow: hidden; background: #2b3a2a; box-shadow: inset 0 0 0 2px var(--wood-950), 0 0 0 1px rgba(225, 168, 58, 0.4); aspect-ratio: 1; }
.mm-canvas { display: block; width: 100%; height: 100%; cursor: crosshair; touch-action: none; }
</style>
